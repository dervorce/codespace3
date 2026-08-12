const fs = require('fs');

const configuredBinary = process.env.GIT_BINARY;
const gitBinary = configuredBinary && fs.existsSync(configuredBinary)
  ? configuredBinary
  : ['/usr/bin/git', '/usr/local/bin/git'].find((candidate) => fs.existsSync(candidate)) || 'git';

module.exports = { gitBinary };
