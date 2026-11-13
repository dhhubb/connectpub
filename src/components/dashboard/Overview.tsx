'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/client/api';
import { useSession, type SessionUser } from '@/lib/client/session';
import { roleLabel, timeAgo } from '@/lib/client/format';
import type { Application, ServiceRequest } from '@/lib/client/types';
import type { DashboardMeta } from './meta';
import { JobFormModal, ListingFormModal } from './ListingForms';
import Badge from '@/components/Badge';
import Spinner from '@/components/Spinner';
import { useUi } from '@/lib/client/ui';

const CARD_LABELS: Record<string, string> = {
  applications: 'Applications', shortlisted: 'In progress', savedJobs: 'Saved jobs', savedProviders: 'Saved providers',
  jobs: 'Job listings', published: 'Published', pendingReview: 'Awaiting review', hired: 'Hired', jobViews: 'Listing views',
  listings: 'Service listings', requests: 'Service requests', newRequests: 'New requests', completed: 'Completed jobs',
  listingViews: 'Listing views', averageRating: 'Average rating', users: 'Users',
};

const PRIORITY = ['applications', 'published', 'shortlisted', 'newRequests', 'hired', 'completed', 'savedJobs', 'savedProviders', 'jobs', 'listings', 'requests', 'pendingReview', 'averageRating', 'jobViews', 'listingViews'];

interface OverviewData {
  role: string;
  cards: Record<string, number | null>;
  recentApplications: Application[];
  recentRequests: ServiceRequest[];
}

export default function Overview({ user, meta, go }: { user: SessionUser; meta: DashboardMeta; go: (v: any) => void }) {
  const { toast } = useUi();
  const { refresh } = useSession();
  const [data, setData] = useState<OverviewData | null>(null);
  const [jobForm, setJobForm] = useState(false);
  const [listingForm, setListingForm] = useState(false);

  const load = useCallback(() => {
    api<OverviewData>('/dashboard/overview').then(setData).catch((e) => toast((e as Error).message, 'err'));
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  if (!data) return <Spinner />;

  const isEmployer = user.role === 'employer';
  const isProvider = user.role === 'provider';
  const keys = Object.keys(data.cards);
  const ordered = [...new Set([...PRIORITY.filter((k) => keys.includes(k)), ...keys])];

  return (
    <>
      <div className="page-head">
        <div>
          <h2>Welcome back, {user.name.split(' ')[0]}</h2>
          <p className="sub">{roleLabel(user.role)} dashboard · {user.email}</p>
        </div>
        <div className="btn-group">
          {isEmployer && <button className="btn" onClick={() => setJobForm(true)}>+ Post a job</button>}
          {isProvider && <button className="btn" onClick={() => setListingForm(true)}>+ Add a service listing</button>}
          {user.role === 'seeker' && <Link className="btn" href="/jobs">Browse jobs</Link>}
        </div>
      </div>

      <div className="stat-grid">
        {ordered.map((k, i) => (
          <div key={k} className={'stat-card' + (i === 0 ? ' accent' : i === 1 ? ' clay' : '')}>
            <div className="k">{CARD_LABELS[k] || k}</div>
            <div className="v">{k === 'averageRating' ? (data.cards[k] ?? '—') : Number(data.cards[k]).toLocaleString('en-US')}</div>
          </div>
        ))}
      </div>

      {data.recentApplications.length > 0 && (
        <div className="panel" style={{ marginTop: '1.4rem' }}>
          <div className="panel-head">
            <b>Recent applications</b>
            <button className="btn btn-xs btn-ghost" onClick={() => go(isEmployer ? 'applicants' : 'applications')}>View all</button>
          </div>
          <div className="table-wrap">
            <table className="data">
              <thead><tr><th>{isEmployer ? 'Applicant' : 'Job'}</th><th>{isEmployer ? 'Job' : 'Company'}</th><th>Status</th><th>Applied</th></tr></thead>
              <tbody>
                {data.recentApplications.map((a) => (
                  <tr key={a.id}>
                    <td>{isEmployer ? (a.applicantName || '—') : (a.jobTitle || '—')}</td>
                    <td>{isEmployer ? (a.jobTitle || '—') : (a.company || '—')}</td>
                    <td><Badge status={a.status} label={a.statusLabel || a.status} /></td>
                    <td className="small muted">{timeAgo(a.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {data.recentRequests.length > 0 && (
        <div className="panel" style={{ marginTop: '1.2rem' }}>
          <div className="panel-head">
            <b>Recent service requests</b>
            <button className="btn btn-xs btn-ghost" onClick={() => go('requests')}>View all</button>
          </div>
          <div className="table-wrap">
            <table className="data">
              <thead><tr><th>Service</th><th>{isProvider ? 'Customer' : 'Provider'}</th><th>Status</th><th>Received</th></tr></thead>
              <tbody>
                {data.recentRequests.map((r) => (
                  <tr key={r.id}>
                    <td>{r.serviceNeeded}</td>
                    <td>{isProvider ? r.name : (r.businessName || '—')}</td>
                    <td><Badge status={r.status} label={r.statusLabel} /></td>
                    <td className="small muted">{timeAgo(r.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {data.recentApplications.length === 0 && data.recentRequests.length === 0 && (
        <div className="card" style={{ marginTop: '1.4rem' }}>
          <h3>Getting started</h3>
          <ul className="list-check">
            {user.role === 'seeker' && <><li>Complete your profile so employers know your skills.</li><li><Link href="/jobs">Browse jobs</Link> and apply — applications appear here.</li><li>Save jobs you like and come back to them.</li></>}
            {isEmployer && <><li>Post your first vacancy — an administrator reviews it before it goes live.</li><li>Applicants land in the Applicants tab.</li><li>Move candidates through shortlist, interview and hired.</li></>}
            {isProvider && <><li>Publish a service listing with your prices and services.</li><li>Requests from customers appear in Service requests.</li><li>Encourage happy customers to leave a review.</li></>}
          </ul>
        </div>
      )}

      {jobForm && (
        <JobFormModal job={null} meta={meta} user={user} onClose={() => setJobForm(false)}
          onSaved={(msg) => { setJobForm(false); toast(msg); load(); refresh(); }} />
      )}
      {listingForm && (
        <ListingFormModal provider={null} meta={meta} user={user} onClose={() => setListingForm(false)}
          onSaved={(msg) => { setListingForm(false); toast(msg); load(); refresh(); }} />
      )}
    </>
  );
}
