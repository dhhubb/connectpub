'use strict';

const crypto = require('node:crypto');

const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7;
const sessions = new Map();

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return `scrypt$${salt}$${derived}`;
}

function verifyPassword(password, stored) {
  if (typeof stored !== 'string') return false;
  const [scheme, salt, digest] = stored.split('$');
  if (scheme !== 'scrypt' || !salt || !digest) return false;
  const candidate = crypto.scryptSync(String(password), salt, 64);
  const expected = Buffer.from(digest, 'hex');
  if (candidate.length !== expected.length) return false;
  return crypto.timingSafeEqual(candidate, expected);
}

function createSession(user) {
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, { userId: user.id, role: user.role, expiresAt: Date.now() + SESSION_TTL_MS });
  return token;
}

function readToken(req) {
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) return header.slice(7).trim();
  if (req.headers['x-auth-token']) return String(req.headers['x-auth-token']);
  return null;
}

function destroySession(token) {
  if (token) sessions.delete(token);
}

function pruneSessions() {
  const now = Date.now();
  for (const [token, session] of sessions) {
    if (session.expiresAt <= now) sessions.delete(token);
  }
}

// Resolves req.user from a session token. Pass the user loader in to avoid a
// circular dependency between auth and db.
function attachUser(loadUser) {
  return (req, _res, next) => {
    const token = readToken(req);
    req.authToken = token;
    req.user = null;
    if (token) {
      const session = sessions.get(token);
      if (session && session.expiresAt > Date.now()) {
        const user = loadUser(session.userId);
        if (user && user.status === 'active') req.user = user;
        else sessions.delete(token);
      } else if (session) {
        sessions.delete(token);
      }
    }
    next();
  };
}

function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Authentication required' });
  next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Authentication required' });
    if (!roles.includes(req.user.role)) return res.status(403).json({ error: 'Insufficient permissions' });
    next();
  };
}

module.exports = {
  hashPassword,
  verifyPassword,
  createSession,
  destroySession,
  readToken,
  attachUser,
  requireAuth,
  requireRole,
  pruneSessions,
  SESSION_TTL_MS,
};
