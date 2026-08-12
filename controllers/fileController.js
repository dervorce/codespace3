const fs = require('fs');
const path = require('path');
const os = require('os');
const { promisify } = require('util');
const { execFile } = require('child_process');
const execFileAsync = promisify(execFile);
const Repository = require('../models/Repository');
const Member = require('../models/RepositoryMember');
const Upload = require('../models/RepositoryUpload');
const { bareRepoPath } = require('../utils/repoPath');
const { detectLanguage } = require('../utils/language');
const { gitBinary } = require('../utils/git');

function safePath(value) { return String(value).split('/').filter((part) => part && part !== '.' && part !== '..').join('/'); }
async function git(args, options = {}) { return execFileAsync(gitBinary, args, options); }

async function loadRepositoryForMember(req) {
  const repo = await Repository.findById(req.params.id);
  if (!repo) return null;
  const member = await Member.find(repo.id, req.user.id);
  return member ? { repo, member } : null;
}

async function uploadFiles(req, res, next) {
  let workDir;
  try {
    const access = await loadRepositoryForMember(req);
    if (!access) return res.status(403).json({ error: 'You are not a repository member.' });
    if (access.member.role === 'viewer') return res.status(403).json({ error: 'Viewers cannot upload files.' });
    const files = req.files || [];
    if (!files.length) return res.status(400).json({ error: 'No files were uploaded.' });
    const paths = JSON.parse(req.body.pathsJson || '[]');
    const repoPath = bareRepoPath(access.repo.owner_username, access.repo.name);
    workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'codespace3-upload-'));
    await git(['clone', repoPath, workDir]);
    const entries = [];
    for (let index = 0; index < files.length; index += 1) {
      const relativePath = safePath(paths[index] || files[index].originalname);
      if (!relativePath) continue;
      const target = path.resolve(workDir, relativePath);
      if (!target.startsWith(workDir + path.sep)) continue;
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, files[index].buffer);
      entries.push({ relativePath, language: detectLanguage(relativePath), size: files[index].size });
    }
    if (!entries.length) return res.status(400).json({ error: 'No valid file paths were uploaded.' });
    await git(['-C', workDir, 'add', '--all']);
    const notes = String(req.body.notes || '').trim().slice(0, 2000);
    await git(['-C', workDir, '-c', `user.name=${req.user.username}`, '-c', `user.email=${req.user.username}@codespace.local`, 'commit', '-m', notes || `Upload ${entries.length} file(s)`]);
    const { stdout } = await git(['-C', workDir, 'rev-parse', 'HEAD']);
    const commitHash = stdout.trim();
    await git(['-C', workDir, 'push', 'origin', 'HEAD:main']);
    await Upload.createMany(entries.map((entry) => ({ repository_id: access.repo.id, uploader_id: req.user.id, relative_path: entry.relativePath, language: entry.language, size: entry.size, notes, commit_hash: commitHash })));
    res.status(201).json({ uploaded: entries.length, commitHash });
  } catch (error) { next(error); }
  finally { if (workDir) fs.rmSync(workDir, { recursive: true, force: true }); }
}

async function listFiles(req, res, next) {
  try {
    const access = await loadRepositoryForMember(req);
    if (!access) return res.status(403).json({ error: 'You are not a repository member.' });
    const entries = await Upload.list(access.repo.id);
    res.json({ files: entries.map((entry) => ({ id: entry.id, name: entry.relative_path, language: entry.language, size: entry.size, uploadedAt: entry.created_at, uploadedBy: entry.users?.username || 'unknown', notes: entry.notes || '' })) });
  } catch (error) { next(error); }
}

async function getFileContent(req, res, next) {
  try {
    const access = await loadRepositoryForMember(req);
    if (!access) return res.status(403).json({ error: 'You are not a repository member.' });
    const entry = await Upload.find(req.params.fileId, access.repo.id);
    if (!entry) return res.status(404).json({ error: 'File entry not found.' });
    const repoPath = bareRepoPath(access.repo.owner_username, access.repo.name);
    const { stdout } = await git(['--git-dir', repoPath, 'show', `${entry.commit_hash}:${entry.relative_path}`]);
    res.json({ file: { name: entry.relative_path, language: entry.language, uploadedAt: entry.created_at, uploadedBy: entry.users?.username || 'unknown', notes: entry.notes || '', content: stdout } });
  } catch (error) { next(error); }
}

module.exports = { uploadFiles, listFiles, getFileContent };
