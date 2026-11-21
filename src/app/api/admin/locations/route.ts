import { db } from '@/lib/db';
import { route, requireRole } from '@/lib/http';
import { slugify, logAudit, type Row } from '@/lib/util';

export const dynamic = 'force-dynamic';

export const GET = route(async (ctx) => {
  requireRole(ctx, 'admin');
  const rows = db.prepare(`
    SELECT l.*,
      (SELECT COUNT(*) FROM jobs j WHERE j.location_id = l.id) AS job_count,
      (SELECT COUNT(*) FROM providers p WHERE p.location_id = l.id) AS provider_count
    FROM locations l ORDER BY l.kind, l.name`).all() as Row[];
  return {
    body: {
      locations: rows.map((l) => ({
        id: l.id, name: l.name, slug: l.slug, kind: l.kind, notes: l.notes,
        jobCount: l.job_count, providerCount: l.provider_count,
      })),
    },
  };
});

export const POST = route(async (ctx) => {
  const actor = requireRole(ctx, 'admin');
  const body = ctx.body || {};
  const name = String(body.name || '').trim();
  const kind = ['town', 'ward', 'village'].includes(body.kind) ? body.kind : 'ward';
  if (name.length < 2) return { status: 400, body: { error: 'Validation failed', errors: { name: 'Location name is required' } } };
  const slug = slugify(body.slug || name);
  if (db.prepare('SELECT id FROM locations WHERE slug = ?').get(slug)) {
    return { status: 409, body: { error: 'That location already exists', errors: { name: 'Name already used' } } };
  }
  const info = db.prepare('INSERT INTO locations (name, slug, kind, notes) VALUES (?, ?, ?, ?)')
    .run(name, slug, kind, String(body.notes || '').trim() || null);
  logAudit(db, actor.id, 'create_location', 'location', Number(info.lastInsertRowid), { name, kind });
  return { status: 201, body: { location: db.prepare('SELECT * FROM locations WHERE id = ?').get(Number(info.lastInsertRowid)) } };
});
