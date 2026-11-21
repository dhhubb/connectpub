import { db } from '@/lib/db';
import { route, requireRole } from '@/lib/http';
import { httpError, slugify, logAudit, toInt, type Row } from '@/lib/util';

export const dynamic = 'force-dynamic';

export const PATCH = route(async (ctx) => {
  const actor = requireRole(ctx, 'admin');
  const id = toInt(ctx.params.id);
  const location = db.prepare('SELECT * FROM locations WHERE id = ?').get(id) as Row | undefined;
  if (!location) throw httpError(404, 'Location not found');
  const body = ctx.body || {};
  const name = String(body.name ?? location.name).trim();
  const slug = slugify(body.slug || name);
  if (db.prepare('SELECT id FROM locations WHERE slug = ? AND id != ?').get(slug, id)) {
    return { status: 409, body: { error: 'Another location already uses that name', errors: { name: 'Name already used' } } };
  }
  const kind = ['town', 'ward', 'village'].includes(body.kind) ? body.kind : location.kind;
  db.prepare('UPDATE locations SET name = ?, slug = ?, kind = ?, notes = ? WHERE id = ?')
    .run(name, slug, kind, String(body.notes ?? location.notes ?? '').trim() || null, id);
  logAudit(db, actor.id, 'update_location', 'location', id, { name });
  return { body: { location: db.prepare('SELECT * FROM locations WHERE id = ?').get(id) } };
});

export const DELETE = route(async (ctx) => {
  const actor = requireRole(ctx, 'admin');
  const id = toInt(ctx.params.id);
  const location = db.prepare('SELECT * FROM locations WHERE id = ?').get(id) as Row | undefined;
  if (!location) throw httpError(404, 'Location not found');
  const jobs = (db.prepare('SELECT COUNT(*) AS n FROM jobs WHERE location_id = ?').get(id) as { n: number }).n;
  const providers = (db.prepare('SELECT COUNT(*) AS n FROM providers WHERE location_id = ?').get(id) as { n: number }).n;
  if (jobs + providers > 0) throw httpError(400, `Move the ${jobs + providers} listing(s) using this location before deleting it`);
  db.prepare('DELETE FROM locations WHERE id = ?').run(id);
  logAudit(db, actor.id, 'delete_location', 'location', id, { name: location.name });
  return { body: { ok: true } };
});
