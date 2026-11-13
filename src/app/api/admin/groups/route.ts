import { db } from '@/lib/db';
import { route, requireRole } from '@/lib/http';
import { slugify, logAudit, toInt, type Row } from '@/lib/util';

function serializeAdminGroup(g: Row): Row {
  return {
    id: g.id, name: g.name, slug: g.slug, icon: g.icon, scope: g.scope, description: g.description,
    sortOrder: g.sort_order, categoryCount: g.category_count, jobCount: g.job_count, providerCount: g.provider_count,
  };
}

export const GET = route(async (ctx) => {
  requireRole(ctx, 'admin');
  const rows = db.prepare(`
    SELECT g.*,
      (SELECT COUNT(*) FROM categories c WHERE c.group_id = g.id) AS category_count,
      (SELECT COUNT(*) FROM jobs j JOIN categories c ON c.id = j.category_id WHERE c.group_id = g.id) AS job_count,
      (SELECT COUNT(*) FROM providers p JOIN categories c ON c.id = p.category_id WHERE c.group_id = g.id) AS provider_count
    FROM category_groups g ORDER BY g.sort_order, g.name`).all() as Row[];
  return { body: { groups: rows.map(serializeAdminGroup) } };
});

export const POST = route(async (ctx) => {
  const actor = requireRole(ctx, 'admin');
  const body = ctx.body || {};
  const name = String(body.name || '').trim();
  if (name.length < 2) return { status: 400, body: { error: 'Validation failed', errors: { name: 'Group name is required' } } };
  const slug = slugify(body.slug || name);
  if (db.prepare('SELECT id FROM category_groups WHERE slug = ?').get(slug)) {
    return { status: 409, body: { error: 'A group with that name already exists', errors: { name: 'Name already used' } } };
  }
  const scope = ['job', 'service', 'both'].includes(body.scope) ? body.scope : 'both';
  const sortOrder = toInt(body.sortOrder, 0) || 0;
  const info = db.prepare('INSERT INTO category_groups (name, slug, icon, scope, description, sort_order) VALUES (?, ?, ?, ?, ?, ?)')
    .run(name, slug, String(body.icon || '📁').trim(), scope, String(body.description || '').trim() || null, sortOrder);
  const id = Number(info.lastInsertRowid);
  logAudit(db, actor.id, 'create_group', 'category_group', id, { name, scope });
  return { status: 201, body: { group: db.prepare('SELECT * FROM category_groups WHERE id = ?').get(id) } };
});
