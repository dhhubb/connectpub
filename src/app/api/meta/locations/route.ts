import { db } from '@/lib/db';
import { route } from '@/lib/http';
import type { Row } from '@/lib/util';

export const GET = route(async () => {
  const rows = db.prepare('SELECT * FROM locations ORDER BY kind, name').all() as Row[];
  const jobCount = db.prepare("SELECT COUNT(*) AS n FROM jobs WHERE location_id = ? AND status = 'approved'");
  const providerCount = db.prepare("SELECT COUNT(*) AS n FROM providers WHERE location_id = ? AND status = 'approved'");
  return {
    body: {
      locations: rows.map((l) => ({
        id: l.id, name: l.name, slug: l.slug, kind: l.kind, notes: l.notes,
        jobCount: (jobCount.get(l.id) as { n: number }).n,
        providerCount: (providerCount.get(l.id) as { n: number }).n,
      })),
    },
  };
});
