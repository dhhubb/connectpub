'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/client/api';
import { useUi } from '@/lib/client/ui';
import { money, timeAgo } from '@/lib/client/format';
import type { ServiceRequest } from '@/lib/client/types';
import Badge from '@/components/Badge';
import Spinner from '@/components/Spinner';

export default function AdminRequests() {
  const { toast } = useUi();
  const [requests, setRequests] = useState<ServiceRequest[] | null>(null);

  useEffect(() => {
    api<{ requests: ServiceRequest[] }>('/admin/service-requests')
      .then((d) => setRequests(d.requests))
      .catch((e) => { toast((e as Error).message, 'err'); setRequests([]); });
  }, [toast]);

  if (!requests) return <Spinner />;

  return (
    <>
      <div className="page-head">
        <div><h2>Service requests</h2><p className="sub">Latest {requests.length} request{requests.length === 1 ? '' : 's'}</p></div>
      </div>
      <div className="panel">
        <div className="table-wrap">
          <table className="data">
            <thead><tr><th>Service</th><th>Provider</th><th>Customer</th><th>Budget</th><th>Status</th><th>Sent</th></tr></thead>
            <tbody>
              {requests.length ? requests.map((r) => (
                <tr key={r.id}>
                  <td><b className="small">{r.serviceNeeded}</b></td>
                  <td className="small">{r.businessName}</td>
                  <td className="small">{r.name}<div className="tiny muted">{r.phone}</div></td>
                  <td className="small">{r.budget ? money(r.budget, 'USD') : '—'}</td>
                  <td><Badge status={r.status} label={r.statusLabel} /></td>
                  <td className="small muted nowrap">{timeAgo(r.createdAt)}</td>
                </tr>
              )) : <tr><td colSpan={6} className="muted small" style={{ padding: '1.4rem' }}>No service requests yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
