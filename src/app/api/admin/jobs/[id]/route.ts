import { db } from '@/lib/db';
import { route, requireRole } from '@/lib/http';
import { httpError, logAudit, pickEnum, toInt, type Row } from '@/lib/util';
import { serializeJob } from '@/lib/jobs';

const JOB_STATUSES = ['pending', 'approved', 'rejected', 'closed', 'expired'] as const;

export const PATCH = route(async (ctx) => {
  const user = requireRole(ctx, 'admin');
  const id = toInt(ctx.params.id);
  const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(id) as Row | undefined;
  if (!job) throw httpError(404, 'Job not found');
  const body = ctx.body || {};
  const status = body.status !== undefined ? pickEnum(body.status, JOB_STATUSES, null) : job.status;
  if (body.status !== undefined && !status) throw httpError(400, 'Unknown job status');
  const featured = body.featured !== undefined ? (body.featured ? 1 : 0) : job.featured;
  const reason = status === 'rejected' ? String(body.rejectionReason || 'Does not meet listing guidelines').trim() : null;

  db.prepare("UPDATE jobs SET status = ?, featured = ?, rejection_reason = ?, updated_at = datetime('now') WHERE id = ?")
    .run(status, featured, reason, id);
  logAudit(db, user.id, 'moderate_job', 'job', id, { status, featured: Boolean(featured) });

  const row = db.prepare(`
    SELECT j.*, c.name AS category_name, c.icon AS category_icon, l.name AS location_name,
           u.name AS employer_name, u.email AS employer_email,
           (SELECT COUNT(*) FROM applications a WHERE a.job_id = j.id) AS application_count
    FROM jobs j LEFT JOIN categories c ON c.id = j.category_id
    LEFT JOIN locations l ON l.id = j.location_id LEFT JOIN users u ON u.id = j.employer_id
    WHERE j.id = ?`).get(id) as Row;
  return { body: { job: serializeJob(row, { full: true }), message: `Job ${status}` } };
});
