'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/client/api';
import { useUi } from '@/lib/client/ui';
import { dateTimeLabel, roleLabel, timeAgo } from '@/lib/client/format';
import type { AdminStats } from '@/lib/client/types';
import { BarList, ChartBox, Donut } from './charts';
import Spinner from '@/components/Spinner';

export default function AdminOverview({ go }: { go: (v: any) => void }) {
  const { toast } = useUi();
  const [s, setS] = useState<AdminStats | null>(null);

  const load = useCallback(() => {
    api<AdminStats>('/admin/stats').then(setS).catch((e) => toast((e as Error).message, 'err'));
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  if (!s) return <Spinner />;

  const c = s.counts;
  const pending = c.pendingJobs + c.pendingProviders;
  const signupMax = Math.max(1, ...s.signups.map((d) => d.users + d.jobs + d.providers + d.applications));

  const card = (label: string, value: number, sub?: string, cls = '') => (
    <div className={'stat-card ' + cls}>
      <div className="k">{label}</div>
      <div className="v">{Number(value).toLocaleString('en-US')}</div>
      {sub && <div className="s">{sub}</div>}
    </div>
  );

  return (
    <>
      <div className="page-head">
        <div><h2>Administrator dashboard</h2><p className="sub">Platform health for Plumtree Connect · {dateTimeLabel(new Date().toISOString())}</p></div>
        <div className="btn-group">
          {pending
            ? <button className="btn btn-clay" onClick={() => go(c.pendingJobs >= c.pendingProviders ? 'jobs' : 'providers')}>⚑ {pending} awaiting review</button>
            : <span className="badge badge-green">All queues clear</span>}
          <button className="btn btn-ghost" onClick={() => { toast('Refreshed'); load(); }}>↻ Refresh</button>
        </div>
      </div>

      <div className="stat-grid">
        {card('Total users', c.users, `${c.seekers} seekers · ${c.employers} employers · ${c.providers} providers`, 'accent')}
        {card('Pending review', pending, `${c.pendingJobs} jobs · ${c.pendingProviders} providers`, pending ? 'clay' : '')}
        {card('Live jobs', c.approvedJobs, `${c.jobs} total listings`)}
        {card('Live providers', c.approvedProviders, `${c.verifiedProviders} verified`)}
        {card('Applications', c.applications, 'across all jobs')}
        {card('Service requests', c.serviceRequests, `${c.openRequests} open`)}
        {card('Job views', c.jobViews, 'all listings')}
        {card('Provider views', c.providerViews, 'all listings')}
        {card('Reviews', c.reviews, `${c.hiddenReviews} hidden`)}
        {card('Categories', c.categories, `${c.locations} locations`)}
      </div>

      <div className="chart-grid" style={{ marginTop: '1.4rem' }}>
        <ChartBox title="New activity — last 14 days">
          <div className="col-chart">
            {s.signups.map((d) => {
              const total = d.users + d.jobs + d.providers + d.applications;
              const h = (total / signupMax) * 120;
              const seg = (v: number) => (total ? (v / total) * h : 0);
              return (
                <div className="col" key={d.day} title={`${d.day}: ${d.users} users, ${d.jobs} jobs, ${d.providers} providers, ${d.applications} applications`}>
                  <div className="stack" style={{ height: `${Math.max(h, total ? 3 : 1)}px` }}>
                    <span className="seg users" style={{ height: `${seg(d.users)}px` }} />
                    <span className="seg jobs" style={{ height: `${seg(d.jobs)}px` }} />
                    <span className="seg providers" style={{ height: `${seg(d.providers)}px` }} />
                    <span className="seg apps" style={{ height: `${seg(d.applications)}px` }} />
                  </div>
                  <span className="cl">{d.day.slice(5)}</span>
                </div>
              );
            })}
          </div>
          <div className="legend">
            <span><i style={{ background: '#2d8a4e' }} />Users</span>
            <span><i style={{ background: '#d9822b' }} />Jobs</span>
            <span><i style={{ background: '#1d5a86' }} />Providers</span>
            <span><i style={{ background: '#9aab9f' }} />Applications</span>
          </div>
        </ChartBox>

        <ChartBox title="Users by role"><Donut rows={s.usersByRole.map((r) => ({ label: roleLabel(r.label), count: r.count }))} /></ChartBox>
        <ChartBox title="Job listings by status"><Donut rows={s.jobsByStatus} /></ChartBox>
        <ChartBox title="Service listings by status"><Donut rows={s.providersByStatus} /></ChartBox>
        <ChartBox title="Applications by status"><BarList rows={s.applicationsByStatus} clay /></ChartBox>
        <ChartBox title="Service requests by status"><BarList rows={s.requestsByStatus} clay /></ChartBox>
        <ChartBox title="Jobs by category"><BarList rows={s.jobsByCategory} iconKey="icon" /></ChartBox>
        <ChartBox title="Providers by category"><BarList rows={s.providersByCategory} iconKey="icon" clay /></ChartBox>
      </div>

      <div className="chart-grid" style={{ marginTop: '1rem' }}>
        <ChartBox title="Busiest locations">
          <div className="table-wrap"><table className="data">
            <thead><tr><th>Location</th><th>Jobs</th><th>Providers</th><th>Total</th></tr></thead>
            <tbody>{s.activityByLocation.map((l, i) => <tr key={i}><td>{l.label}</td><td>{l.jobs}</td><td>{l.providers}</td><td><b>{l.jobs + l.providers}</b></td></tr>)}</tbody>
          </table></div>
        </ChartBox>
        <ChartBox title="Most viewed jobs">
          <div className="table-wrap"><table className="data">
            <thead><tr><th>Job</th><th>Views</th><th>Applicants</th></tr></thead>
            <tbody>{s.topJobs.map((j) => <tr key={j.id}><td><Link href={`/jobs/${j.id}`}>{j.title}</Link><div className="tiny muted">{j.company}</div></td><td>{j.views}</td><td>{j.applications}</td></tr>)}</tbody>
          </table></div>
        </ChartBox>
        <ChartBox title="Most viewed providers">
          <div className="table-wrap"><table className="data">
            <thead><tr><th>Business</th><th>Views</th><th>Requests</th><th>Rating</th></tr></thead>
            <tbody>{s.topProviders.map((p) => <tr key={p.id}><td><Link href={`/providers/${p.id}`}>{p.business_name}</Link></td><td>{p.views}</td><td>{p.requests}</td><td>{p.rating ?? '—'}</td></tr>)}</tbody>
          </table></div>
        </ChartBox>
        <ChartBox title="Recent admin activity">
          <div className="table-wrap"><table className="data">
            <thead><tr><th>Action</th><th>Entity</th><th>By</th><th>When</th></tr></thead>
            <tbody>{s.recentAudit.length
              ? s.recentAudit.map((a) => <tr key={a.id}><td><b className="small">{a.action}</b></td><td className="small muted">{a.entity}{a.entityId ? ` #${a.entityId}` : ''}</td><td className="small">{a.actorName || 'system'}</td><td className="small muted nowrap">{timeAgo(a.createdAt)}</td></tr>)
              : <tr><td colSpan={4} className="muted small">No activity logged yet.</td></tr>}</tbody>
          </table></div>
        </ChartBox>
      </div>
    </>
  );
}
