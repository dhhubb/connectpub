'use strict';

const path = require('node:path');
const express = require('express');

const { db, DB_PATH } = require('./db');
const { seed } = require('./seed');
const { attachUser, pruneSessions } = require('./auth');
const { publicUser } = require('./util');

const authRoutes = require('./routes/auth');
const metaRoutes = require('./routes/meta');
const jobsModule = require('./routes/jobs');
const providersModule = require('./routes/providers');
const dashboardModule = require('./routes/dashboard');
const adminRoutes = require('./routes/admin');

const app = express();
const PORT = Number(process.env.PORT || 3000);
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

app.disable('x-powered-by');
app.use(express.json({ limit: '256kb' }));
app.use(express.urlencoded({ extended: false }));

const loadUser = (id) => {
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  return row ? publicUser(row) : null;
};
app.use(attachUser(loadUser));

app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'plumtree-connect', database: path.basename(DB_PATH), time: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api/meta', metaRoutes);
app.use('/api/jobs', jobsModule.router);
app.use('/api/providers', providersModule.router);
app.use('/api/dashboard', dashboardModule.router);
app.use('/api/admin', adminRoutes);

app.use('/api', (_req, res) => res.status(404).json({ error: 'Endpoint not found' }));

app.use(express.static(PUBLIC_DIR, { extensions: ['html'] }));

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  const file = path.join(PUBLIC_DIR, '404.html');
  res.status(404).sendFile(file, (err) => { if (err) res.status(404).send('Not found'); });
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, _next) => {
  const status = err.status && Number.isInteger(err.status) ? err.status : 500;
  if (status >= 500) console.error('[error]', err);
  res.status(status).json({ error: status >= 500 ? 'Something went wrong on the server' : err.message });
});

function start() {
  const result = seed({ force: false });
  if (result.seeded) {
    console.log('[seed] database initialised with sample data', JSON.stringify(result.counts));
  }
  setInterval(pruneSessions, 1000 * 60 * 30).unref();
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Plumtree Connect running at http://0.0.0.0:${PORT}`);
    console.log(`Database: ${DB_PATH}`);
  });
}

if (require.main === module) start();

module.exports = { app, start };
