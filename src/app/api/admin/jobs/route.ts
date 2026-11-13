import { db } from '@/lib/db';
import { route, requireRole } from '@/lib/http';
import { pageParams, pickEnum, type Row } from '@/lib/util';
import { serializeJob } from '@/lib/jobs';

const JOB_STATUSES = ['pending', 'approved', 'rejected', 'closed', 'expired'] as const;

export const GET = route(async (ctx) => {
  requireRole(ctx, 'admin');
  const { page, perPage, offset } = pageParams(Object.fromEntries(ctx.query));
  const where: string[] = [];
  const params: any[] = [];
  const status = pickEnum(ctx.query.get('status'), JOB_STATUSES, null);
  if (status) { where.push('j.status = ?'); params.push(status); }
  const q = String(ctx.query.get('q') || '').trim();
  if (q) { where.push('(j.title LIKE ? OR j.company LIKE ?)'); params.push(`%${q}%`, `%${q}%`); }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const total = (db.prepare(`SELECT COUNT(*) AS n FROM jobs j ${whereSql}`).get(...params) as { n: number }).n;
  const rows = db.prepare(`
    SELECT j.*, c.name AS category_name, c.icon AS category_icon, l.name AS location_name,
           u.name AS employer_name, u.email AS employer_email,
           (SELECT COUNT(*) FROM applications a WHERE a.job_id = j.id) AS application_count
    FROM jobs j LEFT JOIN categories c ON c.id = j.category_id
    LEFT JOIN locations l ON l.id = j.location_id LEFT JOIN users u ON u.id = j.employer_id
    ${whereSql} ORDER BY CASE j.status WHEN 'pending' THEN 0 ELSE 1 END, j.created_at DESC
    LIMIT ? OFFSET ?`).all(...params, perPage, offset) as Row[];

  return {
    body: {
      jobs: rows.map((r) => serializeJob(r, { full: true })),
      pagination: { page, perPage, total, pages: Math.max(1, Math.ceil(total / perPage)) },
    },
  };
});
