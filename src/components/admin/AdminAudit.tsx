'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, setQuery, toQuery } from '@/lib/client/api';
import { useUi } from '@/lib/client/ui';
import { dateTimeLabel } from '@/lib/client/format';
import type { AuditEntry } from '@/lib/client/types';
import Spinner from '@/components/Spinner';

const ENTITIES = ['', 'job', 'provider', 'user', 'application', 'service_request', 'review', 'category', 'location', 'settings'];

export default function AdminAudit() {
  const { toast } = useUi();
  const [entries, setEntries] = useState<AuditEntry[] | null>(null);
  const [total, setTotal] = useState(0);
  const [entity, setEntity] = useState('');

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    setEntity(p.get('entity') || '');
  }, []);

  const load = useCallback(() => {
    api<{ entries: AuditEntry[]; pagination: { total: number } }>('/admin/audit?' + toQuery({ per_page: 80, entity }))
      .then((d) => { setEntries(d.entries); setTotal(d.pagination.total); })
      .catch((e) => { toast((e as Error).message, 'err'); setEntries([]); });
  }, [entity, toast]);

  useEffect(() => { load(); }, [load]);

  if (!entries) return <Spinner />;

  return (
    <>
      <div className="page-head">
        <div><h2>Audit log</h2><p className="sub">{total} recorded action{total === 1 ? '' : 's'}</p></div>
      </div>
      <div className="panel" style={{ marginBottom: '1rem' }}>
        <div className="panel-body chips">
          {ENTITIES.map((en) => (
            <button key={en} className={'chip' + (entity === en ? ' active' : '')}
              onClick={() => { setEntity(en); setQuery({ entity: en, view: 'audit' }); }}>
              {en === '' ? 'All' : en.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>
      <div className="panel">
        <div className="table-wrap">
          <table className="data">
            <thead><tr><th>When</th><th>Actor</th><th>Action</th><th>Entity</th><th>Details</th></tr></thead>
            <tbody>
              {entries.length ? entries.map((a) => (
                <tr key={a.id}>
                  <td className="small muted nowrap">{dateTimeLabel(a.createdAt)}</td>
                  <td className="small">{a.actorName || 'system'}</td>
                  <td><b className="small">{a.action}</b></td>
                  <td className="small muted">{a.entity}{a.entityId ? ` #${a.entityId}` : ''}</td>
                  <td className="tiny mono muted" style={{ maxWidth: 360, overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.details ? JSON.stringify(a.details) : ''}</td>
                </tr>
              )) : <tr><td colSpan={5} className="muted small" style={{ padding: '1.4rem' }}>No entries.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
