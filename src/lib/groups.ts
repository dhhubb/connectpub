import { db } from './db';
import type { Row } from './util';

export function serializeGroup(row: Row, counts: Row = {}): Row {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    icon: row.icon,
    scope: row.scope,
    description: row.description,
    jobCount: counts.jobCount ?? 0,
    providerCount: counts.providerCount ?? 0,
    categoryCount: counts.categoryCount ?? 0,
  };
}

/** Approved listing totals per group, split by kind. */
export function groupCounts(): Map<number, Row> {
  const rows = db.prepare(`
    SELECT g.id,
      (SELECT COUNT(*) FROM jobs j JOIN categories c ON c.id = j.category_id
        WHERE c.group_id = g.id AND j.status = 'approved') AS job_count,
      (SELECT COUNT(*) FROM providers p JOIN categories c ON c.id = p.category_id
        WHERE c.group_id = g.id AND p.status = 'approved') AS provider_count,
      (SELECT COUNT(*) FROM categories c WHERE c.group_id = g.id) AS category_count
    FROM category_groups g`).all() as Row[];
  const map = new Map<number, Row>();
  for (const r of rows) {
    map.set(r.id, { jobCount: r.job_count, providerCount: r.provider_count, categoryCount: r.category_count });
  }
  return map;
}
