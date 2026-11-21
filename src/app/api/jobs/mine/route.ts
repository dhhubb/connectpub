import { db } from '@/lib/db';
import { route, requireRole } from '@/lib/http';
import { SELECT_JOB, serializeJob } from '@/lib/jobs';
import type { Row } from '@/lib/util';

export const dynamic = 'force-dynamic';

export const GET = route(async (ctx) => {
  const user = requireRole(ctx, 'employer', 'admin');
  const rows = (user.role === 'admin'
    ? db.prepare(`${SELECT_JOB} ORDER BY j.created_at DESC`).all()
    : db.prepare(`${SELECT_JOB} WHERE j.employer_id = ? ORDER BY j.created_at DESC`).all(user.id)) as Row[];
  return { body: { jobs: rows.map((r) => serializeJob(r)) } };
});
