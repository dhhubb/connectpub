import { db } from '@/lib/db';
import { route, requireRole } from '@/lib/http';
import { logAudit, type Row } from '@/lib/util';

function readSettings(): Record<string, string> {
  const rows = db.prepare('SELECT key, value FROM settings').all() as Row[];
  const settings: Record<string, string> = {};
  for (const row of rows) settings[row.key] = row.value;
  return settings;
}

export const GET = route(async (ctx) => {
  requireRole(ctx, 'admin');
  return { body: { settings: readSettings() } };
});

export const PATCH = route(async (ctx) => {
  const actor = requireRole(ctx, 'admin');
  const body = ctx.body || {};
  const allowed = ['site_name', 'province', 'town', 'auto_approve_jobs', 'auto_approve_providers', 'contact_email'];
  const upsert = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');
  const changed: Record<string, string> = {};
  for (const key of allowed) {
    if (body[key] !== undefined) {
      const value = String(body[key]);
      upsert.run(key, value);
      changed[key] = value;
    }
  }
  logAudit(db, actor.id, 'update_settings', 'settings', null, changed);
  return { body: { settings: readSettings(), message: 'Settings saved' } };
});
