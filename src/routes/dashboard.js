'use strict';

const express = require('express');
const { db } = require('../db');
const { requireAuth } = require('../auth');
const {
  asyncHandler, httpError, logAudit, toInt, pickEnum,
  APPLICATION_STATUSES, REQUEST_STATUSES,
  APPLICATION_STATUS_LABELS, REQUEST_STATUS_LABELS,
} = require('../util');
const { serializeJob, serializeApplication } = require('./jobs');
const { serializeProvider } = require('./providers');

const router = express.Router();
router.use(requireAuth);

// ---------- Overview ----------

router.get('/overview', asyncHandler((req, res) => {
  const user = req.user;
  const cards = {};
  const one = (sql, ...args) => db.prepare(sql).get(...args).n;

  if (user.role === 'seeker') {
    cards.applications = one('SELECT COUNT(*) AS n FROM applications WHERE applicant_id = ?', user.id);
    cards.shortlisted = one("SELECT COUNT(*) AS n FROM applications WHERE applicant_id = ? AND status IN ('shortlisted','interview','hired')", user.id);
    cards.savedJobs = one("SELECT COUNT(*) AS n FROM saved_items WHERE user_id = ? AND item_type = 'job'", user.id);
    cards.savedProviders = one("SELECT COUNT(*) AS n FROM saved_items WHERE user_id = ? AND item_type = 'provider'", user.id);
  } else if (user.role === 'employer') {
    cards.jobs = one('SELECT COUNT(*) AS n FROM jobs WHERE employer_id = ?', user.id);
    cards.published = one("SELECT COUNT(*) AS n FROM jobs WHERE employer_id = ? AND status = 'approved'", user.id);
    cards.pendingReview = one("SELECT COUNT(*) AS n FROM jobs WHERE employer_id = ? AND status = 'pending'", user.id);
    cards.applications = one('SELECT COUNT(*) AS n FROM applications a JOIN jobs j ON j.id = a.job_id WHERE j.employer_id = ?', user.id);
    cards.shortlisted = one("SELECT COUNT(*) AS n FROM applications a JOIN jobs j ON j.id = a.job_id WHERE j.employer_id = ? AND a.status IN ('shortlisted','interview')", user.id);
    cards.hired = one("SELECT COUNT(*) AS n FROM applications a JOIN jobs j ON j.id = a.job_id WHERE j.employer_id = ? AND a.status = 'hired'", user.id);
    cards.jobViews = one('SELECT COALESCE(SUM(views), 0) AS n FROM jobs WHERE employer_id = ?', user.id);
  } else if (user.role === 'provider') {
    cards.listings = one('SELECT COUNT(*) AS n FROM providers WHERE owner_id = ?', user.id);
    cards.published = one("SELECT COUNT(*) AS n FROM providers WHERE owner_id = ? AND status = 'approved'", user.id);
    cards.pendingReview = one("SELECT COUNT(*) AS n FROM providers WHERE owner_id = ? AND status = 'pending'", user.id);
    cards.requests = one('SELECT COUNT(*) AS n FROM service_requests r JOIN providers p ON p.id = r.provider_id WHERE p.owner_id = ?', user.id);
    cards.newRequests = one("SELECT COUNT(*) AS n FROM service_requests r JOIN providers p ON p.id = r.provider_id WHERE p.owner_id = ? AND r.status = 'new'", user.id);
    cards.completed = one("SELECT COUNT(*) AS n FROM service_requests r JOIN providers p ON p.id = r.provider_id WHERE p.owner_id = ? AND r.status = 'completed'", user.id);
    cards.listingViews = one('SELECT COALESCE(SUM(views), 0) AS n FROM providers WHERE owner_id = ?', user.id);
    const agg = db.prepare(`
      SELECT COALESCE(SUM(rating_sum), 0) AS s, COALESCE(SUM(rating_count), 0) AS c
      FROM providers WHERE owner_id = ?`).get(user.id);
    cards.averageRating = agg.c ? Math.round((agg.s / agg.c) * 10) / 10 : null;
  } else {
    cards.jobs = one('SELECT COUNT(*) AS n FROM jobs');
    cards.providers = one('SELECT COUNT(*) AS n FROM providers');
    cards.users = one('SELECT COUNT(*) AS n FROM users');
    cards.applications = one('SELECT COUNT(*) AS n FROM applications');
    cards.requests = one('SELECT COUNT(*) AS n FROM service_requests');
  }

  const recentApplications = user.role === 'seeker'
    ? db.prepare(`
        SELECT a.*, j.title AS job_title, j.company, j.status AS job_status
        FROM applications a JOIN jobs j ON j.id = a.job_id
        WHERE a.applicant_id = ? ORDER BY a.created_at DESC LIMIT 5`).all(user.id)
    : db.prepare(`
        SELECT a.*, j.title AS job_title, j.company, u.name AS applicant_name, u.email AS applicant_email
        FROM applications a JOIN jobs j ON j.id = a.job_id JOIN users u ON u.id = a.applicant_id
        WHERE j.employer_id = ? ORDER BY a.created_at DESC LIMIT 5`).all(user.id);

  const recentRequests = user.role === 'provider'
    ? db.prepare(`
        SELECT r.*, p.business_name FROM service_requests r JOIN providers p ON p.id = r.provider_id
        WHERE p.owner_id = ? ORDER BY r.created_at DESC LIMIT 5`).all(user.id)
    : db.prepare(`
        SELECT r.*, p.business_name FROM service_requests r JOIN providers p ON p.id = r.provider_id
        WHERE r.requester_id = ? ORDER BY r.created_at DESC LIMIT 5`).all(user.id);

  res.json({
    role: user.role,
    cards,
    recentApplications: user.role === 'provider' ? [] : recentApplications.map(serializeApplicationRow),
    recentRequests: recentRequests.map(serializeRequestRow),
  });
}));

// ---------- Applications (seeker view) ----------

router.get('/applications', asyncHandler((req, res) => {
  const rows = db.prepare(`
    SELECT a.*, j.title AS job_title, j.company, j.status AS job_status, j.deadline,
           l.name AS location_name, c.name AS category_name, c.icon AS category_icon
    FROM applications a
    JOIN jobs j ON j.id = a.job_id
    LEFT JOIN locations l ON l.id = j.location_id
    LEFT JOIN categories c ON c.id = j.category_id
    WHERE a.applicant_id = ? ORDER BY a.created_at DESC`).all(req.user.id);
  res.json({ applications: rows.map(serializeApplicationRow) });
}));

router.patch('/applications/:id', asyncHandler((req, res) => {
  const id = toInt(req.params.id);
  const app = db.prepare('SELECT * FROM applications WHERE id = ?').get(id);
  if (!app) throw httpError(404, 'Application not found');
  const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(app.job_id);

  if (job.employer_id === req.user.id) {
    const status = pickEnum((req.body || {}).status, APPLICATION_STATUSES, null);
    if (!status) throw httpError(400, 'Unknown application status');
    const note = (req.body || {}).employerNote !== undefined ? String(req.body.employerNote).trim() || null : app.employer_note;
    db.prepare("UPDATE applications SET status = ?, employer_note = ?, updated_at = datetime('now') WHERE id = ?").run(status, note, id);
    logAudit(req.user.id, 'update_application', 'application', id, { status });
  } else if (app.applicant_id === req.user.id) {
    const status = pickEnum((req.body || {}).status, ['withdrawn'], null);
    if (!status) throw httpError(403, 'Only the employer can change the application status');
    db.prepare("UPDATE applications SET status = 'withdrawn', updated_at = datetime('now') WHERE id = ?").run(id);
    logAudit(req.user.id, 'withdraw_application', 'application', id, null);
  } else {
    throw httpError(403, 'You cannot modify this application');
  }

  const updated = db.prepare(`
    SELECT a.*, j.title AS job_title, j.company, u.name AS applicant_name, u.email AS applicant_email
    FROM applications a JOIN jobs j ON j.id = a.job_id JOIN users u ON u.id = a.applicant_id
    WHERE a.id = ?`).get(id);
  res.json({ application: serializeApplicationRow(updated) });
}));

// ---------- Applications (employer view) ----------

router.get('/job-applications', asyncHandler((req, res) => {
  const where = [];
  const params = [];
  if (req.user.role !== 'admin') { where.push('j.employer_id = ?'); params.push(req.user.id); }
  const jobId = toInt(req.query.job_id);
  if (jobId) { where.push('a.job_id = ?'); params.push(jobId); }
  const status = pickEnum(req.query.status, APPLICATION_STATUSES, null);
  if (status) { where.push('a.status = ?'); params.push(status); }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const rows = db.prepare(`
    SELECT a.*, j.title AS job_title, j.company, j.status AS job_status,
           u.name AS applicant_name, u.email AS applicant_email, u.phone AS applicant_phone, u.ward AS applicant_ward, u.bio AS applicant_bio
    FROM applications a JOIN jobs j ON j.id = a.job_id JOIN users u ON u.id = a.applicant_id
    ${whereSql} ORDER BY a.created_at DESC`).all(...params);
  res.json({ applications: rows.map(serializeApplicationRow) });
}));

// ---------- Service requests ----------

router.get('/service-requests', asyncHandler((req, res) => {
  const mine = req.query.mine === '1';
  const rows = mine
    ? db.prepare(`
        SELECT r.*, p.business_name, p.id AS provider_id, u.name AS requester_name
        FROM service_requests r JOIN providers p ON p.id = r.provider_id
        LEFT JOIN users u ON u.id = r.requester_id
        WHERE r.requester_id = ? ORDER BY r.created_at DESC`).all(req.user.id)
    : db.prepare(`
        SELECT r.*, p.business_name, p.id AS provider_id, u.name AS requester_name
        FROM service_requests r JOIN providers p ON p.id = r.provider_id
        LEFT JOIN users u ON u.id = r.requester_id
        WHERE p.owner_id = ? ORDER BY r.created_at DESC`).all(req.user.id);
  res.json({ requests: rows.map(serializeRequestRow), view: mine ? 'sent' : 'received' });
}));

router.patch('/service-requests/:id', asyncHandler((req, res) => {
  const id = toInt(req.params.id);
  const row = db.prepare(`
    SELECT r.*, p.owner_id, p.business_name FROM service_requests r JOIN providers p ON p.id = r.provider_id
    WHERE r.id = ?`).get(id);
  if (!row) throw httpError(404, 'Service request not found');

  const body = req.body || {};
  if (row.owner_id === req.user.id) {
    const status = pickEnum(body.status, REQUEST_STATUSES, null);
    if (!status) throw httpError(400, 'Unknown request status');
    db.prepare("UPDATE service_requests SET status = ?, response = ?, updated_at = datetime('now') WHERE id = ?")
      .run(status, body.response !== undefined ? String(body.response).trim() || null : row.response, id);
    logAudit(req.user.id, 'update_service_request', 'service_request', id, { status });
  } else if (row.requester_id === req.user.id) {
    if (body.status !== 'cancelled') throw httpError(403, 'You can only cancel your own request');
    db.prepare("UPDATE service_requests SET status = 'cancelled', updated_at = datetime('now') WHERE id = ?").run(id);
    logAudit(req.user.id, 'cancel_service_request', 'service_request', id, null);
  } else {
    throw httpError(403, 'You cannot modify this request');
  }

  const updated = db.prepare(`
    SELECT r.*, p.business_name, p.id AS provider_id, u.name AS requester_name
    FROM service_requests r JOIN providers p ON p.id = r.provider_id
    LEFT JOIN users u ON u.id = r.requester_id WHERE r.id = ?`).get(id);
  res.json({ request: serializeRequestRow(updated) });
}));

// ---------- Saved items ----------

router.get('/saved', asyncHandler((req, res) => {
  const rows = db.prepare('SELECT * FROM saved_items WHERE user_id = ? ORDER BY created_at DESC').all(req.user.id);
  const jobs = [];
  const providers = [];
  for (const row of rows) {
    if (row.item_type === 'job') {
      const job = db.prepare(`
        SELECT j.*, c.name AS category_name, c.slug AS category_slug, c.icon AS category_icon,
               l.name AS location_name, l.kind AS location_kind, u.name AS employer_name
        FROM jobs j LEFT JOIN categories c ON c.id = j.category_id
        LEFT JOIN locations l ON l.id = j.location_id LEFT JOIN users u ON u.id = j.employer_id
        WHERE j.id = ?`).get(row.item_id);
      if (job) jobs.push({ ...serializeJob(job), savedAt: row.created_at });
    } else {
      const provider = db.prepare(`
        SELECT p.*, c.name AS category_name, c.slug AS category_slug, c.icon AS category_icon,
               l.name AS location_name, l.kind AS location_kind, u.name AS owner_name
        FROM providers p LEFT JOIN categories c ON c.id = p.category_id
        LEFT JOIN locations l ON l.id = p.location_id LEFT JOIN users u ON u.id = p.owner_id
        WHERE p.id = ?`).get(row.item_id);
      if (provider) providers.push({ ...serializeProvider(provider), savedAt: row.created_at });
    }
  }
  res.json({ jobs, providers });
}));

router.delete('/saved/:type/:id', asyncHandler((req, res) => {
  const type = pickEnum(req.params.type, ['job', 'provider'], null);
  if (!type) throw httpError(400, 'Unknown saved item type');
  db.prepare('DELETE FROM saved_items WHERE user_id = ? AND item_type = ? AND item_id = ?').run(req.user.id, type, toInt(req.params.id));
  res.json({ ok: true });
}));

function serializeApplicationRow(row) {
  const base = serializeApplication(row);
  return {
    ...base,
    jobTitle: row.job_title ?? null,
    company: row.company ?? null,
    jobStatus: row.job_status ?? null,
    locationName: row.location_name ?? null,
    categoryName: row.category_name ?? null,
    categoryIcon: row.category_icon ?? null,
    applicantName: row.applicant_name ?? null,
    applicantEmail: row.applicant_email ?? null,
    applicantPhone: row.applicant_phone ?? null,
    applicantWard: row.applicant_ward ?? null,
    applicantBio: row.applicant_bio ?? null,
    statusLabel: APPLICATION_STATUS_LABELS[row.status] || row.status,
  };
}

function serializeRequestRow(row) {
  return {
    id: row.id,
    providerId: row.provider_id,
    businessName: row.business_name,
    requesterId: row.requester_id,
    requesterName: row.requester_name,
    name: row.name,
    phone: row.phone,
    email: row.email,
    serviceNeeded: row.service_needed,
    details: row.details,
    preferredDate: row.preferred_date,
    budget: row.budget,
    status: row.status,
    statusLabel: REQUEST_STATUS_LABELS[row.status] || row.status,
    response: row.response,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

module.exports = { router, serializeRequestRow, serializeApplicationRow };
