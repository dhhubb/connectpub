'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { api, setQuery, toQuery, useDebounced } from '@/lib/client/api';
import { useUi } from '@/lib/client/ui';
import { dateLabel, dateTimeLabel, timeAgo } from '@/lib/client/format';
import type { Job } from '@/lib/client/types';
import Badge from '@/components/Badge';
import Modal from '@/components/Modal';
import Spinner from '@/components/Spinner';

const STATUSES = ['', 'pending', 'approved', 'rejected', 'closed'];

export default function AdminJobs() {
  const { toast } = useUi();
  const [jobs, setJobs] = useState<Job[] | null>(null);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const [inspect, setInspect] = useState<Job | null>(null);
  const [reject, setReject] = useState<Job | null>(null);
  const [rejectReason, setRejectReason] = useState('Does not meet listing guidelines');

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    setStatus(p.get('status') || '');
    setQ(p.get('q') || '');
  }, []);

  const load = useCallback(() => {
    api<{ jobs: Job[]; pagination: { total: number } }>('/admin/jobs?' + toQuery({ per_page: 50, status, q }))
      .then((d) => { setJobs(d.jobs); setTotal(d.pagination.total); })
      .catch((e) => { toast((e as Error).message, 'err'); setJobs([]); });
  }, [status, q, toast]);

  useEffect(() => { load(); }, [load]);

  const debounced = useDebounced((v: string) => { setQ(v); setQuery({ q: v, view: 'jobs' }); }, 450);

  const moderate = async (id: number, patch: Record<string, any>) => {
    try {
      const res = await api<{ message: string }>('/admin/jobs/' + id, { method: 'PATCH', body: patch });
      toast(res.message || 'Job updated');
      load();
    } catch (e) { toast((e as Error).message, 'err'); }
  };

  const doReject = async () => {
    if (!reject) return;
    try {
      await api('/admin/jobs/' + reject.id, { method: 'PATCH', body: { status: 'rejected', rejectionReason: rejectReason } });
      setReject(null);
      toast('Job rejected');
      load();
    } catch (e) { toast((e as Error).message, 'err'); }
  };

  if (!jobs) return <Spinner />;

  return (
    <>
      <div className="page-head">
        <div><h2>Job moderation</h2><p className="sub">{total} listing{total === 1 ? '' : 's'} · approve, reject or feature vacancies</p></div>
      </div>

      <div className="panel" style={{ marginBottom: '1rem' }}>
        <div className="panel-body row row-wrap">
          <div className="chips">
            {STATUSES.map((s) => (
              <button key={s} className={'chip' + (status === s ? ' active' : '')} onClick={() => { setStatus(s); setQuery({ status: s, view: 'jobs' }); }}>
                {s === '' ? 'All' : s}
              </button>
            ))}
          </div>
          <div className="grow" />
          <input type="search" placeholder="Search title or company…" defaultValue={q} style={{ maxWidth: 280 }} onChange={(e) => debounced(e.target.value)} />
        </div>
      </div>

      <div className="panel">
        <div className="table-wrap">
          <table className="data">
            <thead><tr><th>Job</th><th>Employer</th><th>Category</th><th>Applicants</th><th>Views</th><th>Status</th><th>Posted</th><th></th></tr></thead>
            <tbody>
              {jobs.length ? jobs.map((j) => (
                <tr key={j.id} className={j.status === 'pending' ? 'row-flag' : ''}>
                  <td>
                    <Link href={`/jobs/${j.id}`}><b>{j.title}</b></Link>
                    <div className="tiny muted">{j.jobTypeLabel} · {j.workModeLabel}{j.location ? ` · ${j.location.name}` : ''}{j.featured ? ' · ' : ''}{j.featured && <span className="badge badge-clay">Featured</span>}</div>
                  </td>
                  <td className="small">{j.employerName || j.company}</td>
                  <td className="small muted">{j.category?.name || '—'}</td>
                  <td className="small">{j.applicationCount}</td>
                  <td className="small">{j.views}</td>
                  <td>
                    <Badge status={j.status} label={j.statusLabel} />
                    {j.rejectionReason && <div className="tiny" style={{ color: 'var(--danger)' }}>{j.rejectionReason}</div>}
                  </td>
                  <td className="small muted nowrap">{timeAgo(j.createdAt)}</td>
                  <td className="actions">
                    <button className="btn btn-xs btn-ghost" onClick={() => setInspect(j)}>Inspect</button>
                    {j.status !== 'approved' && <button className="btn btn-xs" onClick={() => moderate(j.id, { status: 'approved' })}>Approve</button>}
                    {j.status !== 'rejected' && <button className="btn btn-xs btn-ghost" onClick={() => { setRejectReason('Does not meet listing guidelines'); setReject(j); }}>Reject</button>}
                    <button className="btn btn-xs btn-ghost" onClick={() => moderate(j.id, { featured: !j.featured })}>{j.featured ? '★ Unfeature' : '☆ Feature'}</button>
                  </td>
                </tr>
              )) : <tr><td colSpan={8} className="muted small" style={{ padding: '1.4rem' }}>No listings match.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {inspect && (
        <Modal title={inspect.title} onClose={() => setInspect(null)} large>
          <dl className="kv">
            <dt>Employer</dt><dd>{inspect.employerName || inspect.company}</dd>
            <dt>Company</dt><dd>{inspect.company}</dd>
            <dt>Category</dt><dd>{inspect.category?.name || '—'}</dd>
            <dt>Area</dt><dd>{inspect.location?.name || '—'}</dd>
            <dt>Type</dt><dd>{inspect.jobTypeLabel} · {inspect.workModeLabel}</dd>
            <dt>Salary</dt><dd>{inspect.salaryLabel}</dd>
            <dt>Vacancies</dt><dd>{inspect.vacancies}</dd>
            <dt>Deadline</dt><dd>{inspect.deadline ? dateLabel(inspect.deadline) : 'Rolling'}</dd>
            <dt>Contact</dt><dd>{inspect.contactEmail || '—'} · {inspect.contactPhone || '—'}</dd>
            <dt>Status</dt><dd><Badge status={inspect.status} label={inspect.statusLabel} /></dd>
            <dt>Posted</dt><dd>{dateTimeLabel(inspect.createdAt)}</dd>
          </dl>
          <div className="divider" />
          <h4>Description</h4>
          <p className="small" style={{ whiteSpace: 'pre-line' }}>{inspect.description}</p>
          {inspect.requirements && inspect.requirements.length > 0 && (
            <>
              <h4>Requirements</h4>
              <ul className="list-check">{inspect.requirements.map((r, i) => <li key={i}>{r}</li>)}</ul>
            </>
          )}
          <div className="divider" />
          <div className="btn-group">
            <Link className="btn btn-sm btn-ghost" href={`/jobs/${inspect.id}`} target="_blank" rel="noopener">Open public page</Link>
            <button className="btn btn-sm" onClick={() => setInspect(null)}>Close</button>
          </div>
        </Modal>
      )}

      {reject && (
        <Modal title="Reject job listing" onClose={() => setReject(null)}>
          <p className="small muted">Give the employer a reason. It appears on their listing.</p>
          <label className="field"><span className="lbl">Reason</span>
            <textarea rows={3} value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} />
          </label>
          <div className="form-actions">
            <button className="btn btn-danger" onClick={doReject}>Reject listing</button>
            <button className="btn btn-ghost" onClick={() => setReject(null)}>Cancel</button>
          </div>
        </Modal>
      )}
    </>
  );
}
