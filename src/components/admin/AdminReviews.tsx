'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/client/api';
import { useUi } from '@/lib/client/ui';
import { timeAgo } from '@/lib/client/format';
import type { AdminReview } from '@/lib/client/types';
import Badge from '@/components/Badge';
import Spinner from '@/components/Spinner';

export default function AdminReviews() {
  const { toast, confirm } = useUi();
  const [reviews, setReviews] = useState<AdminReview[] | null>(null);

  const load = useCallback(() => {
    api<{ reviews: AdminReview[] }>('/admin/reviews')
      .then((d) => setReviews(d.reviews))
      .catch((e) => { toast((e as Error).message, 'err'); setReviews([]); });
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const toggle = async (r: AdminReview) => {
    try {
      await api('/admin/reviews/' + r.id, { method: 'PATCH', body: { status: r.status === 'published' ? 'hidden' : 'published' } });
      toast('Review updated');
      load();
    } catch (e) { toast((e as Error).message, 'err'); }
  };

  const del = async (r: AdminReview) => {
    if (!(await confirm('Delete this review permanently?', { confirmLabel: 'Delete', danger: true }))) return;
    try { await api('/admin/reviews/' + r.id, { method: 'DELETE' }); toast('Review deleted'); load(); }
    catch (e) { toast((e as Error).message, 'err'); }
  };

  if (!reviews) return <Spinner />;

  return (
    <>
      <div className="page-head">
        <div><h2>Reviews</h2><p className="sub">{reviews.length} review{reviews.length === 1 ? '' : 's'} · hide abusive or fake reviews</p></div>
      </div>
      <div className="panel">
        <div className="table-wrap">
          <table className="data">
            <thead><tr><th>Provider</th><th>Reviewer</th><th>Rating</th><th>Comment</th><th>Status</th><th>When</th><th></th></tr></thead>
            <tbody>
              {reviews.length ? reviews.map((r) => (
                <tr key={r.id}>
                  <td className="small"><Link href={`/providers/${r.providerId}`}>{r.businessName}</Link></td>
                  <td className="small">{r.userName}</td>
                  <td className="small nowrap">{'★'.repeat(r.rating)}<span className="muted">{'★'.repeat(5 - r.rating)}</span></td>
                  <td className="small muted" style={{ maxWidth: 320 }}>{(r.comment || '').slice(0, 110)}{(r.comment || '').length > 110 ? '…' : ''}</td>
                  <td><Badge status={r.status} label={r.status === 'published' ? 'Published' : 'Hidden'} /></td>
                  <td className="small muted nowrap">{timeAgo(r.createdAt)}</td>
                  <td className="actions">
                    <button className="btn btn-xs btn-ghost" onClick={() => toggle(r)}>{r.status === 'published' ? 'Hide' : 'Publish'}</button>
                    <button className="btn btn-xs btn-ghost" onClick={() => del(r)}>Delete</button>
                  </td>
                </tr>
              )) : <tr><td colSpan={7} className="muted small" style={{ padding: '1.4rem' }}>No reviews yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
