'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { api, setQuery, toQuery, useDebounced } from '@/lib/client/api';
import { useUi } from '@/lib/client/ui';
import { dateTimeLabel, money } from '@/lib/client/format';
import type { Provider } from '@/lib/client/types';
import Badge from '@/components/Badge';
import Modal from '@/components/Modal';
import Spinner from '@/components/Spinner';

const STATUSES = ['', 'pending', 'approved', 'rejected', 'suspended'];

export default function AdminProviders() {
  const { toast } = useUi();
  const [providers, setProviders] = useState<Provider[] | null>(null);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const [inspect, setInspect] = useState<Provider | null>(null);
  const [reject, setReject] = useState<Provider | null>(null);
  const [rejectReason, setRejectReason] = useState('Does not meet listing guidelines');

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    setStatus(p.get('status') || '');
    setQ(p.get('q') || '');
  }, []);

  const load = useCallback(() => {
    api<{ providers: Provider[]; pagination: { total: number } }>('/admin/providers?' + toQuery({ per_page: 50, status, q }))
      .then((d) => { setProviders(d.providers); setTotal(d.pagination.total); })
      .catch((e) => { toast((e as Error).message, 'err'); setProviders([]); });
  }, [status, q, toast]);

  useEffect(() => { load(); }, [load]);

  const debounced = useDebounced((v: string) => { setQ(v); setQuery({ q: v, view: 'providers' }); }, 450);

  const moderate = async (id: number, patch: Record<string, any>) => {
    try {
      const res = await api<{ message: string }>('/admin/providers/' + id, { method: 'PATCH', body: patch });
      toast(res.message || 'Provider updated');
      load();
    } catch (e) { toast((e as Error).message, 'err'); }
  };

  const doReject = async () => {
    if (!reject) return;
    try {
      await api('/admin/providers/' + reject.id, { method: 'PATCH', body: { status: 'rejected', rejectionReason: rejectReason } });
      setReject(null);
      toast('Provider rejected');
      load();
    } catch (e) { toast((e as Error).message, 'err'); }
  };

  if (!providers) return <Spinner />;

  return (
    <>
      <div className="page-head">
        <div><h2>Service moderation</h2><p className="sub">{total} listing{total === 1 ? '' : 's'} · approve, verify or feature providers</p></div>
      </div>

      <div className="panel" style={{ marginBottom: '1rem' }}>
        <div className="panel-body row row-wrap">
          <div className="chips">
            {STATUSES.map((s) => (
              <button key={s} className={'chip' + (status === s ? ' active' : '')} onClick={() => { setStatus(s); setQuery({ status: s, view: 'providers' }); }}>
                {s === '' ? 'All' : s}
              </button>
            ))}
          </div>
          <div className="grow" />
          <input type="search" placeholder="Search business name…" defaultValue={q} style={{ maxWidth: 280 }} onChange={(e) => debounced(e.target.value)} />
        </div>
      </div>

      <div className="panel">
        <div className="table-wrap">
          <table className="data">
            <thead><tr><th>Business</th><th>Owner</th><th>Category</th><th>Requests</th><th>Rating</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {providers.length ? providers.map((p) => (
                <tr key={p.id} className={p.status === 'pending' ? 'row-flag' : ''}>
                  <td>
                    <Link href={`/providers/${p.id}`}><b>{p.businessName}</b></Link>
                    <div className="tiny muted">{p.location ? p.location.name : '—'}{p.verified ? ' · ' : ''}{p.verified && <span className="badge badge-green">Verified</span>}{p.featured ? ' · ' : ''}{p.featured && <span className="badge badge-clay">Featured</span>}</div>
                  </td>
                  <td className="small">{p.ownerName || '—'}<div className="tiny muted">{p.email || ''}</div></td>
                  <td className="small muted">{p.category?.name || '—'}</td>
                  <td className="small">{p.requestCount ?? '—'}</td>
                  <td className="small">{p.rating ? `${p.rating} ★ (${p.ratingCount})` : '—'}</td>
                  <td>
                    <Badge status={p.status} label={p.status} />
                    {p.rejectionReason && <div className="tiny" style={{ color: 'var(--danger)' }}>{p.rejectionReason}</div>}
                  </td>
                  <td className="actions">
                    <button className="btn btn-xs btn-ghost" onClick={() => setInspect(p)}>Inspect</button>
                    {p.status !== 'approved' && <button className="btn btn-xs" onClick={() => moderate(p.id, { status: 'approved' })}>Approve</button>}
                    {p.status !== 'rejected' && <button className="btn btn-xs btn-ghost" onClick={() => { setRejectReason('Does not meet listing guidelines'); setReject(p); }}>Reject</button>}
                    <button className="btn btn-xs btn-ghost" onClick={() => moderate(p.id, { verified: !p.verified })}>{p.verified ? '✓ Unverify' : '✓ Verify'}</button>
                    <button className="btn btn-xs btn-ghost" onClick={() => moderate(p.id, { featured: !p.featured })}>{p.featured ? '★ Unfeature' : '☆ Feature'}</button>
                  </td>
                </tr>
              )) : <tr><td colSpan={7} className="muted small" style={{ padding: '1.4rem' }}>No listings match.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {inspect && (
        <Modal title={inspect.businessName} onClose={() => setInspect(null)} large>
          <dl className="kv">
            <dt>Owner</dt><dd>{inspect.ownerName || '—'}</dd>
            <dt>Category</dt><dd>{inspect.category?.name || '—'}</dd>
            <dt>Area</dt><dd>{inspect.location?.name || '—'}</dd>
            <dt>Phone</dt><dd>{inspect.phone || '—'}{inspect.whatsapp ? ` · WhatsApp ${inspect.whatsapp}` : ''}</dd>
            <dt>Email</dt><dd>{inspect.email || '—'}</dd>
            <dt>Address</dt><dd>{inspect.address || '—'}</dd>
            <dt>Starting price</dt><dd>{money(inspect.priceFrom, inspect.currency)}</dd>
            <dt>Experience</dt><dd>{inspect.yearsExperience} years</dd>
            <dt>Availability</dt><dd>{inspect.availabilityLabel}</dd>
            <dt>Status</dt><dd><Badge status={inspect.status} label={inspect.status} /></dd>
            <dt>Listed</dt><dd>{dateTimeLabel(inspect.createdAt)}</dd>
          </dl>
          <div className="divider" />
          <h4>Description</h4>
          <p className="small" style={{ whiteSpace: 'pre-line' }}>{inspect.description}</p>
          {inspect.services && inspect.services.length > 0 && (
            <>
              <h4>Services</h4>
              <div className="tag-list">{inspect.services.map((s, i) => <span className="tag" key={i}>{s}</span>)}</div>
            </>
          )}
          <div className="divider" />
          <div className="btn-group">
            <Link className="btn btn-sm btn-ghost" href={`/providers/${inspect.id}`} target="_blank" rel="noopener">Open public page</Link>
            <button className="btn btn-sm" onClick={() => setInspect(null)}>Close</button>
          </div>
        </Modal>
      )}

      {reject && (
        <Modal title="Reject service listing" onClose={() => setReject(null)}>
          <p className="small muted">Give the provider a reason. It appears on their listing.</p>
          <label className="field"><span className="lbl">Reason</span>
            <textarea rows={3} value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} />
          </label>
          <div className="form-actions">
            <button className="btn btn-danger" onClick={doReject}>Reject listing</button>
            <button className="btn btn-ghost" onClick={() => setReject(null)}>Cancel</button>
          </div>
        </Modal>
      )}
    </>
  );
}
