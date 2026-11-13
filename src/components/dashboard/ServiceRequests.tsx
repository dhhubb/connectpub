'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/client/api';
import { useSession, type SessionUser } from '@/lib/client/session';
import { useUi } from '@/lib/client/ui';
import { dateLabel, money, timeAgo } from '@/lib/client/format';
import type { ServiceRequest } from '@/lib/client/types';
import Badge from '@/components/Badge';
import Modal from '@/components/Modal';
import Spinner from '@/components/Spinner';

const CANCELABLE = ['new', 'contacted', 'quoted'];
const MANAGE_OPTIONS: [string, string][] = [['new', 'New'], ['contacted', 'Contacted'], ['quoted', 'Quoted'], ['accepted', 'Accepted'], ['completed', 'Completed'], ['declined', 'Declined']];

export default function ServiceRequests({ user, go }: { user: SessionUser; go: (v: any) => void }) {
  const { toast, confirm } = useUi();
  const isProvider = user.role === 'provider';
  const [requests, setRequests] = useState<ServiceRequest[] | null>(null);
  const [detail, setDetail] = useState<ServiceRequest | null>(null);
  const [manage, setManage] = useState<ServiceRequest | null>(null);

  const load = useCallback(() => {
    const path = '/dashboard/service-requests' + (isProvider ? '' : '?mine=1');
    api<{ requests: ServiceRequest[] }>(path).then((d) => setRequests(d.requests)).catch((e) => { toast((e as Error).message, 'err'); setRequests([]); });
  }, [isProvider, toast]);

  useEffect(() => { load(); }, [load]);

  const cancel = async (id: number) => {
    if (!(await confirm('Cancel this service request?', { confirmLabel: 'Cancel request', danger: true }))) return;
    try {
      await api(`/dashboard/service-requests/${id}`, { method: 'PATCH', body: { status: 'cancelled' } });
      toast('Request cancelled');
      load();
    } catch (err) { toast((err as Error).message, 'err'); }
  };

  if (!requests) return <Spinner />;

  return (
    <>
      <div className="page-head">
        <div>
          <h2>{isProvider ? 'Service requests' : 'My service requests'}</h2>
          <p className="sub">{isProvider ? 'Requests customers sent to your business.' : 'Requests you sent to service providers.'}</p>
        </div>
        <Link className="btn btn-outline" href="/providers">{isProvider ? 'View directory' : 'Find a provider'}</Link>
      </div>

      {requests.length ? (
        <div className="panel">
          <div className="table-wrap">
            <table className="data">
              <thead><tr><th>Service</th><th>{isProvider ? 'Customer' : 'Provider'}</th><th>Budget</th><th>Status</th><th>{isProvider ? 'Received' : 'Sent'}</th><th></th></tr></thead>
              <tbody>
                {requests.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <b>{r.serviceNeeded}</b>
                      {r.preferredDate && <div className="tiny muted">Preferred: {dateLabel(r.preferredDate)}</div>}
                    </td>
                    <td>
                      {isProvider ? r.name : <Link href={`/providers/${r.providerId}`}>{r.businessName}</Link>}
                      <div className="tiny muted">{r.phone}</div>
                    </td>
                    <td className="small">{r.budget ? money(r.budget, 'USD') : '—'}</td>
                    <td><Badge status={r.status} label={r.statusLabel} /></td>
                    <td className="small muted nowrap">{timeAgo(r.createdAt)}</td>
                    <td className="actions">
                      <button className="btn btn-xs btn-ghost" onClick={() => setDetail(r)}>View</button>
                      {isProvider
                        ? <button className="btn btn-xs" onClick={() => setManage(r)}>Manage</button>
                        : CANCELABLE.includes(r.status) && <button className="btn btn-xs btn-ghost" onClick={() => cancel(r.id)}>Cancel</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="empty">
          <span className="icon">🔧</span>
          <b>No service requests {isProvider ? 'received' : 'sent'} yet</b>
          <p>{isProvider ? 'When customers request your services they appear here.' : 'Browse the service directory and send a request.'}</p>
          <Link className="btn" href="/providers">Browse services</Link>
        </div>
      )}

      {detail && (
        <Modal title={detail.serviceNeeded || 'Request'} onClose={() => setDetail(null)}>
          <dl className="kv">
            <dt>{isProvider ? 'Customer' : 'Provider'}</dt><dd>{isProvider ? detail.name : detail.businessName}</dd>
            <dt>Phone</dt><dd>{detail.phone}</dd>
            <dt>Email</dt><dd>{detail.email || '—'}</dd>
            <dt>Preferred date</dt><dd>{detail.preferredDate ? dateLabel(detail.preferredDate) : '—'}</dd>
            <dt>Budget</dt><dd>{detail.budget ? money(detail.budget, 'USD') : '—'}</dd>
            <dt>Status</dt><dd><Badge status={detail.status} label={detail.statusLabel} /></dd>
            <dt>Sent</dt><dd>{dateLabel(detail.createdAt)}</dd>
          </dl>
          <div className="divider" />
          <h4>Details</h4>
          <p className="small" style={{ whiteSpace: 'pre-line' }}>{detail.details || 'No extra details provided.'}</p>
          {detail.response && <div className="alert alert-info" style={{ marginTop: '1rem' }}><b>Provider response:</b> {detail.response}</div>}
        </Modal>
      )}

      {manage && (
        <ManageRequestModal request={manage} onClose={() => setManage(null)}
          onSaved={() => { setManage(null); toast('Request updated'); load(); }} />
      )}
    </>
  );
}

function ManageRequestModal({ request, onClose, onSaved }: { request: ServiceRequest; onClose: () => void; onSaved: () => void }) {
  const { toast } = useUi();
  const [status, setStatus] = useState(request.status);
  const [response, setResponse] = useState(request.response || '');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api(`/dashboard/service-requests/${request.id}`, { method: 'PATCH', body: { status, response } });
      onSaved();
    } catch (err) {
      toast((err as Error).message, 'err');
      setBusy(false);
    }
  };

  return (
    <Modal title={`Manage request: ${request.serviceNeeded}`} onClose={onClose}>
      <form onSubmit={submit}>
        <div className="alert alert-info">Customer <b>{request.name}</b> · {request.phone}{request.email ? ' · ' + request.email : ''}</div>
        <p className="small" style={{ whiteSpace: 'pre-line' }}>{request.details || ''}</p>
        <label className="field"><span className="lbl">Status</span>
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            {MANAGE_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
        <label className="field"><span className="lbl">Your response to the customer</span>
          <textarea rows={4} placeholder="e.g. Quoted USD 250 including materials." value={response} onChange={(e) => setResponse(e.target.value)} />
        </label>
        <div className="form-actions">
          <button className="btn" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
          <button className="btn btn-ghost" type="button" onClick={onClose}>Close</button>
        </div>
      </form>
    </Modal>
  );
}
