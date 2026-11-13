import { db } from './db';
import {
  toInt, toNum, pickEnum, JOB_TYPE_LABELS, WORK_MODE_LABELS, STATUS_LABELS,
  JOB_TYPES, WORK_MODES, type Row,
} from './util';

export const SELECT_JOB = `
  SELECT j.*,
         c.name AS category_name, c.slug AS category_slug, c.icon AS category_icon,
         g.name AS group_name, g.slug AS group_slug, g.icon AS group_icon,
         l.name AS location_name, l.kind AS location_kind,
         u.name AS employer_name, u.email AS employer_email, u.phone AS employer_phone,
         (SELECT COUNT(*) FROM applications a WHERE a.job_id = j.id) AS application_count
  FROM jobs j
  LEFT JOIN categories c ON c.id = j.category_id
  LEFT JOIN category_groups g ON g.id = c.group_id
  LEFT JOIN locations l ON l.id = j.location_id
  LEFT JOIN users u ON u.id = j.employer_id`;

function salaryText(row: Row): string {
  if (!row.salary_min && !row.salary_max) return 'Negotiable';
  const fmt = (n: number) => `${row.currency} ${Number(n).toLocaleString('en-US')}`;
  if (row.salary_min && row.salary_max) return `${fmt(row.salary_min)} - ${fmt(row.salary_max)}`;
  if (row.salary_min) return `From ${fmt(row.salary_min)}`;
  return `Up to ${fmt(row.salary_max)}`;
}

export interface SerializeJobOptions {
  full?: boolean;
  savedIds?: Set<number> | null;
  myApplication?: unknown;
}

export function serializeJob(row: Row | null | undefined, { full = false, savedIds = null, myApplication = null }: SerializeJobOptions = {}): any {
  if (!row) return null;
  const job: Row = {
    id: row.id,
    title: row.title,
    company: row.company,
    employerId: row.employer_id,
    employerName: row.employer_name,
    category: row.category_id ? { id: row.category_id, name: row.category_name, slug: row.category_slug, icon: row.category_icon } : null,
    group: row.group_slug ? { name: row.group_name, slug: row.group_slug, icon: row.group_icon } : null,
    location: row.location_id ? { id: row.location_id, name: row.location_name, kind: row.location_kind } : null,
    jobType: row.job_type,
    jobTypeLabel: JOB_TYPE_LABELS[row.job_type] || row.job_type,
    workMode: row.work_mode,
    workModeLabel: WORK_MODE_LABELS[row.work_mode] || row.work_mode,
    salaryMin: row.salary_min,
    salaryMax: row.salary_max,
    currency: row.currency,
    salaryLabel: salaryText(row),
    vacancies: row.vacancies,
    deadline: row.deadline,
    status: row.status,
    statusLabel: STATUS_LABELS[row.status] || row.status,
    featured: Boolean(row.featured),
    views: row.views,
    applicationCount: row.application_count ?? 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    isExpired: Boolean(row.deadline && row.deadline < new Date().toISOString().slice(0, 10)),
  };
  if (full) {
    job.description = row.description;
    job.requirements = row.requirements ? String(row.requirements).split('\n').filter(Boolean) : [];
    job.contactEmail = row.contact_email;
    job.contactPhone = row.contact_phone;
    job.rejectionReason = row.rejection_reason;
  }
  if (savedIds) job.saved = savedIds.has(row.id);
  if (myApplication !== null) job.myApplication = myApplication;
  return job;
}

export function savedJobIds(userId: number | null | undefined): Set<number> | null {
  if (!userId) return null;
  const rows = db.prepare("SELECT item_id FROM saved_items WHERE user_id = ? AND item_type = 'job'").all(userId) as Array<{ item_id: number }>;
  return new Set(rows.map((r) => r.item_id));
}

export function serializeApplication(row: Row | null | undefined): any {
  if (!row) return null;
  return {
    id: row.id,
    jobId: row.job_id,
    applicantId: row.applicant_id,
    coverLetter: row.cover_letter,
    cvUrl: row.cv_url,
    expectedSalary: row.expected_salary,
    status: row.status,
    employerNote: row.employer_note,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function resolveCategoryId(value: unknown): number | null {
  if (value === undefined || value === null || value === '') return null;
  const asId = toInt(value);
  if (asId && db.prepare("SELECT id FROM categories WHERE id = ? AND kind = 'job'").get(asId)) return asId;
  const bySlug = db.prepare("SELECT id FROM categories WHERE slug = ? AND kind = 'job'").get(String(value)) as { id: number } | undefined;
  return bySlug ? bySlug.id : null;
}

export function resolveLocationId(value: unknown): number | null {
  if (value === undefined || value === null || value === '') return null;
  const asId = toInt(value);
  if (asId && db.prepare('SELECT id FROM locations WHERE id = ?').get(asId)) return asId;
  const bySlug = db.prepare('SELECT id FROM locations WHERE slug = ?').get(String(value)) as { id: number } | undefined;
  return bySlug ? bySlug.id : null;
}

/**
 * Resolve a group filter to the set of category ids that belong to it. Returns
 * null when the caller asked for a group that does not exist or applies to the
 * other listing kind, so an unknown slug simply yields no extra constraint.
 */
export function resolveGroup(value: unknown, kind: 'job' | 'service'): { group: Row; categoryIds: number[] } | null {
  if (value === undefined || value === null || value === '') return null;
  const group = db.prepare('SELECT * FROM category_groups WHERE slug = ? OR id = ?')
    .get(String(value), toInt(value) || -1) as Row | undefined;
  if (!group) return null;
  const rows = db.prepare(`
    SELECT c.id FROM categories c
    JOIN category_groups g ON g.id = c.group_id
    WHERE c.kind = ? AND g.id = ?`).all(kind, group.id) as Array<{ id: number }>;
  return { group, categoryIds: rows.map((r) => r.id) };
}

export function jobToBody(job: Row): Row {
  return {
    title: job.title, company: job.company, description: job.description, requirements: job.requirements,
    jobType: job.job_type, workMode: job.work_mode, salaryMin: job.salary_min, salaryMax: job.salary_max,
    currency: job.currency, vacancies: job.vacancies, deadline: job.deadline,
    contactEmail: job.contact_email, contactPhone: job.contact_phone,
    categoryId: job.category_id, locationId: job.location_id,
  };
}

export function validateJob(body: any) {
  const errors: Record<string, string> = {};
  const title = String(body.title || '').trim();
  const company = String(body.company || '').trim();
  const description = String(body.description || '').trim();
  if (title.length < 3) errors.title = 'Job title is required';
  if (company.length < 2) errors.company = 'Company name is required';
  if (description.length < 30) errors.description = 'Please write at least 30 characters describing the role';
  const jobType = pickEnum(body.jobType, JOB_TYPES, null);
  if (!jobType) errors.jobType = 'Select a job type';
  const workMode = pickEnum(body.workMode, WORK_MODES, 'on_site');
  const salaryMin = toNum(body.salaryMin, null);
  const salaryMax = toNum(body.salaryMax, null);
  if (salaryMin !== null && salaryMax !== null && salaryMax < salaryMin) errors.salaryMax = 'Maximum salary must be greater than the minimum';
  const vacancies = toInt(body.vacancies, 1) || 1;
  if (vacancies < 1) errors.vacancies = 'At least one vacancy is required';
  const deadline = body.deadline ? String(body.deadline).slice(0, 10) : null;
  if (deadline && !/^\d{4}-\d{2}-\d{2}$/.test(deadline)) errors.deadline = 'Use the date picker to choose a deadline';
  return {
    errors,
    values: {
      title, company, description,
      requirements: String(body.requirements || '').trim() || null,
      jobType, workMode, salaryMin, salaryMax,
      currency: String(body.currency || 'USD').trim().toUpperCase().slice(0, 3) || 'USD',
      vacancies, deadline,
      contactEmail: String(body.contactEmail || '').trim() || null,
      contactPhone: String(body.contactPhone || '').trim() || null,
      categoryId: resolveCategoryId(body.categoryId ?? body.category),
      locationId: resolveLocationId(body.locationId ?? body.location),
    },
  };
}
