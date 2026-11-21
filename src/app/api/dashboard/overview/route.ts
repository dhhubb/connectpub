import { db } from '@/lib/db';
import { route, requireAuth } from '@/lib/http';
import type { Row } from '@/lib/util';
import { serializeApplicationRow, serializeRequestRow } from '@/lib/serialize';
// ---------- Overview ----------

export const dynamic = 'force-dynamic';

export const GET = route(async (ctx) => {
  const user = requireAuth(ctx);
  const cards: Record<string, number | null> = {};
  const one = (sql: string, ...args: any[]) => (db.prepare(sql).get(...args) as { n: number }).n;

  if (user.role === 'seeker') {
    cards.applications = one('SELECT COUNT(*) AS n FROM applications WHERE applicant_id = ?', user.id);
    cards.shortlisted = one("SELECT COUNT(*) AS n FROM applications WHERE applicant_id = ? AND status IN ('shortlisted','interview','hired')", user.id);
    cards.savedJobs = one("SELECT COUNT(*) AS n FROM saved_items WHERE user_id = ? AND item_type = 'job'", user.id);
    cards.savedProviders = one("SELECT COUNT(*) AS n FROM saved_items WHERE user_id = ? AND item_type = 'provider'", user.id);
  } else if (user.role === 'employer') {
    cards.jobs = one('SELECT COUNT(*) AS n FROM jobs WHERE employer_id = ?', user.id);
    cards.published = one("SELECT COUNT(*) AS n FROM jobs WHERE employer_id = ? AND status = 'approved'", user.id);
    cards.pendingReview = one("SELECT COUNT(*) AS n FROM jobs WHERE employer_id = ? AND status = 'pending'", user.id);
    cards.applications = one('SELECT COUNT(*) AS n FROM applications a JOIN jobs j ON j.id = a.job_id WHERE j.employer_id = ?', user.id);
    cards.shortlisted = one("SELECT COUNT(*) AS n FROM applications a JOIN jobs j ON j.id = a.job_id WHERE j.employer_id = ? AND a.status IN ('shortlisted','interview')", user.id);
    cards.hired = one("SELECT COUNT(*) AS n FROM applications a JOIN jobs j ON j.id = a.job_id WHERE j.employer_id = ? AND a.status = 'hired'", user.id);
    cards.jobViews = one('SELECT COALESCE(SUM(views), 0) AS n FROM jobs WHERE employer_id = ?', user.id);
  } else if (user.role === 'provider') {
    cards.listings = one('SELECT COUNT(*) AS n FROM providers WHERE owner_id = ?', user.id);
    cards.published = one("SELECT COUNT(*) AS n FROM providers WHERE owner_id = ? AND status = 'approved'", user.id);
    cards.pendingReview = one("SELECT COUNT(*) AS n FROM providers WHERE owner_id = ? AND status = 'pending'", user.id);
    cards.requests = one('SELECT COUNT(*) AS n FROM service_requests r JOIN providers p ON p.id = r.provider_id WHERE p.owner_id = ?', user.id);
    cards.newRequests = one("SELECT COUNT(*) AS n FROM service_requests r JOIN providers p ON p.id = r.provider_id WHERE p.owner_id = ? AND r.status = 'new'", user.id);
    cards.completed = one("SELECT COUNT(*) AS n FROM service_requests r JOIN providers p ON p.id = r.provider_id WHERE p.owner_id = ? AND r.status = 'completed'", user.id);
    cards.listingViews = one('SELECT COALESCE(SUM(views), 0) AS n FROM providers WHERE owner_id = ?', user.id);
    const agg = db.prepare(`
      SELECT COALESCE(SUM(rating_sum), 0) AS s, COALESCE(SUM(rating_count), 0) AS c
      FROM providers WHERE owner_id = ?`).get(user.id) as { s: number; c: number };
    cards.averageRating = agg.c ? Math.round((agg.s / agg.c) * 10) / 10 : null;
  } else {
    cards.jobs = one('SELECT COUNT(*) AS n FROM jobs');
    cards.providers = one('SELECT COUNT(*) AS n FROM providers');
    cards.users = one('SELECT COUNT(*) AS n FROM users');
    cards.applications = one('SELECT COUNT(*) AS n FROM applications');
    cards.requests = one('SELECT COUNT(*) AS n FROM service_requests');
  }

  const recentApplications = user.role === 'seeker'
    ? db.prepare(`
        SELECT a.*, j.title AS job_title, j.company, j.status AS job_status
        FROM applications a JOIN jobs j ON j.id = a.job_id
        WHERE a.applicant_id = ? ORDER BY a.created_at DESC LIMIT 5`).all(user.id)
    : db.prepare(`
        SELECT a.*, j.title AS job_title, j.company, u.name AS applicant_name, u.email AS applicant_email
        FROM applications a JOIN jobs j ON j.id = a.job_id JOIN users u ON u.id = a.applicant_id
        WHERE j.employer_id = ? ORDER BY a.created_at DESC LIMIT 5`).all(user.id);

  const recentRequests = user.role === 'provider'
    ? db.prepare(`
        SELECT r.*, p.business_name FROM service_requests r JOIN providers p ON p.id = r.provider_id
        WHERE p.owner_id = ? ORDER BY r.created_at DESC LIMIT 5`).all(user.id)
    : db.prepare(`
        SELECT r.*, p.business_name FROM service_requests r JOIN providers p ON p.id = r.provider_id
        WHERE r.requester_id = ? ORDER BY r.created_at DESC LIMIT 5`).all(user.id);

  return {
    body: {
      role: user.role,
      cards,
      recentApplications: user.role === 'provider' ? [] : (recentApplications as Row[]).map(serializeApplicationRow),
      recentRequests: (recentRequests as Row[]).map(serializeRequestRow),
    },
  };
});
