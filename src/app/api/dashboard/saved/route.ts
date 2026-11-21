import { db } from '@/lib/db';
import { route, requireAuth } from '@/lib/http';
import { serializeJob } from '@/lib/jobs';
import { serializeProvider } from '@/lib/providers';
import type { Row } from '@/lib/util';

export const dynamic = 'force-dynamic';

export const GET = route(async (ctx) => {
  const user = requireAuth(ctx);
  const rows = db.prepare('SELECT * FROM saved_items WHERE user_id = ? ORDER BY created_at DESC').all(user.id) as Row[];
  const jobs: Row[] = [];
  const providers: Row[] = [];
  for (const row of rows) {
    if (row.item_type === 'job') {
      const job = db.prepare(`
        SELECT j.*, c.name AS category_name, c.slug AS category_slug, c.icon AS category_icon,
               l.name AS location_name, l.kind AS location_kind, u.name AS employer_name
        FROM jobs j LEFT JOIN categories c ON c.id = j.category_id
        LEFT JOIN locations l ON l.id = j.location_id LEFT JOIN users u ON u.id = j.employer_id
        WHERE j.id = ?`).get(row.item_id) as Row | undefined;
      if (job) jobs.push({ ...serializeJob(job), savedAt: row.created_at });
    } else {
      const provider = db.prepare(`
        SELECT p.*, c.name AS category_name, c.slug AS category_slug, c.icon AS category_icon,
               l.name AS location_name, l.kind AS location_kind, u.name AS owner_name
        FROM providers p LEFT JOIN categories c ON c.id = p.category_id
        LEFT JOIN locations l ON l.id = p.location_id LEFT JOIN users u ON u.id = p.owner_id
        WHERE p.id = ?`).get(row.item_id) as Row | undefined;
      if (provider) providers.push({ ...serializeProvider(provider), savedAt: row.created_at });
    }
  }
  return { body: { jobs, providers } };
});
