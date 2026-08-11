const express = require('express');
const router = express.Router();
const gitController = require('../controllers/gitController');
const { optionalGitAuth, requireGitAuth } = require('../middleware/gitAuth');

// These three routes are what `git clone`, `git fetch`, `git pull`, and
// `git push` actually talk to over HTTP. Auth is optional on the read paths
// (so public repos work without credentials) and required on push.
router.get('/:owner/:repo.git/info/refs', optionalGitAuth, gitController.infoRefs);
router.post('/:owner/:repo.git/git-upload-pack', optionalGitAuth, gitController.uploadPack);
router.post('/:owner/:repo.git/git-receive-pack', requireGitAuth, gitController.receivePack);

module.exports = router;
