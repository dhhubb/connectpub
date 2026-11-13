'use strict';

const express = require('express');
const { db } = require('../db');
const { asyncHandler, httpError, toInt } = require('../util');

const router = express.Router();

function serializeGroup(row, counts = {}) {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    icon: row.icon,
    scope: row.scope,
    description: row.description,
    jobCount: counts.jobCount ?? 0,
    providerCount: counts.providerCount ?? 0,
    categoryCount: counts.categoryCount ?? 0,
  };
}

/** Approved listing totals per group, split by kind. */
function groupCounts() {
  const rows = db.prepare(`
    SELECT g.id,
      (SELECT COUNT(*) FROM jobs j JOIN categories c ON c.id = j.category_id
        WHERE c.group_id = g.id AND j.status = 'approved') AS job_count,
      (SELECT COUNT(*) FROM providers p JOIN categories c ON c.id = p.category_id
        WHERE c.group_id = g.id AND p.status = 'approved') AS provider_count,
      (SELECT COUNT(*) FROM categories c WHERE c.group_id = g.id) AS category_count
    FROM category_groups g`).all();
  const map = new Map();
  for (const r of rows) {
    map.set(r.id, { jobCount: r.job_count, providerCount: r.provider_count, categoryCount: r.category_count });
  }
  return map;
}

router.get('/groups', asyncHandler((req, res) => {
  const kind = req.query.kind;
  const where = kind ? "WHERE g.scope IN ('both', ?)" : '';
  const params = kind ? [kind] : [];
  const rows = db.prepare(`SELECT g.* FROM category_groups g ${where} ORDER BY g.sort_order, g.name`).all(...params);
  const counts = groupCounts();
  res.json({
    groups: rows.map((g) => {
      const c = counts.get(g.id) || {};
      // On a kind-specific request, report only the counts that kind cares about.
      const payload = serializeGroup(g, c);
      if (kind === 'job') payload.providerCount = 0;
      if (kind === 'service') payload.jobCount = 0;
      return payload;
    }),
  });
}));

router.get('/groups/:slug', asyncHandler((req, res) => {
  const slug = String(req.params.slug);
  const group = db.prepare('SELECT * FROM category_groups WHERE slug = ? OR id = ?')
    .get(slug, toInt(slug) || -1);
  if (!group) throw httpError(404, 'Category group not found');
  const counts = groupCounts().get(group.id) || {};
  const categories = db.prepare(`
    SELECT c.*,
      (SELECT COUNT(*) FROM jobs j WHERE j.category_id = c.id AND j.status = 'approved') AS job_count,
      (SELECT COUNT(*) FROM providers p WHERE p.category_id = c.id AND p.status = 'approved') AS provider_count
    FROM categories c WHERE c.group_id = ? ORDER BY c.sort_order, c.name`).all(group.id);
  res.json({
    group: serializeGroup(group, counts),
    categories: categories.map((c) => ({
      id: c.id, name: c.name, slug: c.slug, kind: c.kind, icon: c.icon, description: c.description,
      jobCount: c.job_count, providerCount: c.provider_count,
    })),
  });
}));

router.get('/categories', asyncHandler((req, res) => {
  const kind = req.query.kind;
  const rows = kind
    ? db.prepare('SELECT * FROM categories WHERE kind = ? ORDER BY sort_order, name').all(kind)
    : db.prepare('SELECT * FROM categories ORDER BY kind, sort_order, name').all();
  const groupNames = new Map(db.prepare('SELECT id, name, slug, icon FROM category_groups').all().map((g) => [g.id, g]));
  res.json({
    categories: rows.map((c) => {
      const g = c.group_id ? groupNames.get(c.group_id) : null;
      return {
        id: c.id, name: c.name, slug: c.slug, kind: c.kind, icon: c.icon, description: c.description,
        group: g ? { id: g.id, name: g.name, slug: g.slug, icon: g.icon } : null,
        jobCount: db.prepare("SELECT COUNT(*) AS n FROM jobs WHERE category_id = ? AND status = 'approved'").get(c.id).n,
        providerCount: db.prepare("SELECT COUNT(*) AS n FROM providers WHERE category_id = ? AND status = 'approved'").get(c.id).n,
      };
    }),
  });
}));

router.get('/locations', asyncHandler((req, res) => {
  const rows = db.prepare('SELECT * FROM locations ORDER BY kind, name').all();
  res.json({
    locations: rows.map((l) => ({
      id: l.id, name: l.name, slug: l.slug, kind: l.kind, notes: l.notes,
      jobCount: db.prepare("SELECT COUNT(*) AS n FROM jobs WHERE location_id = ? AND status = 'approved'").get(l.id).n,
      providerCount: db.prepare("SELECT COUNT(*) AS n FROM providers WHERE location_id = ? AND status = 'approved'").get(l.id).n,
    })),
  });
}));

router.get('/stats', asyncHandler((_req, res) => {
  const one = (sql) => db.prepare(sql).get().n;
  const byJobCategory = db.prepare(`
    SELECT c.name, c.icon, COUNT(j.id) AS count
    FROM categories c LEFT JOIN jobs j ON j.category_id = c.id AND j.status = 'approved'
    WHERE c.kind = 'job' GROUP BY c.id ORDER BY count DESC, c.name`).all();
  const byProviderCategory = db.prepare(`
    SELECT c.name, c.icon, COUNT(p.id) AS count
    FROM categories c LEFT JOIN providers p ON p.category_id = c.id AND p.status = 'approved'
    WHERE c.kind = 'service' GROUP BY c.id ORDER BY count DESC, c.name`).all();
  const byLocation = db.prepare(`
    SELECT l.name, l.kind,
      (SELECT COUNT(*) FROM jobs j WHERE j.location_id = l.id AND j.status = 'approved') AS jobs,
      (SELECT COUNT(*) FROM providers p WHERE p.location_id = l.id AND p.status = 'approved') AS providers
    FROM locations l ORDER BY jobs + providers DESC, l.name LIMIT 12`).all();
  const byJobType = db.prepare(`
    SELECT job_type AS label, COUNT(*) AS count FROM jobs WHERE status = 'approved' GROUP BY job_type`).all();
  const byGroup = db.prepare(`
    SELECT g.name, g.slug, g.icon, g.scope, g.description,
      (SELECT COUNT(*) FROM jobs j JOIN categories c ON c.id = j.category_id
        WHERE c.group_id = g.id AND j.status = 'approved') AS jobs,
      (SELECT COUNT(*) FROM providers p JOIN categories c ON c.id = p.category_id
        WHERE c.group_id = g.id AND p.status = 'approved') AS providers
    FROM category_groups g ORDER BY g.sort_order, g.name`).all();

  res.json({
    totals: {
      approvedJobs: one("SELECT COUNT(*) AS n FROM jobs WHERE status = 'approved'"),
      openVacancies: one("SELECT COALESCE(SUM(vacancies), 0) AS n FROM jobs WHERE status = 'approved'"),
      approvedProviders: one("SELECT COUNT(*) AS n FROM providers WHERE status = 'approved'"),
      verifiedProviders: one("SELECT COUNT(*) AS n FROM providers WHERE status = 'approved' AND verified = 1"),
      registeredUsers: one("SELECT COUNT(*) AS n FROM users WHERE status = 'active'"),
      employers: one("SELECT COUNT(*) AS n FROM users WHERE role = 'employer'"),
      providers: one("SELECT COUNT(*) AS n FROM users WHERE role = 'provider'"),
      applications: one('SELECT COUNT(*) AS n FROM applications'),
      serviceRequests: one('SELECT COUNT(*) AS n FROM service_requests'),
      pendingJobs: one("SELECT COUNT(*) AS n FROM jobs WHERE status = 'pending'"),
      pendingProviders: one("SELECT COUNT(*) AS n FROM providers WHERE status = 'pending'"),
    },
    byJobCategory,
    byProviderCategory,
    byGroup,
    byLocation,
    byJobType,
  });
}));

router.get('/settings', asyncHandler((_req, res) => {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const settings = {};
  for (const row of rows) settings[row.key] = row.value;
  res.json({ settings });
}));

module.exports = router;
