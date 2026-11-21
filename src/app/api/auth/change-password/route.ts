import { db } from '@/lib/db';
import { hashPassword, verifyPassword } from '@/lib/auth';
import { route, requireAuth } from '@/lib/http';
import { logAudit } from '@/lib/util';

export const dynamic = 'force-dynamic';

export const POST = route(async (ctx) => {
  const user = requireAuth(ctx);
  const current = String(ctx.body.currentPassword || '');
  const next = String(ctx.body.newPassword || '');
  if (next.length < 8) {
    return { status: 400, body: { error: 'Validation failed', errors: { newPassword: 'Password must be at least 8 characters' } } };
  }
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id) as any;
  if (!verifyPassword(current, row.password_hash)) {
    return { status: 400, body: { error: 'Validation failed', errors: { currentPassword: 'Current password is incorrect' } } };
  }
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(next), user.id);
  logAudit(db, user.id, 'change_password', 'user', user.id, null);
  return { body: { ok: true } };
});
