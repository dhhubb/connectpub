import { db } from '@/lib/db';
import { route, requireAuth } from '@/lib/http';
import { httpError, logAudit, pickEnum, REQUEST_STATUSES, type Row } from '@/lib/util';
import { serializeRequestRow } from '@/lib/serialize';

export const dynamic = 'force-dynamic';

export const PATCH = route(async (ctx) => {
  const user = requireAuth(ctx);
  const id = Number(ctx.params.id);
  const row = db.prepare(`
    SELECT r.*, p.owner_id, p.business_name FROM service_requests r JOIN providers p ON p.id = r.provider_id
    WHERE r.id = ?`).get(id) as Row | undefined;
  if (!row) throw httpError(404, 'Service request not found');

  const body = ctx.body || {};
  if (row.owner_id === user.id) {
    const status = pickEnum(body.status, REQUEST_STATUSES, null);
    if (!status) throw httpError(400, 'Unknown request status');
    db.prepare("UPDATE service_requests SET status = ?, response = ?, updated_at = datetime('now') WHERE id = ?")
      .run(status, body.response !== undefined ? String(body.response).trim() || null : row.response, id);
    logAudit(db, user.id, 'update_service_request', 'service_request', id, { status });
  } else if (row.requester_id === user.id) {
    if (body.status !== 'cancelled') throw httpError(403, 'You can only cancel your own request');
    db.prepare("UPDATE service_requests SET status = 'cancelled', updated_at = datetime('now') WHERE id = ?").run(id);
    logAudit(db, user.id, 'cancel_service_request', 'service_request', id, null);
  } else {
    throw httpError(403, 'You cannot modify this request');
  }

  const updated = db.prepare(`
    SELECT r.*, p.business_name, p.id AS provider_id, u.name AS requester_name
    FROM service_requests r JOIN providers p ON p.id = r.provider_id
    LEFT JOIN users u ON u.id = r.requester_id WHERE r.id = ?`).get(id) as Row;
  return { body: { request: serializeRequestRow(updated) } };
});
