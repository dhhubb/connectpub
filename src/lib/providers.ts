import { db } from './db';
import { toInt, toNum, pickEnum, type Row } from './util';

export const AVAILABILITY = ['available', 'busy', 'unavailable'] as const;
export const AVAILABILITY_LABELS: Record<string, string> = {
  available: 'Available now',
  busy: 'Busy',
  unavailable: 'Unavailable',
};

export const SELECT_PROVIDER = `
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

function ratingOf(row: Row): number | null {
  if (!row.rating_count) return null;
  return Math.round((row.rating_sum / row.rating_count) * 10) / 10;
}

export function serializeProvider(row: Row | null | undefined, { full = false, savedIds = null }: { full?: boolean; savedIds?: Set<number> | null } = {}): any {
  if (!row) return null;
  const provider: Row = {
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
    provider.services = row.services ? String(row.services).split('\n').filter(Boolean) : [];
    provider.rejectionReason = row.rejection_reason;
  }
  if (savedIds) provider.saved = savedIds.has(row.id);
  return provider;
}

export function savedProviderIds(userId: number | null | undefined): Set<number> | null {
  if (!userId) return null;
  const rows = db.prepare("SELECT item_id FROM saved_items WHERE user_id = ? AND item_type = 'provider'").all(userId) as Array<{ item_id: number }>;
  return new Set(rows.map((r) => r.item_id));
}

export function resolveServiceCategoryId(value: unknown): number | null {
  if (value === undefined || value === null || value === '') return null;
  const asId = toInt(value);
  if (asId && db.prepare("SELECT id FROM categories WHERE id = ? AND kind = 'service'").get(asId)) return asId;
  const bySlug = db.prepare("SELECT id FROM categories WHERE slug = ? AND kind = 'service'").get(String(value)) as { id: number } | undefined;
  return bySlug ? bySlug.id : null;
}

export function resolveServiceLocationId(value: unknown): number | null {
  if (value === undefined || value === null || value === '') return null;
  const asId = toInt(value);
  if (asId && db.prepare('SELECT id FROM locations WHERE id = ?').get(asId)) return asId;
  const bySlug = db.prepare('SELECT id FROM locations WHERE slug = ?').get(String(value)) as { id: number } | undefined;
  return bySlug ? bySlug.id : null;
}

export function providerToBody(provider: Row): Row {
  return {
    businessName: provider.business_name, tagline: provider.tagline, description: provider.description,
    services: provider.services, phone: provider.phone, whatsapp: provider.whatsapp, email: provider.email,
    address: provider.address, priceFrom: provider.price_from, currency: provider.currency,
    yearsExperience: provider.years_experience, availability: provider.availability,
    categoryId: provider.category_id, locationId: provider.location_id,
  };
}

export function validateProvider(body: any) {
  const errors: Record<string, string> = {};
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
      categoryId: resolveServiceCategoryId(body.categoryId ?? body.category),
      locationId: resolveServiceLocationId(body.locationId ?? body.location),
    },
  };
}
