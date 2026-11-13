import { db } from '@/lib/db';
import { route, requireRole } from '@/lib/http';
import { hashPassword } from '@/lib/auth';
import { httpError, logAudit, toInt, type Row } from '@/lib/util';

export const POST = route(async (ctx) => {
  const actor = requireRole(ctx, 'admin');
  const id = toInt(ctx.params.id);
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as Row | undefined;
  if (!user) throw httpError(404, 'User not found');
  const password = String(ctx.body.password || '');
  if (password.length < 8) return { status: 400, body: { error: 'Validation failed', errors: { password: 'Password must be at least 8 characters' } } };
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(password), id);
  logAudit(db, actor.id, 'reset_password', 'user', id, null);
  return { body: { ok: true, message: 'Password updated' } };
});
