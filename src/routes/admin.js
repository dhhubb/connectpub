'use strict';

const express = require('express');
const { db } = require('../db');
const { requireAuth, requireRole } = require('../auth');
const {
  asyncHandler, httpError, logAudit, slugify, toInt, pageParams, pickEnum, publicUser, USER_ROLES,
} = require('../util');
const { serializeJob } = require('./jobs');
const { serializeProvider } = require('./providers');
const { serializeRequestRow, serializeApplicationRow } = require('./dashboard');

const router = express.Router();
router.use(requireAuth, requireRole('admin'));

const JOB_STATUSES = ['pending', 'approved', 'rejected', 'closed', 'expired'];
const PROVIDER_STATUSES = ['pending', 'approved', 'rejected', 'suspended'];

// ---------- Dashboard statistics ----------

router.get('/stats', asyncHandler((_req, res) => {
  const one = (sql) => db.prepare(sql).get().n;
  const counts = {
    users: one('SELECT COUNT(*) AS n FROM users'),
    seekers: one("SELECT COUNT(*) AS n FROM users WHERE role = 'seeker'"),
    employers: one("SELECT COUNT(*) AS n FROM users WHERE role = 'employer'"),
    providers: one("SELECT COUNT(*) AS n FROM users WHERE role = 'provider'"),
    admins: one("SELECT COUNT(*) AS n FROM users WHERE role = 'admin'"),
    suspendedUsers: one("SELECT COUNT(*) AS n FROM users WHERE status = 'suspended'"),
    jobs: one('SELECT COUNT(*) AS n FROM jobs'),
    pendingJobs: one("SELECT COUNT(*) AS n FROM jobs WHERE status = 'pending'"),
    approvedJobs: one("SELECT COUNT(*) AS n FROM jobs WHERE status = 'approved'"),
    rejectedJobs: one("SELECT COUNT(*) AS n FROM jobs WHERE status = 'rejected'"),
    featuredJobs: one('SELECT COUNT(*) AS n FROM jobs WHERE featured = 1'),
    jobViews: one('SELECT COALESCE(SUM(views), 0) AS n FROM jobs'),
    providersTotal: one('SELECT COUNT(*) AS n FROM providers'),
    pendingProviders: one("SELECT COUNT(*) AS n FROM providers WHERE status = 'pending'"),
    approvedProviders: one("SELECT COUNT(*) AS n FROM providers WHERE status = 'approved'"),
    verifiedProviders: one("SELECT COUNT(*) AS n FROM providers WHERE verified = 1"),
    featuredProviders: one('SELECT COUNT(*) AS n FROM providers WHERE featured = 1'),
    providerViews: one('SELECT COALESCE(SUM(views), 0) AS n FROM providers'),
    applications: one('SELECT COUNT(*) AS n FROM applications'),
    serviceRequests: one('SELECT COUNT(*) AS n FROM service_requests'),
    openRequests: one("SELECT COUNT(*) AS n FROM service_requests WHERE status IN ('new','contacted','quoted','accepted')"),
    reviews: one('SELECT COUNT(*) AS n FROM reviews'),
    hiddenReviews: one("SELECT COUNT(*) AS n FROM reviews WHERE status = 'hidden'"),
    categories: one('SELECT COUNT(*) AS n FROM categories'),
    locations: one('SELECT COUNT(*) AS n FROM locations'),
  };

  const usersByRole = db.prepare('SELECT role AS label, COUNT(*) AS count FROM users GROUP BY role').all();
  const jobsByStatus = db.prepare('SELECT status AS label, COUNT(*) AS count FROM jobs GROUP BY status').all();
  const providersByStatus = db.prepare('SELECT status AS label, COUNT(*) AS count FROM providers GROUP BY status').all();
  const applicationsByStatus = db.prepare('SELECT status AS label, COUNT(*) AS count FROM applications GROUP BY status').all();
  const requestsByStatus = db.prepare('SELECT status AS label, COUNT(*) AS count FROM service_requests GROUP BY status').all();

  const jobsByCategory = db.prepare(`
    SELECT c.name AS label, c.icon AS icon, COUNT(j.id) AS count
    FROM categories c LEFT JOIN jobs j ON j.category_id = c.id
    WHERE c.kind = 'job' GROUP BY c.id ORDER BY count DESC`).all();
  const providersByCategory = db.prepare(`
    SELECT c.name AS label, c.icon AS icon, COUNT(p.id) AS count
    FROM categories c LEFT JOIN providers p ON p.category_id = c.id
    WHERE c.kind = 'service' GROUP BY c.id ORDER BY count DESC`).all();
  const activityByLocation = db.prepare(`
    SELECT l.name AS label,
      (SELECT COUNT(*) FROM jobs j WHERE j.location_id = l.id) AS jobs,
      (SELECT COUNT(*) FROM providers p WHERE p.location_id = l.id) AS providers
    FROM locations l ORDER BY (jobs + providers) DESC LIMIT 10`).all();

  const signups = db.prepare(`
    WITH RECURSIVE days(d) AS (
      SELECT date('now', '-13 days') UNION ALL SELECT date(d, '+1 day') FROM days WHERE d < date('now')
    )
    SELECT d AS day,
      (SELECT COUNT(*) FROM users u WHERE date(u.created_at) = d) AS users,
      (SELECT COUNT(*) FROM jobs j WHERE date(j.created_at) = d) AS jobs,
      (SELECT COUNT(*) FROM providers p WHERE date(p.created_at) = d) AS providers,
      (SELECT COUNT(*) FROM applications a WHERE date(a.created_at) = d) AS applications
    FROM days`).all();

  const topJobs = db.prepare(`
    SELECT j.id, j.title, j.company, j.views,
      (SELECT COUNT(*) FROM applications a WHERE a.job_id = j.id) AS applications
    FROM jobs j WHERE j.status = 'approved' ORDER BY j.views DESC LIMIT 8`).all();

  const topProviders = db.prepare(`
    SELECT p.id, p.business_name, p.views,
      (SELECT COUNT(*) FROM service_requests r WHERE r.provider_id = p.id) AS requests,
      CASE WHEN p.rating_count > 0 THEN ROUND(p.rating_sum * 1.0 / p.rating_count, 1) ELSE NULL END AS rating
    FROM providers p WHERE p.status = 'approved' ORDER BY p.views DESC LIMIT 8`).all();

  const recentAudit = db.prepare(`
    SELECT a.*, u.name AS actor_name FROM audit_log a LEFT JOIN users u ON u.id = a.actor_id
    ORDER BY a.created_at DESC LIMIT 12`).all();

  res.json({
    counts, usersByRole, jobsByStatus, providersByStatus, applicationsByStatus, requestsByStatus,
    jobsByCategory, providersByCategory, activityByLocation, signups, topJobs, topProviders,
    recentAudit: recentAudit.map(serializeAudit),
  });
}));

function serializeAudit(row) {
  let details = row.details;
  if (details) {
    try { details = JSON.parse(details); } catch { /* keep raw string */ }
  }
  return {
    id: row.id, actorId: row.actor_id, actorName: row.actor_name, action: row.action,
    entity: row.entity, entityId: row.entity_id, details, createdAt: row.created_at,
  };
}

// ---------- Moderation queues ----------

router.get('/jobs', asyncHandler((req, res) => {
  const { page, perPage, offset } = pageParams(req.query);
  const where = [];
  const params = [];
  const status = pickEnum(req.query.status, JOB_STATUSES, null);
  if (status) { where.push('j.status = ?'); params.push(status); }
  const q = String(req.query.q || '').trim();
  if (q) { where.push('(j.title LIKE ? OR j.company LIKE ?)'); params.push(`%${q}%`, `%${q}%`); }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const total = db.prepare(`SELECT COUNT(*) AS n FROM jobs j ${whereSql}`).get(...params).n;
  const rows = db.prepare(`
    SELECT j.*, c.name AS category_name, c.icon AS category_icon, l.name AS location_name,
           u.name AS employer_name, u.email AS employer_email,
           (SELECT COUNT(*) FROM applications a WHERE a.job_id = j.id) AS application_count
    FROM jobs j LEFT JOIN categories c ON c.id = j.category_id
    LEFT JOIN locations l ON l.id = j.location_id LEFT JOIN users u ON u.id = j.employer_id
    ${whereSql} ORDER BY CASE j.status WHEN 'pending' THEN 0 ELSE 1 END, j.created_at DESC
    LIMIT ? OFFSET ?`).all(...params, perPage, offset);

  res.json({ jobs: rows.map((r) => serializeJob(r, { full: true })), pagination: { page, perPage, total, pages: Math.max(1, Math.ceil(total / perPage)) } });
}));

router.patch('/jobs/:id', asyncHandler((req, res) => {
  const id = toInt(req.params.id);
  const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(id);
  if (!job) throw httpError(404, 'Job not found');
  const body = req.body || {};
  const status = body.status !== undefined ? pickEnum(body.status, JOB_STATUSES, null) : job.status;
  if (body.status !== undefined && !status) throw httpError(400, 'Unknown job status');
  const featured = body.featured !== undefined ? (body.featured ? 1 : 0) : job.featured;
  const reason = status === 'rejected' ? String(body.rejectionReason || 'Does not meet listing guidelines').trim() : null;

  db.prepare("UPDATE jobs SET status = ?, featured = ?, rejection_reason = ?, updated_at = datetime('now') WHERE id = ?")
    .run(status, featured, reason, id);
  logAudit(req.user.id, 'moderate_job', 'job', id, { status, featured: Boolean(featured) });

  const row = db.prepare(`
    SELECT j.*, c.name AS category_name, c.icon AS category_icon, l.name AS location_name,
           u.name AS employer_name, u.email AS employer_email,
           (SELECT COUNT(*) FROM applications a WHERE a.job_id = j.id) AS application_count
    FROM jobs j LEFT JOIN categories c ON c.id = j.category_id
    LEFT JOIN locations l ON l.id = j.location_id LEFT JOIN users u ON u.id = j.employer_id
    WHERE j.id = ?`).get(id);
  res.json({ job: serializeJob(row, { full: true }), message: `Job ${status}` });
}));

router.get('/providers', asyncHandler((req, res) => {
  const { page, perPage, offset } = pageParams(req.query);
  const where = [];
  const params = [];
  const status = pickEnum(req.query.status, PROVIDER_STATUSES, null);
  if (status) { where.push('p.status = ?'); params.push(status); }
  const q = String(req.query.q || '').trim();
  if (q) { where.push('(p.business_name LIKE ? OR p.email LIKE ?)'); params.push(`%${q}%`, `%${q}%`); }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const total = db.prepare(`SELECT COUNT(*) AS n FROM providers p ${whereSql}`).get(...params).n;
  const rows = db.prepare(`
    SELECT p.*, c.name AS category_name, c.icon AS category_icon, l.name AS location_name,
           u.name AS owner_name, u.email AS owner_email,
           (SELECT COUNT(*) FROM service_requests r WHERE r.provider_id = p.id) AS request_count
    FROM providers p LEFT JOIN categories c ON c.id = p.category_id
    LEFT JOIN locations l ON l.id = p.location_id LEFT JOIN users u ON u.id = p.owner_id
    ${whereSql} ORDER BY CASE p.status WHEN 'pending' THEN 0 ELSE 1 END, p.created_at DESC
    LIMIT ? OFFSET ?`).all(...params, perPage, offset);

  res.json({
    providers: rows.map((r) => ({ ...serializeProvider(r, { full: true }), requestCount: r.request_count })),
    pagination: { page, perPage, total, pages: Math.max(1, Math.ceil(total / perPage)) },
  });
}));

router.patch('/providers/:id', asyncHandler((req, res) => {
  const id = toInt(req.params.id);
  const provider = db.prepare('SELECT * FROM providers WHERE id = ?').get(id);
  if (!provider) throw httpError(404, 'Service provider not found');
  const body = req.body || {};
  const status = body.status !== undefined ? pickEnum(body.status, PROVIDER_STATUSES, null) : provider.status;
  if (body.status !== undefined && !status) throw httpError(400, 'Unknown provider status');
  const verified = body.verified !== undefined ? (body.verified ? 1 : 0) : provider.verified;
  const featured = body.featured !== undefined ? (body.featured ? 1 : 0) : provider.featured;
  const reason = status === 'rejected' ? String(body.rejectionReason || 'Does not meet listing guidelines').trim() : null;

  db.prepare(`UPDATE providers SET status = ?, verified = ?, featured = ?, rejection_reason = ?, updated_at = datetime('now') WHERE id = ?`)
    .run(status, verified, featured, reason, id);
  logAudit(req.user.id, 'moderate_provider', 'provider', id, { status, verified: Boolean(verified), featured: Boolean(featured) });

  const row = db.prepare(`
    SELECT p.*, c.name AS category_name, c.icon AS category_icon, l.name AS location_name,
           u.name AS owner_name, u.email AS owner_email,
           (SELECT COUNT(*) FROM service_requests r WHERE r.provider_id = p.id) AS request_count
    FROM providers p LEFT JOIN categories c ON c.id = p.category_id
    LEFT JOIN locations l ON l.id = p.location_id LEFT JOIN users u ON u.id = p.owner_id
    WHERE p.id = ?`).get(id);
  res.json({ provider: { ...serializeProvider(row, { full: true }), requestCount: row.request_count }, message: `Listing ${status}` });
}));

// ---------- Users ----------

router.get('/users', asyncHandler((req, res) => {
  const { page, perPage, offset } = pageParams(req.query);
  const where = [];
  const params = [];
  const role = pickEnum(req.query.role, USER_ROLES, null);
  if (role) { where.push('role = ?'); params.push(role); }
  const status = pickEnum(req.query.status, ['active', 'suspended'], null);
  if (status) { where.push('status = ?'); params.push(status); }
  const q = String(req.query.q || '').trim();
  if (q) { where.push('(name LIKE ? OR email LIKE ? OR phone LIKE ?)'); params.push(`%${q}%`, `%${q}%`, `%${q}%`); }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const total = db.prepare(`SELECT COUNT(*) AS n FROM users ${whereSql}`).get(...params).n;
  const rows = db.prepare(`
    SELECT u.*,
      (SELECT COUNT(*) FROM jobs j WHERE j.employer_id = u.id) AS job_count,
      (SELECT COUNT(*) FROM providers p WHERE p.owner_id = u.id) AS provider_count,
      (SELECT COUNT(*) FROM applications a WHERE a.applicant_id = u.id) AS application_count
    FROM users u ${whereSql} ORDER BY u.created_at DESC LIMIT ? OFFSET ?`).all(...params, perPage, offset);

  res.json({
    users: rows.map((r) => ({ ...publicUser(r), jobCount: r.job_count, providerCount: r.provider_count, applicationCount: r.application_count })),
    pagination: { page, perPage, total, pages: Math.max(1, Math.ceil(total / perPage)) },
  });
}));

router.post('/users', asyncHandler((req, res) => {
  const body = req.body || {};
  const name = String(body.name || '').trim();
  const email = String(body.email || '').trim().toLowerCase();
  const password = String(body.password || '');
  const role = pickEnum(body.role, USER_ROLES, 'seeker');
  const errors = {};
  if (name.length < 2) errors.name = 'Name is required';
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) errors.email = 'Valid email required';
  if (password.length < 8) errors.password = 'Password must be at least 8 characters';
  if (Object.keys(errors).length) return res.status(400).json({ error: 'Validation failed', errors });
  if (db.prepare('SELECT id FROM users WHERE lower(email) = lower(?)').get(email)) {
    return res.status(409).json({ error: 'Email already registered', errors: { email: 'Email already registered' } });
  }
  const { hashPassword } = require('../auth');
  const info = db.prepare(
    `INSERT INTO users (name, email, phone, password_hash, role, status, ward, bio)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(name, email, String(body.phone || '').trim() || null, hashPassword(password), role,
    pickEnum(body.status, ['active', 'suspended'], 'active'), String(body.ward || '').trim() || null, String(body.bio || '').trim() || null);

  const id = Number(info.lastInsertRowid);
  logAudit(req.user.id, 'create_user', 'user', id, { role });
  res.status(201).json({ user: publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(id)) });
}));

router.patch('/users/:id', asyncHandler((req, res) => {
  const id = toInt(req.params.id);
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  if (!user) throw httpError(404, 'User not found');
  const body = req.body || {};

  const role = body.role !== undefined ? pickEnum(body.role, USER_ROLES, null) : user.role;
  if (body.role !== undefined && !role) throw httpError(400, 'Unknown role');
  const status = body.status !== undefined ? pickEnum(body.status, ['active', 'suspended'], null) : user.status;
  if (body.status !== undefined && !status) throw httpError(400, 'Unknown status');

  if (id === req.user.id && (role !== 'admin' || status !== 'active')) {
    throw httpError(400, 'You cannot remove your own admin access or suspend your own account');
  }
  if (user.role === 'admin' && role !== 'admin') {
    const admins = db.prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'admin' AND status = 'active'").get().n;
    if (admins <= 1) throw httpError(400, 'At least one active administrator must remain');
  }

  db.prepare('UPDATE users SET name = ?, phone = ?, role = ?, status = ?, ward = ?, bio = ? WHERE id = ?')
    .run(String(body.name ?? user.name).trim(), String(body.phone ?? user.phone ?? '').trim() || null, role, status,
      String(body.ward ?? user.ward ?? '').trim() || null, String(body.bio ?? user.bio ?? '').trim() || null, id);
  logAudit(req.user.id, 'update_user', 'user', id, { role, status });
  res.json({ user: publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(id)) });
}));

router.post('/users/:id/reset-password', asyncHandler((req, res) => {
  const id = toInt(req.params.id);
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  if (!user) throw httpError(404, 'User not found');
  const password = String((req.body || {}).password || '');
  if (password.length < 8) return res.status(400).json({ error: 'Validation failed', errors: { password: 'Password must be at least 8 characters' } });
  const { hashPassword } = require('../auth');
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(password), id);
  logAudit(req.user.id, 'reset_password', 'user', id, null);
  res.json({ ok: true, message: 'Password updated' });
}));

router.delete('/users/:id', asyncHandler((req, res) => {
  const id = toInt(req.params.id);
  if (id === req.user.id) throw httpError(400, 'You cannot delete your own account');
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  if (!user) throw httpError(404, 'User not found');
  if (user.role === 'admin') {
    const admins = db.prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'admin'").get().n;
    if (admins <= 1) throw httpError(400, 'At least one administrator must remain');
  }
  db.prepare('DELETE FROM users WHERE id = ?').run(id);
  logAudit(req.user.id, 'delete_user', 'user', id, { email: user.email });
  res.json({ ok: true });
}));

// ---------- Categories ----------

router.get('/categories', asyncHandler((_req, res) => {
  const rows = db.prepare(`
    SELECT c.*,
      (SELECT COUNT(*) FROM jobs j WHERE j.category_id = c.id) AS job_count,
      (SELECT COUNT(*) FROM providers p WHERE p.category_id = c.id) AS provider_count
    FROM categories c ORDER BY c.kind, c.name`).all();
  res.json({ categories: rows.map((c) => ({ id: c.id, name: c.name, slug: c.slug, kind: c.kind, icon: c.icon, description: c.description, jobCount: c.job_count, providerCount: c.provider_count })) });
}));

router.post('/categories', asyncHandler((req, res) => {
  const body = req.body || {};
  const name = String(body.name || '').trim();
  const kind = pickEnum(body.kind, ['job', 'service'], null);
  if (name.length < 2) return res.status(400).json({ error: 'Validation failed', errors: { name: 'Category name is required' } });
  if (!kind) return res.status(400).json({ error: 'Validation failed', errors: { kind: 'Choose job or service' } });
  const slug = slugify(body.slug || name);
  if (db.prepare('SELECT id FROM categories WHERE slug = ?').get(slug)) {
    return res.status(409).json({ error: 'A category with that name already exists', errors: { name: 'Name already used' } });
  }
  const info = db.prepare('INSERT INTO categories (name, slug, kind, icon, description) VALUES (?, ?, ?, ?, ?)')
    .run(name, slug, kind, String(body.icon || '📌').trim(), String(body.description || '').trim() || null);
  logAudit(req.user.id, 'create_category', 'category', Number(info.lastInsertRowid), { name, kind });
  res.status(201).json({ category: db.prepare('SELECT * FROM categories WHERE id = ?').get(Number(info.lastInsertRowid)) });
}));

router.patch('/categories/:id', asyncHandler((req, res) => {
  const id = toInt(req.params.id);
  const category = db.prepare('SELECT * FROM categories WHERE id = ?').get(id);
  if (!category) throw httpError(404, 'Category not found');
  const body = req.body || {};
  const name = String(body.name ?? category.name).trim();
  const slug = slugify(body.slug || name);
  if (db.prepare('SELECT id FROM categories WHERE slug = ? AND id != ?').get(slug, id)) {
    return res.status(409).json({ error: 'Another category already uses that name', errors: { name: 'Name already used' } });
  }
  db.prepare('UPDATE categories SET name = ?, slug = ?, kind = ?, icon = ?, description = ? WHERE id = ?')
    .run(name, slug, pickEnum(body.kind, ['job', 'service'], category.kind), String(body.icon ?? category.icon ?? '📌'),
      String(body.description ?? category.description ?? '').trim() || null, id);
  logAudit(req.user.id, 'update_category', 'category', id, { name });
  res.json({ category: db.prepare('SELECT * FROM categories WHERE id = ?').get(id) });
}));

router.delete('/categories/:id', asyncHandler((req, res) => {
  const id = toInt(req.params.id);
  const category = db.prepare('SELECT * FROM categories WHERE id = ?').get(id);
  if (!category) throw httpError(404, 'Category not found');
  const jobs = db.prepare('SELECT COUNT(*) AS n FROM jobs WHERE category_id = ?').get(id).n;
  const providers = db.prepare('SELECT COUNT(*) AS n FROM providers WHERE category_id = ?').get(id).n;
  if (jobs + providers > 0) throw httpError(400, `Move the ${jobs + providers} listing(s) using this category before deleting it`);
  db.prepare('DELETE FROM categories WHERE id = ?').run(id);
  logAudit(req.user.id, 'delete_category', 'category', id, { name: category.name });
  res.json({ ok: true });
}));

// ---------- Locations ----------

router.get('/locations', asyncHandler((_req, res) => {
  const rows = db.prepare(`
    SELECT l.*,
      (SELECT COUNT(*) FROM jobs j WHERE j.location_id = l.id) AS job_count,
      (SELECT COUNT(*) FROM providers p WHERE p.location_id = l.id) AS provider_count
    FROM locations l ORDER BY l.kind, l.name`).all();
  res.json({ locations: rows.map((l) => ({ id: l.id, name: l.name, slug: l.slug, kind: l.kind, notes: l.notes, jobCount: l.job_count, providerCount: l.provider_count })) });
}));

router.post('/locations', asyncHandler((req, res) => {
  const body = req.body || {};
  const name = String(body.name || '').trim();
  const kind = pickEnum(body.kind, ['town', 'ward', 'village'], 'ward');
  if (name.length < 2) return res.status(400).json({ error: 'Validation failed', errors: { name: 'Location name is required' } });
  const slug = slugify(body.slug || name);
  if (db.prepare('SELECT id FROM locations WHERE slug = ?').get(slug)) {
    return res.status(409).json({ error: 'That location already exists', errors: { name: 'Name already used' } });
  }
  const info = db.prepare('INSERT INTO locations (name, slug, kind, notes) VALUES (?, ?, ?, ?)')
    .run(name, slug, kind, String(body.notes || '').trim() || null);
  logAudit(req.user.id, 'create_location', 'location', Number(info.lastInsertRowid), { name, kind });
  res.status(201).json({ location: db.prepare('SELECT * FROM locations WHERE id = ?').get(Number(info.lastInsertRowid)) });
}));

router.patch('/locations/:id', asyncHandler((req, res) => {
  const id = toInt(req.params.id);
  const location = db.prepare('SELECT * FROM locations WHERE id = ?').get(id);
  if (!location) throw httpError(404, 'Location not found');
  const body = req.body || {};
  const name = String(body.name ?? location.name).trim();
  const slug = slugify(body.slug || name);
  if (db.prepare('SELECT id FROM locations WHERE slug = ? AND id != ?').get(slug, id)) {
    return res.status(409).json({ error: 'Another location already uses that name', errors: { name: 'Name already used' } });
  }
  db.prepare('UPDATE locations SET name = ?, slug = ?, kind = ?, notes = ? WHERE id = ?')
    .run(name, slug, pickEnum(body.kind, ['town', 'ward', 'village'], location.kind),
      String(body.notes ?? location.notes ?? '').trim() || null, id);
  logAudit(req.user.id, 'update_location', 'location', id, { name });
  res.json({ location: db.prepare('SELECT * FROM locations WHERE id = ?').get(id) });
}));

router.delete('/locations/:id', asyncHandler((req, res) => {
  const id = toInt(req.params.id);
  const location = db.prepare('SELECT * FROM locations WHERE id = ?').get(id);
  if (!location) throw httpError(404, 'Location not found');
  const jobs = db.prepare('SELECT COUNT(*) AS n FROM jobs WHERE location_id = ?').get(id).n;
  const providers = db.prepare('SELECT COUNT(*) AS n FROM providers WHERE location_id = ?').get(id).n;
  if (jobs + providers > 0) throw httpError(400, `Move the ${jobs + providers} listing(s) using this location before deleting it`);
  db.prepare('DELETE FROM locations WHERE id = ?').run(id);
  logAudit(req.user.id, 'delete_location', 'location', id, { name: location.name });
  res.json({ ok: true });
}));

// ---------- Applications, requests, reviews ----------

router.get('/applications', asyncHandler((req, res) => {
  const rows = db.prepare(`
    SELECT a.*, j.title AS job_title, j.company, j.status AS job_status,
           u.name AS applicant_name, u.email AS applicant_email, u.phone AS applicant_phone
    FROM applications a JOIN jobs j ON j.id = a.job_id JOIN users u ON u.id = a.applicant_id
    ORDER BY a.created_at DESC LIMIT 200`).all();
  res.json({ applications: rows.map(serializeApplicationRow) });
}));

router.get('/service-requests', asyncHandler((_req, res) => {
  const rows = db.prepare(`
    SELECT r.*, p.business_name, p.id AS provider_id, u.name AS requester_name
    FROM service_requests r JOIN providers p ON p.id = r.provider_id
    LEFT JOIN users u ON u.id = r.requester_id ORDER BY r.created_at DESC LIMIT 200`).all();
  res.json({ requests: rows.map(serializeRequestRow) });
}));

router.get('/reviews', asyncHandler((_req, res) => {
  const rows = db.prepare(`
    SELECT r.*, p.business_name, u.name AS user_name FROM reviews r
    JOIN providers p ON p.id = r.provider_id JOIN users u ON u.id = r.user_id
    ORDER BY r.created_at DESC LIMIT 200`).all();
  res.json({
    reviews: rows.map((r) => ({
      id: r.id, providerId: r.provider_id, businessName: r.business_name, userId: r.user_id,
      userName: r.user_name, rating: r.rating, comment: r.comment, status: r.status, createdAt: r.created_at,
    })),
  });
}));

router.patch('/reviews/:id', asyncHandler((req, res) => {
  const id = toInt(req.params.id);
  const review = db.prepare('SELECT * FROM reviews WHERE id = ?').get(id);
  if (!review) throw httpError(404, 'Review not found');
  const status = pickEnum((req.body || {}).status, ['published', 'hidden'], null);
  if (!status) throw httpError(400, 'Unknown review status');
  db.prepare('UPDATE reviews SET status = ? WHERE id = ?').run(status, id);
  db.prepare(`
    UPDATE providers SET
      rating_sum = (SELECT COALESCE(SUM(rating), 0) FROM reviews WHERE provider_id = ? AND status = 'published'),
      rating_count = (SELECT COUNT(*) FROM reviews WHERE provider_id = ? AND status = 'published')
    WHERE id = ?`).run(review.provider_id, review.provider_id, review.provider_id);
  logAudit(req.user.id, 'moderate_review', 'review', id, { status });
  res.json({ ok: true });
}));

router.delete('/reviews/:id', asyncHandler((req, res) => {
  const id = toInt(req.params.id);
  const review = db.prepare('SELECT * FROM reviews WHERE id = ?').get(id);
  if (!review) throw httpError(404, 'Review not found');
  db.prepare('DELETE FROM reviews WHERE id = ?').run(id);
  db.prepare(`
    UPDATE providers SET
      rating_sum = (SELECT COALESCE(SUM(rating), 0) FROM reviews WHERE provider_id = ? AND status = 'published'),
      rating_count = (SELECT COUNT(*) FROM reviews WHERE provider_id = ? AND status = 'published')
    WHERE id = ?`).run(review.provider_id, review.provider_id, review.provider_id);
  logAudit(req.user.id, 'delete_review', 'review', id, null);
  res.json({ ok: true });
}));

// ---------- Audit log and settings ----------

router.get('/audit', asyncHandler((req, res) => {
  const { page, perPage, offset } = pageParams(req.query);
  const where = [];
  const params = [];
  const entity = String(req.query.entity || '').trim();
  if (entity) { where.push('a.entity = ?'); params.push(entity); }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const total = db.prepare(`SELECT COUNT(*) AS n FROM audit_log a ${whereSql}`).get(...params).n;
  const rows = db.prepare(`
    SELECT a.*, u.name AS actor_name FROM audit_log a LEFT JOIN users u ON u.id = a.actor_id
    ${whereSql} ORDER BY a.created_at DESC LIMIT ? OFFSET ?`).all(...params, perPage, offset);
  res.json({ entries: rows.map(serializeAudit), pagination: { page, perPage, total, pages: Math.max(1, Math.ceil(total / perPage)) } });
}));

router.get('/settings', asyncHandler((_req, res) => {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const settings = {};
  for (const row of rows) settings[row.key] = row.value;
  res.json({ settings });
}));

router.patch('/settings', asyncHandler((req, res) => {
  const body = req.body || {};
  const allowed = ['site_name', 'province', 'town', 'auto_approve_jobs', 'auto_approve_providers', 'contact_email'];
  const upsert = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');
  const changed = {};
  for (const key of allowed) {
    if (body[key] !== undefined) {
      const value = typeof body[key] === 'boolean' ? String(body[key]) : String(body[key]);
      upsert.run(key, value);
      changed[key] = value;
    }
  }
  logAudit(req.user.id, 'update_settings', 'settings', null, changed);
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const settings = {};
  for (const row of rows) settings[row.key] = row.value;
  res.json({ settings, message: 'Settings saved' });
}));

module.exports = router;
