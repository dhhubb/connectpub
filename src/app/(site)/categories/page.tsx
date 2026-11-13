'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { api, toQuery, setQuery, useDebounced } from '@/lib/client/api';
import type { Group } from '@/lib/client/types';

type Scope = 'both' | 'job' | 'service';

export default function CategoriesPage() {
  const [groups, setGroups] = useState<Group[] | null>(null);
  const [scope, setScope] = useState<Scope>('both');
  const [q, setQ] = useState('');

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const s = p.get('scope');
    if (s === 'job' || s === 'service' || s === 'both') setScope(s);
    setQ(p.get('q') || '');
  }, []);

  useEffect(() => {
    const kind = scope === 'both' ? '' : '?' + toQuery({ kind: scope });
    setGroups(null);
    api<{ groups: Group[] }>('/meta/groups' + kind).then((d) => setGroups(d.groups)).catch(() => setGroups([]));
  }, [scope]);

  useEffect(() => { setQuery({ scope: scope === 'both' ? null : scope, q: q || null }); }, [scope, q]);

  const debounced = useDebounced((v: string) => setQ(v), 250);

  const visible = useMemo(() => {
    if (!groups) return [];
    if (!q) return groups;
    const needle = q.toLowerCase();
    return groups.filter((g) => (g.name + ' ' + (g.description || '')).toLowerCase().includes(needle));
  }, [groups, q]);

  const countsFor = (group: Group) => {
    if (scope === 'job') return `${group.jobCount} open job${group.jobCount === 1 ? '' : 's'}`;
    if (scope === 'service') return `${group.providerCount} provider${group.providerCount === 1 ? '' : 's'}`;
    const parts: string[] = [];
    if (group.jobCount) parts.push(`${group.jobCount} job${group.jobCount === 1 ? '' : 's'}`);
    if (group.providerCount) parts.push(`${group.providerCount} provider${group.providerCount === 1 ? '' : 's'}`);
    return parts.length ? parts.join(' · ') : 'No listings yet';
  };

  return (
    <>
      <div style={{ background: 'linear-gradient(140deg,var(--green-900),var(--green-800))', color: '#fff' }}>
        <div className="container" style={{ padding: '1.8rem 1.15rem' }}>
          <p className="eyebrow" style={{ color: '#f0b878' }}>Browse by category</p>
          <h1 style={{ color: '#fff', marginBottom: '.3rem' }}>Every trade, every trade route</h1>
          <p className="mb0" style={{ color: 'rgba(255,255,255,.85)' }}>Jobs and services grouped into the industries that keep Plumtree and Matabeleland South moving.</p>
        </div>
      </div>

      <main className="container" style={{ padding: '1.6rem 1.15rem 2.6rem' }}>
        <div className="panel" style={{ marginBottom: '1.2rem' }}>
          <div className="panel-body row row-wrap" style={{ gap: '.7rem' }}>
            <div className="grow">
              <input type="search" placeholder="Search categories — try “solar”, “transport”, “retail”…" onChange={(e) => debounced(e.target.value)} defaultValue={q} />
            </div>
            <div className="chips">
              {(['both', 'job', 'service'] as Scope[]).map((s) => (
                <button key={s} type="button" className={'chip' + (scope === s ? ' active' : '')} onClick={() => setScope(s)}>
                  {s === 'both' ? 'All' : s === 'job' ? 'Jobs' : 'Services'}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid-cards-3">
          {groups === null
            ? <><div className="skeleton" style={{ height: 150 }} /><div className="skeleton" style={{ height: 150 }} /><div className="skeleton" style={{ height: 150 }} /></>
            : visible.map((g) => (
              <Link key={g.id} className="card cat-card" href={`/categories/${g.slug}${scope !== 'both' ? `?kind=${scope}` : ''}`}>
                <div className="row">
                  <div className="thumb">{g.icon || '📁'}</div>
                  <div className="grow">
                    <b style={{ color: 'var(--ink-900)' }}>{g.name}</b>
                    <div className="tiny muted">{countsFor(g)}</div>
                  </div>
                </div>
                <p className="small muted" style={{ margin: '.6rem 0 0' }}>{g.description}</p>
                <div className="cat-card-foot">
                  <span className="tag">{g.categoryCount} categor{g.categoryCount === 1 ? 'y' : 'ies'}</span>
                  <span className="cat-go">Open →</span>
                </div>
              </Link>
            ))}
        </div>

        {groups !== null && visible.length === 0 && (
          <div className="empty"><span className="icon">🔍</span><b>No categories matched</b><p>Try a different word, or clear the search.</p></div>
        )}
      </main>
    </>
  );
}
