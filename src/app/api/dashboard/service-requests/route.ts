import { db } from '@/lib/db';
import { route, requireAuth } from '@/lib/http';
import { pageParams, pickEnum, REQUEST_STATUSES, type Row } from '@/lib/util';
import { serializeRequestRow } from '@/lib/serialize';

export const GET = route(async (ctx) => {
  const user = requireAuth(ctx);
  const { page, perPage } = pageParams(Object.fromEntries(ctx.query), { defaultPerPage: 12 });
  const mine = ctx.query.get('mine') === '1';
  const where = [mine ? 'r.requester_id = ?' : 'p.owner_id = ?'];
  const params: any[] = [user.id];
  const status = pickEnum(ctx.query.get('status'), REQUEST_STATUSES, null);
  if (status) { where.push('r.status = ?'); params.push(status); }
  const whereSql = `WHERE ${where.join(' AND ')}`;

  const total = (db.prepare(`
    SELECT COUNT(*) AS n FROM service_requests r JOIN providers p ON p.id = r.provider_id ${whereSql}`).get(...params) as { n: number }).n;
  const pages = Math.max(1, Math.ceil(total / perPage));
  const safePage = Math.min(page, pages);
  const rows = db.prepare(`
    SELECT r.*, p.business_name, p.id AS provider_id, u.name AS requester_name
    FROM service_requests r JOIN providers p ON p.id = r.provider_id
    LEFT JOIN users u ON u.id = r.requester_id
    ${whereSql} ORDER BY r.created_at DESC LIMIT ? OFFSET ?`).all(...params, perPage, (safePage - 1) * perPage) as Row[];
  return {
    body: {
      requests: rows.map(serializeRequestRow),
      view: mine ? 'sent' : 'received',
      pagination: { page: safePage, perPage, total, pages, hasPrev: safePage > 1, hasNext: safePage < pages },
    },
  };
});
