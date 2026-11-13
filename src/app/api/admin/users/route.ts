import { db } from '@/lib/db';
import { route, requireRole } from '@/lib/http';
import { hashPassword } from '@/lib/auth';
import { pageParams, pickEnum, publicUser, logAudit, USER_ROLES, type Row } from '@/lib/util';

export const GET = route(async (ctx) => {
  requireRole(ctx, 'admin');
  const { page, perPage, offset } = pageParams(Object.fromEntries(ctx.query));
  const where: string[] = [];
  const params: any[] = [];
  const role = pickEnum(ctx.query.get('role'), USER_ROLES, null);
  if (role) { where.push('role = ?'); params.push(role); }
  const status = pickEnum(ctx.query.get('status'), ['active', 'suspended'] as const, null);
  if (status) { where.push('status = ?'); params.push(status); }
  const q = String(ctx.query.get('q') || '').trim();
  if (q) { where.push('(name LIKE ? OR email LIKE ? OR phone LIKE ?)'); params.push(`%${q}%`, `%${q}%`, `%${q}%`); }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const total = (db.prepare(`SELECT COUNT(*) AS n FROM users ${whereSql}`).get(...params) as { n: number }).n;
  const rows = db.prepare(`
    SELECT u.*,
      (SELECT COUNT(*) FROM jobs j WHERE j.employer_id = u.id) AS job_count,
      (SELECT COUNT(*) FROM providers p WHERE p.owner_id = u.id) AS provider_count,
      (SELECT COUNT(*) FROM applications a WHERE a.applicant_id = u.id) AS application_count
    FROM users u ${whereSql} ORDER BY u.created_at DESC LIMIT ? OFFSET ?`).all(...params, perPage, offset) as Row[];

  return {
    body: {
      users: rows.map((r) => ({ ...publicUser(r), jobCount: r.job_count, providerCount: r.provider_count, applicationCount: r.application_count })),
      pagination: { page, perPage, total, pages: Math.max(1, Math.ceil(total / perPage)) },
    },
  };
});

export const POST = route(async (ctx) => {
  const actor = requireRole(ctx, 'admin');
  const body = ctx.body || {};
  const name = String(body.name || '').trim();
  const email = String(body.email || '').trim().toLowerCase();
  const password = String(body.password || '');
  const role = pickEnum(body.role, USER_ROLES, 'seeker');
  const errors: Record<string, string> = {};
  if (name.length < 2) errors.name = 'Name is required';
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) errors.email = 'Valid email required';
  if (password.length < 8) errors.password = 'Password must be at least 8 characters';
  if (Object.keys(errors).length) return { status: 400, body: { error: 'Validation failed', errors } };
  if (db.prepare('SELECT id FROM users WHERE lower(email) = lower(?)').get(email)) {
    return { status: 409, body: { error: 'Email already registered', errors: { email: 'Email already registered' } } };
  }
  const info = db.prepare(
    `INSERT INTO users (name, email, phone, password_hash, role, status, ward, bio)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(name, email, String(body.phone || '').trim() || null, hashPassword(password), role,
    pickEnum(body.status, ['active', 'suspended'] as const, 'active'), String(body.ward || '').trim() || null, String(body.bio || '').trim() || null);

  const id = Number(info.lastInsertRowid);
  logAudit(db, actor.id, 'create_user', 'user', id, { role });
  return { status: 201, body: { user: publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(id) as Row) } };
});
