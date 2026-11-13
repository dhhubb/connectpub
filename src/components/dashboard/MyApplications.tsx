'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/client/api';
import { useUi } from '@/lib/client/ui';
import { dateLabel, money, timeAgo } from '@/lib/client/format';
import type { Application } from '@/lib/client/types';
import Badge from '@/components/Badge';
import Modal from '@/components/Modal';
import Spinner from '@/components/Spinner';

const WITHDRAWABLE = ['submitted', 'reviewing', 'shortlisted', 'interview'];

export default function MyApplications({ go }: { go: (v: any) => void }) {
  const { toast, confirm } = useUi();
  const [applications, setApplications] = useState<Application[] | null>(null);
  const [detail, setDetail] = useState<Application | null>(null);

  const load = useCallback(() => {
    api<{ applications: Application[] }>('/dashboard/applications').then((d) => setApplications(d.applications)).catch((e) => { toast((e as Error).message, 'err'); setApplications([]); });
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const withdraw = async (id: number) => {
    if (!(await confirm('Withdraw this application? The employer will see it as withdrawn.', { confirmLabel: 'Withdraw', danger: true }))) return;
    try {
      await api(`/dashboard/applications/${id}`, { method: 'PATCH', body: { status: 'withdrawn' } });
      toast('Application withdrawn');
      load();
    } catch (err) { toast((err as Error).message, 'err'); }
  };

  if (!applications) return <Spinner />;

  return (
    <>
      <div className="page-head">
        <div><h2>My applications</h2><p className="sub">{applications.length} application{applications.length === 1 ? '' : 's'} submitted</p></div>
        <Link className="btn btn-outline" href="/jobs">Find more jobs</Link>
      </div>

      {applications.length ? (
        <div className="panel">
          <div className="table-wrap">
            <table className="data">
              <thead><tr><th>Job</th><th>Company</th><th>Area</th><th>Expected</th><th>Status</th><th>Applied</th><th></th></tr></thead>
              <tbody>
                {applications.map((a) => (
                  <tr key={a.id}>
                    <td>
                      <Link href={`/jobs/${a.jobId}`}><b>{a.jobTitle}</b></Link>
                      {a.categoryName && <div className="tiny muted">{a.categoryIcon} {a.categoryName}</div>}
                    </td>
                    <td>{a.company || '—'}</td>
                    <td className="small muted">{a.locationName || '—'}</td>
                    <td className="small">{a.expectedSalary ? money(a.expectedSalary, 'USD') : '—'}</td>
                    <td>
                      <Badge status={a.status} label={a.statusLabel || a.status} />
                      {a.employerNote && <div className="tiny muted" title={a.employerNote}>Note: {a.employerNote.slice(0, 40)}{a.employerNote.length > 40 ? '…' : ''}</div>}
                    </td>
                    <td className="small muted nowrap">{timeAgo(a.createdAt)}</td>
                    <td className="actions">
                      <button className="btn btn-xs btn-ghost" onClick={() => setDetail(a)}>View</button>
                      {WITHDRAWABLE.includes(a.status) && <button className="btn btn-xs btn-ghost" onClick={() => withdraw(a.id)}>Withdraw</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="empty"><span className="icon">📨</span><b>No applications yet</b><p>Browse the job board and apply to roles that fit you.</p><Link className="btn" href="/jobs">Browse jobs</Link></div>
      )}

      {detail && (
        <Modal title={detail.jobTitle || 'Application'} onClose={() => setDetail(null)}>
          <dl className="kv">
            <dt>Company</dt><dd>{detail.company || '—'}</dd>
            <dt>Status</dt><dd><Badge status={detail.status} label={detail.statusLabel || detail.status} /></dd>
            <dt>Applied</dt><dd>{dateLabel(detail.createdAt)}</dd>
            <dt>Expected salary</dt><dd>{detail.expectedSalary ? money(detail.expectedSalary, 'USD') : '—'}</dd>
            <dt>CV link</dt><dd>{detail.cvUrl ? <a href={detail.cvUrl} target="_blank" rel="noopener">Open</a> : '—'}</dd>
          </dl>
          <div className="divider" />
          <h4>Cover letter</h4>
          <p className="small" style={{ whiteSpace: 'pre-line' }}>{detail.coverLetter || 'No cover letter provided.'}</p>
          {detail.employerNote && <div className="alert alert-info" style={{ marginTop: '1rem' }}><b>Employer note:</b> {detail.employerNote}</div>}
        </Modal>
      )}
    </>
  );
}
