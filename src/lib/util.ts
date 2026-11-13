import type { DatabaseSync } from 'node:sqlite';

export type UserRole = 'seeker' | 'employer' | 'provider' | 'admin';
export type UserStatus = 'active' | 'suspended';
export type JobType = 'full_time' | 'part_time' | 'contract' | 'casual' | 'internship';
export type WorkMode = 'on_site' | 'hybrid' | 'remote';
export type JobStatus = 'pending' | 'approved' | 'rejected' | 'closed' | 'expired';
export type ProviderStatus = 'pending' | 'approved' | 'rejected' | 'suspended';
export type Availability = 'available' | 'busy' | 'unavailable';
export type ApplicationStatus = 'submitted' | 'reviewing' | 'shortlisted' | 'interview' | 'hired' | 'rejected' | 'withdrawn';
export type RequestStatus = 'new' | 'contacted' | 'quoted' | 'accepted' | 'completed' | 'declined' | 'cancelled';
export type ReviewStatus = 'published' | 'hidden';

export interface HttpError extends Error {
  status: number;
}

export interface PublicUser {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  role: UserRole;
  status: UserStatus;
  ward: string | null;
  bio: string | null;
  createdAt: string;
  lastLoginAt: string | null;
}

export interface Pagination {
  page: number;
  perPage: number;
  total: number;
  pages: number;
  from?: number;
  to?: number;
  hasPrev?: boolean;
  hasNext?: boolean;
}

export interface PageParams {
  page: number;
  perPage: number;
  offset: number;
  perPageOptions: number[];
}

/** A raw SQLite row. node:sqlite returns loosely typed records. */
export type Row = Record<string, any>;

export function slugify(value: unknown): string {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

export function httpError(status: number, message: string): HttpError {
  const err = new Error(message) as HttpError;
  err.status = status;
  return err;
}

export function logAudit(
  db: DatabaseSync,
  actorId: number | null,
  action: string,
  entity: string,
  entityId: number | null,
  details?: unknown,
): void {
  db.prepare(
    'INSERT INTO audit_log (actor_id, action, entity, entity_id, details) VALUES (?, ?, ?, ?, ?)',
  ).run(
    actorId ?? null,
    action,
    entity,
    entityId ?? null,
    details ? (typeof details === 'string' ? details : JSON.stringify(details)) : null,
  );
}

export function toInt(value: unknown, fallback: number | null = null): number | null {
  const n = Number.parseInt(String(value), 10);
  return Number.isFinite(n) ? n : fallback;
}

export function toNum(value: unknown, fallback: number | null = null): number | null {
  if (value === '' || value === null || value === undefined) return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export const PER_PAGE_OPTIONS = [6, 9, 12, 24, 48, 96];
export const DEFAULT_PER_PAGE = 12;

export function pageParams(
  query: Record<string, string | string[] | undefined>,
  { defaultPerPage = DEFAULT_PER_PAGE }: { defaultPerPage?: number } = {},
): PageParams {
  const page = clamp(toInt(query.page, 1) ?? 1, 1, 10000);
  const requested = toInt(query.per_page, defaultPerPage) ?? defaultPerPage;
  // Snap to the nearest allowed size so the UI selector and the API agree, but
  // still honour any value inside the hard bounds.
  const perPage = PER_PAGE_OPTIONS.includes(requested)
    ? requested
    : clamp(requested, 1, 100);
  return { page, perPage, offset: (page - 1) * perPage, perPageOptions: PER_PAGE_OPTIONS };
}

/**
 * Turn free text typed into a search box into a safe FTS5 MATCH expression.
 * Each whitespace-separated term becomes a prefix query and the terms are
 * ANDed, so "bore hole" and "borehole" both behave sensibly. Returns null when
 * there is nothing searchable, letting callers skip the join entirely.
 */
export function ftsQuery(input: unknown): string | null {
  const terms = String(input ?? '')
    .replace(/["'^*():]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 2)
    .slice(0, 8);
  if (!terms.length) return null;
  return terms.map((t) => `"${t}"*`).join(' AND ');
}

export function pickEnum<T extends string>(value: unknown, allowed: readonly T[], fallback: T | null): T | null {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

export const JOB_TYPES: readonly JobType[] = ['full_time', 'part_time', 'contract', 'casual', 'internship'];
export const WORK_MODES: readonly WorkMode[] = ['on_site', 'hybrid', 'remote'];
export const APPLICATION_STATUSES: readonly ApplicationStatus[] = ['submitted', 'reviewing', 'shortlisted', 'interview', 'hired', 'rejected', 'withdrawn'];
export const REQUEST_STATUSES: readonly RequestStatus[] = ['new', 'contacted', 'quoted', 'accepted', 'completed', 'declined', 'cancelled'];
export const USER_ROLES: readonly UserRole[] = ['seeker', 'employer', 'provider', 'admin'];

export const JOB_TYPE_LABELS: Record<string, string> = {
  full_time: 'Full time',
  part_time: 'Part time',
  contract: 'Contract',
  casual: 'Casual',
  internship: 'Internship',
};

export const WORK_MODE_LABELS: Record<string, string> = { on_site: 'On site', hybrid: 'Hybrid', remote: 'Remote' };

export const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending review',
  approved: 'Approved',
  rejected: 'Rejected',
  closed: 'Closed',
  expired: 'Expired',
  suspended: 'Suspended',
  active: 'Active',
};

export const APPLICATION_STATUS_LABELS: Record<string, string> = {
  submitted: 'Submitted',
  reviewing: 'Reviewing',
  shortlisted: 'Shortlisted',
  interview: 'Interview',
  hired: 'Hired',
  rejected: 'Rejected',
  withdrawn: 'Withdrawn',
};

export const REQUEST_STATUS_LABELS: Record<string, string> = {
  new: 'New',
  contacted: 'Contacted',
  quoted: 'Quoted',
  accepted: 'Accepted',
  completed: 'Completed',
  declined: 'Declined',
  cancelled: 'Cancelled',
};

export function publicUser(row: Row | null | undefined): PublicUser | null {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    role: row.role,
    status: row.status,
    ward: row.ward,
    bio: row.bio,
    createdAt: row.created_at,
    lastLoginAt: row.last_login_at,
  };
}
