import { db } from '@/lib/db';
import { route } from '@/lib/http';
import type { Row } from '@/lib/util';

export const GET = route(async () => {
  const one = (sql: string) => (db.prepare(sql).get() as { n: number }).n;
  const byJobCategory = db.prepare(`
    SELECT c.name, c.icon, COUNT(j.id) AS count
    FROM categories c LEFT JOIN jobs j ON j.category_id = c.id AND j.status = 'approved'
    WHERE c.kind = 'job' GROUP BY c.id ORDER BY count DESC, c.name`).all() as Row[];
  const byProviderCategory = db.prepare(`
    SELECT c.name, c.icon, COUNT(p.id) AS count
    FROM categories c LEFT JOIN providers p ON p.category_id = c.id AND p.status = 'approved'
    WHERE c.kind = 'service' GROUP BY c.id ORDER BY count DESC, c.name`).all() as Row[];
  const byLocation = db.prepare(`
    SELECT l.name, l.kind,
      (SELECT COUNT(*) FROM jobs j WHERE j.location_id = l.id AND j.status = 'approved') AS jobs,
      (SELECT COUNT(*) FROM providers p WHERE p.location_id = l.id AND p.status = 'approved') AS providers
    FROM locations l ORDER BY jobs + providers DESC, l.name LIMIT 12`).all() as Row[];
  const byJobType = db.prepare(`
    SELECT job_type AS label, COUNT(*) AS count FROM jobs WHERE status = 'approved' GROUP BY job_type`).all() as Row[];
  const byGroup = db.prepare(`
    SELECT g.name, g.slug, g.icon, g.scope, g.description,
      (SELECT COUNT(*) FROM jobs j JOIN categories c ON c.id = j.category_id
        WHERE c.group_id = g.id AND j.status = 'approved') AS jobs,
      (SELECT COUNT(*) FROM providers p JOIN categories c ON c.id = p.category_id
        WHERE c.group_id = g.id AND p.status = 'approved') AS providers
    FROM category_groups g ORDER BY g.sort_order, g.name`).all() as Row[];

  return {
    body: {
      totals: {
        approvedJobs: one("SELECT COUNT(*) AS n FROM jobs WHERE status = 'approved'"),
        openVacancies: one("SELECT COALESCE(SUM(vacancies), 0) AS n FROM jobs WHERE status = 'approved'"),
        approvedProviders: one("SELECT COUNT(*) AS n FROM providers WHERE status = 'approved'"),
        verifiedProviders: one("SELECT COUNT(*) AS n FROM providers WHERE status = 'approved' AND verified = 1"),
        registeredUsers: one("SELECT COUNT(*) AS n FROM users WHERE status = 'active'"),
        employers: one("SELECT COUNT(*) AS n FROM users WHERE role = 'employer'"),
        providers: one("SELECT COUNT(*) AS n FROM users WHERE role = 'provider'"),
        applications: one('SELECT COUNT(*) AS n FROM applications'),
        serviceRequests: one('SELECT COUNT(*) AS n FROM service_requests'),
        pendingJobs: one("SELECT COUNT(*) AS n FROM jobs WHERE status = 'pending'"),
        pendingProviders: one("SELECT COUNT(*) AS n FROM providers WHERE status = 'pending'"),
      },
      byJobCategory, byProviderCategory, byGroup, byLocation, byJobType,
    },
  };
});
