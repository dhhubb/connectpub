import { db } from '@/lib/db';
import { route, requireRole } from '@/lib/http';
import { httpError, slugify, logAudit, toInt, type Row } from '@/lib/util';

export const dynamic = 'force-dynamic';

export const PATCH = route(async (ctx) => {
  const actor = requireRole(ctx, 'admin');
  const id = toInt(ctx.params.id);
  const group = db.prepare('SELECT * FROM category_groups WHERE id = ?').get(id) as Row | undefined;
  if (!group) throw httpError(404, 'Group not found');
  const body = ctx.body || {};
  const name = String(body.name ?? group.name).trim();
  const slug = slugify(body.slug || name);
  if (db.prepare('SELECT id FROM category_groups WHERE slug = ? AND id != ?').get(slug, id)) {
    return { status: 409, body: { error: 'Another group already uses that name', errors: { name: 'Name already used' } } };
  }
  const scope = ['job', 'service', 'both'].includes(body.scope) ? body.scope : group.scope;
  const sortOrder = body.sortOrder !== undefined ? (toInt(body.sortOrder, 0) || 0) : group.sort_order;
  db.prepare('UPDATE category_groups SET name = ?, slug = ?, icon = ?, scope = ?, description = ?, sort_order = ? WHERE id = ?')
    .run(name, slug, String(body.icon ?? group.icon ?? '📁').trim(), scope,
      String(body.description ?? group.description ?? '').trim() || null, sortOrder, id);
  logAudit(db, actor.id, 'update_group', 'category_group', id, { name, scope });
  return { body: { group: db.prepare('SELECT * FROM category_groups WHERE id = ?').get(id) } };
});

export const DELETE = route(async (ctx) => {
  const actor = requireRole(ctx, 'admin');
  const id = toInt(ctx.params.id);
  const group = db.prepare('SELECT * FROM category_groups WHERE id = ?').get(id) as Row | undefined;
  if (!group) throw httpError(404, 'Group not found');
  const inUse = (db.prepare('SELECT COUNT(*) AS n FROM categories WHERE group_id = ?').get(id) as { n: number }).n;
  if (inUse > 0) throw httpError(400, `Move the ${inUse} category(s) in this group before deleting it`);
  db.prepare('DELETE FROM category_groups WHERE id = ?').run(id);
  logAudit(db, actor.id, 'delete_group', 'category_group', id, { name: group.name });
  return { body: { ok: true } };
});
