import { db } from '@/lib/db';
import { hashPassword, createSession } from '@/lib/auth';
import { route } from '@/lib/http';
import { logAudit, pickEnum, publicUser, USER_ROLES } from '@/lib/util';

const SELF_REGISTER_ROLES = ['seeker', 'employer', 'provider'] as const;

function validateRegistration(body: any) {
  const errors: Record<string, string> = {};
  const name = String(body.name || '').trim();
  const email = String(body.email || '').trim().toLowerCase();
  const password = String(body.password || '');
  const role = pickEnum(body.role, SELF_REGISTER_ROLES, 'seeker')!;

  if (name.length < 2) errors.name = 'Please enter your full name';
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) errors.email = 'Please enter a valid email address';
  if (password.length < 8) errors.password = 'Password must be at least 8 characters';
  if (body.role && !USER_ROLES.includes(body.role)) errors.role = 'Unknown account type';
  if (body.role === 'admin') errors.role = 'Admin accounts cannot be self registered';

  return {
    errors,
    values: {
      name, email, password, role,
      phone: String(body.phone || '').trim(),
      ward: String(body.ward || '').trim(),
      bio: String(body.bio || '').trim(),
    },
  };
}

export const POST = route(async (ctx) => {
  const { errors, values } = validateRegistration(ctx.body || {});
  if (Object.keys(errors).length) return { status: 400, body: { error: 'Validation failed', errors } };

  const existing = db.prepare('SELECT id FROM users WHERE lower(email) = lower(?)').get(values.email);
  if (existing) {
    return { status: 409, body: { error: 'An account with that email already exists', errors: { email: 'Email already registered' } } };
  }

  const info = db.prepare(
    `INSERT INTO users (name, email, phone, password_hash, role, status, ward, bio)
     VALUES (?, ?, ?, ?, ?, 'active', ?, ?)`,
  ).run(values.name, values.email, values.phone || null, hashPassword(values.password), values.role, values.ward || null, values.bio || null);

  const id = Number(info.lastInsertRowid);
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as any;
  const token = createSession(user);
  logAudit(db, user.id, 'register', 'user', user.id, { role: user.role });
  return { status: 201, body: { token, user: publicUser(user) } };
});
