import { db } from '@/lib/db';
import { route, requireRole } from '@/lib/http';
import { httpError, logAudit, pickEnum, toInt, type Row } from '@/lib/util';
import { SELECT_JOB, serializeJob, savedJobIds, serializeApplication } from '@/lib/jobs';
import { validateJob } from '@/lib/jobs';

function loadOwnedJob(ctx: any): Row {
  const id = toInt(ctx.params.id);
  const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(id) as Row | undefined;
  if (!job) throw httpError(404, 'Job not found');
  if (ctx.user.role !== 'admin' && job.employer_id !== ctx.user.id) throw httpError(403, 'You can only manage your own listings');
  return job;
}

function jobToBody(job: Row): Row {
  return {
    title: job.title, company: job.company, description: job.description, requirements: job.requirements,
    jobType: job.job_type, workMode: job.work_mode, salaryMin: job.salary_min, salaryMax: job.salary_max,
    currency: job.currency, vacancies: job.vacancies, deadline: job.deadline,
    contactEmail: job.contact_email, contactPhone: job.contact_phone,
    categoryId: job.category_id, locationId: job.location_id,
  };
}

export const GET = route(async (ctx) => {
  const id = toInt(ctx.params.id);
  const row = db.prepare(`${SELECT_JOB} WHERE j.id = ?`).get(id) as Row | undefined;
  if (!row) throw httpError(404, 'Job not found');

  const isOwner = ctx.user && ctx.user.id === row.employer_id;
  const isAdmin = ctx.user && ctx.user.role === 'admin';
  if (row.status !== 'approved' && !isOwner && !isAdmin) throw httpError(404, 'Job not found');

  if (row.status === 'approved') db.prepare('UPDATE jobs SET views = views + 1 WHERE id = ?').run(id);

  let myApplication: unknown = null;
  if (ctx.user && !isAdmin) {
    const app = db.prepare('SELECT * FROM applications WHERE job_id = ? AND applicant_id = ?').get(id, ctx.user.id) as Row | undefined;
    myApplication = app ? serializeApplication(app) : false;
  }
  const savedIds = savedJobIds(ctx.user?.id);
  return {
    body: {
      job: serializeJob(
        { ...row, views: row.views + (row.status === 'approved' ? 1 : 0) },
        { full: true, savedIds, myApplication },
      ),
    },
  };
});

export const PATCH = route(async (ctx) => {
  const user = requireRole(ctx, 'employer', 'admin');
  const job = loadOwnedJob({ ...ctx, user });
  const { errors, values } = validateJob({ ...jobToBody(job), ...ctx.body });
  if (Object.keys(errors).length) return { status: 400, body: { error: 'Validation failed', errors } };

  const status = user.role === 'admin'
    ? pickEnum(ctx.body.status, ['pending', 'approved', 'rejected', 'closed', 'expired'] as const, job.status)
    : (job.status === 'approved' ? 'pending' : job.status);

  db.prepare(
    `UPDATE jobs SET category_id = ?, location_id = ?, title = ?, company = ?, description = ?, requirements = ?,
       job_type = ?, work_mode = ?, salary_min = ?, salary_max = ?, currency = ?, vacancies = ?, deadline = ?,
       contact_email = ?, contact_phone = ?, status = ?, updated_at = datetime('now')
     WHERE id = ?`,
  ).run(values.categoryId, values.locationId, values.title, values.company, values.description, values.requirements,
    values.jobType, values.workMode, values.salaryMin, values.salaryMax, values.currency, values.vacancies, values.deadline,
    values.contactEmail, values.contactPhone, status, job.id);

  logAudit(db, user.id, 'update_job', 'job', job.id, { status });
  const row = db.prepare(`${SELECT_JOB} WHERE j.id = ?`).get(job.id) as Row;
  return {
    body: {
      job: serializeJob(row, { full: true }),
      message: status === 'pending' && job.status === 'approved' ? 'Job updated and sent back for review' : 'Job updated',
    },
  };
});

export const DELETE = route(async (ctx) => {
  const user = requireRole(ctx, 'employer', 'admin');
  const job = loadOwnedJob({ ...ctx, user });
  db.prepare('DELETE FROM jobs WHERE id = ?').run(job.id);
  logAudit(db, user.id, 'delete_job', 'job', job.id, { title: job.title });
  return { body: { ok: true } };
});
