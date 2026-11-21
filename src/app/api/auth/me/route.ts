import { db } from '@/lib/db';
import { route, requireAuth } from '@/lib/http';
import { publicUser } from '@/lib/util';

export const dynamic = 'force-dynamic';

export const GET = route(async (ctx) => {
  requireAuth(ctx);
  return { body: { user: ctx.user } };
});

export const PATCH = route(async (ctx) => {
  const user = requireAuth(ctx);
  const body = ctx.body || {};
  const name = String(body.name ?? user.name).trim();
  const phone = String(body.phone ?? user.phone ?? '').trim();
  const ward = String(body.ward ?? user.ward ?? '').trim();
  const bio = String(body.bio ?? user.bio ?? '').trim();
  if (name.length < 2) {
    return { status: 400, body: { error: 'Validation failed', errors: { name: 'Please enter your full name' } } };
  }
  db.prepare('UPDATE users SET name = ?, phone = ?, ward = ?, bio = ? WHERE id = ?')
    .run(name, phone || null, ward || null, bio || null, user.id);
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id) as any;
  return { body: { user: publicUser(row) } };
});
