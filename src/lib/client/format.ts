export function money(amount: number | string | null | undefined, currency?: string | null): string {
  if (amount === null || amount === undefined || amount === '') return 'Negotiable';
  const n = Number(amount);
  return (currency ? currency + ' ' : '') + n.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

function toDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const iso = String(value).includes('T') ? value : String(value).replace(' ', 'T') + 'Z';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d;
}

export function dateLabel(value: string | null | undefined): string {
  if (!value) return '—';
  const d = toDate(value);
  if (!d) return String(value);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function dateTimeLabel(value: string | null | undefined): string {
  if (!value) return '—';
  const d = toDate(value);
  if (!d) return String(value);
  return d.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function timeAgo(value: string | null | undefined): string {
  if (!value) return '';
  const d = toDate(value);
  if (!d) return '';
  const secs = Math.floor((Date.now() - d.getTime()) / 1000);
  if (secs < 60) return 'just now';
  const mins = Math.floor(secs / 60);
  if (mins < 60) return mins + ' min ago';
  const hours = Math.floor(mins / 60);
  if (hours < 24) return hours + (hours === 1 ? ' hour ago' : ' hours ago');
  const days = Math.floor(hours / 24);
  if (days < 31) return days + (days === 1 ? ' day ago' : ' days ago');
  return dateLabel(value);
}

export function daysLeft(deadline: string | null | undefined): number | null {
  if (!deadline) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const end = new Date(String(deadline).slice(0, 10) + 'T00:00:00Z');
  if (isNaN(end.getTime())) return null;
  return Math.round((end.getTime() - today.getTime()) / 86400000);
}

export function initials(name: string | null | undefined): string {
  return String(name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');
}

export function roleLabel(role: string): string {
  return ({ seeker: 'Job seeker', employer: 'Employer', provider: 'Service provider', admin: 'Administrator' } as Record<string, string>)[role] || role;
}

const STATUS_CLASS: Record<string, string> = {
  approved: 'badge-green', active: 'badge-green', published: 'badge-green', completed: 'badge-green',
  hired: 'badge-green', accepted: 'badge-green', available: 'badge-green',
  pending: 'badge-amber', reviewing: 'badge-blue', contacted: 'badge-blue', quoted: 'badge-blue',
  submitted: 'badge-blue', new: 'badge-blue', shortlisted: 'badge-clay', interview: 'badge-clay', busy: 'badge-clay',
  rejected: 'badge-red', suspended: 'badge-red', declined: 'badge-red', cancelled: 'badge-red',
  closed: 'badge-plain', expired: 'badge-plain', withdrawn: 'badge-plain', unavailable: 'badge-plain', hidden: 'badge-plain',
};

export function statusClass(status: string): string {
  return STATUS_CLASS[status] || 'badge-plain';
}

/**
 * Build the numbered page list with ellipses, e.g. 1 … 4 5 [6] 7 8 … 20.
 * Always keeps the first and last page reachable so the control does not shift
 * around as the user pages through a long result set.
 */
export function pageNumbers(page: number, pages: number, span = 2): (number | '…')[] {
  const out: (number | '…')[] = [];
  const push = (v: number | '…') => { if (out[out.length - 1] !== v) out.push(v); };
  push(1);
  const start = Math.max(2, page - span);
  const end = Math.min(pages - 1, page + span);
  if (start > 2) push('…');
  for (let p = start; p <= end; p += 1) push(p);
  if (end < pages - 1) push('…');
  if (pages > 1) push(pages);
  return out;
}

export const PER_PAGE_OPTIONS = [6, 9, 12, 24, 48, 96];
