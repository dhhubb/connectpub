'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, toQuery, setQuery, useDebounced } from '@/lib/client/api';
import type { Category, Group, Job, Provider } from '@/lib/client/types';
import JobCard from '@/components/JobCard';
import ProviderCard from '@/components/ProviderCard';
import Pager, { type Pagination } from '@/components/Pager';
import Spinner from '@/components/Spinner';

type Kind = 'job' | 'service';

const JOB_SORTS = [
  { value: 'recent', label: 'Newest first' },
  { value: 'salary', label: 'Highest salary' },
  { value: 'deadline', label: 'Closing soon' },
  { value: 'popular', label: 'Most viewed' },
];
const SERVICE_SORTS = [
  { value: 'recent', label: 'Newest first' },
  { value: 'rating', label: 'Highest rated' },
  { value: 'experience', label: 'Most experienced' },
  { value: 'price', label: 'Lowest starting price' },
  { value: 'popular', label: 'Most viewed' },
];

export default function CategoryPage() {
  const params = useParams();
  const slug = String(params.slug);

  const [group, setGroup] = useState<Group | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [groupState, setGroupState] = useState<'loading' | 'ready' | 'missing'>('loading');

  const [kind, setKind] = useState<Kind>('job');
  const [category, setCategory] = useState('');
  const [q, setQ] = useState('');
  const [sort, setSort] = useState('recent');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(12);

  const [jobs, setJobs] = useState<Job[] | null>(null);
  const [providers, setProviders] = useState<Provider[] | null>(null);
  const [pagination, setPagination] = useState<Pagination | null>(null);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    setKind(p.get('kind') === 'service' ? 'service' : 'job');
    setCategory(p.get('category') || '');
    setQ(p.get('q') || '');
    setSort(p.get('sort') || 'recent');
    setPage(Number(p.get('page')) || 1);
    setPerPage(Number(p.get('per_page')) || 12);
  }, [slug]);

  useEffect(() => {
    setGroupState('loading');
    api<{ group: Group; categories: Category[] }>('/meta/groups/' + encodeURIComponent(slug))
      .then((d) => { setGroup(d.group); setCategories(d.categories); setGroupState('ready'); })
      .catch(() => setGroupState('missing'));
  }, [slug]);

  const load = useCallback(async () => {
    const query = toQuery({ group: slug, category, q, sort, page, per_page: perPage });
    if (kind === 'job') { setProviders(null); setJobs(null); }
    else { setJobs(null); setProviders(null); }
    try {
      if (kind === 'job') {
        const data = await api<{ jobs: Job[]; pagination: Pagination }>('/jobs?' + query);
        setJobs(data.jobs); setPagination(data.pagination);
      } else {
        const data = await api<{ providers: Provider[]; pagination: Pagination }>('/providers?' + query);
        setProviders(data.providers); setPagination(data.pagination);
      }
    } catch {
      if (kind === 'job') setJobs([]); else setProviders([]);
      setPagination(null);
    }
  }, [slug, category, q, sort, page, perPage, kind]);

  useEffect(() => { if (groupState === 'ready') load(); }, [groupState, load]);

  useEffect(() => {
    setQuery({ kind: kind === 'job' ? null : kind, category: category || null, q: q || null, sort: sort === 'recent' ? null : sort, page: page > 1 ? page : null, per_page: perPage });
  }, [kind, category, q, sort, page, perPage]);

  const debounced = useDebounced((v: string) => { setQ(v); setPage(1); }, 350);

  const relevantCategories = useMemo(
    () => categories.filter((c) => (kind === 'job' ? c.kind === 'job' : c.kind === 'service')),
    [categories, kind],
  );

  const setKindTab = (k: Kind) => {
    setKind(k); setCategory(''); setSort('recent'); setPage(1);
  };

  const rows = kind === 'job' ? jobs : providers;
  const unit = kind === 'job' ? 'job' : 'provider';
  const sorts = kind === 'job' ? JOB_SORTS : SERVICE_SORTS;

  return (
    <>
      <div style={{ background: 'linear-gradient(140deg,var(--green-900),var(--green-800))', color: '#fff' }}>
        <div className="container" style={{ padding: '1.8rem 1.15rem' }}>
          <p className="eyebrow" style={{ color: '#f0b878' }}><Link href="/categories" style={{ color: '#f0b878' }}>All categories</Link></p>
          {groupState === 'missing'
            ? <><h1 style={{ color: '#fff' }}>Category not found</h1><p className="mb0" style={{ color: 'rgba(255,255,255,.85)' }}>That category page does not exist.</p></>
            : (
              <>
                <h1 style={{ color: '#fff', marginBottom: '.3rem' }}>{group?.icon || '📁'} {group?.name || 'Loading…'}</h1>
                <p className="mb0" style={{ color: 'rgba(255,255,255,.85)' }}>{group?.description || ''}</p>
                {group && (
                  <div className="chips" style={{ marginTop: '.9rem' }}>
                    <span className="badge badge-green">{group.jobCount} open job{group.jobCount === 1 ? '' : 's'}</span>
                    <span className="badge badge-clay">{group.providerCount} provider{group.providerCount === 1 ? '' : 's'}</span>
                    <span className="badge badge-plain">{group.categoryCount} categor{group.categoryCount === 1 ? 'y' : 'ies'}</span>
                  </div>
                )}
              </>
            )}
        </div>
      </div>

      <main className="container" style={{ padding: '1.6rem 1.15rem 2.6rem' }}>
        {groupState === 'missing' ? (
          <div className="empty"><span className="icon">📁</span><b>No category selected</b><p><Link href="/categories">Browse all categories</Link></p></div>
        ) : (
          <>
            <nav className="tabs" style={{ marginBottom: '1rem' }}>
              <button className={'tab' + (kind === 'job' ? ' active' : '')} onClick={() => setKindTab('job')}>Jobs</button>
              <button className={'tab' + (kind === 'service' ? ' active' : '')} onClick={() => setKindTab('service')}>Service providers</button>
            </nav>

            {relevantCategories.length > 0 && (
              <div className="chips" style={{ marginBottom: '1rem' }}>
                <button type="button" className={'chip' + (!category ? ' active' : '')} onClick={() => { setCategory(''); setPage(1); }}>
                  All in {group?.name || 'category'}
                </button>
                {relevantCategories.map((c) => {
                  const n = kind === 'job' ? c.jobCount : c.providerCount;
                  return (
                    <button key={c.id} type="button" className={'chip' + (category === c.slug ? ' active' : '')}
                      onClick={() => { setCategory(c.slug); setPage(1); }}>
                      {c.icon} {c.name} <span className="muted">{n}</span>
                    </button>
                  );
                })}
              </div>
            )}

            <div className="panel" style={{ marginBottom: '1rem' }}>
              <div className="panel-body row row-wrap" style={{ gap: '.7rem' }}>
                <div className="grow">
                  <input type="search" placeholder="Search within this category…" value={q} onChange={(e) => debounced(e.target.value)} />
                </div>
                <label className="row small" style={{ gap: '.35rem', whiteSpace: 'nowrap' }}>
                  <span className="muted">Sort</span>
                  <select style={{ width: 'auto' }} value={sort} onChange={(e) => { setSort(e.target.value); setPage(1); }}>
                    {sorts.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </label>
              </div>
            </div>

            <div className="spread" style={{ marginBottom: '.9rem' }}>
              <p className="mb0 small muted">
                {pagination
                  ? (pagination.total ? <><b>{pagination.total}</b> {unit}{pagination.total === 1 ? '' : 's'} found</> : `No ${unit}s in this category yet`)
                  : 'Loading…'}
              </p>
              <div className="chips">
                {q && <button className="chip active" onClick={() => { setQ(''); setPage(1); }}>“{q}” ✕</button>}
                {category && <button className="chip active" onClick={() => { setCategory(''); setPage(1); }}>{relevantCategories.find((c) => c.slug === category)?.name || category} ✕</button>}
              </div>
            </div>

            <div className="grid-cards">
              {rows === null
                ? <Spinner />
                : rows.length
                  ? (kind === 'job'
                    ? (jobs as Job[]).map((j) => <JobCard key={j.id} job={j} />)
                    : (providers as Provider[]).map((p) => <ProviderCard key={p.id} provider={p} />))
                  : <div className="empty"><span className="icon">🔍</span><b>Nothing here yet</b><p>Try another sub-category or clear your search.</p></div>}
            </div>

            {pagination && (
              <Pager pagination={pagination} unit={unit} onPage={(p) => { setPage(p); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                onPerPage={(n) => { setPerPage(n); setPage(1); }} />
            )}
          </>
        )}
      </main>
    </>
  );
}
