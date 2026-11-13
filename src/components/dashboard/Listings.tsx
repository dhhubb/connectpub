'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/client/api';
import type { SessionUser } from '@/lib/client/session';
import { useUi } from '@/lib/client/ui';
import type { Job, Provider } from '@/lib/client/types';
import type { DashboardMeta } from './meta';
import { JobFormModal, ListingFormModal } from './ListingForms';
import Badge from '@/components/Badge';
import Spinner from '@/components/Spinner';

export default function Listings({ user, meta }: { user: SessionUser; meta: DashboardMeta }) {
  const { toast, confirm } = useUi();
  const isEmployer = user.role === 'employer';
  const [rows, setRows] = useState<(Job | Provider)[] | null>(null);
  const [editing, setEditing] = useState<Job | Provider | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(() => {
    const endpoint = isEmployer ? '/jobs/mine' : '/providers/mine';
    const key = isEmployer ? 'jobs' : 'providers';
    api<Record<string, any>>(endpoint)
      .then((d) => setRows(d[key]))
      .catch((e) => { toast((e as Error).message, 'err'); setRows([]); });
  }, [isEmployer, toast]);

  useEffect(() => { load(); }, [load]);

  const remove = async (id: number) => {
    if (!(await confirm('Delete this listing permanently? This cannot be undone.', { confirmLabel: 'Delete', danger: true }))) return;
    try {
      await api(`${isEmployer ? '/jobs' : '/providers'}/${id}`, { method: 'DELETE' });
      toast('Listing deleted');
      load();
    } catch (err) { toast((err as Error).message, 'err'); }
  };

  const close = async (item: Job | Provider) => {
    if (!(await confirm('Close this listing so it stops showing publicly?', { confirmLabel: 'Close listing' }))) return;
    try {
      const body = isEmployer ? { ...jobBody(item as Job), status: 'closed' } : { status: 'suspended' };
      await api(`${isEmployer ? '/jobs' : '/providers'}/${item.id}`, { method: 'PATCH', body });
      toast('Listing closed');
      load();
    } catch (err) { toast((err as Error).message, 'err'); }
  };

  if (!rows) return <Spinner />;

  const openForm = (item: Job | Provider | null) => { setEditing(item); setCreating(!item); };

  return (
    <>
      <div className="page-head">
        <div>
          <h2>{isEmployer ? 'My job listings' : 'My service listings'}</h2>
          <p className="sub">{rows.length} listing{rows.length === 1 ? '' : 's'} · pending items are reviewed by an administrator</p>
        </div>
        <button className="btn" onClick={() => openForm(null)}>+ {isEmployer ? 'Post a job' : 'Add a service listing'}</button>
      </div>

      {rows.length ? (
        <div className="panel">
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>{isEmployer ? 'Job' : 'Business'}</th><th>Category</th><th>Area</th>
                  <th>{isEmployer ? 'Applicants' : 'Requests'}</th><th>Views</th><th>Status</th><th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const job = r as Job;
                  const prov = r as Provider;
                  const row = r as Job & Provider;
                  return (
                    <tr key={r.id}>
                      <td>
                        {isEmployer
                          ? <><Link href={`/jobs/${r.id}`}><b>{job.title}</b></Link><div className="tiny muted">{job.salaryLabel || ''}</div></>
                          : <><Link href={`/providers/${r.id}`}><b>{prov.businessName}</b></Link><div className="tiny muted">{prov.tagline || ''}</div></>}
                      </td>
                      <td className="small">{r.category?.name || '—'}</td>
                      <td className="small muted">{r.location?.name || '—'}</td>
                      <td className="small">{isEmployer ? job.applicationCount : (prov.requestCount ?? '—')}</td>
                      <td className="small">{r.views}</td>
                      <td>
                        <Badge status={r.status} label={row.statusLabel || r.status} />
                        {isEmployer && job.featured && <span className="badge badge-clay"> Featured</span>}
                        {!isEmployer && prov.verified && <span className="badge badge-green"> ✓</span>}
                        {row.rejectionReason && <div className="tiny" style={{ color: 'var(--danger)' }}>{r.rejectionReason}</div>}
                      </td>
                      <td className="actions">
                        <button className="btn btn-xs btn-ghost" onClick={() => openForm(r)}>Edit</button>
                        {r.status === 'approved' && <button className="btn btn-xs btn-ghost" onClick={() => close(r)}>Close</button>}
                        <button className="btn btn-xs btn-ghost" onClick={() => remove(r.id)}>Delete</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="empty">
          <span className="icon">{isEmployer ? '💼' : '🔧'}</span>
          <b>No listings yet</b>
          <p>{isEmployer ? 'Post your first vacancy to reach local candidates.' : 'Publish your business so customers can find you.'}</p>
          <button className="btn" onClick={() => openForm(null)}>+ Create listing</button>
        </div>
      )}

      {(creating || editing) && isEmployer && (
        <JobFormModal job={editing as Job | null} meta={meta} user={user} onClose={() => { setEditing(null); setCreating(false); }}
          onSaved={(msg) => { setEditing(null); setCreating(false); toast(msg); load(); }} />
      )}
      {(creating || editing) && !isEmployer && (
        <ListingFormModal provider={editing as Provider | null} meta={meta} user={user} onClose={() => { setEditing(null); setCreating(false); }}
          onSaved={(msg) => { setEditing(null); setCreating(false); toast(msg); load(); }} />
      )}
    </>
  );
}

function jobBody(job: Job) {
  return {
    title: job.title, company: job.company, description: job.description,
    requirements: (job.requirements || []).join('\n'), jobType: job.jobType, workMode: job.workMode,
    salaryMin: job.salaryMin, salaryMax: job.salaryMax, currency: job.currency, vacancies: job.vacancies,
    deadline: job.deadline, contactEmail: job.contactEmail, contactPhone: job.contactPhone,
    categoryId: job.category?.id, locationId: job.location?.id,
  };
}
