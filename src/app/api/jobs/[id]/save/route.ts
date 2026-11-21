import { db } from '@/lib/db';
import { route, requireAuth } from '@/lib/http';
import { httpError } from '@/lib/util';

export const dynamic = 'force-dynamic';

export const POST = route(async (ctx) => {
  const user = requireAuth(ctx);
  const id = Number(ctx.params.id);
  if (!db.prepare('SELECT id FROM jobs WHERE id = ?').get(id)) throw httpError(404, 'Job not found');
  const existing = db.prepare("SELECT id FROM saved_items WHERE user_id = ? AND item_type = 'job' AND item_id = ?").get(user.id, id) as { id: number } | undefined;
  if (existing) {
    db.prepare('DELETE FROM saved_items WHERE id = ?').run(existing.id);
    return { body: { saved: false } };
  }
  db.prepare("INSERT INTO saved_items (user_id, item_type, item_id) VALUES (?, 'job', ?)").run(user.id, id);
  return { body: { saved: true } };
});
