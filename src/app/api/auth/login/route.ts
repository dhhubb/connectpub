import { db } from '@/lib/db';
import { verifyPassword, createSession } from '@/lib/auth';
import { route } from '@/lib/http';
import { logAudit, publicUser } from '@/lib/util';

export const POST = route(async (ctx) => {
  const email = String(ctx.body.email || '').trim();
  const password = String(ctx.body.password || '');
  const user = db.prepare('SELECT * FROM users WHERE lower(email) = lower(?)').get(email) as any;
  if (!user || !verifyPassword(password, user.password_hash)) {
    return { status: 401, body: { error: 'Incorrect email or password' } };
  }
  if (user.status !== 'active') {
    return { status: 403, body: { error: 'This account has been suspended. Please contact the administrator.' } };
  }
  db.prepare("UPDATE users SET last_login_at = datetime('now') WHERE id = ?").run(user.id);
  const fresh = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id) as any;
  const token = createSession(fresh);
  logAudit(db, fresh.id, 'login', 'user', fresh.id, null);
  return { body: { token, user: publicUser(fresh) } };
});
