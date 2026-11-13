'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api, toQuery } from '@/lib/client/api';
import type { Category, Job, Provider } from '@/lib/client/types';
import JobCard from '@/components/JobCard';
import ProviderCard from '@/components/ProviderCard';
import Spinner from '@/components/Spinner';
import CategoryCard from '@/components/CategoryCard';

interface Stats {
  totals: {
    approvedJobs: number;
    openVacancies: number;
    approvedProviders: number;
    registeredUsers: number;
  };
  byLocation: { name: string; jobs: number; providers: number }[];
}

export default function HomePage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [jobs, setJobs] = useState<Job[] | null>(null);
  const [providers, setProviders] = useState<Provider[] | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [kind, setKind] = useState<'job' | 'service'>('job');
  const [locations, setLocations] = useState<{ id: number; name: string }[]>([]);
  const [query, setQuery] = useState('');
  const [searchType, setSearchType] = useState<'jobs' | 'providers'>('jobs');
  const [locationId, setLocationId] = useState('');

  useEffect(() => {
    api<Stats>('/meta/stats').then(setStats).catch(() => setStats(null));
    api<{ jobs: Job[] }>('/jobs?' + toQuery({ per_page: 6, sort: 'recent' })).then((d) => setJobs(d.jobs)).catch(() => setJobs([]));
    api<{ providers: Provider[] }>('/providers?' + toQuery({ per_page: 6, sort: 'rating' })).then((d) => setProviders(d.providers)).catch(() => setProviders([]));
    api<{ locations: { id: number; name: string }[] }>('/meta/locations').then((d) => setLocations(d.locations)).catch(() => setLocations([]));
  }, []);

  useEffect(() => {
    api<{ categories: Category[] }>('/meta/categories?' + toQuery({ kind })).then((d) => setCategories(d.categories.slice(0, 9))).catch(() => setCategories([]));
  }, [kind]);

  const search = (e: React.FormEvent) => {
    e.preventDefault();
    const path = searchType === 'jobs' ? '/jobs' : '/providers';
    const params: Record<string, string> = {};
    if (query.trim()) params.q = query.trim();
    if (locationId) params.location = locationId;
    window.location.href = path + (Object.keys(params).length ? '?' + toQuery(params) : '');
  };

  const bars = stats?.byLocation?.slice(0, 6) ?? [];
  const maxBar = Math.max(1, ...bars.map((b) => b.jobs + b.providers));

  return (
    <>
      <section className="hero">
        <div className="container hero-inner">
          <p className="eyebrow">Plumtree · Matabeleland South</p>
          <h1>Work and services, all in one local board</h1>
          <p className="lede">
            Plumtree Connect links job seekers, employers and service providers across Plumtree town,
            Bulilima, Mangwe and the surrounding wards. Everything is moderated, so what you see is real.
          </p>

          <form className="hero-search" onSubmit={search}>
            <label className="field">
              <span className="lbl">What are you looking for?</span>
              <input type="search" placeholder="e.g. driver, borehole, receptionist" value={query} onChange={(e) => setQuery(e.target.value)} autoComplete="off" />
            </label>
            <label className="field">
              <span className="lbl">Looking for</span>
              <select value={searchType} onChange={(e) => setSearchType(e.target.value as 'jobs' | 'providers')}>
                <option value="jobs">Jobs</option>
                <option value="providers">Services</option>
              </select>
            </label>
            <label className="field">
              <span className="lbl">Area</span>
              <select value={locationId} onChange={(e) => setLocationId(e.target.value)}>
                <option value="">All areas</option>
                {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </label>
            <button className="btn" type="submit">Search</button>
          </form>

          <div className="hero-stats">
            {stats ? (
              <>
                <div className="stat"><b>{stats.totals.approvedJobs}</b><span>Open jobs</span></div>
                <div className="stat"><b>{stats.totals.approvedProviders}</b><span>Service providers</span></div>
                <div className="stat"><b>{stats.totals.openVacancies}</b><span>Vacancies</span></div>
                <div className="stat"><b>{stats.totals.registeredUsers}</b><span>Registered users</span></div>
              </>
            ) : (
              <>
                {['Open jobs', 'Service providers', 'Vacancies', 'Registered users'].map((label) => (
                  <div className="stat" key={label}><b className="skeleton" style={{ width: 70, height: 26, display: 'block' }}>&nbsp;</b><span>{label}</span></div>
                ))}
              </>
            )}
          </div>
        </div>
      </section>

      <section className="section container">
        <div className="spread section-head">
          <div>
            <p className="eyebrow">Latest openings</p>
            <h2>Featured jobs</h2>
            <p className="muted mb0">Fresh vacancies posted by employers around Plumtree and the district.</p>
          </div>
          <Link className="btn btn-outline" href="/jobs">View all jobs →</Link>
        </div>
        <div className="grid-cards">
          {jobs === null ? <Spinner /> : jobs.length
            ? jobs.map((j) => <JobCard key={j.id} job={j} />)
            : <div className="empty"><span className="icon">💼</span><b>No jobs yet</b><p>New vacancies appear here once approved.</p></div>}
        </div>
      </section>

      <section className="section-tight" style={{ background: 'var(--green-50)', borderTop: '1px solid var(--line)', borderBottom: '1px solid var(--line)' }}>
        <div className="container">
          <div className="spread section-head">
            <div>
              <p className="eyebrow">Local trades and skills</p>
              <h2>Top rated service providers</h2>
              <p className="muted mb0">Plumbers, builders, drillers, transporters and more — reviewed by neighbours.</p>
            </div>
            <Link className="btn btn-outline" href="/providers">Browse services →</Link>
          </div>
          <div className="grid-cards">
            {providers === null ? <Spinner /> : providers.length
              ? providers.map((p) => <ProviderCard key={p.id} provider={p} />)
              : <div className="empty"><span className="icon">🔧</span><b>No providers yet</b><p>Service listings appear here once approved.</p></div>}
          </div>
        </div>
      </section>

      <section className="section container">
        <div className="section-head center">
          <p className="eyebrow">Explore</p>
          <h2>Browse by category</h2>
          <p className="muted">Jobs and services grouped into the industries that keep Plumtree and Matabeleland South moving.</p>
        </div>
        <div className="tabs" style={{ justifyContent: 'center', border: 'none' }}>
          <button className={'tab' + (kind === 'job' ? ' active' : '')} onClick={() => setKind('job')}>Job categories</button>
          <button className={'tab' + (kind === 'service' ? ' active' : '')} onClick={() => setKind('service')}>Service categories</button>
        </div>
        <div className="grid-cards-3" style={{ marginTop: '1.2rem' }}>
          {categories.map((c) => <CategoryCard key={c.id} category={c} kind={kind} />)}
        </div>
        <div className="row" style={{ justifyContent: 'center', marginTop: '1.3rem' }}>
          <Link className="btn btn-outline" href="/categories">Browse all categories →</Link>
        </div>
      </section>

      <section className="section-tight" style={{ background: 'var(--surface-3)' }}>
        <div className="container">
          <div className="grid-3">
            <div className="feature-tile">
              <div className="ic">🧑‍🌾</div>
              <h3>For job seekers</h3>
              <p className="small muted">Build one profile, apply in a click and track every application from submitted to hired.</p>
              <Link href="/register" className="small">Create a free account →</Link>
            </div>
            <div className="feature-tile">
              <div className="ic">🏢</div>
              <h3>For employers</h3>
              <p className="small muted">Post a vacancy, review applicants in a dashboard and move candidates through your shortlist.</p>
              <Link href="/register" className="small">Post a vacancy →</Link>
            </div>
            <div className="feature-tile">
              <div className="ic">🔧</div>
              <h3>For service providers</h3>
              <p className="small muted">List your business, collect service requests and build a public rating from real customers.</p>
              <Link href="/register" className="small">List your business →</Link>
            </div>
          </div>
        </div>
      </section>

      <section className="section container">
        <div className="grid-side">
          <div>
            <p className="eyebrow">Where the work is</p>
            <h2>Activity across the district</h2>
            <p className="muted">Listings span Plumtree town and the rural wards that feed it — Bulilima, Mangwe, Tshitshi, Matjinge, Empandeni and more.</p>
            <div className="panel">
              <div className="panel-head"><b>Busiest locations</b><span className="small muted">Approved listings</span></div>
              <div className="panel-body">
                <div className="bars">
                  {bars.length ? bars.map((b) => (
                    <div className="bar-row" key={b.name}>
                      <span className="bl">{b.name}</span>
                      <span className="bar-track">
                        <span className="bar-fill" style={{ width: `${Math.round(((b.jobs + b.providers) / maxBar) * 100)}%` }} />
                      </span>
                      <span className="bv">{b.jobs} / {b.providers}</span>
                    </div>
                  )) : <Spinner />}
                </div>
              </div>
            </div>
          </div>
          <div className="card stack">
            <h3>How Plumtree Connect works</h3>
            <ul className="list-check">
              <li>Register as a job seeker, employer or service provider.</li>
              <li>Employers and providers post listings — an administrator reviews them.</li>
              <li>Approved listings appear publicly and are searchable.</li>
              <li>Applications and service requests land in the right dashboard.</li>
              <li>Customers rate providers, keeping quality visible.</li>
            </ul>
            <Link className="btn btn-block" href="/register">Get started — it is free</Link>
            <p className="tiny muted mb0 center">Demo administrator: admin@plumtreeconnect.co.zw / admin1234</p>
          </div>
        </div>
      </section>
    </>
  );
}
