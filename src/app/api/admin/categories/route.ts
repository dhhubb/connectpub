import { db } from '@/lib/db';
import { route, requireRole } from '@/lib/http';
import { slugify, logAudit, toInt, type Row } from '@/lib/util';

/** Accept either a group id or slug from the admin form and return the id. */
function groupIdFromSlug(value: unknown): number | null {
  if (!value) return null;
  const row = db.prepare('SELECT id FROM category_groups WHERE slug = ? OR id = ?').get(String(value), toInt(value) || -1) as { id: number } | undefined;
  return row ? row.id : null;
}

export const GET = route(async (ctx) => {
  requireRole(ctx, 'admin');
  const rows = db.prepare(`
    SELECT c.*, g.name AS group_name, g.slug AS group_slug, g.icon AS group_icon,
      (SELECT COUNT(*) FROM jobs j WHERE j.category_id = c.id) AS job_count,
      (SELECT COUNT(*) FROM providers p WHERE p.category_id = c.id) AS provider_count
    FROM categories c LEFT JOIN category_groups g ON g.id = c.group_id
    ORDER BY c.kind, c.sort_order, c.name`).all() as Row[];
  return {
    body: {
      categories: rows.map((c) => ({
        id: c.id, name: c.name, slug: c.slug, kind: c.kind, icon: c.icon, description: c.description,
        groupId: c.group_id,
        group: c.group_id ? { id: c.group_id, name: c.group_name, slug: c.group_slug, icon: c.group_icon } : null,
        jobCount: c.job_count, providerCount: c.provider_count,
      })),
    },
  };
});

export const POST = route(async (ctx) => {
  const actor = requireRole(ctx, 'admin');
  const body = ctx.body || {};
  const name = String(body.name || '').trim();
  const kind = ['job', 'service'].includes(body.kind) ? body.kind : null;
  if (name.length < 2) return { status: 400, body: { error: 'Validation failed', errors: { name: 'Category name is required' } } };
  if (!kind) return { status: 400, body: { error: 'Validation failed', errors: { kind: 'Choose job or service' } } };
  const slug = slugify(body.slug || name);
  if (db.prepare('SELECT id FROM categories WHERE slug = ?').get(slug)) {
    return { status: 409, body: { error: 'A category with that name already exists', errors: { name: 'Name already used' } } };
  }
  const groupId = body.group_id ? toInt(body.group_id) : (body.group ? groupIdFromSlug(body.group) : null);
  const info = db.prepare('INSERT INTO categories (name, slug, kind, icon, description, group_id) VALUES (?, ?, ?, ?, ?, ?)')
    .run(name, slug, kind, String(body.icon || '📌').trim(), String(body.description || '').trim() || null, groupId);
  logAudit(db, actor.id, 'create_category', 'category', Number(info.lastInsertRowid), { name, kind, groupId });
  return { status: 201, body: { category: db.prepare('SELECT * FROM categories WHERE id = ?').get(Number(info.lastInsertRowid)) } };
});
