import { db } from '@/lib/db';
import { route } from '@/lib/http';
import { httpError, toInt, type Row } from '@/lib/util';
import { serializeGroup, groupCounts } from '@/lib/groups';

export const GET = route(async (ctx) => {
  const slug = String(ctx.params.slug);
  const group = db.prepare('SELECT * FROM category_groups WHERE slug = ? OR id = ?')
    .get(slug, toInt(slug) || -1) as Row | undefined;
  if (!group) throw httpError(404, 'Category group not found');
  const counts = groupCounts().get(group.id) || {};
  const categories = db.prepare(`
    SELECT c.*,
      (SELECT COUNT(*) FROM jobs j WHERE j.category_id = c.id AND j.status = 'approved') AS job_count,
      (SELECT COUNT(*) FROM providers p WHERE p.category_id = c.id AND p.status = 'approved') AS provider_count
    FROM categories c WHERE c.group_id = ? ORDER BY c.sort_order, c.name`).all(group.id) as Row[];
  return {
    body: {
      group: serializeGroup(group, counts),
      categories: categories.map((c) => ({
        id: c.id, name: c.name, slug: c.slug, kind: c.kind, icon: c.icon, description: c.description,
        jobCount: c.job_count, providerCount: c.provider_count,
      })),
    },
  };
});
