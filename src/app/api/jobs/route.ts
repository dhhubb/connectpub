import { db } from '@/lib/db';
import { route, requireRole } from '@/lib/http';
import {
  logAudit, pageParams, ftsQuery, pickEnum, toNum,
  JOB_TYPES, WORK_MODES, JOB_TYPE_LABELS, WORK_MODE_LABELS, type Row,
} from '@/lib/util';
import {
  SELECT_JOB, serializeJob, savedJobIds, resolveCategoryId, resolveLocationId, resolveGroup, validateJob,
} from '@/lib/jobs';

// ---------- Public browsing ----------

export const dynamic = 'force-dynamic';

export const GET = route(async (ctx) => {
  const { page, perPage } = pageParams(Object.fromEntries(ctx.query));
  const where = ["j.status = 'approved'"];
  const params: any[] = [];

  if (ctx.query.get('include_expired') !== '1') {
    where.push("(j.deadline IS NULL OR j.deadline >= date('now'))");
  }
  const q = String(ctx.query.get('q') || '').trim();
  const match = ftsQuery(q);
  if (match) {
    // Join against the inverted index rather than scanning with LIKE '%term%'.
    where.push('j.id IN (SELECT rowid FROM jobs_fts WHERE jobs_fts MATCH ?)');
    params.push(match);
  }
  const categoryId = resolveCategoryId(ctx.query.get('category'));
  if (categoryId) { where.push('j.category_id = ?'); params.push(categoryId); }
  const groupFilter = resolveGroup(ctx.query.get('group'), 'job');
  if (groupFilter) {
    if (!groupFilter.categoryIds.length) {
      where.push('1 = 0');
    } else {
      where.push(`j.category_id IN (${groupFilter.categoryIds.map(() => '?').join(',')})`);
      params.push(...groupFilter.categoryIds);
    }
  }
  const locationId = resolveLocationId(ctx.query.get('location'));
  if (locationId) { where.push('j.location_id = ?'); params.push(locationId); }
  const jobType = pickEnum(ctx.query.get('job_type'), JOB_TYPES, null);
  if (jobType) { where.push('j.job_type = ?'); params.push(jobType); }
  const workMode = pickEnum(ctx.query.get('work_mode'), WORK_MODES, null);
  if (workMode) { where.push('j.work_mode = ?'); params.push(workMode); }
  if (ctx.query.get('featured') === '1') where.push('j.featured = 1');
  const minSalary = toNum(ctx.query.get('min_salary'), null);
  if (minSalary) { where.push('COALESCE(j.salary_max, j.salary_min, 0) >= ?'); params.push(minSalary); }

  const whereSql = `WHERE ${where.join(' AND ')}`;
  const sortMap: Record<string, string> = {
    recent: 'j.created_at DESC',
    oldest: 'j.created_at ASC',
    salary: 'COALESCE(j.salary_max, j.salary_min, 0) DESC',
    deadline: "CASE WHEN j.deadline IS NULL THEN 1 ELSE 0 END, j.deadline ASC",
    popular: 'j.views DESC',
    title: 'j.title ASC',
    company: 'j.company ASC',
  };
  const sortKey = String(ctx.query.get('sort') || 'recent');
  const orderBy = sortMap[sortKey] || sortMap.recent;

  const total = (db.prepare(`SELECT COUNT(*) AS n FROM jobs j ${whereSql}`).get(...params) as { n: number }).n;
  const pages = Math.max(1, Math.ceil(total / perPage));
  // Clamp instead of returning an empty page when a deep link overshoots.
  const safePage = Math.min(page, pages);
  const safeOffset = (safePage - 1) * perPage;
  const rows = db.prepare(
    `${SELECT_JOB} ${whereSql} ORDER BY j.featured DESC, ${orderBy} LIMIT ? OFFSET ?`,
  ).all(...params, perPage, safeOffset) as Row[];

  const savedIds = savedJobIds(ctx.user?.id);
  return {
    body: {
      jobs: rows.map((r) => serializeJob(r, { savedIds })),
      pagination: {
        page: safePage, perPage, total, pages,
        from: total ? safeOffset + 1 : 0,
        to: Math.min(total, safeOffset + rows.length),
        hasPrev: safePage > 1, hasNext: safePage < pages,
      },
      sort: sortKey,
      group: groupFilter ? { id: groupFilter.group.id, slug: groupFilter.group.slug, name: groupFilter.group.name } : null,
      filters: {
        jobTypes: JOB_TYPES.map((t) => ({ value: t, label: JOB_TYPE_LABELS[t] })),
        workModes: WORK_MODES.map((w) => ({ value: w, label: WORK_MODE_LABELS[w] })),
      },
    },
  };
});

// ---------- Employer management ----------

export const POST = route(async (ctx) => {
  const user = requireRole(ctx, 'employer', 'admin');
  const { errors, values } = validateJob(ctx.body || {});
  if (Object.keys(errors).length) return { status: 400, body: { error: 'Validation failed', errors } };

  const autoApprove = (db.prepare("SELECT value FROM settings WHERE key = 'auto_approve_jobs'").get() as { value: string } | undefined)?.value === 'true';
  const status = user.role === 'admin' || autoApprove ? 'approved' : 'pending';

  const info = db.prepare(
    `INSERT INTO jobs (employer_id, category_id, location_id, title, company, description, requirements,
       job_type, work_mode, salary_min, salary_max, currency, vacancies, deadline, contact_email, contact_phone, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(user.id, values.categoryId, values.locationId, values.title, values.company, values.description, values.requirements,
    values.jobType, values.workMode, values.salaryMin, values.salaryMax, values.currency, values.vacancies, values.deadline,
    values.contactEmail, values.contactPhone, status);

  const id = Number(info.lastInsertRowid);
  logAudit(db, user.id, 'create_job', 'job', id, { title: values.title, status });
  const row = db.prepare(`${SELECT_JOB} WHERE j.id = ?`).get(id) as Row;
  return {
    status: 201,
    body: { job: serializeJob(row, { full: true }), message: status === 'approved' ? 'Job published' : 'Job submitted for review' },
  };
});
