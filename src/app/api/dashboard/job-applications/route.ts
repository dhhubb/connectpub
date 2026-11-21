import { db } from '@/lib/db';
import { route, requireAuth } from '@/lib/http';
import { pageParams, pickEnum, toInt, APPLICATION_STATUSES, type Row } from '@/lib/util';
import { serializeApplicationRow } from '@/lib/serialize';

export const dynamic = 'force-dynamic';

export const GET = route(async (ctx) => {
  const user = requireAuth(ctx);
  const { page, perPage } = pageParams(Object.fromEntries(ctx.query), { defaultPerPage: 12 });
  const where: string[] = [];
  const params: any[] = [];
  if (user.role !== 'admin') { where.push('j.employer_id = ?'); params.push(user.id); }
  const jobId = toInt(ctx.query.get('job_id'));
  if (jobId) { where.push('a.job_id = ?'); params.push(jobId); }
  const status = pickEnum(ctx.query.get('status'), APPLICATION_STATUSES, null);
  if (status) { where.push('a.status = ?'); params.push(status); }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const total = (db.prepare(`
    SELECT COUNT(*) AS n FROM applications a JOIN jobs j ON j.id = a.job_id ${whereSql}`).get(...params) as { n: number }).n;
  const pages = Math.max(1, Math.ceil(total / perPage));
  const safePage = Math.min(page, pages);
  const rows = db.prepare(`
    SELECT a.*, j.title AS job_title, j.company, j.status AS job_status,
           u.name AS applicant_name, u.email AS applicant_email, u.phone AS applicant_phone, u.ward AS applicant_ward, u.bio AS applicant_bio
    FROM applications a JOIN jobs j ON j.id = a.job_id JOIN users u ON u.id = a.applicant_id
    ${whereSql} ORDER BY a.created_at DESC LIMIT ? OFFSET ?`).all(...params, perPage, (safePage - 1) * perPage) as Row[];
  return {
    body: {
      applications: rows.map(serializeApplicationRow),
      pagination: { page: safePage, perPage, total, pages, hasPrev: safePage > 1, hasNext: safePage < pages },
    },
  };
});
