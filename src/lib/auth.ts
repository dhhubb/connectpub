import crypto from 'node:crypto';
import type { UserRole } from './util';

export const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7;

interface Session {
  userId: number;
  role: UserRole;
  expiresAt: number;
}

interface AuthGlobal {
  __plumtreeSessions?: Map<string, Session>;
}

// Cache on globalThis so a dev hot reload does not sign everyone out.
const g = globalThis as unknown as AuthGlobal;
const sessions: Map<string, Session> = g.__plumtreeSessions ?? (g.__plumtreeSessions = new Map());

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return `scrypt$${salt}$${derived}`;
}

export function verifyPassword(password: string, stored: unknown): boolean {
  if (typeof stored !== 'string') return false;
  const [scheme, salt, digest] = stored.split('$');
  if (scheme !== 'scrypt' || !salt || !digest) return false;
  const candidate = crypto.scryptSync(String(password), salt, 64);
  const expected = Buffer.from(digest, 'hex');
  if (candidate.length !== expected.length) return false;
  return crypto.timingSafeEqual(candidate, expected);
}

export function createSession(user: { id: number; role: UserRole }): string {
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, { userId: user.id, role: user.role, expiresAt: Date.now() + SESSION_TTL_MS });
  return token;
}

export function readToken(headers: Headers): string | null {
  const header = headers.get('authorization');
  if (header && header.startsWith('Bearer ')) return header.slice(7).trim();
  const alt = headers.get('x-auth-token');
  return alt ? String(alt) : null;
}

export function destroySession(token: string | null): void {
  if (token) sessions.delete(token);
}

export function pruneSessions(): void {
  const now = Date.now();
  for (const [token, session] of sessions) {
    if (session.expiresAt <= now) sessions.delete(token);
  }
}

/** Resolve a session token to a user id, dropping expired tokens. */
export function userIdFromToken(token: string | null): number | null {
  if (!token) return null;
  const session = sessions.get(token);
  if (!session) return null;
  if (session.expiresAt <= Date.now()) {
    sessions.delete(token);
    return null;
  }
  return session.userId;
}
