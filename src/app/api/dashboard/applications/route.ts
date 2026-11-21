import { db } from '@/lib/db';
import { route, requireAuth } from '@/lib/http';
import { pageParams, pickEnum, APPLICATION_STATUSES, type Row } from '@/lib/util';
import { serializeApplicationRow } from '@/lib/serialize';

export const dynamic = 'force-dynamic';

export const GET = route(async (ctx) => {
  const user = requireAuth(ctx);
  const { page, perPage } = pageParams(Object.fromEntries(ctx.query), { defaultPerPage: 12 });
  const status = pickEnum(ctx.query.get('status'), APPLICATION_STATUSES, null);
  const where = ['a.applicant_id = ?'];
  const params: any[] = [user.id];
  if (status) { where.push('a.status = ?'); params.push(status); }
  const whereSql = `WHERE ${where.join(' AND ')}`;

  const total = (db.prepare(`SELECT COUNT(*) AS n FROM applications a ${whereSql}`).get(...params) as { n: number }).n;
  const pages = Math.max(1, Math.ceil(total / perPage));
  const safePage = Math.min(page, pages);
  const rows = db.prepare(`
    SELECT a.*, j.title AS job_title, j.company, j.status AS job_status, j.deadline,
           l.name AS location_name, c.name AS category_name, c.icon AS category_icon
    FROM applications a
    JOIN jobs j ON j.id = a.job_id
    LEFT JOIN locations l ON l.id = j.location_id
    LEFT JOIN categories c ON c.id = j.category_id
    ${whereSql} ORDER BY a.created_at DESC LIMIT ? OFFSET ?`)
    .all(...params, perPage, (safePage - 1) * perPage) as Row[];
  return {
    body: {
      applications: rows.map(serializeApplicationRow),
      pagination: { page: safePage, perPage, total, pages, hasPrev: safePage > 1, hasNext: safePage < pages },
    },
  };
});
