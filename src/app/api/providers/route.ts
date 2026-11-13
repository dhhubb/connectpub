import { db } from '@/lib/db';
import { route, requireRole } from '@/lib/http';
import {
  logAudit, pageParams, ftsQuery, pickEnum, toNum, type Row,
} from '@/lib/util';
import {
  SELECT_PROVIDER, serializeProvider, savedProviderIds, resolveServiceCategoryId,
  resolveServiceLocationId, AVAILABILITY, AVAILABILITY_LABELS, validateProvider,
} from '@/lib/providers';
import { resolveGroup } from '@/lib/jobs';

// ---------- Public browsing ----------

export const GET = route(async (ctx) => {
  const { page, perPage } = pageParams(Object.fromEntries(ctx.query));
  const where = ["p.status = 'approved'"];
  const params: any[] = [];

  const q = String(ctx.query.get('q') || '').trim();
  const match = ftsQuery(q);
  if (match) {
    // Search the inverted index rather than scanning four columns with LIKE.
    where.push('p.id IN (SELECT rowid FROM providers_fts WHERE providers_fts MATCH ?)');
    params.push(match);
  }
  const categoryId = resolveServiceCategoryId(ctx.query.get('category'));
  if (categoryId) { where.push('p.category_id = ?'); params.push(categoryId); }
  const groupFilter = resolveGroup(ctx.query.get('group'), 'service');
  if (groupFilter) {
    if (!groupFilter.categoryIds.length) {
      where.push('1 = 0');
    } else {
      where.push(`p.category_id IN (${groupFilter.categoryIds.map(() => '?').join(',')})`);
      params.push(...groupFilter.categoryIds);
    }
  }
  const locationId = resolveServiceLocationId(ctx.query.get('location'));
  if (locationId) { where.push('p.location_id = ?'); params.push(locationId); }
  const availability = pickEnum(ctx.query.get('availability'), AVAILABILITY, null);
  if (availability) { where.push('p.availability = ?'); params.push(availability); }
  if (ctx.query.get('verified') === '1') where.push('p.verified = 1');
  if (ctx.query.get('featured') === '1') where.push('p.featured = 1');
  const maxPrice = toNum(ctx.query.get('max_price'), null);
  if (maxPrice) { where.push('COALESCE(p.price_from, 0) <= ?'); params.push(maxPrice); }
  const minRating = toNum(ctx.query.get('min_rating'), null);
  if (minRating) { where.push('(CASE WHEN p.rating_count > 0 THEN p.rating_sum / p.rating_count ELSE 0 END) >= ?'); params.push(minRating); }

  const whereSql = `WHERE ${where.join(' AND ')}`;
  const sortMap: Record<string, string> = {
    rating: '(CASE WHEN p.rating_count > 0 THEN p.rating_sum / p.rating_count ELSE 0 END) DESC, p.rating_count DESC',
    experience: 'p.years_experience DESC',
    price: 'COALESCE(p.price_from, 0) ASC',
    popular: 'p.views DESC',
    recent: 'p.created_at DESC',
    name: 'p.business_name ASC',
  };
  const sortKey = String(ctx.query.get('sort') || 'rating');
  const orderBy = sortMap[sortKey] || sortMap.rating;

  const total = (db.prepare(`SELECT COUNT(*) AS n FROM providers p ${whereSql}`).get(...params) as { n: number }).n;
  const pages = Math.max(1, Math.ceil(total / perPage));
  const safePage = Math.min(page, pages);
  const safeOffset = (safePage - 1) * perPage;
  const rows = db.prepare(
    `${SELECT_PROVIDER} ${whereSql} ORDER BY p.featured DESC, p.verified DESC, ${orderBy} LIMIT ? OFFSET ?`,
  ).all(...params, perPage, safeOffset) as Row[];

  const savedIds = savedProviderIds(ctx.user?.id);
  return {
    body: {
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
    },
  };
});

// ---------- Provider management ----------

export const POST = route(async (ctx) => {
  const user = requireRole(ctx, 'provider', 'admin');
  const { errors, values } = validateProvider(ctx.body || {});
  if (Object.keys(errors).length) return { status: 400, body: { error: 'Validation failed', errors } };

  const autoApprove = (db.prepare("SELECT value FROM settings WHERE key = 'auto_approve_providers'").get() as { value: string } | undefined)?.value === 'true';
  const status = user.role === 'admin' || autoApprove ? 'approved' : 'pending';

  const info = db.prepare(
    `INSERT INTO providers (owner_id, category_id, location_id, business_name, tagline, description, services,
       phone, whatsapp, email, address, price_from, currency, years_experience, availability, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(user.id, values.categoryId, values.locationId, values.businessName, values.tagline, values.description, values.services,
    values.phone, values.whatsapp, values.email, values.address, values.priceFrom, values.currency, values.yearsExperience,
    values.availability, status);

  const id = Number(info.lastInsertRowid);
  logAudit(db, user.id, 'create_provider', 'provider', id, { businessName: values.businessName, status });
  const row = db.prepare(`${SELECT_PROVIDER} WHERE p.id = ?`).get(id) as Row;
  return {
    status: 201,
    body: { provider: serializeProvider(row, { full: true }), message: status === 'approved' ? 'Service listing published' : 'Service listing submitted for review' },
  };
});
