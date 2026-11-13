import { db } from '@/lib/db';
import { route } from '@/lib/http';
import type { Row } from '@/lib/util';

export const GET = route(async (ctx) => {
  const kind = ctx.query.get('kind');
  const rows = (kind
    ? db.prepare('SELECT * FROM categories WHERE kind = ? ORDER BY sort_order, name').all(kind)
    : db.prepare('SELECT * FROM categories ORDER BY kind, sort_order, name').all()) as Row[];
  const groupNames = new Map(
    (db.prepare('SELECT id, name, slug, icon FROM category_groups').all() as Row[]).map((g) => [g.id, g]),
  );
  const jobCount = db.prepare("SELECT COUNT(*) AS n FROM jobs WHERE category_id = ? AND status = 'approved'");
  const providerCount = db.prepare("SELECT COUNT(*) AS n FROM providers WHERE category_id = ? AND status = 'approved'");
  return {
    body: {
      categories: rows.map((c) => {
        const g = c.group_id ? groupNames.get(c.group_id) : null;
        return {
          id: c.id, name: c.name, slug: c.slug, kind: c.kind, icon: c.icon, description: c.description,
          group: g ? { id: g.id, name: g.name, slug: g.slug, icon: g.icon } : null,
          jobCount: (jobCount.get(c.id) as { n: number }).n,
          providerCount: (providerCount.get(c.id) as { n: number }).n,
        };
      }),
    },
  };
});
