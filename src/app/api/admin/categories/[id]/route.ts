import { db } from '@/lib/db';
import { route, requireRole } from '@/lib/http';
import { httpError, slugify, logAudit, toInt, type Row } from '@/lib/util';

function groupIdFromSlug(value: unknown): number | null {
  if (!value) return null;
  const row = db.prepare('SELECT id FROM category_groups WHERE slug = ? OR id = ?').get(String(value), toInt(value) || -1) as { id: number } | undefined;
  return row ? row.id : null;
}

export const PATCH = route(async (ctx) => {
  const actor = requireRole(ctx, 'admin');
  const id = toInt(ctx.params.id);
  const category = db.prepare('SELECT * FROM categories WHERE id = ?').get(id) as Row | undefined;
  if (!category) throw httpError(404, 'Category not found');
  const body = ctx.body || {};
  const name = String(body.name ?? category.name).trim();
  const slug = slugify(body.slug || name);
  if (db.prepare('SELECT id FROM categories WHERE slug = ? AND id != ?').get(slug, id)) {
    return { status: 409, body: { error: 'Another category already uses that name', errors: { name: 'Name already used' } } };
  }
  let groupId = category.group_id;
  if (body.group_id !== undefined) groupId = body.group_id ? toInt(body.group_id) : null;
  else if (body.group !== undefined) groupId = groupIdFromSlug(body.group);
  const kind = ['job', 'service'].includes(body.kind) ? body.kind : category.kind;
  db.prepare('UPDATE categories SET name = ?, slug = ?, kind = ?, icon = ?, description = ?, group_id = ? WHERE id = ?')
    .run(name, slug, kind, String(body.icon ?? category.icon ?? '📌'),
      String(body.description ?? category.description ?? '').trim() || null, groupId, id);
  logAudit(db, actor.id, 'update_category', 'category', id, { name, groupId });
  return { body: { category: db.prepare('SELECT * FROM categories WHERE id = ?').get(id) } };
});

export const DELETE = route(async (ctx) => {
  const actor = requireRole(ctx, 'admin');
  const id = toInt(ctx.params.id);
  const category = db.prepare('SELECT * FROM categories WHERE id = ?').get(id) as Row | undefined;
  if (!category) throw httpError(404, 'Category not found');
  const jobs = (db.prepare('SELECT COUNT(*) AS n FROM jobs WHERE category_id = ?').get(id) as { n: number }).n;
  const providers = (db.prepare('SELECT COUNT(*) AS n FROM providers WHERE category_id = ?').get(id) as { n: number }).n;
  if (jobs + providers > 0) throw httpError(400, `Move the ${jobs + providers} listing(s) using this category before deleting it`);
  db.prepare('DELETE FROM categories WHERE id = ?').run(id);
  logAudit(db, actor.id, 'delete_category', 'category', id, { name: category.name });
  return { body: { ok: true } };
});
