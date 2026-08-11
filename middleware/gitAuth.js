const User = require('../models/User');

// Git over HTTP authenticates with a standard "Authorization: Basic <base64>"
// header, the same way git CLI does when it prompts for a username/password
// on `git push`/`git clone` against an HTTP(S) remote.
async function parseBasicAuth(req) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Basic ')) return null;

  const decoded = Buffer.from(header.slice(6), 'base64').toString('utf8');
  const sepIndex = decoded.indexOf(':');
  if (sepIndex === -1) return null;

  const username = decoded.slice(0, sepIndex).toLowerCase();
  const password = decoded.slice(sepIndex + 1);

  const user = await User.findByUsername(username);
  if (!user) return null;

  const ok = await User.comparePassword(user, password);
  return ok ? user : null;
}

// Use on routes that work for both public and private repos (e.g. fetch/clone).
// Sets req.gitUser if valid credentials were supplied, but never blocks the request.
exports.optionalGitAuth = async (req, res, next) => {
  try {
    req.gitUser = await parseBasicAuth(req);
  } catch (err) {
    req.gitUser = null;
  }
  next();
};

// Use on routes that always require a known identity (e.g. push).
exports.requireGitAuth = async (req, res, next) => {
  let user = null;
  try {
    user = await parseBasicAuth(req);
  } catch (err) {
    user = null;
  }
  if (!user) {
    res.setHeader('WWW-Authenticate', 'Basic realm="Git"');
    return res.status(401).send('Authentication required');
  }
  req.gitUser = user;
  next();
};
