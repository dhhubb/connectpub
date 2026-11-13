'use strict';

const express = require('express');
const { db } = require('../db');
const {
  hashPassword, verifyPassword, createSession, destroySession, requireAuth,
} = require('../auth');
const { asyncHandler, httpError, logAudit, publicUser, pickEnum, USER_ROLES } = require('../util');

const router = express.Router();
const SELF_REGISTER_ROLES = ['seeker', 'employer', 'provider'];

const findByEmail = (email) => db.prepare('SELECT * FROM users WHERE lower(email) = lower(?)').get(String(email || '').trim());

function validateRegistration(body) {
  const errors = {};
  const name = String(body.name || '').trim();
  const email = String(body.email || '').trim().toLowerCase();
  const password = String(body.password || '');
  const role = pickEnum(body.role, SELF_REGISTER_ROLES, 'seeker');

  if (name.length < 2) errors.name = 'Please enter your full name';
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) errors.email = 'Please enter a valid email address';
  if (password.length < 8) errors.password = 'Password must be at least 8 characters';
  if (body.role && !USER_ROLES.includes(body.role)) errors.role = 'Unknown account type';
  if (body.role === 'admin') errors.role = 'Admin accounts cannot be self registered';
  return { errors, values: { name, email, password, role, phone: String(body.phone || '').trim(), ward: String(body.ward || '').trim(), bio: String(body.bio || '').trim() } };
}

router.post('/register', asyncHandler((req, res) => {
  const { errors, values } = validateRegistration(req.body || {});
  if (Object.keys(errors).length) return res.status(400).json({ error: 'Validation failed', errors });
  if (findByEmail(values.email)) return res.status(409).json({ error: 'An account with that email already exists', errors: { email: 'Email already registered' } });

  const info = db.prepare(
    `INSERT INTO users (name, email, phone, password_hash, role, status, ward, bio)
     VALUES (?, ?, ?, ?, ?, 'active', ?, ?)`
  ).run(values.name, values.email, values.phone || null, hashPassword(values.password), values.role, values.ward || null, values.bio || null);

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(Number(info.lastInsertRowid));
  const token = createSession(user);
  logAudit(user.id, 'register', 'user', user.id, { role: user.role });
  res.status(201).json({ token, user: publicUser(user) });
}));

router.post('/login', asyncHandler((req, res) => {
  const email = String((req.body || {}).email || '').trim();
  const password = String((req.body || {}).password || '');
  const user = findByEmail(email);
  if (!user || !verifyPassword(password, user.password_hash)) {
    return res.status(401).json({ error: 'Incorrect email or password' });
  }
  if (user.status !== 'active') {
    return res.status(403).json({ error: 'This account has been suspended. Please contact the administrator.' });
  }
  db.prepare("UPDATE users SET last_login_at = datetime('now') WHERE id = ?").run(user.id);
  const fresh = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
  const token = createSession(fresh);
  logAudit(fresh.id, 'login', 'user', fresh.id, null);
  res.json({ token, user: publicUser(fresh) });
}));

router.post('/logout', asyncHandler((req, res) => {
  destroySession(req.authToken);
  res.json({ ok: true });
}));

router.get('/me', requireAuth, asyncHandler((req, res) => {
  res.json({ user: publicUser(req.user) });
}));

router.patch('/me', requireAuth, asyncHandler((req, res) => {
  const body = req.body || {};
  const name = String(body.name ?? req.user.name).trim();
  const phone = String(body.phone ?? req.user.phone ?? '').trim();
  const ward = String(body.ward ?? req.user.ward ?? '').trim();
  const bio = String(body.bio ?? req.user.bio ?? '').trim();
  if (name.length < 2) return res.status(400).json({ error: 'Validation failed', errors: { name: 'Please enter your full name' } });

  db.prepare('UPDATE users SET name = ?, phone = ?, ward = ?, bio = ? WHERE id = ?')
    .run(name, phone || null, ward || null, bio || null, req.user.id);
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  res.json({ user: publicUser(user) });
}));

router.post('/change-password', requireAuth, asyncHandler((req, res) => {
  const current = String((req.body || {}).currentPassword || '');
  const next = String((req.body || {}).newPassword || '');
  if (next.length < 8) return res.status(400).json({ error: 'Validation failed', errors: { newPassword: 'Password must be at least 8 characters' } });
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!verifyPassword(current, user.password_hash)) {
    return res.status(400).json({ error: 'Validation failed', errors: { currentPassword: 'Current password is incorrect' } });
  }
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(next), req.user.id);
  logAudit(req.user.id, 'change_password', 'user', req.user.id, null);
  res.json({ ok: true });
}));

module.exports = router;
