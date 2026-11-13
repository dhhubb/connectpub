'use strict';

const express = require('express');
const { db } = require('../db');
const { requireAuth, requireRole } = require('../auth');
const {
  asyncHandler, httpError, logAudit, pageParams, ftsQuery, pickEnum, toInt, toNum,
  JOB_TYPES, WORK_MODES, JOB_TYPE_LABELS, WORK_MODE_LABELS, STATUS_LABELS,
} = require('../util');

const router = express.Router();

const SELECT_JOB = `
  SELECT j.*,
         c.name AS category_name, c.slug AS category_slug, c.icon AS category_icon,
         g.name AS group_name, g.slug AS group_slug, g.icon AS group_icon,
         l.name AS location_name, l.kind AS location_kind,
         u.name AS employer_name, u.email AS employer_email, u.phone AS employer_phone,
         (SELECT COUNT(*) FROM applications a WHERE a.job_id = j.id) AS application_count
  FROM jobs j
  LEFT JOIN categories c ON c.id = j.category_id
  LEFT JOIN category_groups g ON g.id = c.group_id
  LEFT JOIN locations l ON l.id = j.location_id
  LEFT JOIN users u ON u.id = j.employer_id`;

function serializeJob(row, { full = false, savedIds = null, myApplication = null } = {}) {
  if (!row) return null;
  const job = {
    id: row.id,
    title: row.title,
    company: row.company,
    employerId: row.employer_id,
    employerName: row.employer_name,
    category: row.category_id ? { id: row.category_id, name: row.category_name, slug: row.category_slug, icon: row.category_icon } : null,
    group: row.group_slug ? { name: row.group_name, slug: row.group_slug, icon: row.group_icon } : null,
    location: row.location_id ? { id: row.location_id, name: row.location_name, kind: row.location_kind } : null,
    jobType: row.job_type,
    jobTypeLabel: JOB_TYPE_LABELS[row.job_type] || row.job_type,
    workMode: row.work_mode,
    workModeLabel: WORK_MODE_LABELS[row.work_mode] || row.work_mode,
    salaryMin: row.salary_min,
    salaryMax: row.salary_max,
    currency: row.currency,
    salaryLabel: salaryText(row),
    vacancies: row.vacancies,
    deadline: row.deadline,
    status: row.status,
    statusLabel: STATUS_LABELS[row.status] || row.status,
    featured: Boolean(row.featured),
    views: row.views,
    applicationCount: row.application_count ?? 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    isExpired: Boolean(row.deadline && row.deadline < new Date().toISOString().slice(0, 10)),
  };
  if (full) {
    job.description = row.description;
    job.requirements = row.requirements ? row.requirements.split('\n').filter(Boolean) : [];
    job.contactEmail = row.contact_email;
    job.contactPhone = row.contact_phone;
    job.rejectionReason = row.rejection_reason;
  }
  if (savedIds) job.saved = savedIds.has(row.id);
  if (myApplication !== null) job.myApplication = myApplication;
  return job;
}

function salaryText(row) {
  if (!row.salary_min && !row.salary_max) return 'Negotiable';
  const fmt = (n) => `${row.currency} ${Number(n).toLocaleString('en-US')}`;
  if (row.salary_min && row.salary_max) return `${fmt(row.salary_min)} - ${fmt(row.salary_max)}`;
  if (row.salary_min) return `From ${fmt(row.salary_min)}`;
  return `Up to ${fmt(row.salary_max)}`;
}

function savedJobIds(userId) {
  if (!userId) return null;
  const rows = db.prepare("SELECT item_id FROM saved_items WHERE user_id = ? AND item_type = 'job'").all(userId);
  return new Set(rows.map((r) => r.item_id));
}

function resolveCategoryId(value) {
  if (value === undefined || value === null || value === '') return null;
  const asId = toInt(value);
  if (asId && db.prepare("SELECT id FROM categories WHERE id = ? AND kind = 'job'").get(asId)) return asId;
  const bySlug = db.prepare("SELECT id FROM categories WHERE slug = ? AND kind = 'job'").get(String(value));
  return bySlug ? bySlug.id : null;
}

function resolveLocationId(value) {
  if (value === undefined || value === null || value === '') return null;
  const asId = toInt(value);
  if (asId && db.prepare('SELECT id FROM locations WHERE id = ?').get(asId)) return asId;
  const bySlug = db.prepare('SELECT id FROM locations WHERE slug = ?').get(String(value));
  return bySlug ? bySlug.id : null;
}

/**
 * Resolve a group filter to the set of category ids that belong to it. Returns
 * null when the caller asked for a group that does not exist or applies to the
 * other listing kind, so an unknown slug simply yields no extra constraint.
 */
function resolveGroup(value, kind) {
  if (value === undefined || value === null || value === '') return null;
  const group = db.prepare('SELECT * FROM category_groups WHERE slug = ? OR id = ?')
    .get(String(value), toInt(value) || -1);
  if (!group) return null;
  const rows = db.prepare(`
    SELECT c.id FROM categories c
    JOIN category_groups g ON g.id = c.group_id
    WHERE c.kind = ? AND g.id = ?`).all(kind, group.id);
  return { group, categoryIds: rows.map((r) => r.id) };
}

// ---------- Public browsing ----------

router.get('/', asyncHandler((req, res) => {
  const { page, perPage, offset } = pageParams(req.query);
  const where = ["j.status = 'approved'"];
  const params = [];

  if (req.query.include_expired !== '1') {
    where.push("(j.deadline IS NULL OR j.deadline >= date('now'))");
  }
  const q = String(req.query.q || '').trim();
  const match = ftsQuery(q);
  if (match) {
    // Join against the inverted index rather than scanning with LIKE '%term%'.
    where.push('j.id IN (SELECT rowid FROM jobs_fts WHERE jobs_fts MATCH ?)');
    params.push(match);
  }
  const categoryId = resolveCategoryId(req.query.category);
  if (categoryId) { where.push('j.category_id = ?'); params.push(categoryId); }
  const groupFilter = resolveGroup(req.query.group, 'job');
  if (groupFilter) {
    if (!groupFilter.categoryIds.length) {
      where.push('1 = 0');
    } else {
      where.push(`j.category_id IN (${groupFilter.categoryIds.map(() => '?').join(',')})`);
      params.push(...groupFilter.categoryIds);
    }
  }
  const locationId = resolveLocationId(req.query.location);
  if (locationId) { where.push('j.location_id = ?'); params.push(locationId); }
  const jobType = pickEnum(req.query.job_type, JOB_TYPES, null);
  if (jobType) { where.push('j.job_type = ?'); params.push(jobType); }
  const workMode = pickEnum(req.query.work_mode, WORK_MODES, null);
  if (workMode) { where.push('j.work_mode = ?'); params.push(workMode); }
  if (req.query.featured === '1') where.push('j.featured = 1');
  const minSalary = toNum(req.query.min_salary, null);
  if (minSalary) { where.push('COALESCE(j.salary_max, j.salary_min, 0) >= ?'); params.push(minSalary); }

  const whereSql = `WHERE ${where.join(' AND ')}`;
  const sortMap = {
    recent: 'j.created_at DESC',
    oldest: 'j.created_at ASC',
    salary: 'COALESCE(j.salary_max, j.salary_min, 0) DESC',
    deadline: "CASE WHEN j.deadline IS NULL THEN 1 ELSE 0 END, j.deadline ASC",
    popular: 'j.views DESC',
    title: 'j.title ASC',
    company: 'j.company ASC',
  };
  const sortKey = String(req.query.sort || 'recent');
  const orderBy = sortMap[sortKey] || sortMap.recent;

  const total = db.prepare(`SELECT COUNT(*) AS n FROM jobs j ${whereSql}`).get(...params).n;
  const pages = Math.max(1, Math.ceil(total / perPage));
  // Clamp instead of returning an empty page when a deep link overshoots.
  const safePage = Math.min(page, pages);
  const safeOffset = (safePage - 1) * perPage;
  const rows = db.prepare(
    `${SELECT_JOB} ${whereSql} ORDER BY j.featured DESC, ${orderBy} LIMIT ? OFFSET ?`
  ).all(...params, perPage, safeOffset);

  const savedIds = savedJobIds(req.user && req.user.id);
  res.json({
    jobs: rows.map((r) => serializeJob(r, { savedIds })),
    pagination: {
      page: safePage, perPage, total, pages,
      from: total ? safeOffset + 1 : 0,
      to: Math.min(total, safeOffset + rows.length),
      hasPrev: safePage > 1, hasNext: safePage < pages,
    },
    sort: sortKey,
    group: groupFilter ? { id: groupFilter.group.id, slug: groupFilter.group.slug, name: groupFilter.group.name } : null,
    filters: { jobTypes: JOB_TYPES.map((t) => ({ value: t, label: JOB_TYPE_LABELS[t] })), workModes: WORK_MODES.map((w) => ({ value: w, label: WORK_MODE_LABELS[w] })) },
  });
}));

router.get('/:id', asyncHandler((req, res) => {
  const id = toInt(req.params.id);
  const row = db.prepare(`${SELECT_JOB} WHERE j.id = ?`).get(id);
  if (!row) throw httpError(404, 'Job not found');

  const isOwner = req.user && req.user.id === row.employer_id;
  const isAdmin = req.user && req.user.role === 'admin';
  if (row.status !== 'approved' && !isOwner && !isAdmin) throw httpError(404, 'Job not found');

  if (row.status === 'approved') db.prepare('UPDATE jobs SET views = views + 1 WHERE id = ?').run(id);

  let myApplication = null;
  if (req.user && !isAdmin) {
    const app = db.prepare('SELECT * FROM applications WHERE job_id = ? AND applicant_id = ?').get(id, req.user.id);
    myApplication = app ? serializeApplication(app) : false;
  }
  const savedIds = savedJobIds(req.user && req.user.id);
  res.json({ job: serializeJob({ ...row, views: row.views + (row.status === 'approved' ? 1 : 0) }, { full: true, savedIds, myApplication }) });
}));

router.post('/:id/apply', requireAuth, asyncHandler((req, res) => {
  const id = toInt(req.params.id);
  const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(id);
  if (!job || job.status !== 'approved') throw httpError(404, 'Job not found or not open for applications');
  if (job.employer_id === req.user.id) throw httpError(400, 'You cannot apply for your own job listing');
  if (job.deadline && job.deadline < new Date().toISOString().slice(0, 10)) throw httpError(400, 'The application deadline has passed');

  const existing = db.prepare('SELECT id FROM applications WHERE job_id = ? AND applicant_id = ?').get(id, req.user.id);
  if (existing) throw httpError(409, 'You have already applied for this job');

  const body = req.body || {};
  const info = db.prepare(
    `INSERT INTO applications (job_id, applicant_id, cover_letter, cv_url, expected_salary)
     VALUES (?, ?, ?, ?, ?)`
  ).run(id, req.user.id, String(body.coverLetter || '').trim() || null, String(body.cvUrl || '').trim() || null, toNum(body.expectedSalary, null));

  logAudit(req.user.id, 'apply', 'job', id, { applicationId: Number(info.lastInsertRowid) });
  const app = db.prepare('SELECT * FROM applications WHERE id = ?').get(Number(info.lastInsertRowid));
  res.status(201).json({ application: serializeApplication(app) });
}));

router.post('/:id/save', requireAuth, asyncHandler((req, res) => {
  const id = toInt(req.params.id);
  if (!db.prepare('SELECT id FROM jobs WHERE id = ?').get(id)) throw httpError(404, 'Job not found');
  const existing = db.prepare("SELECT id FROM saved_items WHERE user_id = ? AND item_type = 'job' AND item_id = ?").get(req.user.id, id);
  if (existing) {
    db.prepare('DELETE FROM saved_items WHERE id = ?').run(existing.id);
    return res.json({ saved: false });
  }
  db.prepare("INSERT INTO saved_items (user_id, item_type, item_id) VALUES (?, 'job', ?)").run(req.user.id, id);
  res.json({ saved: true });
}));

// ---------- Employer management ----------

function validateJob(body) {
  const errors = {};
  const title = String(body.title || '').trim();
  const company = String(body.company || '').trim();
  const description = String(body.description || '').trim();
  if (title.length < 3) errors.title = 'Job title is required';
  if (company.length < 2) errors.company = 'Company name is required';
  if (description.length < 30) errors.description = 'Please write at least 30 characters describing the role';
  const jobType = pickEnum(body.jobType, JOB_TYPES, null);
  if (!jobType) errors.jobType = 'Select a job type';
  const workMode = pickEnum(body.workMode, WORK_MODES, 'on_site');
  const salaryMin = toNum(body.salaryMin, null);
  const salaryMax = toNum(body.salaryMax, null);
  if (salaryMin !== null && salaryMax !== null && salaryMax < salaryMin) errors.salaryMax = 'Maximum salary must be greater than the minimum';
  const vacancies = toInt(body.vacancies, 1) || 1;
  if (vacancies < 1) errors.vacancies = 'At least one vacancy is required';
  const deadline = body.deadline ? String(body.deadline).slice(0, 10) : null;
  if (deadline && !/^\d{4}-\d{2}-\d{2}$/.test(deadline)) errors.deadline = 'Use the date picker to choose a deadline';
  return {
    errors,
    values: {
      title, company, description,
      requirements: String(body.requirements || '').trim() || null,
      jobType, workMode, salaryMin, salaryMax,
      currency: String(body.currency || 'USD').trim().toUpperCase().slice(0, 3) || 'USD',
      vacancies, deadline,
      contactEmail: String(body.contactEmail || '').trim() || null,
      contactPhone: String(body.contactPhone || '').trim() || null,
      categoryId: resolveCategoryId(body.categoryId ?? body.category),
      locationId: resolveLocationId(body.locationId ?? body.location),
    },
  };
}

router.get('/mine/list', requireAuth, requireRole('employer', 'admin'), asyncHandler((req, res) => {
  const rows = req.user.role === 'admin'
    ? db.prepare(`${SELECT_JOB} ORDER BY j.created_at DESC`).all()
    : db.prepare(`${SELECT_JOB} WHERE j.employer_id = ? ORDER BY j.created_at DESC`).all(req.user.id);
  res.json({ jobs: rows.map((r) => serializeJob(r)) });
}));

router.post('/', requireAuth, requireRole('employer', 'admin'), asyncHandler((req, res) => {
  const { errors, values } = validateJob(req.body || {});
  if (Object.keys(errors).length) return res.status(400).json({ error: 'Validation failed', errors });

  const autoApprove = db.prepare("SELECT value FROM settings WHERE key = 'auto_approve_jobs'").get()?.value === 'true';
  const status = req.user.role === 'admin' || autoApprove ? 'approved' : 'pending';

  const info = db.prepare(
    `INSERT INTO jobs (employer_id, category_id, location_id, title, company, description, requirements,
       job_type, work_mode, salary_min, salary_max, currency, vacancies, deadline, contact_email, contact_phone, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(req.user.id, values.categoryId, values.locationId, values.title, values.company, values.description, values.requirements,
    values.jobType, values.workMode, values.salaryMin, values.salaryMax, values.currency, values.vacancies, values.deadline,
    values.contactEmail, values.contactPhone, status);

  const id = Number(info.lastInsertRowid);
  logAudit(req.user.id, 'create_job', 'job', id, { title: values.title, status });
  const row = db.prepare(`${SELECT_JOB} WHERE j.id = ?`).get(id);
  res.status(201).json({ job: serializeJob(row, { full: true }), message: status === 'approved' ? 'Job published' : 'Job submitted for review' });
}));

function loadOwnedJob(req) {
  const id = toInt(req.params.id);
  const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(id);
  if (!job) throw httpError(404, 'Job not found');
  if (req.user.role !== 'admin' && job.employer_id !== req.user.id) throw httpError(403, 'You can only manage your own listings');
  return job;
}

router.patch('/:id', requireAuth, requireRole('employer', 'admin'), asyncHandler((req, res) => {
  const job = loadOwnedJob(req);
  const { errors, values } = validateJob({ ...jobToBody(job), ...req.body });
  if (Object.keys(errors).length) return res.status(400).json({ error: 'Validation failed', errors });

  const status = req.user.role === 'admin'
    ? pickEnum(req.body.status, ['pending', 'approved', 'rejected', 'closed', 'expired'], job.status)
    : (job.status === 'approved' ? 'pending' : job.status);

  db.prepare(
    `UPDATE jobs SET category_id = ?, location_id = ?, title = ?, company = ?, description = ?, requirements = ?,
       job_type = ?, work_mode = ?, salary_min = ?, salary_max = ?, currency = ?, vacancies = ?, deadline = ?,
       contact_email = ?, contact_phone = ?, status = ?, updated_at = datetime('now')
     WHERE id = ?`
  ).run(values.categoryId, values.locationId, values.title, values.company, values.description, values.requirements,
    values.jobType, values.workMode, values.salaryMin, values.salaryMax, values.currency, values.vacancies, values.deadline,
    values.contactEmail, values.contactPhone, status, job.id);

  logAudit(req.user.id, 'update_job', 'job', job.id, { status });
  const row = db.prepare(`${SELECT_JOB} WHERE j.id = ?`).get(job.id);
  res.json({ job: serializeJob(row, { full: true }), message: status === 'pending' && job.status === 'approved' ? 'Job updated and sent back for review' : 'Job updated' });
}));

router.delete('/:id', requireAuth, requireRole('employer', 'admin'), asyncHandler((req, res) => {
  const job = loadOwnedJob(req);
  db.prepare('DELETE FROM jobs WHERE id = ?').run(job.id);
  logAudit(req.user.id, 'delete_job', 'job', job.id, { title: job.title });
  res.json({ ok: true });
}));

function jobToBody(job) {
  return {
    title: job.title, company: job.company, description: job.description, requirements: job.requirements,
    jobType: job.job_type, workMode: job.work_mode, salaryMin: job.salary_min, salaryMax: job.salary_max,
    currency: job.currency, vacancies: job.vacancies, deadline: job.deadline,
    contactEmail: job.contact_email, contactPhone: job.contact_phone,
    categoryId: job.category_id, locationId: job.location_id,
  };
}

function serializeApplication(row) {
  if (!row) return null;
  return {
    id: row.id,
    jobId: row.job_id,
    applicantId: row.applicant_id,
    coverLetter: row.cover_letter,
    cvUrl: row.cv_url,
    expectedSalary: row.expected_salary,
    status: row.status,
    employerNote: row.employer_note,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

module.exports = { router, serializeJob, serializeApplication, resolveCategoryId, resolveLocationId, resolveGroup, SELECT_JOB };
