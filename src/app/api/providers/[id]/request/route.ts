import { db } from '@/lib/db';
import { route } from '@/lib/http';
import { httpError, logAudit, toNum, type Row } from '@/lib/util';

export const dynamic = 'force-dynamic';

export const POST = route(async (ctx) => {
  const id = Number(ctx.params.id);
  const provider = db.prepare('SELECT * FROM providers WHERE id = ?').get(id) as Row | undefined;
  if (!provider || provider.status !== 'approved') throw httpError(404, 'Service provider not found');

  const body = ctx.body || {};
  const errors: Record<string, string> = {};
  const name = String(body.name || '').trim();
  const phone = String(body.phone || '').trim();
  const serviceNeeded = String(body.serviceNeeded || '').trim();
  if (name.length < 2) errors.name = 'Please enter your name';
  if (phone.length < 7) errors.phone = 'Please enter a contact phone number';
  if (serviceNeeded.length < 3) errors.serviceNeeded = 'Tell the provider which service you need';
  if (Object.keys(errors).length) return { status: 400, body: { error: 'Validation failed', errors } };

  const info = db.prepare(
    `INSERT INTO service_requests (provider_id, requester_id, name, phone, email, service_needed, details, preferred_date, budget)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, ctx.user ? ctx.user.id : null, name, phone, String(body.email || '').trim() || null, serviceNeeded,
    String(body.details || '').trim() || null, body.preferredDate ? String(body.preferredDate).slice(0, 10) : null, toNum(body.budget, null));

  logAudit(db, ctx.user ? ctx.user.id : null, 'service_request', 'provider', id, { requestId: Number(info.lastInsertRowid) });
  return { status: 201, body: { ok: true, requestId: Number(info.lastInsertRowid), message: `Your request has been sent to ${provider.business_name}` } };
});
