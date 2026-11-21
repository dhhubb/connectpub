import { db } from '@/lib/db';
import { route, requireRole } from '@/lib/http';
import { httpError, logAudit, pickEnum, toInt, type Row } from '@/lib/util';

function recomputeRating(providerId: number) {
  db.prepare(`
    UPDATE providers SET
      rating_sum = (SELECT COALESCE(SUM(rating), 0) FROM reviews WHERE provider_id = ? AND status = 'published'),
      rating_count = (SELECT COUNT(*) FROM reviews WHERE provider_id = ? AND status = 'published')
    WHERE id = ?`).run(providerId, providerId, providerId);
}

export const dynamic = 'force-dynamic';

export const PATCH = route(async (ctx) => {
  const actor = requireRole(ctx, 'admin');
  const id = toInt(ctx.params.id);
  const review = db.prepare('SELECT * FROM reviews WHERE id = ?').get(id) as Row | undefined;
  if (!review) throw httpError(404, 'Review not found');
  const status = pickEnum(ctx.body.status, ['published', 'hidden'] as const, null);
  if (!status) throw httpError(400, 'Unknown review status');
  db.prepare('UPDATE reviews SET status = ? WHERE id = ?').run(status, id);
  recomputeRating(review.provider_id);
  logAudit(db, actor.id, 'moderate_review', 'review', id, { status });
  return { body: { ok: true } };
});

export const DELETE = route(async (ctx) => {
  const actor = requireRole(ctx, 'admin');
  const id = toInt(ctx.params.id);
  const review = db.prepare('SELECT * FROM reviews WHERE id = ?').get(id) as Row | undefined;
  if (!review) throw httpError(404, 'Review not found');
  db.prepare('DELETE FROM reviews WHERE id = ?').run(id);
  recomputeRating(review.provider_id);
  logAudit(db, actor.id, 'delete_review', 'review', id, null);
  return { body: { ok: true } };
});
