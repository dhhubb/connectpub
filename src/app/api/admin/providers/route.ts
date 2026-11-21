import { db } from '@/lib/db';
import { route, requireRole } from '@/lib/http';
import { pageParams, pickEnum, type Row } from '@/lib/util';
import { serializeProvider } from '@/lib/providers';

const PROVIDER_STATUSES = ['pending', 'approved', 'rejected', 'suspended'] as const;

export const dynamic = 'force-dynamic';

export const GET = route(async (ctx) => {
  requireRole(ctx, 'admin');
  const { page, perPage, offset } = pageParams(Object.fromEntries(ctx.query));
  const where: string[] = [];
  const params: any[] = [];
  const status = pickEnum(ctx.query.get('status'), PROVIDER_STATUSES, null);
  if (status) { where.push('p.status = ?'); params.push(status); }
  const q = String(ctx.query.get('q') || '').trim();
  if (q) { where.push('(p.business_name LIKE ? OR p.email LIKE ?)'); params.push(`%${q}%`, `%${q}%`); }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const total = (db.prepare(`SELECT COUNT(*) AS n FROM providers p ${whereSql}`).get(...params) as { n: number }).n;
  const rows = db.prepare(`
    SELECT p.*, c.name AS category_name, c.icon AS category_icon, l.name AS location_name,
           u.name AS owner_name, u.email AS owner_email,
           (SELECT COUNT(*) FROM service_requests r WHERE r.provider_id = p.id) AS request_count
    FROM providers p LEFT JOIN categories c ON c.id = p.category_id
    LEFT JOIN locations l ON l.id = p.location_id LEFT JOIN users u ON u.id = p.owner_id
    ${whereSql} ORDER BY CASE p.status WHEN 'pending' THEN 0 ELSE 1 END, p.created_at DESC
    LIMIT ? OFFSET ?`).all(...params, perPage, offset) as Row[];

  return {
    body: {
      providers: rows.map((r) => ({ ...serializeProvider(r, { full: true }), requestCount: r.request_count })),
      pagination: { page, perPage, total, pages: Math.max(1, Math.ceil(total / perPage)) },
    },
  };
});
