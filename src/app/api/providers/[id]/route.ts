import { db } from '@/lib/db';
import { route, requireRole } from '@/lib/http';
import { httpError, logAudit, pickEnum, toInt, type Row } from '@/lib/util';
import { SELECT_PROVIDER, serializeProvider, savedProviderIds, providerToBody } from '@/lib/providers';
import { validateProvider } from '@/lib/providers';

function loadOwnedProvider(ctx: any): Row {
  const id = toInt(ctx.params.id);
  const provider = db.prepare('SELECT * FROM providers WHERE id = ?').get(id) as Row | undefined;
  if (!provider) throw httpError(404, 'Service provider not found');
  if (ctx.user.role !== 'admin' && provider.owner_id !== ctx.user.id) throw httpError(403, 'You can only manage your own listings');
  return provider;
}

export const dynamic = 'force-dynamic';

export const GET = route(async (ctx) => {
  const id = toInt(ctx.params.id);
  const row = db.prepare(`${SELECT_PROVIDER} WHERE p.id = ?`).get(id) as Row | undefined;
  if (!row) throw httpError(404, 'Service provider not found');
  const isOwner = ctx.user && ctx.user.id === row.owner_id;
  const isAdmin = ctx.user && ctx.user.role === 'admin';
  if (row.status !== 'approved' && !isOwner && !isAdmin) throw httpError(404, 'Service provider not found');

  if (row.status === 'approved') db.prepare('UPDATE providers SET views = views + 1 WHERE id = ?').run(id);

  const reviews = db.prepare(`
    SELECT r.*, u.name AS user_name FROM reviews r JOIN users u ON u.id = r.user_id
    WHERE r.provider_id = ? AND r.status = 'published' ORDER BY r.created_at DESC`).all(id) as Row[];

  const myReview = ctx.user
    ? db.prepare('SELECT * FROM reviews WHERE provider_id = ? AND user_id = ?').get(id, ctx.user.id) as Row | undefined
    : null;

  const savedIds = savedProviderIds(ctx.user?.id);
  return {
    body: {
      provider: serializeProvider({ ...row, views: row.views + (row.status === 'approved' ? 1 : 0) }, { full: true, savedIds }),
      reviews: reviews.map((r) => ({
        id: r.id, rating: r.rating, comment: r.comment, userName: r.user_name, createdAt: r.created_at, userId: r.user_id,
      })),
      myReview: myReview ? { id: myReview.id, rating: myReview.rating, comment: myReview.comment } : null,
    },
  };
});

export const PATCH = route(async (ctx) => {
  const user = requireRole(ctx, 'provider', 'admin');
  const provider = loadOwnedProvider({ ...ctx, user });
  const { errors, values } = validateProvider({ ...providerToBody(provider), ...ctx.body });
  if (Object.keys(errors).length) return { status: 400, body: { error: 'Validation failed', errors } };

  const status = user.role === 'admin'
    ? pickEnum(ctx.body.status, ['pending', 'approved', 'rejected', 'suspended'] as const, provider.status)
    : (provider.status === 'approved' ? 'pending' : provider.status);

  db.prepare(
    `UPDATE providers SET category_id = ?, location_id = ?, business_name = ?, tagline = ?, description = ?, services = ?,
       phone = ?, whatsapp = ?, email = ?, address = ?, price_from = ?, currency = ?, years_experience = ?,
       availability = ?, status = ?, updated_at = datetime('now')
     WHERE id = ?`,
  ).run(values.categoryId, values.locationId, values.businessName, values.tagline, values.description, values.services,
    values.phone, values.whatsapp, values.email, values.address, values.priceFrom, values.currency, values.yearsExperience,
    values.availability, status, provider.id);

  logAudit(db, user.id, 'update_provider', 'provider', provider.id, { status });
  const row = db.prepare(`${SELECT_PROVIDER} WHERE p.id = ?`).get(provider.id) as Row;
  return {
    body: {
      provider: serializeProvider(row, { full: true }),
      message: status === 'pending' && provider.status === 'approved' ? 'Listing updated and sent back for review' : 'Listing updated',
    },
  };
});

export const DELETE = route(async (ctx) => {
  const user = requireRole(ctx, 'provider', 'admin');
  const provider = loadOwnedProvider({ ...ctx, user });
  db.prepare('DELETE FROM providers WHERE id = ?').run(provider.id);
  logAudit(db, user.id, 'delete_provider', 'provider', provider.id, { businessName: provider.business_name });
  return { body: { ok: true } };
});
