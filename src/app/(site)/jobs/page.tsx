'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, toQuery, setQuery, useDebounced } from '@/lib/client/api';
import type { Category, Group, Job, Location } from '@/lib/client/types';
import JobCard from '@/components/JobCard';
import Pager, { type Pagination } from '@/components/Pager';
import Spinner from '@/components/Spinner';

const SORTS = [
  { value: 'recent', label: 'Newest first' },
  { value: 'deadline', label: 'Closing soon' },
  { value: 'salary', label: 'Highest salary' },
  { value: 'popular', label: 'Most viewed' },
  { value: 'title', label: 'Title A–Z' },
  { value: 'company', label: 'Company A–Z' },
];

const JOB_TYPES: [string, string][] = [['full_time', 'Full time'], ['part_time', 'Part time'], ['contract', 'Contract'], ['casual', 'Casual'], ['internship', 'Internship'], ['volunteer', 'Volunteer']];
const WORK_MODES: [string, string][] = [['on_site', 'On site'], ['hybrid', 'Hybrid'], ['remote', 'Remote']];

export default function JobsPage() {
  const [jobs, setJobs] = useState<Job[] | null>(null);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [q, setQ] = useState('');
  const [group, setGroup] = useState('');
  const [category, setCategory] = useState('');
  const [location, setLocation] = useState('');
  const [jobType, setJobType] = useState('');
  const [workMode, setWorkMode] = useState('');
  const [minSalary, setMinSalary] = useState('');
  const [sort, setSort] = useState('recent');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(12);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    setQ(p.get('q') || '');
    setGroup(p.get('group') || '');
    setCategory(p.get('category') || '');
    setLocation(p.get('location') || '');
    setJobType(p.get('job_type') || '');
    setWorkMode(p.get('work_mode') || '');
    setMinSalary(p.get('min_salary') || '');
    setSort(p.get('sort') || 'recent');
    setPage(Number(p.get('page')) || 1);
    setPerPage(Number(p.get('per_page')) || 12);
  }, []);

  useEffect(() => {
    api<{ groups: Group[] }>('/meta/groups?' + toQuery({ kind: 'job' })).then((d) => setGroups(d.groups)).catch(() => {});
    api<{ locations: Location[] }>('/meta/locations').then((d) => setLocations(d.locations)).catch(() => {});
  }, []);

  useEffect(() => {
    const params = group ? { kind: 'job', group } : { kind: 'job' };
    api<{ categories: Category[] }>('/meta/categories?' + toQuery(params)).then((d) => setCategories(d.categories)).catch(() => {});
  }, [group]);

  const load = useCallback(async () => {
    const query = toQuery({ q, group, category, location, job_type: jobType, work_mode: workMode, min_salary: minSalary, sort, page, per_page: perPage });
    try {
      const data = await api<{ jobs: Job[]; pagination: Pagination }>('/jobs?' + query);
      setJobs(data.jobs);
      setPagination(data.pagination);
    } catch {
      setJobs([]);
      setPagination(null);
    }
  }, [q, group, category, location, jobType, workMode, minSalary, sort, page, perPage]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    setQuery({ q, group, category, location, job_type: jobType, work_mode: workMode, min_salary: minSalary, sort, page, per_page: perPage });
  }, [q, group, category, location, jobType, workMode, minSalary, sort, page, perPage]);

  const debouncedSearch = useDebounced((value: string) => { setQ(value); setPage(1); }, 350);

  const activeChips = useMemo(() => {
    const chips: { label: string; clear: () => void }[] = [];
    if (q) chips.push({ label: `“${q}”`, clear: () => setQ('') });
    if (group) chips.push({ label: groups.find((g) => g.slug === group)?.name || group, clear: () => setGroup('') });
    if (category) chips.push({ label: categories.find((c) => c.slug === category)?.name || category, clear: () => setCategory('') });
    if (location) chips.push({ label: locations.find((l) => String(l.id) === location)?.name || location, clear: () => setLocation('') });
    if (jobType) chips.push({ label: JOB_TYPES.find((t) => t[0] === jobType)?.[1] || jobType, clear: () => setJobType('') });
    if (workMode) chips.push({ label: WORK_MODES.find((w) => w[0] === workMode)?.[1] || workMode, clear: () => setWorkMode('') });
    if (minSalary) chips.push({ label: `≥ ${minSalary} USD`, clear: () => setMinSalary('') });
    return chips;
  }, [q, group, category, location, jobType, workMode, minSalary, groups, categories, locations]);

  const clearAll = () => { setQ(''); setGroup(''); setCategory(''); setLocation(''); setJobType(''); setWorkMode(''); setMinSalary(''); setPage(1); };

  return (
    <>
      <div style={{ background: 'linear-gradient(140deg,var(--green-900),var(--green-800))', color: '#fff' }}>
        <div className="container" style={{ padding: '1.8rem 1.15rem' }}>
          <p className="eyebrow" style={{ color: '#f0b878' }}>Job board</p>
          <h1 style={{ color: '#fff', marginBottom: '.3rem' }}>Find your next job</h1>
          <p className="mb0" style={{ color: 'rgba(255,255,255,.85)' }}>Vacancies from employers across Plumtree and Matabeleland South.</p>
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
                <input type="search" placeholder="Title, company…" value={q} onChange={(e) => debouncedSearch(e.target.value)} />
              </label>

              <div className="filter-group">
                <span className="lbl">Industry</span>
                <div className="filter-list">
                  <button type="button" className={!group ? 'active' : ''} onClick={() => { setGroup(''); setCategory(''); setPage(1); }}>All industries</button>
                  {groups.map((g) => (
                    <button key={g.id} type="button" className={group === g.slug ? 'active' : ''}
                      onClick={() => { setGroup(g.slug); setCategory(''); setPage(1); }}>
                      {g.icon || '📁'} {g.name} <span className="n">{g.jobCount}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="filter-group">
                <span className="lbl">Category</span>
                <div className="filter-list">
                  <button type="button" className={!category ? 'active' : ''} onClick={() => { setCategory(''); setPage(1); }}>All categories</button>
                  {categories.map((c) => (
                    <button key={c.id} type="button" className={category === c.slug ? 'active' : ''}
                      onClick={() => { setCategory(c.slug); setPage(1); }}>
                      {c.icon || '📌'} {c.name} <span className="n">{c.jobCount ?? 0}</span>
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
                      {l.name} <span className="n">{l.jobCount}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="filter-group">
                <span className="lbl">Job type</span>
                <div className="chips">
                  {JOB_TYPES.map(([value, label]) => (
                    <button key={value} type="button" className={'chip' + (jobType === value ? ' active' : '')}
                      onClick={() => { setJobType(jobType === value ? '' : value); setPage(1); }}>{label}</button>
                  ))}
                </div>
              </div>

              <div className="filter-group">
                <span className="lbl">Work mode</span>
                <div className="chips">
                  {WORK_MODES.map(([value, label]) => (
                    <button key={value} type="button" className={'chip' + (workMode === value ? ' active' : '')}
                      onClick={() => { setWorkMode(workMode === value ? '' : value); setPage(1); }}>{label}</button>
                  ))}
                </div>
              </div>

              <label className="field">
                <span className="lbl">Minimum salary (USD)</span>
                <input type="number" min={0} step={10} placeholder="Any" value={minSalary}
                  onChange={(e) => { setMinSalary(e.target.value); setPage(1); }} />
              </label>
              <button className="btn btn-block" type="submit">Apply filters</button>
            </form>
          </aside>

          <section>
            <div className="panel" style={{ marginBottom: '1rem' }}>
              <div className="panel-body row row-wrap" style={{ gap: '.7rem' }}>
                <div className="grow">
                  <input type="search" placeholder="Search jobs by title or company…" value={q} onChange={(e) => debouncedSearch(e.target.value)} />
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
                {pagination ? `${pagination.total} job${pagination.total === 1 ? '' : 's'} found` : 'Loading…'}
              </p>
              <div className="chips">
                {activeChips.map((chip, i) => (
                  <button key={i} type="button" className="chip active" onClick={() => { chip.clear(); setPage(1); }}>
                    {chip.label} ✕
                  </button>
                ))}
              </div>
            </div>

            <div className="stack">
              {jobs === null
                ? <Spinner />
                : jobs.length
                  ? jobs.map((j) => <JobCard key={j.id} job={j} />)
                  : <div className="empty"><span className="icon">🔍</span><b>No jobs match your filters</b><p>Try widening your search or clearing some filters.</p><button className="btn btn-outline" onClick={clearAll}>Clear filters</button></div>}
            </div>

            {pagination && (
              <Pager pagination={pagination} unit="job" onPage={setPage}
                onPerPage={(n) => { setPerPage(n); setPage(1); }} />
            )}
          </section>
        </div>
      </main>
    </>
  );
}
