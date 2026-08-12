const bcrypt = require('bcryptjs');
const Repository = require('../models/Repository');
const User = require('../models/User');
const Member = require('../models/RepositoryMember');
const { bareRepoPath } = require('../utils/repoPath');
const { gitBinary } = require('../utils/git');
const fs = require('fs');
const { execFile } = require('child_process');

function initBareRepo(repoPath) {
  return new Promise((resolve, reject) => {
    fs.mkdirSync(repoPath, { recursive: true });
    execFile(gitBinary, ['init', '--bare', '--initial-branch=main', repoPath], (error) => error ? reject(error) : resolve());
  });
}

async function createSpace(req, res, next) {
  try {
    const { name, password, description = '', isPrivate = true } = req.body;
    if (!name || !/^[a-zA-Z0-9._-]+$/.test(name)) return res.status(400).json({ error: 'Repository name may contain letters, numbers, dots, underscores, and hyphens.' });
    if (!password || password.length < 4) return res.status(400).json({ error: 'Repository password must be at least 4 characters.' });
    const existing = await Repository.findByOwnerAndName(req.user.username, name);
    const repoPath = bareRepoPath(req.user.username, name);
    if (existing || fs.existsSync(repoPath)) return res.status(409).json({ error: 'Repository already exists.' });
    await initBareRepo(repoPath);
    const repo = await Repository.create({ name, ownerId: req.user.id, ownerUsername: req.user.username, description, isPrivate: Boolean(isPrivate) });
    const supabase = require('../config/supabaseClient');
    const { error } = await supabase.from('repositories').update({ access_password_hash: await bcrypt.hash(password, 10) }).eq('id', repo.id);
    if (error) throw error;
    await Member.add(repo.id, req.user.id, 'owner');
    res.status(201).json({ space: { id: repo.id, name: repo.name } });
  } catch (error) { next(error); }
}

async function mySpaces(req, res, next) {
  try {
    const memberships = await Member.listForUser(req.user.id);
    const spaces = memberships.map(({ role, joined_at, repositories: repo }) => ({
      id: repo.id, name: repo.name, description: repo.description, isOwner: role === 'owner', role,
      memberCount: undefined, createdAt: repo.created_at, joinedAt: joined_at,
    }));
    res.json({ spaces });
  } catch (error) { next(error); }
}

async function joinSpace(req, res, next) {
  try {
    const { owner, name, password } = req.body;
    if (!owner || !name || !password) return res.status(400).json({ error: 'Owner, repository name, and password are required.' });
    const repo = await Repository.findByOwnerAndName(owner, name);
    if (!repo) return res.status(404).json({ error: 'Repository not found.' });
    if (!(await bcrypt.compare(password, repo.access_password_hash || ''))) return res.status(401).json({ error: 'Incorrect repository password.' });
    await Member.add(repo.id, req.user.id, 'editor');
    res.json({ space: { id: repo.id, name: repo.name } });
  } catch (error) { next(error); }
}

async function getSpace(req, res, next) {
  try {
    const repo = await Repository.findById(req.params.id);
    if (!repo) return res.status(404).json({ error: 'Repository not found.' });
    const membership = await Member.find(repo.id, req.user.id);
    if (!membership) return res.status(403).json({ error: 'You are not a repository member.' });
    const members = await Member.listMembers(repo.id);
    res.json({ space: { id: repo.id, name: repo.name, owner: repo.owner_id, ownerUsername: repo.owner_username, role: membership.role,
      members: members.map(({ role, joined_at, users }) => ({ id: users.id, username: users.username, email: users.email, role, joinedAt: joined_at })) } });
  } catch (error) { next(error); }
}

module.exports = { createSpace, mySpaces, joinSpace, getSpace };
