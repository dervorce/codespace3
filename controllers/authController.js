const jwt = require('jsonwebtoken');
const User = require('../models/User');

function signToken(user) {
  return jwt.sign({ id: user.id, username: user.username }, process.env.JWT_SECRET, {
    expiresIn: '7d',
  });
}

exports.register = async (req, res, next) => {
  try {
    const { username, email, password } = req.body;
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'username, email, and password are required' });
    }
    if (!/^[a-zA-Z0-9-]+$/.test(username)) {
      return res.status(400).json({ error: 'username may only contain letters, numbers, and hyphens' });
    }

    const existing = await User.findByUsernameOrEmail(username, email);
    if (existing) {
      return res.status(409).json({ error: 'Username or email already taken' });
    }

    const user = await User.create({ username, email, password });
    const token = signToken(user);
    res.status(201).json({
      token,
      user: { id: user.id, username: user.username, email: user.email },
    });
  } catch (err) {
    next(err);
  }
};

exports.login = async (req, res, next) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'username and password are required' });
    }

    const user = await User.findByUsername(username);
    if (!user || !(await User.comparePassword(user, password))) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const token = signToken(user);
    res.json({
      token,
      user: { id: user.id, username: user.username, email: user.email },
    });
  } catch (err) {
    next(err);
  }
};
