const fs = require('fs');
const { spawn } = require('child_process');
const Repository = require('../models/Repository');
const { bareRepoPath } = require('../utils/repoPath');
const { gitBinary } = require('../utils/git');

// This controller implements git's "Smart HTTP" transport, the same
// protocol GitHub/GitLab use. It works by shelling out to the real `git`
// binary's plumbing commands (`git upload-pack` for fetch/clone, and
// `git receive-pack` for push) in --stateless-rpc mode, and piping the
// request/response bodies straight through. This is the standard,
// well-documented way to build a minimal git server.
//
// Docs: https://git-scm.com/docs/http-protocol

function pktLine(str) {
  const len = (str.length + 4).toString(16).padStart(4, '0');
  return len + str;
}

async function resolveRepo(owner, repoParam) {
  const name = repoParam.replace(/\.git$/, '');
  const ownerUsername = owner.toLowerCase();
  const repoPath = bareRepoPath(ownerUsername, name);
  const repository = await Repository.findByOwnerAndName(ownerUsername, name);
  return { repoPath, repository };
}

// GET /:owner/:repo.git/info/refs?service=git-upload-pack|git-receive-pack
// The first request any git client makes. Advertises available refs/capabilities.
exports.infoRefs = async (req, res, next) => {
  try {
    const { owner, repo } = req.params;
    const service = req.query.service;

    if (!service || !['git-upload-pack', 'git-receive-pack'].includes(service)) {
      return res.status(400).send('Invalid or missing "service" parameter');
    }

    const { repoPath, repository } = await resolveRepo(owner, repo);
    if (!repository || !fs.existsSync(repoPath)) {
      return res.status(404).send('Repository not found');
    }
    if (repository.is_private && !req.gitUser) {
      res.setHeader('WWW-Authenticate', 'Basic realm="Git"');
      return res.status(401).send('Authentication required for private repository');
    }
    if (service === 'git-receive-pack' && (!req.gitUser || req.gitUser.username !== owner.toLowerCase())) {
      return res.status(403).send('You do not have push access to this repository');
    }

    const cmd = service.replace('git-', ''); // "upload-pack" | "receive-pack"
    const child = spawn(gitBinary, [cmd, '--stateless-rpc', '--advertise-refs', repoPath]);

    res.setHeader('Content-Type', `application/x-${service}-advertisement`);
    res.setHeader('Cache-Control', 'no-cache');
    res.write(pktLine(`# service=${service}\n`));
    res.write('0000');

    child.stdout.pipe(res);
    child.stderr.on('data', (chunk) => console.error(`[git ${cmd}]`, chunk.toString()));
    child.on('error', (err) => {
      console.error('git spawn error:', err.message);
      if (!res.headersSent) res.status(500).end();
    });
  } catch (err) {
    next(err);
  }
};

// POST /:owner/:repo.git/git-upload-pack  (fetch / clone / pull)
exports.uploadPack = async (req, res, next) => {
  try {
    const { owner, repo } = req.params;
    const { repoPath, repository } = await resolveRepo(owner, repo);
    if (!repository || !fs.existsSync(repoPath)) {
      return res.status(404).send('Repository not found');
    }
    if (repository.is_private && !req.gitUser) {
      res.setHeader('WWW-Authenticate', 'Basic realm="Git"');
      return res.status(401).send('Authentication required for private repository');
    }

    res.setHeader('Content-Type', 'application/x-git-upload-pack-result');
    const child = spawn(gitBinary, ['upload-pack', '--stateless-rpc', repoPath]);
    req.pipe(child.stdin);
    child.stdout.pipe(res);
    child.stderr.on('data', (chunk) => console.error('[git upload-pack]', chunk.toString()));
    child.on('error', (err) => {
      console.error('upload-pack spawn error:', err.message);
      if (!res.headersSent) res.status(500).end();
    });
  } catch (err) {
    next(err);
  }
};

// POST /:owner/:repo.git/git-receive-pack  (push)
exports.receivePack = async (req, res, next) => {
  try {
    const { owner, repo } = req.params;
    const { repoPath, repository } = await resolveRepo(owner, repo);
    if (!repository || !fs.existsSync(repoPath)) {
      return res.status(404).send('Repository not found');
    }
    // requireGitAuth already ran, but double check the pusher owns this repo.
    if (!req.gitUser || req.gitUser.username !== owner.toLowerCase()) {
      return res.status(403).send('You do not have push access to this repository');
    }

    res.setHeader('Content-Type', 'application/x-git-receive-pack-result');
    const child = spawn(gitBinary, ['receive-pack', '--stateless-rpc', repoPath]);
    req.pipe(child.stdin);
    child.stdout.pipe(res);
    child.stderr.on('data', (chunk) => console.error('[git receive-pack]', chunk.toString()));
    child.on('error', (err) => {
      console.error('receive-pack spawn error:', err.message);
      if (!res.headersSent) res.status(500).end();
    });
  } catch (err) {
    next(err);
  }
};
