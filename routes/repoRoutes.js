const express = require('express');
const router = express.Router();
const repoController = require('../controllers/repoController');
const jwtAuth = require('../middleware/jwtAuth');

router.post('/', jwtAuth, repoController.createRepo);
router.get('/', jwtAuth, repoController.listRepos);

router.get('/:owner/:repo', repoController.getRepo);
router.delete('/:owner/:repo', jwtAuth, repoController.deleteRepo);

router.get('/:owner/:repo/branches', repoController.listBranches);
router.get('/:owner/:repo/tree', repoController.listTree);
router.get('/:owner/:repo/blob/*', repoController.getFileContent);

module.exports = router;
