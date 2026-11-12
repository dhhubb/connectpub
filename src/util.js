'use strict';

const { db } = require('./db');

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

function logAudit(actorId, action, entity, entityId, details) {
  db.prepare(
    'INSERT INTO audit_log (actor_id, action, entity, entity_id, details) VALUES (?, ?, ?, ?, ?)'
  ).run(
    actorId ?? null,
    action,
    entity,
    entityId ?? null,
    details ? (typeof details === 'string' ? details : JSON.stringify(details)) : null
  );
}

function toInt(value, fallback = null) {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
}

function toNum(value, fallback = null) {
  if (value === '' || value === null || value === undefined) return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function pageParams(query) {
  const page = clamp(toInt(query.page, 1) || 1, 1, 10000);
  const perPage = clamp(toInt(query.per_page, 12) || 12, 1, 100);
  return { page, perPage, offset: (page - 1) * perPage };
}

function pickEnum(value, allowed, fallback) {
  return allowed.includes(value) ? value : fallback;
}

const JOB_TYPES = ['full_time', 'part_time', 'contract', 'casual', 'internship'];
const WORK_MODES = ['on_site', 'hybrid', 'remote'];
const APPLICATION_STATUSES = ['submitted', 'reviewing', 'shortlisted', 'interview', 'hired', 'rejected', 'withdrawn'];
const REQUEST_STATUSES = ['new', 'contacted', 'quoted', 'accepted', 'completed', 'declined', 'cancelled'];
const USER_ROLES = ['seeker', 'employer', 'provider', 'admin'];

const JOB_TYPE_LABELS = {
  full_time: 'Full time',
  part_time: 'Part time',
  contract: 'Contract',
  casual: 'Casual',
  internship: 'Internship',
};

const WORK_MODE_LABELS = { on_site: 'On site', hybrid: 'Hybrid', remote: 'Remote' };

const STATUS_LABELS = {
  pending: 'Pending review',
  approved: 'Approved',
  rejected: 'Rejected',
  closed: 'Closed',
  expired: 'Expired',
  suspended: 'Suspended',
  active: 'Active',
};

const APPLICATION_STATUS_LABELS = {
  submitted: 'Submitted',
  reviewing: 'Reviewing',
  shortlisted: 'Shortlisted',
  interview: 'Interview',
  hired: 'Hired',
  rejected: 'Rejected',
  withdrawn: 'Withdrawn',
};

const REQUEST_STATUS_LABELS = {
  new: 'New',
  contacted: 'Contacted',
  quoted: 'Quoted',
  accepted: 'Accepted',
  completed: 'Completed',
  declined: 'Declined',
  cancelled: 'Cancelled',
};

function publicUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    role: row.role,
    status: row.status,
    ward: row.ward,
    bio: row.bio,
    createdAt: row.created_at,
    lastLoginAt: row.last_login_at,
  };
}

module.exports = {
  slugify,
  httpError,
  asyncHandler,
  logAudit,
  toInt,
  toNum,
  clamp,
  pageParams,
  pickEnum,
  publicUser,
  JOB_TYPES,
  WORK_MODES,
  APPLICATION_STATUSES,
  REQUEST_STATUSES,
  USER_ROLES,
  JOB_TYPE_LABELS,
  WORK_MODE_LABELS,
  STATUS_LABELS,
  APPLICATION_STATUS_LABELS,
  REQUEST_STATUS_LABELS,
};
