import { db } from '@/lib/db';
import { route, requireAuth } from '@/lib/http';
import { httpError, logAudit, pickEnum, APPLICATION_STATUSES, type Row } from '@/lib/util';
import { serializeApplicationRow } from '@/lib/serialize';

export const dynamic = 'force-dynamic';

export const PATCH = route(async (ctx) => {
  const user = requireAuth(ctx);
  const id = Number(ctx.params.id);
  const app = db.prepare('SELECT * FROM applications WHERE id = ?').get(id) as Row | undefined;
  if (!app) throw httpError(404, 'Application not found');
  const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(app.job_id) as Row;

  if (job.employer_id === user.id) {
    const status = pickEnum(ctx.body.status, APPLICATION_STATUSES, null);
    if (!status) throw httpError(400, 'Unknown application status');
    const note = ctx.body.employerNote !== undefined ? String(ctx.body.employerNote).trim() || null : app.employer_note;
    db.prepare("UPDATE applications SET status = ?, employer_note = ?, updated_at = datetime('now') WHERE id = ?").run(status, note, id);
    logAudit(db, user.id, 'update_application', 'application', id, { status });
  } else if (app.applicant_id === user.id) {
    const status = pickEnum(ctx.body.status, ['withdrawn'] as const, null);
    if (!status) throw httpError(403, 'Only the employer can change the application status');
    db.prepare("UPDATE applications SET status = 'withdrawn', updated_at = datetime('now') WHERE id = ?").run(id);
    logAudit(db, user.id, 'withdraw_application', 'application', id, null);
  } else {
    throw httpError(403, 'You cannot modify this application');
  }

  const updated = db.prepare(`
    SELECT a.*, j.title AS job_title, j.company, u.name AS applicant_name, u.email AS applicant_email
    FROM applications a JOIN jobs j ON j.id = a.job_id JOIN users u ON u.id = a.applicant_id
    WHERE a.id = ?`).get(id) as Row;
  return { body: { application: serializeApplicationRow(updated) } };
});
