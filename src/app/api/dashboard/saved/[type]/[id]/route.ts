import { db } from '@/lib/db';
import { route, requireAuth } from '@/lib/http';
import { httpError, pickEnum } from '@/lib/util';

export const dynamic = 'force-dynamic';

export const DELETE = route(async (ctx) => {
  const user = requireAuth(ctx);
  const type = pickEnum(ctx.params.type, ['job', 'provider'] as const, null);
  if (!type) throw httpError(400, 'Unknown saved item type');
  db.prepare('DELETE FROM saved_items WHERE user_id = ? AND item_type = ? AND item_id = ?')
    .run(user.id, type, Number(ctx.params.id));
  return { body: { ok: true } };
});
