import { db } from '@/lib/db';
import { route, requireRole } from '@/lib/http';
import { httpError, logAudit, pickEnum, toInt, type Row } from '@/lib/util';
import { serializeProvider } from '@/lib/providers';

const PROVIDER_STATUSES = ['pending', 'approved', 'rejected', 'suspended'] as const;

export const dynamic = 'force-dynamic';

export const PATCH = route(async (ctx) => {
  const user = requireRole(ctx, 'admin');
  const id = toInt(ctx.params.id);
  const provider = db.prepare('SELECT * FROM providers WHERE id = ?').get(id) as Row | undefined;
  if (!provider) throw httpError(404, 'Service provider not found');
  const body = ctx.body || {};
  const status = body.status !== undefined ? pickEnum(body.status, PROVIDER_STATUSES, null) : provider.status;
  if (body.status !== undefined && !status) throw httpError(400, 'Unknown provider status');
  const verified = body.verified !== undefined ? (body.verified ? 1 : 0) : provider.verified;
  const featured = body.featured !== undefined ? (body.featured ? 1 : 0) : provider.featured;
  const reason = status === 'rejected' ? String(body.rejectionReason || 'Does not meet listing guidelines').trim() : null;

  db.prepare('UPDATE providers SET status = ?, verified = ?, featured = ?, rejection_reason = ?, updated_at = datetime(\'now\') WHERE id = ?')
    .run(status, verified, featured, reason, id);
  logAudit(db, user.id, 'moderate_provider', 'provider', id, { status, verified: Boolean(verified), featured: Boolean(featured) });

  const row = db.prepare(`
    SELECT p.*, c.name AS category_name, c.icon AS category_icon, l.name AS location_name,
           u.name AS owner_name, u.email AS owner_email,
           (SELECT COUNT(*) FROM service_requests r WHERE r.provider_id = p.id) AS request_count
    FROM providers p LEFT JOIN categories c ON c.id = p.category_id
    LEFT JOIN locations l ON l.id = p.location_id LEFT JOIN users u ON u.id = p.owner_id
    WHERE p.id = ?`).get(id) as Row;
  return { body: { provider: { ...serializeProvider(row, { full: true }), requestCount: row.request_count }, message: `Listing ${status}` } };
});
