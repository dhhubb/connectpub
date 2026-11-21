import { db } from '@/lib/db';
import { route, requireRole } from '@/lib/http';
import { SELECT_PROVIDER, serializeProvider } from '@/lib/providers';
import type { Row } from '@/lib/util';

export const dynamic = 'force-dynamic';

export const GET = route(async (ctx) => {
  const user = requireRole(ctx, 'provider', 'admin');
  const rows = (user.role === 'admin'
    ? db.prepare(`${SELECT_PROVIDER} ORDER BY p.created_at DESC`).all()
    : db.prepare(`${SELECT_PROVIDER} WHERE p.owner_id = ? ORDER BY p.created_at DESC`).all(user.id)) as Row[];
  return { body: { providers: rows.map((r) => serializeProvider(r)) } };
});
