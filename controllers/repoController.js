const fs = require('fs');
const { execFile } = require('child_process');
const simpleGit = require('simple-git');
const Repository = require('../models/Repository');
const { bareRepoPath } = require('../utils/repoPath');
const { gitBinary } = require('../utils/git');

function initBareRepo(repoPath) {
  return new Promise((resolve, reject) => {
    fs.mkdirSync(repoPath, { recursive: true });
    execFile(gitBinary, ['init', '--bare', '--initial-branch=main', repoPath], (err) => {
      if (err) return reject(err);
      resolve();
    });
  });
}

exports.createRepo = async (req, res, next) => {
  try {
    const { name, description = '', isPrivate = false } = req.body;
    if (!name || !/^[a-zA-Z0-9._-]+$/.test(name)) {
      return res.status(400).json({ error: 'Repository name must be alphanumeric (., _, - allowed)' });
    }

    const ownerUsername = req.user.username;
    const repoPath = bareRepoPath(ownerUsername, name);

    const existing = await Repository.findByOwnerAndName(ownerUsername, name);
    if (existing || fs.existsSync(repoPath)) {
      return res.status(409).json({ error: 'Repository already exists' });
    }

    await initBareRepo(repoPath);

    const repo = await Repository.create({
      name,
      ownerId: req.user.id,
      ownerUsername,
      description,
      isPrivate: Boolean(isPrivate),
    });

    const supabase = require('../config/supabaseClient');
    const { error: memberError } = await supabase
      .from('repository_members')
      .insert({ repository_id: repo.id, user_id: req.user.id, role: 'owner' });
    if (memberError) throw memberError;

    res.status(201).json({
      repo,
      cloneUrl: `${req.protocol}://${req.get('host')}/${ownerUsername}/${name}.git`,
    });
  } catch (err) {
    next(err);
  }
};

exports.listRepos = async (req, res, next) => {
  try {
    const repos = await Repository.listByOwner(req.user.username);
    res.json(repos);
  } catch (err) {
    next(err);
  }
};

exports.getRepo = async (req, res, next) => {
  try {
    const { owner, repo } = req.params;
    const repository = await Repository.findByOwnerAndName(owner, repo);
    if (!repository) return res.status(404).json({ error: 'Repository not found' });
    res.json(repository);
  } catch (err) {
    next(err);
  }
};

exports.deleteRepo = async (req, res, next) => {
  try {
    const { owner, repo } = req.params;
    if (owner.toLowerCase() !== req.user.username) {
      return res.status(403).json({ error: 'Not authorized to delete this repository' });
    }

    const repository = await Repository.remove(owner, repo);
    if (!repository) return res.status(404).json({ error: 'Repository not found' });

    fs.rmSync(bareRepoPath(owner, repo), { recursive: true, force: true });
    res.json({ message: 'Repository deleted' });
  } catch (err) {
    next(err);
  }
};

exports.listBranches = async (req, res, next) => {
  try {
    const { owner, repo } = req.params;
    const repoPath = bareRepoPath(owner, repo);
    if (!fs.existsSync(repoPath)) return res.status(404).json({ error: 'Repository not found' });

    const branches = await simpleGit(repoPath, { binary: gitBinary }).branch(['-a']);
    res.json(branches);
  } catch (err) {
    next(err);
  }
};

exports.listTree = async (req, res, next) => {
  try {
    const { owner, repo } = req.params;
    const ref = req.query.ref || 'main';
    const repoPath = bareRepoPath(owner, repo);
    if (!fs.existsSync(repoPath)) return res.status(404).json({ error: 'Repository not found' });

    const raw = await simpleGit(repoPath, { binary: gitBinary }).raw(['ls-tree', '-r', '--name-only', ref]);
    const files = raw.split('\n').filter(Boolean);
    res.json({ ref, files });
  } catch (err) {
    // Most likely cause: the ref doesn't exist yet (empty repo, no pushes).
    res.status(404).json({ error: `Could not read tree at ref "${req.query.ref || 'main'}"` });
  }
};

exports.getFileContent = async (req, res, next) => {
  try {
    const { owner, repo } = req.params;
    const ref = req.query.ref || 'main';
    const filePath = req.params[0]; // wildcard portion of the route
    const repoPath = bareRepoPath(owner, repo);
    if (!fs.existsSync(repoPath)) return res.status(404).json({ error: 'Repository not found' });

    const content = await simpleGit(repoPath, { binary: gitBinary }).show([`${ref}:${filePath}`]);
    res.type('text/plain').send(content);
  } catch (err) {
    res.status(404).json({ error: 'File not found at that ref' });
  }
};
