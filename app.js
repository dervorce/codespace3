const express = require('express');
const morgan = require('morgan');
const cors = require('cors');
const path = require('path');

const authRoutes = require('./routes/authRoutes');
const repoRoutes = require('./routes/repoRoutes');
const gitRoutes = require('./routes/gitRoutes');
const spaceRoutes = require('./routes/spaceRoutes');
const errorHandler = require('./middleware/errorHandler');

const app = express();

app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(cors());

// IMPORTANT: git routes are mounted before express.json(). The git
// smart-HTTP endpoints stream raw pack data in the request body — if
// express.json() ran first it would try to parse that binary data as JSON
// and break the protocol.
app.use('/', gitRoutes);

app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/repos', repoRoutes);
// Kept as /spaces for the existing UI; each space is a repository.
app.use('/api/spaces', spaceRoutes);

app.use(express.static(path.join(__dirname, 'public')));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.use((req, res) => res.status(404).json({ error: 'Not found' }));
app.use(errorHandler);

module.exports = app;
