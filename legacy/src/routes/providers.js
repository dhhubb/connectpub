'use strict';

const express = require('express');
const { db } = require('../db');
const { requireAuth, requireRole } = require('../auth');
const {
  asyncHandler, httpError, logAudit, pageParams, ftsQuery, pickEnum, toInt, toNum,
} = require('../util');

const router = express.Router();

const AVAILABILITY = ['available', 'busy', 'unavailable'];
const AVAILABILITY_LABELS = { available: 'Available now', busy: 'Busy', unavailable: 'Unavailable' };

const SELECT_PROVIDER = `
  SELECT p.*,
         c.name AS category_name, c.slug AS category_slug, c.icon AS category_icon,
         g.name AS group_name, g.slug AS group_slug, g.icon AS group_icon,
         l.name AS location_name, l.kind AS location_kind,
         u.name AS owner_name, u.email AS owner_email
  FROM providers p
  LEFT JOIN categories c ON c.id = p.category_id
  LEFT JOIN category_groups g ON g.id = c.group_id
  LEFT JOIN locations l ON l.id = p.location_id
  LEFT JOIN users u ON u.id = p.owner_id`;

function ratingOf(row) {
  if (!row.rating_count) return null;
  return Math.round((row.rating_sum / row.rating_count) * 10) / 10;
}

function serializeProvider(row, { full = false, savedIds = null } = {}) {
  if (!row) return null;
  const provider = {
    id: row.id,
    ownerId: row.owner_id,
    ownerName: row.owner_name,
    businessName: row.business_name,
    tagline: row.tagline,
    category: row.category_id ? { id: row.category_id, name: row.category_name, slug: row.category_slug, icon: row.category_icon } : null,
    group: row.group_slug ? { name: row.group_name, slug: row.group_slug, icon: row.group_icon } : null,
    location: row.location_id ? { id: row.location_id, name: row.location_name, kind: row.location_kind } : null,
    phone: row.phone,
    whatsapp: row.whatsapp,
    email: row.email,
    address: row.address,
    priceFrom: row.price_from,
    currency: row.currency,
    yearsExperience: row.years_experience,
    availability: row.availability,
    availabilityLabel: AVAILABILITY_LABELS[row.availability] || row.availability,
    status: row.status,
    verified: Boolean(row.verified),
    featured: Boolean(row.featured),
    rating: ratingOf(row),
    ratingCount: row.rating_count,
    views: row.views,
    createdAt: row.created_at,
  };
  if (full) {
    provider.description = row.description;
    provider.services = row.services ? row.services.split('\n').filter(Boolean) : [];
    provider.rejectionReason = row.rejection_reason;
  }
  if (savedIds) provider.saved = savedIds.has(row.id);
  return provider;
}

function savedProviderIds(userId) {
  if (!userId) return null;
  const rows = db.prepare("SELECT item_id FROM saved_items WHERE user_id = ? AND item_type = 'provider'").all(userId);
  return new Set(rows.map((r) => r.item_id));
}

function resolveCategoryId(value) {
  if (value === undefined || value === null || value === '') return null;
  const asId = toInt(value);
  if (asId && db.prepare("SELECT id FROM categories WHERE id = ? AND kind = 'service'").get(asId)) return asId;
  const bySlug = db.prepare("SELECT id FROM categories WHERE slug = ? AND kind = 'service'").get(String(value));
  return bySlug ? bySlug.id : null;
}

function resolveLocationId(value) {
  if (value === undefined || value === null || value === '') return null;
  const asId = toInt(value);
  if (asId && db.prepare('SELECT id FROM locations WHERE id = ?').get(asId)) return asId;
  const bySlug = db.prepare('SELECT id FROM locations WHERE slug = ?').get(String(value));
  return bySlug ? bySlug.id : null;
}

/** See jobs.resolveGroup: group slug -> the category ids it covers. */
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
  const where = ["p.status = 'approved'"];
  const params = [];

  const q = String(req.query.q || '').trim();
  const match = ftsQuery(q);
  if (match) {
    // Search the inverted index rather than scanning four columns with LIKE.
    where.push('p.id IN (SELECT rowid FROM providers_fts WHERE providers_fts MATCH ?)');
    params.push(match);
  }
  const categoryId = resolveCategoryId(req.query.category);
  if (categoryId) { where.push('p.category_id = ?'); params.push(categoryId); }
  const groupFilter = resolveGroup(req.query.group, 'service');
  if (groupFilter) {
    if (!groupFilter.categoryIds.length) {
      where.push('1 = 0');
    } else {
      where.push(`p.category_id IN (${groupFilter.categoryIds.map(() => '?').join(',')})`);
      params.push(...groupFilter.categoryIds);
    }
  }
  const locationId = resolveLocationId(req.query.location);
  if (locationId) { where.push('p.location_id = ?'); params.push(locationId); }
  const availability = pickEnum(req.query.availability, AVAILABILITY, null);
  if (availability) { where.push('p.availability = ?'); params.push(availability); }
  if (req.query.verified === '1') where.push('p.verified = 1');
  if (req.query.featured === '1') where.push('p.featured = 1');
  const maxPrice = toNum(req.query.max_price, null);
  if (maxPrice) { where.push('COALESCE(p.price_from, 0) <= ?'); params.push(maxPrice); }
  const minRating = toNum(req.query.min_rating, null);
  if (minRating) { where.push('(CASE WHEN p.rating_count > 0 THEN p.rating_sum / p.rating_count ELSE 0 END) >= ?'); params.push(minRating); }

  const whereSql = `WHERE ${where.join(' AND ')}`;
  const sortMap = {
    rating: '(CASE WHEN p.rating_count > 0 THEN p.rating_sum / p.rating_count ELSE 0 END) DESC, p.rating_count DESC',
    experience: 'p.years_experience DESC',
    price: 'COALESCE(p.price_from, 0) ASC',
    popular: 'p.views DESC',
    recent: 'p.created_at DESC',
    name: 'p.business_name ASC',
  };
  const sortKey = String(req.query.sort || 'rating');
  const orderBy = sortMap[sortKey] || sortMap.rating;

  const total = db.prepare(`SELECT COUNT(*) AS n FROM providers p ${whereSql}`).get(...params).n;
  const pages = Math.max(1, Math.ceil(total / perPage));
  const safePage = Math.min(page, pages);
  const safeOffset = (safePage - 1) * perPage;
  const rows = db.prepare(
    `${SELECT_PROVIDER} ${whereSql} ORDER BY p.featured DESC, p.verified DESC, ${orderBy} LIMIT ? OFFSET ?`
  ).all(...params, perPage, safeOffset);

  const savedIds = savedProviderIds(req.user && req.user.id);
  res.json({
    providers: rows.map((r) => serializeProvider(r, { savedIds })),
    pagination: {
      page: safePage, perPage, total, pages,
      from: total ? safeOffset + 1 : 0,
      to: Math.min(total, safeOffset + rows.length),
      hasPrev: safePage > 1, hasNext: safePage < pages,
    },
    sort: sortKey,
    group: groupFilter ? { id: groupFilter.group.id, slug: groupFilter.group.slug, name: groupFilter.group.name } : null,
    filters: { availability: AVAILABILITY.map((a) => ({ value: a, label: AVAILABILITY_LABELS[a] })) },
  });
}));

router.get('/:id', asyncHandler((req, res) => {
  const id = toInt(req.params.id);
  const row = db.prepare(`${SELECT_PROVIDER} WHERE p.id = ?`).get(id);
  if (!row) throw httpError(404, 'Service provider not found');
  const isOwner = req.user && req.user.id === row.owner_id;
  const isAdmin = req.user && req.user.role === 'admin';
  if (row.status !== 'approved' && !isOwner && !isAdmin) throw httpError(404, 'Service provider not found');

  if (row.status === 'approved') db.prepare('UPDATE providers SET views = views + 1 WHERE id = ?').run(id);

  const reviews = db.prepare(`
    SELECT r.*, u.name AS user_name FROM reviews r JOIN users u ON u.id = r.user_id
    WHERE r.provider_id = ? AND r.status = 'published' ORDER BY r.created_at DESC`).all(id);

  const myReview = req.user
    ? db.prepare('SELECT * FROM reviews WHERE provider_id = ? AND user_id = ?').get(id, req.user.id) : null;

  const savedIds = savedProviderIds(req.user && req.user.id);
  res.json({
    provider: serializeProvider({ ...row, views: row.views + (row.status === 'approved' ? 1 : 0) }, { full: true, savedIds }),
    reviews: reviews.map((r) => ({
      id: r.id, rating: r.rating, comment: r.comment, userName: r.user_name, createdAt: r.created_at, userId: r.user_id,
    })),
    myReview: myReview ? { id: myReview.id, rating: myReview.rating, comment: myReview.comment } : null,
  });
}));

router.post('/:id/reviews', requireAuth, asyncHandler((req, res) => {
  const id = toInt(req.params.id);
  const provider = db.prepare('SELECT * FROM providers WHERE id = ?').get(id);
  if (!provider || provider.status !== 'approved') throw httpError(404, 'Service provider not found');
  if (provider.owner_id === req.user.id) throw httpError(400, 'You cannot review your own business');

  const rating = toInt((req.body || {}).rating);
  if (!rating || rating < 1 || rating > 5) throw httpError(400, 'Rating must be between 1 and 5');
  const comment = String((req.body || {}).comment || '').trim() || null;

  db.prepare(
    `INSERT INTO reviews (provider_id, user_id, rating, comment) VALUES (?, ?, ?, ?)
     ON CONFLICT(provider_id, user_id) DO UPDATE SET rating = excluded.rating, comment = excluded.comment, created_at = datetime('now')`
  ).run(id, req.user.id, rating, comment);

  db.prepare(`
    UPDATE providers SET
      rating_sum = (SELECT COALESCE(SUM(rating), 0) FROM reviews WHERE provider_id = ? AND status = 'published'),
      rating_count = (SELECT COUNT(*) FROM reviews WHERE provider_id = ? AND status = 'published')
    WHERE id = ?`).run(id, id, id);

  const fresh = db.prepare(`${SELECT_PROVIDER} WHERE p.id = ?`).get(id);
  res.status(201).json({ provider: serializeProvider(fresh), message: 'Thank you, your review has been saved' });
}));

router.post('/:id/request', asyncHandler((req, res) => {
  const id = toInt(req.params.id);
  const provider = db.prepare('SELECT * FROM providers WHERE id = ?').get(id);
  if (!provider || provider.status !== 'approved') throw httpError(404, 'Service provider not found');

  const body = req.body || {};
  const errors = {};
  const name = String(body.name || '').trim();
  const phone = String(body.phone || '').trim();
  const serviceNeeded = String(body.serviceNeeded || '').trim();
  if (name.length < 2) errors.name = 'Please enter your name';
  if (phone.length < 7) errors.phone = 'Please enter a contact phone number';
  if (serviceNeeded.length < 3) errors.serviceNeeded = 'Tell the provider which service you need';
  if (Object.keys(errors).length) return res.status(400).json({ error: 'Validation failed', errors });

  const info = db.prepare(
    `INSERT INTO service_requests (provider_id, requester_id, name, phone, email, service_needed, details, preferred_date, budget)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, req.user ? req.user.id : null, name, phone, String(body.email || '').trim() || null, serviceNeeded,
    String(body.details || '').trim() || null, body.preferredDate ? String(body.preferredDate).slice(0, 10) : null, toNum(body.budget, null));

  logAudit(req.user ? req.user.id : null, 'service_request', 'provider', id, { requestId: Number(info.lastInsertRowid) });
  res.status(201).json({ ok: true, requestId: Number(info.lastInsertRowid), message: `Your request has been sent to ${provider.business_name}` });
}));

router.post('/:id/save', requireAuth, asyncHandler((req, res) => {
  const id = toInt(req.params.id);
  if (!db.prepare('SELECT id FROM providers WHERE id = ?').get(id)) throw httpError(404, 'Service provider not found');
  const existing = db.prepare("SELECT id FROM saved_items WHERE user_id = ? AND item_type = 'provider' AND item_id = ?").get(req.user.id, id);
  if (existing) {
    db.prepare('DELETE FROM saved_items WHERE id = ?').run(existing.id);
    return res.json({ saved: false });
  }
  db.prepare("INSERT INTO saved_items (user_id, item_type, item_id) VALUES (?, 'provider', ?)").run(req.user.id, id);
  res.json({ saved: true });
}));

// ---------- Provider management ----------

function validateProvider(body) {
  const errors = {};
  const businessName = String(body.businessName || '').trim();
  const description = String(body.description || '').trim();
  const phone = String(body.phone || '').trim();
  if (businessName.length < 3) errors.businessName = 'Business name is required';
  if (description.length < 30) errors.description = 'Please describe your business in at least 30 characters';
  if (phone.length < 7) errors.phone = 'A contact phone number is required';
  return {
    errors,
    values: {
      businessName,
      tagline: String(body.tagline || '').trim() || null,
      description,
      services: String(body.services || '').trim() || null,
      phone,
      whatsapp: String(body.whatsapp || '').trim() || null,
      email: String(body.email || '').trim() || null,
      address: String(body.address || '').trim() || null,
      priceFrom: toNum(body.priceFrom, null),
      currency: String(body.currency || 'USD').trim().toUpperCase().slice(0, 3) || 'USD',
      yearsExperience: toInt(body.yearsExperience, 0) || 0,
      availability: pickEnum(body.availability, AVAILABILITY, 'available'),
      categoryId: resolveCategoryId(body.categoryId ?? body.category),
      locationId: resolveLocationId(body.locationId ?? body.location),
    },
  };
}

router.get('/mine/list', requireAuth, requireRole('provider', 'admin'), asyncHandler((req, res) => {
  const rows = req.user.role === 'admin'
    ? db.prepare(`${SELECT_PROVIDER} ORDER BY p.created_at DESC`).all()
    : db.prepare(`${SELECT_PROVIDER} WHERE p.owner_id = ? ORDER BY p.created_at DESC`).all(req.user.id);
  res.json({ providers: rows.map((r) => serializeProvider(r)) });
}));

router.post('/', requireAuth, requireRole('provider', 'admin'), asyncHandler((req, res) => {
  const { errors, values } = validateProvider(req.body || {});
  if (Object.keys(errors).length) return res.status(400).json({ error: 'Validation failed', errors });

  const autoApprove = db.prepare("SELECT value FROM settings WHERE key = 'auto_approve_providers'").get()?.value === 'true';
  const status = req.user.role === 'admin' || autoApprove ? 'approved' : 'pending';

  const info = db.prepare(
    `INSERT INTO providers (owner_id, category_id, location_id, business_name, tagline, description, services,
       phone, whatsapp, email, address, price_from, currency, years_experience, availability, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(req.user.id, values.categoryId, values.locationId, values.businessName, values.tagline, values.description, values.services,
    values.phone, values.whatsapp, values.email, values.address, values.priceFrom, values.currency, values.yearsExperience,
    values.availability, status);

  const id = Number(info.lastInsertRowid);
  logAudit(req.user.id, 'create_provider', 'provider', id, { businessName: values.businessName, status });
  const row = db.prepare(`${SELECT_PROVIDER} WHERE p.id = ?`).get(id);
  res.status(201).json({ provider: serializeProvider(row, { full: true }), message: status === 'approved' ? 'Service listing published' : 'Service listing submitted for review' });
}));

function loadOwnedProvider(req) {
  const id = toInt(req.params.id);
  const provider = db.prepare('SELECT * FROM providers WHERE id = ?').get(id);
  if (!provider) throw httpError(404, 'Service provider not found');
  if (req.user.role !== 'admin' && provider.owner_id !== req.user.id) throw httpError(403, 'You can only manage your own listings');
  return provider;
}

router.patch('/:id', requireAuth, requireRole('provider', 'admin'), asyncHandler((req, res) => {
  const provider = loadOwnedProvider(req);
  const { errors, values } = validateProvider({ ...providerToBody(provider), ...req.body });
  if (Object.keys(errors).length) return res.status(400).json({ error: 'Validation failed', errors });

  const status = req.user.role === 'admin'
    ? pickEnum(req.body.status, ['pending', 'approved', 'rejected', 'suspended'], provider.status)
    : (provider.status === 'approved' ? 'pending' : provider.status);

  db.prepare(
    `UPDATE providers SET category_id = ?, location_id = ?, business_name = ?, tagline = ?, description = ?, services = ?,
       phone = ?, whatsapp = ?, email = ?, address = ?, price_from = ?, currency = ?, years_experience = ?,
       availability = ?, status = ?, updated_at = datetime('now')
     WHERE id = ?`
  ).run(values.categoryId, values.locationId, values.businessName, values.tagline, values.description, values.services,
    values.phone, values.whatsapp, values.email, values.address, values.priceFrom, values.currency, values.yearsExperience,
    values.availability, status, provider.id);

  logAudit(req.user.id, 'update_provider', 'provider', provider.id, { status });
  const row = db.prepare(`${SELECT_PROVIDER} WHERE p.id = ?`).get(provider.id);
  res.json({ provider: serializeProvider(row, { full: true }), message: status === 'pending' && provider.status === 'approved' ? 'Listing updated and sent back for review' : 'Listing updated' });
}));

router.delete('/:id', requireAuth, requireRole('provider', 'admin'), asyncHandler((req, res) => {
  const provider = loadOwnedProvider(req);
  db.prepare('DELETE FROM providers WHERE id = ?').run(provider.id);
  logAudit(req.user.id, 'delete_provider', 'provider', provider.id, { businessName: provider.business_name });
  res.json({ ok: true });
}));

function providerToBody(provider) {
  return {
    businessName: provider.business_name, tagline: provider.tagline, description: provider.description,
    services: provider.services, phone: provider.phone, whatsapp: provider.whatsapp, email: provider.email,
    address: provider.address, priceFrom: provider.price_from, currency: provider.currency,
    yearsExperience: provider.years_experience, availability: provider.availability,
    categoryId: provider.category_id, locationId: provider.location_id,
  };
}

module.exports = { router, serializeProvider, resolveGroup };
