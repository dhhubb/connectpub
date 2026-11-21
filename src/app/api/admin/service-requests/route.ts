import { db } from '@/lib/db';
import { route, requireRole } from '@/lib/http';
import { pageParams, pickEnum, REQUEST_STATUSES, type Row } from '@/lib/util';
import { serializeRequestRow } from '@/lib/serialize';

export const dynamic = 'force-dynamic';

export const GET = route(async (ctx) => {
  requireRole(ctx, 'admin');
  const { page, perPage } = pageParams(Object.fromEntries(ctx.query), { defaultPerPage: 24 });
  const where: string[] = [];
  const params: any[] = [];
  const status = pickEnum(ctx.query.get('status'), REQUEST_STATUSES, null);
  if (status) { where.push('r.status = ?'); params.push(status); }
  const q = String(ctx.query.get('q') || '').trim();
  if (q) { where.push('(p.business_name LIKE ? OR r.name LIKE ? OR r.service_needed LIKE ?)'); params.push(`%${q}%`, `%${q}%`, `%${q}%`); }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const total = (db.prepare(`
    SELECT COUNT(*) AS n FROM service_requests r JOIN providers p ON p.id = r.provider_id
    LEFT JOIN users u ON u.id = r.requester_id ${whereSql}`).get(...params) as { n: number }).n;
  const pages = Math.max(1, Math.ceil(total / perPage));
  const safePage = Math.min(page, pages);
  const rows = db.prepare(`
    SELECT r.*, p.business_name, p.id AS provider_id, u.name AS requester_name
    FROM service_requests r JOIN providers p ON p.id = r.provider_id
    LEFT JOIN users u ON u.id = r.requester_id ${whereSql} ORDER BY r.created_at DESC LIMIT ? OFFSET ?`)
    .all(...params, perPage, (safePage - 1) * perPage) as Row[];

  return {
    body: {
      requests: rows.map(serializeRequestRow),
      pagination: { page: safePage, perPage, total, pages, hasPrev: safePage > 1, hasNext: safePage < pages },
    },
  };
});
