import { db } from '@/lib/db';
import { route, requireRole } from '@/lib/http';
import type { Row } from '@/lib/util';
import { serializeAudit } from '@/lib/serialize';

export const dynamic = 'force-dynamic';

export const GET = route(async (ctx) => {
  requireRole(ctx, 'admin');
  const one = (sql: string) => (db.prepare(sql).get() as { n: number }).n;
  const counts = {
    users: one('SELECT COUNT(*) AS n FROM users'),
    seekers: one("SELECT COUNT(*) AS n FROM users WHERE role = 'seeker'"),
    employers: one("SELECT COUNT(*) AS n FROM users WHERE role = 'employer'"),
    providers: one("SELECT COUNT(*) AS n FROM users WHERE role = 'provider'"),
    admins: one("SELECT COUNT(*) AS n FROM users WHERE role = 'admin'"),
    suspendedUsers: one("SELECT COUNT(*) AS n FROM users WHERE status = 'suspended'"),
    jobs: one('SELECT COUNT(*) AS n FROM jobs'),
    pendingJobs: one("SELECT COUNT(*) AS n FROM jobs WHERE status = 'pending'"),
    approvedJobs: one("SELECT COUNT(*) AS n FROM jobs WHERE status = 'approved'"),
    rejectedJobs: one("SELECT COUNT(*) AS n FROM jobs WHERE status = 'rejected'"),
    featuredJobs: one('SELECT COUNT(*) AS n FROM jobs WHERE featured = 1'),
    jobViews: one('SELECT COALESCE(SUM(views), 0) AS n FROM jobs'),
    providersTotal: one('SELECT COUNT(*) AS n FROM providers'),
    pendingProviders: one("SELECT COUNT(*) AS n FROM providers WHERE status = 'pending'"),
    approvedProviders: one("SELECT COUNT(*) AS n FROM providers WHERE status = 'approved'"),
    verifiedProviders: one("SELECT COUNT(*) AS n FROM providers WHERE verified = 1"),
    featuredProviders: one('SELECT COUNT(*) AS n FROM providers WHERE featured = 1'),
    providerViews: one('SELECT COALESCE(SUM(views), 0) AS n FROM providers'),
    applications: one('SELECT COUNT(*) AS n FROM applications'),
    serviceRequests: one('SELECT COUNT(*) AS n FROM service_requests'),
    openRequests: one("SELECT COUNT(*) AS n FROM service_requests WHERE status IN ('new','contacted','quoted','accepted')"),
    reviews: one('SELECT COUNT(*) AS n FROM reviews'),
    hiddenReviews: one("SELECT COUNT(*) AS n FROM reviews WHERE status = 'hidden'"),
    categories: one('SELECT COUNT(*) AS n FROM categories'),
    locations: one('SELECT COUNT(*) AS n FROM locations'),
  };

  const usersByRole = db.prepare('SELECT role AS label, COUNT(*) AS count FROM users GROUP BY role').all() as Row[];
  const jobsByStatus = db.prepare('SELECT status AS label, COUNT(*) AS count FROM jobs GROUP BY status').all() as Row[];
  const providersByStatus = db.prepare('SELECT status AS label, COUNT(*) AS count FROM providers GROUP BY status').all() as Row[];
  const applicationsByStatus = db.prepare('SELECT status AS label, COUNT(*) AS count FROM applications GROUP BY status').all() as Row[];
  const requestsByStatus = db.prepare('SELECT status AS label, COUNT(*) AS count FROM service_requests GROUP BY status').all() as Row[];

  const jobsByCategory = db.prepare(`
    SELECT c.name AS label, c.icon AS icon, COUNT(j.id) AS count
    FROM categories c LEFT JOIN jobs j ON j.category_id = c.id
    WHERE c.kind = 'job' GROUP BY c.id ORDER BY count DESC`).all() as Row[];
  const providersByCategory = db.prepare(`
    SELECT c.name AS label, c.icon AS icon, COUNT(p.id) AS count
    FROM categories c LEFT JOIN providers p ON p.category_id = c.id
    WHERE c.kind = 'service' GROUP BY c.id ORDER BY count DESC`).all() as Row[];
  const activityByLocation = db.prepare(`
    SELECT l.name AS label,
      (SELECT COUNT(*) FROM jobs j WHERE j.location_id = l.id) AS jobs,
      (SELECT COUNT(*) FROM providers p WHERE p.location_id = l.id) AS providers
    FROM locations l ORDER BY (jobs + providers) DESC LIMIT 10`).all() as Row[];

  const signups = db.prepare(`
    WITH RECURSIVE days(d) AS (
      SELECT date('now', '-13 days') UNION ALL SELECT date(d, '+1 day') FROM days WHERE d < date('now')
    )
    SELECT d AS day,
      (SELECT COUNT(*) FROM users u WHERE date(u.created_at) = d) AS users,
      (SELECT COUNT(*) FROM jobs j WHERE date(j.created_at) = d) AS jobs,
      (SELECT COUNT(*) FROM providers p WHERE date(p.created_at) = d) AS providers,
      (SELECT COUNT(*) FROM applications a WHERE date(a.created_at) = d) AS applications
    FROM days`).all() as Row[];

  const topJobs = db.prepare(`
    SELECT j.id, j.title, j.company, j.views,
      (SELECT COUNT(*) FROM applications a WHERE a.job_id = j.id) AS applications
    FROM jobs j WHERE j.status = 'approved' ORDER BY j.views DESC LIMIT 8`).all() as Row[];

  const topProviders = db.prepare(`
    SELECT p.id, p.business_name, p.views,
      (SELECT COUNT(*) FROM service_requests r WHERE r.provider_id = p.id) AS requests,
      CASE WHEN p.rating_count > 0 THEN ROUND(p.rating_sum * 1.0 / p.rating_count, 1) ELSE NULL END AS rating
    FROM providers p WHERE p.status = 'approved' ORDER BY p.views DESC LIMIT 8`).all() as Row[];

  const recentAudit = db.prepare(`
    SELECT a.*, u.name AS actor_name FROM audit_log a LEFT JOIN users u ON u.id = a.actor_id
    ORDER BY a.created_at DESC LIMIT 12`).all() as Row[];

  return {
    body: {
      counts, usersByRole, jobsByStatus, providersByStatus, applicationsByStatus, requestsByStatus,
      jobsByCategory, providersByCategory, activityByLocation, signups, topJobs, topProviders,
      recentAudit: recentAudit.map(serializeAudit),
    },
  };
});
