import { db } from '@/lib/db';
import { route, requireRole } from '@/lib/http';
import { httpError, logAudit, pickEnum, toInt, publicUser, USER_ROLES, type Row } from '@/lib/util';

export const PATCH = route(async (ctx) => {
  const actor = requireRole(ctx, 'admin');
  const id = toInt(ctx.params.id);
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as Row | undefined;
  if (!user) throw httpError(404, 'User not found');
  const body = ctx.body || {};

  const role = body.role !== undefined ? pickEnum(body.role, USER_ROLES, null) : user.role;
  if (body.role !== undefined && !role) throw httpError(400, 'Unknown role');
  const status = body.status !== undefined ? pickEnum(body.status, ['active', 'suspended'] as const, null) : user.status;
  if (body.status !== undefined && !status) throw httpError(400, 'Unknown status');

  if (id === actor.id && (role !== 'admin' || status !== 'active')) {
    throw httpError(400, 'You cannot remove your own admin access or suspend your own account');
  }
  if (user.role === 'admin' && role !== 'admin') {
    const admins = (db.prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'admin' AND status = 'active'").get() as { n: number }).n;
    if (admins <= 1) throw httpError(400, 'At least one active administrator must remain');
  }

  db.prepare('UPDATE users SET name = ?, phone = ?, role = ?, status = ?, ward = ?, bio = ? WHERE id = ?')
    .run(String(body.name ?? user.name).trim(), String(body.phone ?? user.phone ?? '').trim() || null, role, status,
      String(body.ward ?? user.ward ?? '').trim() || null, String(body.bio ?? user.bio ?? '').trim() || null, id);
  logAudit(db, actor.id, 'update_user', 'user', id, { role, status });
  return { body: { user: publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(id) as Row) } };
});

export const DELETE = route(async (ctx) => {
  const actor = requireRole(ctx, 'admin');
  const id = toInt(ctx.params.id);
  if (id === actor.id) throw httpError(400, 'You cannot delete your own account');
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as Row | undefined;
  if (!user) throw httpError(404, 'User not found');
  if (user.role === 'admin') {
    const admins = (db.prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'admin'").get() as { n: number }).n;
    if (admins <= 1) throw httpError(400, 'At least one administrator must remain');
  }
  db.prepare('DELETE FROM users WHERE id = ?').run(id);
  logAudit(db, actor.id, 'delete_user', 'user', id, { email: user.email });
  return { body: { ok: true } };
});
