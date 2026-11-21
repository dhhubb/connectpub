import { db } from '@/lib/db';
import { route } from '@/lib/http';
import type { Row } from '@/lib/util';
import { serializeGroup, groupCounts } from '@/lib/groups';

export const dynamic = 'force-dynamic';

export const GET = route(async (ctx) => {
  const kind = ctx.query.get('kind');
  const where = kind ? "WHERE g.scope IN ('both', ?)" : '';
  const params = kind ? [kind] : [];
  const rows = db.prepare(`SELECT g.* FROM category_groups g ${where} ORDER BY g.sort_order, g.name`).all(...params) as Row[];
  const counts = groupCounts();
  return {
    body: {
      groups: rows.map((g) => {
        const c = counts.get(g.id) || {};
        // On a kind-specific request, report only the counts that kind cares about.
        const payload = serializeGroup(g, c);
        if (kind === 'job') payload.providerCount = 0;
        if (kind === 'service') payload.jobCount = 0;
        return payload;
      }),
    },
  };
});
