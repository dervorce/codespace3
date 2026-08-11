const path = require('path');

const REPO_ROOT = process.env.REPO_STORAGE_PATH
  ? path.resolve(process.env.REPO_STORAGE_PATH)
  : path.join(__dirname, '..', 'data', 'repos');

/**
 * Resolves the on-disk path of a bare repository for a given owner/name,
 * e.g. bareRepoPath('alice', 'my-project') -> <REPO_ROOT>/alice/my-project.git
 */
function bareRepoPath(ownerUsername, repoName) {
  const safeOwner = String(ownerUsername).toLowerCase().replace(/[^a-z0-9-]/g, '');
  const safeRepo = String(repoName).replace(/\.git$/, '').replace(/[^a-zA-Z0-9._-]/g, '');
  return path.join(REPO_ROOT, safeOwner, `${safeRepo}.git`);
}

module.exports = { REPO_ROOT, bareRepoPath };
