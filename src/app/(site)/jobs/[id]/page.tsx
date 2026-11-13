'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/client/api';
import { useSession } from '@/lib/client/session';
import { useUi } from '@/lib/client/ui';
import { dateLabel, daysLeft, initials } from '@/lib/client/format';
import type { Job } from '@/lib/client/types';
import Badge from '@/components/Badge';
import Modal from '@/components/Modal';
import Spinner from '@/components/Spinner';

export default function JobDetailPage() {
  const params = useParams();
  const id = Number(params.id);
  const { user, ready } = useSession();
  const { toast } = useUi();

  const [job, setJob] = useState<Job | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'missing'>('loading');
  const [applyOpen, setApplyOpen] = useState(false);
  const [coverLetter, setCoverLetter] = useState('');
  const [expectedSalary, setExpectedSalary] = useState('');
  const [cvUrl, setCvUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    if (!id) { setState('missing'); return; }
    try {
      const data = await api<{ job: Job }>('/jobs/' + id);
      setJob(data.job);
      setState('ready');
    } catch {
      setState('missing');
    }
  }, [id]);

  // Re-fetch once the session resolves so saved/application state is accurate.
  useEffect(() => { if (ready) load(); }, [ready, load]);

  const toggleSave = async () => {
    if (!user) { window.location.href = '/login?next=' + encodeURIComponent(window.location.pathname); return; }
    try {
      const res = await api<{ saved: boolean }>(`/jobs/${id}/save`, { method: 'POST' });
      setJob((j) => (j ? { ...j, saved: res.saved } : j));
      toast(res.saved ? 'Job saved' : 'Removed from saved jobs');
    } catch (e) { toast((e as Error).message, 'err'); }
  };

  const openApply = () => {
    if (!user) { window.location.href = '/login?next=' + encodeURIComponent(window.location.pathname); return; }
    setCoverLetter(`I am interested in the ${job?.title} role at ${job?.company}. `);
    setErrors({});
    setApplyOpen(true);
  };

  const submitApply = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrors({});
    try {
      await api(`/jobs/${id}/apply`, { method: 'POST', body: { coverLetter, expectedSalary, cvUrl } });
      setApplyOpen(false);
      toast('Application submitted — track it in your dashboard');
      load();
    } catch (err) {
      if (err instanceof ApiError && err.data?.errors) setErrors(err.data.errors);
      else toast((err as Error).message, 'err');
    } finally {
      setSubmitting(false);
    }
  };

  if (state === 'loading') {
    return <main className="container" style={{ padding: '1.8rem 1.15rem 2.6rem' }}><Spinner /></main>;
  }
  if (state === 'missing' || !job) {
    return (
      <main className="container" style={{ padding: '1.8rem 1.15rem 2.6rem' }}>
        <div className="empty"><span className="icon">🔍</span><b>Job not found</b><p>This listing may have been removed or is awaiting review.</p><Link className="btn" href="/jobs">Back to jobs</Link></div>
      </main>
    );
  }

  const left = daysLeft(job.deadline);
  const closed = job.status !== 'approved' || (left !== null && left < 0);
  const isOwner = user && user.id === job.employerId;
  const isAdmin = user && user.role === 'admin';

  let applyBlock;
  if (isOwner) {
    applyBlock = <div className="alert alert-info">You posted this vacancy. <Link href="/dashboard">Manage it in your dashboard</Link>.</div>;
  } else if (isAdmin) {
    applyBlock = <div className="alert alert-info">Administrator view. <Link href="/admin">Moderate in the admin panel</Link>.</div>;
  } else if (closed) {
    applyBlock = <div className="alert alert-warn"><b>Applications are closed.</b> This vacancy is no longer accepting applications.</div>;
  } else if (job.myApplication) {
    applyBlock = (
      <div className="alert alert-ok">
        <b>You applied on {dateLabel(job.myApplication.createdAt)}.</b> Status: <Badge status={job.myApplication.status} label={job.myApplication.statusLabel || job.myApplication.status} />.
        <Link href="/dashboard"> Track it in your dashboard</Link>.
      </div>
    );
  } else {
    applyBlock = (
      <>
        <button className="btn btn-block" onClick={openApply}>Apply for this job</button>
        <p className="tiny muted center" style={{ marginTop: '.5rem' }}>{user ? 'One click — we use your profile details.' : 'You will be asked to sign in first.'}</p>
      </>
    );
  }

  return (
    <main className="container" style={{ padding: '1.8rem 1.15rem 2.6rem' }}>
      <nav className="small muted" style={{ marginBottom: '.9rem' }}>
        <Link href="/">Home</Link> › <Link href="/jobs">Jobs</Link> › {job.title}
      </nav>
      <div className="grid-side">
        <div className="stack">
          <div className="card card-pad-lg">
            <div className="row" style={{ alignItems: 'flex-start' }}>
              <div className="thumb" style={{ width: 56, height: 56, fontSize: '1.6rem' }}>{job.category?.icon || '💼'}</div>
              <div className="grow">
                <h1 style={{ fontSize: '1.6rem', marginBottom: '.2rem' }}>{job.title}</h1>
                <p className="muted mb0"><b style={{ color: 'var(--ink-700)' }}>{job.company}</b>{job.location ? ` · 📍 ${job.location.name}` : ''}</p>
              </div>
              {job.featured && <span className="badge badge-clay">Featured</span>}
            </div>
            <div className="chips" style={{ marginTop: '.9rem' }}>
              <span className="tag">{job.jobTypeLabel}</span>
              <span className="tag">{job.workModeLabel}</span>
              <span className="tag">{job.vacancies} post{job.vacancies === 1 ? '' : 's'}</span>
              {job.category && <span className="tag">{job.category.name}</span>}
              <Badge status={job.status} label={job.statusLabel} />
            </div>
            {job.rejectionReason && <div className="alert alert-error" style={{ marginTop: '1rem' }}>Moderator note: {job.rejectionReason}</div>}
          </div>

          <div className="card">
            <h3>About the role</h3>
            <div className="prose"><p style={{ whiteSpace: 'pre-line' }}>{job.description}</p></div>
            {job.requirements && job.requirements.length > 0 && (
              <>
                <h3 style={{ marginTop: '1.2rem' }}>Requirements</h3>
                <ul className="list-check">{job.requirements.map((r, i) => <li key={i}>{r}</li>)}</ul>
              </>
            )}
          </div>

          <div className="card">
            <h3>How to apply</h3>
            {applyBlock}
            {(job.contactEmail || job.contactPhone) && (
              <>
                <div className="divider" />
                <p className="small muted">You can also contact the employer directly:</p>
                <div className="row row-wrap small">
                  {job.contactEmail && <span className="badge badge-blue">✉ {job.contactEmail}</span>}
                  {job.contactPhone && <span className="badge badge-blue">☎ {job.contactPhone}</span>}
                </div>
              </>
            )}
          </div>
        </div>

        <aside className="stack sticky-side">
          <div className="card">
            <h3>Summary</h3>
            <dl className="kv">
              <dt>Salary</dt><dd><b style={{ color: 'var(--green-800)' }}>{job.salaryLabel}</b></dd>
              <dt>Job type</dt><dd>{job.jobTypeLabel}</dd>
              <dt>Work mode</dt><dd>{job.workModeLabel}</dd>
              <dt>Location</dt><dd>{job.location ? <>{job.location.name} <span className="tiny muted">({job.location.kind})</span></> : 'Not specified'}</dd>
              <dt>Vacancies</dt><dd>{job.vacancies}</dd>
              <dt>Deadline</dt><dd>{job.deadline ? <>{dateLabel(job.deadline)}{left !== null && left >= 0 ? <> <span className="badge badge-amber">{left}d left</span></> : null}</> : 'Rolling'}</dd>
              <dt>Posted</dt><dd>{dateLabel(job.createdAt)}</dd>
              <dt>Applicants</dt><dd>{job.applicationCount}</dd>
              <dt>Views</dt><dd>{job.views}</dd>
            </dl>
          </div>
          <div className="card">
            <h3>Employer</h3>
            <div className="row">
              <div className="avatar">{initials(job.employerName || job.company)}</div>
              <div className="grow"><b>{job.company}</b><div className="tiny muted">{job.employerName || ''}</div></div>
            </div>
            <div className="divider" />
            <button className="btn btn-ghost btn-block btn-sm" onClick={toggleSave}>{job.saved ? '★ Saved' : '☆ Save this job'}</button>
            <button className="btn btn-ghost btn-block btn-sm" style={{ marginTop: '.4rem' }}
              onClick={() => { navigator.clipboard?.writeText(window.location.href).then(() => toast('Link copied to clipboard')).catch(() => toast('Copy failed', 'err')); }}>
              🔗 Copy link
            </button>
          </div>
        </aside>
      </div>

      {applyOpen && (
        <Modal title={`Apply: ${job.title}`} onClose={() => setApplyOpen(false)}>
          <div className="alert alert-info">
            Applying as <b>{user?.name}</b> ({user?.email}){user?.phone ? ' · ' + user.phone : ''}
          </div>
          <form onSubmit={submitApply}>
            <label className="field">
              <span className="lbl">Cover letter <span className="req">*</span></span>
              <textarea rows={6} placeholder="Tell the employer why you are a good fit for this role…" value={coverLetter} onChange={(e) => setCoverLetter(e.target.value)} />
              {errors.coverLetter && <span className="field-error">{errors.coverLetter}</span>}
            </label>
            <div className="grid-2">
              <label className="field">
                <span className="lbl">Expected salary (USD)</span>
                <input type="number" min={0} step={10} placeholder="e.g. 350" value={expectedSalary} onChange={(e) => setExpectedSalary(e.target.value)} />
              </label>
              <label className="field">
                <span className="lbl">CV link (optional)</span>
                <input type="text" placeholder="https://…" value={cvUrl} onChange={(e) => setCvUrl(e.target.value)} />
              </label>
            </div>
            <div className="form-actions">
              <button className="btn" type="submit" disabled={submitting}>{submitting ? 'Submitting…' : 'Submit application'}</button>
              <button className="btn btn-ghost" type="button" onClick={() => setApplyOpen(false)}>Cancel</button>
            </div>
          </form>
        </Modal>
      )}
    </main>
  );
}
