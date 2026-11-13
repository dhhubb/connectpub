'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/client/api';
import { useUi } from '@/lib/client/ui';
import { timeAgo } from '@/lib/client/format';
import type { Job, Provider } from '@/lib/client/types';
import Spinner from '@/components/Spinner';
import Stars from '@/components/Stars';

interface SavedData {
  jobs: (Job & { savedAt: string })[];
  providers: (Provider & { savedAt: string })[];
}

export default function SavedItems() {
  const { toast } = useUi();
  const [data, setData] = useState<SavedData | null>(null);

  const load = useCallback(() => {
    api<SavedData>('/dashboard/saved').then(setData).catch((e) => { toast((e as Error).message, 'err'); setData({ jobs: [], providers: [] }); });
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const unsave = async (type: 'job' | 'provider', id: number) => {
    try {
      await api(`/dashboard/saved/${type}/${id}`, { method: 'DELETE' });
      toast('Removed');
      load();
    } catch (err) { toast((err as Error).message, 'err'); }
  };

  if (!data) return <Spinner />;

  return (
    <>
      <div className="page-head">
        <div>
          <h2>Saved items</h2>
          <p className="sub">{data.jobs.length} job{data.jobs.length === 1 ? '' : 's'} and {data.providers.length} provider{data.providers.length === 1 ? '' : 's'} saved</p>
        </div>
      </div>

      <h3 style={{ marginTop: '.6rem' }}>Saved jobs</h3>
      {data.jobs.length ? (
        <div className="grid-cards">
          {data.jobs.map((j) => (
            <article className="listing" key={j.id}>
              <div className="row">
                <div className="thumb">{j.category?.icon || '💼'}</div>
                <div className="grow">
                  <h3><Link href={`/jobs/${j.id}`}>{j.title}</Link></h3>
                  <div className="org">{j.company}</div>
                </div>
              </div>
              <div className="chips">
                {j.location && <span className="tag">📍 {j.location.name}</span>}
                <span className="tag">{j.jobTypeLabel}</span>
                <span className="tag">{j.salaryLabel}</span>
              </div>
              <div className="foot">
                <span className="tiny muted">Saved {timeAgo(j.savedAt)}</span>
                <span className="btn-group">
                  <Link className="btn btn-xs btn-outline" href={`/jobs/${j.id}`}>Open</Link>
                  <button className="btn btn-xs btn-ghost" onClick={() => unsave('job', j.id)}>Remove</button>
                </span>
              </div>
            </article>
          ))}
        </div>
      ) : <p className="muted small">No saved jobs yet.</p>}

      <h3 style={{ marginTop: '1.6rem' }}>Saved providers</h3>
      {data.providers.length ? (
        <div className="grid-cards">
          {data.providers.map((p) => (
            <article className="listing" key={p.id}>
              <div className="row">
                <div className="thumb thumb-clay">{p.category?.icon || '🔧'}</div>
                <div className="grow">
                  <h3><Link href={`/providers/${p.id}`}>{p.businessName}</Link></h3>
                  <div className="org">{p.category?.name || ''}</div>
                </div>
              </div>
              <div className="row small">{p.rating ? <Stars rating={p.rating} /> : <span className="muted tiny">No reviews</span>}</div>
              <div className="chips">
                {p.location && <span className="tag">📍 {p.location.name}</span>}
                <span className="tag">{p.availabilityLabel}</span>
              </div>
              <div className="foot">
                <span className="tiny muted">Saved {timeAgo(p.savedAt)}</span>
                <span className="btn-group">
                  <Link className="btn btn-xs btn-outline" href={`/providers/${p.id}`}>Open</Link>
                  <button className="btn btn-xs btn-ghost" onClick={() => unsave('provider', p.id)}>Remove</button>
                </span>
              </div>
            </article>
          ))}
        </div>
      ) : <p className="muted small">No saved providers yet.</p>}
    </>
  );
}
