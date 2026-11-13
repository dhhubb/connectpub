import { db } from '@/lib/db';
import { route, requireAuth } from '@/lib/http';
import { httpError, toInt, type Row } from '@/lib/util';
import { SELECT_PROVIDER, serializeProvider } from '@/lib/providers';

export const POST = route(async (ctx) => {
  const user = requireAuth(ctx);
  const id = Number(ctx.params.id);
  const provider = db.prepare('SELECT * FROM providers WHERE id = ?').get(id) as Row | undefined;
  if (!provider || provider.status !== 'approved') throw httpError(404, 'Service provider not found');
  if (provider.owner_id === user.id) throw httpError(400, 'You cannot review your own business');

  const rating = toInt(ctx.body.rating);
  if (!rating || rating < 1 || rating > 5) throw httpError(400, 'Rating must be between 1 and 5');
  const comment = String(ctx.body.comment || '').trim() || null;

  db.prepare(
    `INSERT INTO reviews (provider_id, user_id, rating, comment) VALUES (?, ?, ?, ?)
     ON CONFLICT(provider_id, user_id) DO UPDATE SET rating = excluded.rating, comment = excluded.comment, created_at = datetime('now')`,
  ).run(id, user.id, rating, comment);

  db.prepare(`
    UPDATE providers SET
      rating_sum = (SELECT COALESCE(SUM(rating), 0) FROM reviews WHERE provider_id = ? AND status = 'published'),
      rating_count = (SELECT COUNT(*) FROM reviews WHERE provider_id = ? AND status = 'published')
    WHERE id = ?`).run(id, id, id);

  const fresh = db.prepare(`${SELECT_PROVIDER} WHERE p.id = ?`).get(id) as Row;
  return { status: 201, body: { provider: serializeProvider(fresh), message: 'Thank you, your review has been saved' } };
});
