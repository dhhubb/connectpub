'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/client/api';
import { useUi } from '@/lib/client/ui';
import { dateLabel, initials, money, timeAgo } from '@/lib/client/format';
import type { Application, Job } from '@/lib/client/types';
import Badge from '@/components/Badge';
import Modal from '@/components/Modal';
import Spinner from '@/components/Spinner';

const STATUS_FLOW: [string, string][] = [['submitted', 'Submitted'], ['reviewing', 'Reviewing'], ['shortlisted', 'Shortlisted'], ['interview', 'Interview'], ['hired', 'Hired'], ['rejected', 'Rejected']];

export default function Applicants() {
  const { toast } = useUi();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [applications, setApplications] = useState<Application[] | null>(null);
  const [jobFilter, setJobFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [review, setReview] = useState<Application | null>(null);

  const load = useCallback(() => {
    Promise.all([
      api<{ jobs: Job[] }>('/jobs/mine'),
      api<{ applications: Application[] }>('/dashboard/job-applications'),
    ]).then(([j, a]) => { setJobs(j.jobs); setApplications(a.applications); })
      .catch((e) => { toast((e as Error).message, 'err'); setApplications([]); });
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const current = useMemo(() => {
    if (!applications) return [];
    return applications.filter((a) => (!jobFilter || a.jobId === Number(jobFilter)) && (!statusFilter || a.status === statusFilter));
  }, [applications, jobFilter, statusFilter]);

  if (!applications) return <Spinner />;

  return (
    <>
      <div className="page-head">
        <div><h2>Applicants</h2><p className="sub">{applications.length} application{applications.length === 1 ? '' : 's'} across your listings</p></div>
      </div>

      <div className="panel" style={{ marginBottom: '1rem' }}>
        <div className="panel-body row row-wrap">
          <select style={{ maxWidth: 320 }} value={jobFilter} onChange={(e) => setJobFilter(e.target.value)}>
            <option value="">All job listings</option>
            {jobs.map((j) => <option key={j.id} value={j.id}>{j.title} ({j.applicationCount})</option>)}
          </select>
          <select style={{ maxWidth: 200 }} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All statuses</option>
            {STATUS_FLOW.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <span className="small muted grow">{current.length} shown</span>
        </div>
      </div>

      {current.length ? (
        <div className="panel">
          <div className="table-wrap">
            <table className="data">
              <thead><tr><th>Applicant</th><th>Job</th><th>Expected</th><th>Status</th><th>Applied</th><th></th></tr></thead>
              <tbody>
                {current.map((a) => (
                  <tr key={a.id}>
                    <td>
                      <div className="row">
                        <div className="avatar" style={{ width: 30, height: 30, fontSize: '.75rem' }}>{initials(a.applicantName || '')}</div>
                        <div><b className="small">{a.applicantName}</b><div className="tiny muted">{a.applicantEmail || ''}</div></div>
                      </div>
                    </td>
                    <td className="small">{a.jobTitle}</td>
                    <td className="small">{a.expectedSalary ? money(a.expectedSalary, 'USD') : '—'}</td>
                    <td><Badge status={a.status} label={a.statusLabel || a.status} /></td>
                    <td className="small muted nowrap">{timeAgo(a.createdAt)}</td>
                    <td className="actions"><button className="btn btn-xs" onClick={() => setReview(a)}>Review</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="empty"><span className="icon">📭</span><b>No applications match</b><p>Try a different filter.</p></div>
      )}

      {review && (
        <ReviewApplicantModal application={review} onClose={() => setReview(null)}
          onSaved={() => { setReview(null); toast('Application updated'); load(); }} />
      )}
    </>
  );
}

function ReviewApplicantModal({ application: a, onClose, onSaved }: { application: Application; onClose: () => void; onSaved: () => void }) {
  const { toast } = useUi();
  const [status, setStatus] = useState(a.status);
  const [employerNote, setEmployerNote] = useState(a.employerNote || '');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api(`/dashboard/applications/${a.id}`, { method: 'PATCH', body: { status, employerNote } });
      onSaved();
    } catch (err) {
      toast((err as Error).message, 'err');
      setBusy(false);
    }
  };

  return (
    <Modal title={`Application: ${a.applicantName}`} onClose={onClose} large>
      <div className="grid-2" style={{ gap: '0 1.4rem' }}>
        <div>
          <div className="row">
            <div className="avatar">{initials(a.applicantName || '')}</div>
            <div><b>{a.applicantName}</b><div className="tiny muted">{a.applicantEmail || ''}</div></div>
          </div>
          <dl className="kv" style={{ marginTop: '.9rem' }}>
            <dt>Phone</dt><dd>{a.applicantPhone || '—'}</dd>
            <dt>Area</dt><dd>{a.applicantWard || '—'}</dd>
            <dt>Applied for</dt><dd>{a.jobTitle}</dd>
            <dt>Expected salary</dt><dd>{a.expectedSalary ? money(a.expectedSalary, 'USD') : '—'}</dd>
            <dt>Applied</dt><dd>{dateLabel(a.createdAt)}</dd>
            <dt>CV link</dt><dd>{a.cvUrl ? <a href={a.cvUrl} target="_blank" rel="noopener">Open CV</a> : '—'}</dd>
          </dl>
          {a.applicantBio && <><div className="divider" /><h4>Profile</h4><p className="small">{a.applicantBio}</p></>}
          <div className="divider" />
          <h4>Cover letter</h4>
          <p className="small" style={{ whiteSpace: 'pre-line' }}>{a.coverLetter || 'No cover letter provided.'}</p>
        </div>
        <div>
          <form onSubmit={submit}>
            <label className="field"><span className="lbl">Application status</span>
              <select value={status} onChange={(e) => setStatus(e.target.value)}>
                {STATUS_FLOW.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </label>
            <label className="field"><span className="lbl">Internal note (not shown to applicant)</span>
              <textarea rows={5} placeholder="Interview notes, reference checks…" value={employerNote} onChange={(e) => setEmployerNote(e.target.value)} />
            </label>
            <button className="btn btn-block" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Update application'}</button>
          </form>
          <div className="divider" />
          <div className="btn-group">
            <a className="btn btn-sm btn-ghost" href={`mailto:${a.applicantEmail || ''}`}>✉ Email</a>
            {a.applicantPhone && <a className="btn btn-sm btn-ghost" href={`tel:${a.applicantPhone}`}>☎ Call</a>}
            <Link className="btn btn-sm btn-ghost" href={`/jobs/${a.jobId}`}>View job</Link>
          </div>
        </div>
      </div>
    </Modal>
  );
}
