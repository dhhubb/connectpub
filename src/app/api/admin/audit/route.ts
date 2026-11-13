import { db } from '@/lib/db';
import { route, requireRole } from '@/lib/http';
import { pageParams, type Row } from '@/lib/util';
import { serializeAudit } from '@/lib/serialize';

export const GET = route(async (ctx) => {
  requireRole(ctx, 'admin');
  const { page, perPage, offset } = pageParams(Object.fromEntries(ctx.query));
  const where: string[] = [];
  const params: any[] = [];
  const entity = String(ctx.query.get('entity') || '').trim();
  if (entity) { where.push('a.entity = ?'); params.push(entity); }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const total = (db.prepare(`SELECT COUNT(*) AS n FROM audit_log a ${whereSql}`).get(...params) as { n: number }).n;
  const rows = db.prepare(`
    SELECT a.*, u.name AS actor_name FROM audit_log a LEFT JOIN users u ON u.id = a.actor_id
    ${whereSql} ORDER BY a.created_at DESC LIMIT ? OFFSET ?`).all(...params, perPage, offset) as Row[];
  return {
    body: {
      entries: rows.map(serializeAudit),
      pagination: { page, perPage, total, pages: Math.max(1, Math.ceil(total / perPage)) },
    },
  };
});
