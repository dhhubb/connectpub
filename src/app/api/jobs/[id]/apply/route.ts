import { db } from '@/lib/db';
import { route, requireAuth } from '@/lib/http';
import { httpError, logAudit, toNum, type Row } from '@/lib/util';
import { serializeApplication } from '@/lib/jobs';

export const dynamic = 'force-dynamic';

export const POST = route(async (ctx) => {
  const user = requireAuth(ctx);
  const id = Number(ctx.params.id);
  const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(id) as Row | undefined;
  if (!job || job.status !== 'approved') throw httpError(404, 'Job not found or not open for applications');
  if (job.employer_id === user.id) throw httpError(400, 'You cannot apply for your own job listing');
  if (job.deadline && job.deadline < new Date().toISOString().slice(0, 10)) throw httpError(400, 'The application deadline has passed');

  const existing = db.prepare('SELECT id FROM applications WHERE job_id = ? AND applicant_id = ?').get(id, user.id);
  if (existing) throw httpError(409, 'You have already applied for this job');

  const body = ctx.body || {};
  const info = db.prepare(
    `INSERT INTO applications (job_id, applicant_id, cover_letter, cv_url, expected_salary)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(id, user.id, String(body.coverLetter || '').trim() || null, String(body.cvUrl || '').trim() || null, toNum(body.expectedSalary, null));

  logAudit(db, user.id, 'apply', 'job', id, { applicationId: Number(info.lastInsertRowid) });
  const app = db.prepare('SELECT * FROM applications WHERE id = ?').get(Number(info.lastInsertRowid)) as Row;
  return { status: 201, body: { application: serializeApplication(app) } };
});
