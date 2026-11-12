'use strict';

const express = require('express');
const { db } = require('../db');
const { asyncHandler } = require('../util');

const router = express.Router();

router.get('/categories', asyncHandler((req, res) => {
  const kind = req.query.kind;
  const rows = kind
    ? db.prepare('SELECT * FROM categories WHERE kind = ? ORDER BY name').all(kind)
    : db.prepare('SELECT * FROM categories ORDER BY kind, name').all();
  res.json({
    categories: rows.map((c) => ({
      id: c.id, name: c.name, slug: c.slug, kind: c.kind, icon: c.icon, description: c.description,
      jobCount: db.prepare("SELECT COUNT(*) AS n FROM jobs WHERE category_id = ? AND status = 'approved'").get(c.id).n,
      providerCount: db.prepare("SELECT COUNT(*) AS n FROM providers WHERE category_id = ? AND status = 'approved'").get(c.id).n,
    })),
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
