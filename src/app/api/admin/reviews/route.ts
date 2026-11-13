import { db } from '@/lib/db';
import { route, requireRole } from '@/lib/http';
import { pageParams, pickEnum, type Row } from '@/lib/util';

export const GET = route(async (ctx) => {
  requireRole(ctx, 'admin');
  const { page, perPage } = pageParams(Object.fromEntries(ctx.query), { defaultPerPage: 24 });
  const where: string[] = [];
  const params: any[] = [];
  const status = pickEnum(ctx.query.get('status'), ['published', 'hidden'] as const, null);
  if (status) { where.push('r.status = ?'); params.push(status); }
  const q = String(ctx.query.get('q') || '').trim();
  if (q) { where.push('(p.business_name LIKE ? OR u.name LIKE ? OR r.comment LIKE ?)'); params.push(`%${q}%`, `%${q}%`, `%${q}%`); }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const total = (db.prepare(`
    SELECT COUNT(*) AS n FROM reviews r JOIN providers p ON p.id = r.provider_id JOIN users u ON u.id = r.user_id
    ${whereSql}`).get(...params) as { n: number }).n;
  const pages = Math.max(1, Math.ceil(total / perPage));
  const safePage = Math.min(page, pages);
  const rows = db.prepare(`
    SELECT r.*, p.business_name, u.name AS user_name FROM reviews r
    JOIN providers p ON p.id = r.provider_id JOIN users u ON u.id = r.user_id
    ${whereSql} ORDER BY r.created_at DESC LIMIT ? OFFSET ?`).all(...params, perPage, (safePage - 1) * perPage) as Row[];

  return {
    body: {
      reviews: rows.map((r) => ({
        id: r.id, providerId: r.provider_id, businessName: r.business_name, userId: r.user_id,
        userName: r.user_name, rating: r.rating, comment: r.comment, status: r.status, createdAt: r.created_at,
      })),
      pagination: { page: safePage, perPage, total, pages, hasPrev: safePage > 1, hasNext: safePage < pages },
    },
  };
});
