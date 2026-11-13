'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, toQuery, setQuery, useDebounced } from '@/lib/client/api';
import type { Category, Group, Location, Provider } from '@/lib/client/types';
import ProviderCard from '@/components/ProviderCard';
import Pager, { type Pagination } from '@/components/Pager';
import Spinner from '@/components/Spinner';

const SORTS = [
  { value: 'rating', label: 'Highest rated' },
  { value: 'experience', label: 'Most experienced' },
  { value: 'price', label: 'Lowest price' },
  { value: 'popular', label: 'Most viewed' },
  { value: 'recent', label: 'Newest' },
  { value: 'name', label: 'Name A–Z' },
];

const AVAILABILITY: [string, string][] = [['available', 'Available now'], ['busy', 'Busy'], ['unavailable', 'Unavailable']];

export default function ProvidersPage() {
  const [providers, setProviders] = useState<Provider[] | null>(null);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [q, setQ] = useState('');
  const [group, setGroup] = useState('');
  const [category, setCategory] = useState('');
  const [location, setLocation] = useState('');
  const [availability, setAvailability] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [verified, setVerified] = useState(false);
  const [sort, setSort] = useState('rating');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(12);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    setQ(p.get('q') || '');
    setGroup(p.get('group') || '');
    setCategory(p.get('category') || '');
    setLocation(p.get('location') || '');
    setAvailability(p.get('availability') || '');
    setMaxPrice(p.get('max_price') || '');
    setVerified(p.get('verified') === '1');
    setSort(p.get('sort') || 'rating');
    setPage(Number(p.get('page')) || 1);
    setPerPage(Number(p.get('per_page')) || 12);
  }, []);

  useEffect(() => {
    api<{ groups: Group[] }>('/meta/groups?' + toQuery({ kind: 'service' })).then((d) => setGroups(d.groups)).catch(() => {});
    api<{ locations: Location[] }>('/meta/locations').then((d) => setLocations(d.locations)).catch(() => {});
  }, []);

  useEffect(() => {
    const params = group ? { kind: 'service', group } : { kind: 'service' };
    api<{ categories: Category[] }>('/meta/categories?' + toQuery(params)).then((d) => setCategories(d.categories)).catch(() => {});
  }, [group]);

  const load = useCallback(async () => {
    const query = toQuery({ q, group, category, location, availability, max_price: maxPrice, verified: verified ? '1' : '', sort, page, per_page: perPage });
    try {
      const data = await api<{ providers: Provider[]; pagination: Pagination }>('/providers?' + query);
      setProviders(data.providers);
      setPagination(data.pagination);
    } catch {
      setProviders([]);
      setPagination(null);
    }
  }, [q, group, category, location, availability, maxPrice, verified, sort, page, perPage]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    setQuery({ q, group, category, location, availability, max_price: maxPrice, verified: verified ? '1' : '', sort, page, per_page: perPage });
  }, [q, group, category, location, availability, maxPrice, verified, sort, page, perPage]);

  const debouncedSearch = useDebounced((value: string) => { setQ(value); setPage(1); }, 350);

  const activeChips = useMemo(() => {
    const chips: { label: string; clear: () => void }[] = [];
    if (q) chips.push({ label: `“${q}”`, clear: () => setQ('') });
    if (group) chips.push({ label: groups.find((g) => g.slug === group)?.name || group, clear: () => setGroup('') });
    if (category) chips.push({ label: categories.find((c) => c.slug === category)?.name || category, clear: () => setCategory('') });
    if (location) chips.push({ label: locations.find((l) => String(l.id) === location)?.name || location, clear: () => setLocation('') });
    if (availability) chips.push({ label: AVAILABILITY.find((a) => a[0] === availability)?.[1] || availability, clear: () => setAvailability('') });
    if (maxPrice) chips.push({ label: `≤ ${maxPrice} USD`, clear: () => setMaxPrice('') });
    if (verified) chips.push({ label: 'Verified only', clear: () => setVerified(false) });
    return chips;
  }, [q, group, category, location, availability, maxPrice, verified, groups, categories, locations]);

  const clearAll = () => { setQ(''); setGroup(''); setCategory(''); setLocation(''); setAvailability(''); setMaxPrice(''); setVerified(false); setPage(1); };

  return (
    <>
      <div style={{ background: 'linear-gradient(140deg,#1d3f4a,var(--green-800))', color: '#fff' }}>
        <div className="container" style={{ padding: '1.8rem 1.15rem' }}>
          <p className="eyebrow" style={{ color: '#f0b878' }}>Service directory</p>
          <h1 style={{ color: '#fff', marginBottom: '.3rem' }}>Hire a local service provider</h1>
          <p className="mb0" style={{ color: 'rgba(255,255,255,.85)' }}>Artisans, trades and businesses across Plumtree and the district. Send a request and get a quote.</p>
        </div>
      </div>

      <main className="container" style={{ padding: '1.6rem 1.15rem 2.6rem' }}>
        <div className="grid-side-left">
          <aside className={'card sticky-side' + (filtersOpen ? ' filter-open' : '')}>
            <div className="spread" style={{ marginBottom: '.7rem' }}>
              <b>Filters</b>
              <div className="row" style={{ gap: '.35rem' }}>
                <button className="btn btn-xs btn-ghost filter-toggle" type="button" aria-expanded={filtersOpen} onClick={() => setFiltersOpen((v) => !v)}>
                  {filtersOpen ? 'Hide filters' : 'Show filters'}
                </button>
                <button className="btn btn-xs btn-ghost" type="button" onClick={clearAll}>Clear all</button>
              </div>
            </div>
            <form id="filter-form" onSubmit={(e) => { e.preventDefault(); setPage(1); load(); }}>
              <label className="field">
                <span className="lbl">Keyword</span>
                <input type="search" placeholder="Service or business…" value={q} onChange={(e) => debouncedSearch(e.target.value)} />
              </label>

              <div className="filter-group">
                <span className="lbl">Industry</span>
                <div className="filter-list">
                  <button type="button" className={!group ? 'active' : ''} onClick={() => { setGroup(''); setCategory(''); setPage(1); }}>All industries</button>
                  {groups.map((g) => (
                    <button key={g.id} type="button" className={group === g.slug ? 'active' : ''}
                      onClick={() => { setGroup(g.slug); setCategory(''); setPage(1); }}>
                      {g.icon || '📁'} {g.name} <span className="n">{g.providerCount}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="filter-group">
                <span className="lbl">Service category</span>
                <div className="filter-list">
                  <button type="button" className={!category ? 'active' : ''} onClick={() => { setCategory(''); setPage(1); }}>All categories</button>
                  {categories.map((c) => (
                    <button key={c.id} type="button" className={category === c.slug ? 'active' : ''}
                      onClick={() => { setCategory(c.slug); setPage(1); }}>
                      {c.icon || '📌'} {c.name} <span className="n">{c.providerCount ?? 0}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="filter-group">
                <span className="lbl">Area</span>
                <div className="filter-list">
                  <button type="button" className={!location ? 'active' : ''} onClick={() => { setLocation(''); setPage(1); }}>All areas</button>
                  {locations.map((l) => (
                    <button key={l.id} type="button" className={location === String(l.id) ? 'active' : ''}
                      onClick={() => { setLocation(String(l.id)); setPage(1); }}>
                      {l.name} <span className="n">{l.providerCount}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="filter-group">
                <span className="lbl">Availability</span>
                <div className="chips">
                  {AVAILABILITY.map(([value, label]) => (
                    <button key={value} type="button" className={'chip' + (availability === value ? ' active' : '')}
                      onClick={() => { setAvailability(availability === value ? '' : value); setPage(1); }}>{label}</button>
                  ))}
                </div>
              </div>

              <label className="field">
                <span className="lbl">Maximum starting price (USD)</span>
                <input type="number" min={0} step={10} placeholder="Any" value={maxPrice}
                  onChange={(e) => { setMaxPrice(e.target.value); setPage(1); }} />
              </label>
              <label className="field row" style={{ gap: '.4rem', alignItems: 'center' }}>
                <input type="checkbox" style={{ width: 'auto' }} checked={verified} onChange={(e) => { setVerified(e.target.checked); setPage(1); }} />
                <span className="lbl" style={{ margin: 0 }}>Verified providers only</span>
              </label>
              <button className="btn btn-block" type="submit">Apply filters</button>
            </form>
          </aside>

          <section>
            <div className="panel" style={{ marginBottom: '1rem' }}>
              <div className="panel-body row row-wrap" style={{ gap: '.7rem' }}>
                <div className="grow">
                  <input type="search" placeholder="Search providers by name or service…" value={q} onChange={(e) => debouncedSearch(e.target.value)} />
                </div>
                <label className="row small" style={{ gap: '.35rem', whiteSpace: 'nowrap' }}>
                  <span className="muted">Sort</span>
                  <select style={{ width: 'auto' }} value={sort} onChange={(e) => { setSort(e.target.value); setPage(1); }}>
                    {SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </label>
              </div>
            </div>

            <div className="spread" style={{ marginBottom: '.9rem' }}>
              <p className="mb0 small muted">
                {pagination ? `${pagination.total} provider${pagination.total === 1 ? '' : 's'} found` : 'Loading…'}
              </p>
              <div className="chips">
                {activeChips.map((chip, i) => (
                  <button key={i} type="button" className="chip active" onClick={() => { chip.clear(); setPage(1); }}>
                    {chip.label} ✕
                  </button>
                ))}
              </div>
            </div>

            <div className="grid-cards">
              {providers === null
                ? <Spinner />
                : providers.length
                  ? providers.map((p) => <ProviderCard key={p.id} provider={p} />)
                  : <div className="empty"><span className="icon">🔧</span><b>No providers match your filters</b><p>Try widening your search or clearing some filters.</p><button className="btn btn-outline" onClick={clearAll}>Clear filters</button></div>}
            </div>

            {pagination && (
              <Pager pagination={pagination} unit="provider" onPage={setPage}
                onPerPage={(n) => { setPerPage(n); setPage(1); }} />
            )}
          </section>
        </div>
      </main>
    </>
  );
}
