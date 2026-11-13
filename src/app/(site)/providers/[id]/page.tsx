'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/client/api';
import { useSession } from '@/lib/client/session';
import { useUi } from '@/lib/client/ui';
import { dateLabel, initials, money } from '@/lib/client/format';
import type { Provider, Review } from '@/lib/client/types';
import Badge from '@/components/Badge';
import Modal from '@/components/Modal';
import Spinner from '@/components/Spinner';
import Stars from '@/components/Stars';

export default function ProviderDetailPage() {
  const params = useParams();
  const id = Number(params.id);
  const { user, ready } = useSession();
  const { toast } = useUi();

  const [provider, setProvider] = useState<Provider | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [myReview, setMyReview] = useState<{ id: number; rating: number; comment: string | null } | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'missing'>('loading');

  const [requestOpen, setRequestOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);

  const load = useCallback(async () => {
    if (!id) { setState('missing'); return; }
    try {
      const data = await api<{ provider: Provider; reviews: Review[]; myReview: { id: number; rating: number; comment: string | null } | null }>('/providers/' + id);
      setProvider(data.provider);
      setReviews(data.reviews);
      setMyReview(data.myReview);
      setState('ready');
    } catch {
      setState('missing');
    }
  }, [id]);

  useEffect(() => { if (ready) load(); }, [ready, load]);

  const toggleSave = async () => {
    if (!user) { window.location.href = '/login?next=' + encodeURIComponent(window.location.pathname); return; }
    try {
      const res = await api<{ saved: boolean }>(`/providers/${id}/save`, { method: 'POST' });
      setProvider((p) => (p ? { ...p, saved: res.saved } : p));
      toast(res.saved ? 'Provider saved' : 'Removed from saved providers');
    } catch (e) { toast((e as Error).message, 'err'); }
  };

  if (state === 'loading') {
    return <main className="container" style={{ padding: '1.8rem 1.15rem 2.6rem' }}><Spinner /></main>;
  }
  if (state === 'missing' || !provider) {
    return (
      <main className="container" style={{ padding: '1.8rem 1.15rem 2.6rem' }}>
        <div className="empty"><span className="icon">🔍</span><b>Provider not found</b><p>This listing may have been removed or is awaiting review.</p><Link className="btn" href="/providers">Back to services</Link></div>
      </main>
    );
  }

  const owner = user && user.id === provider.ownerId;
  const isAdmin = user && user.role === 'admin';
  const approved = provider.status === 'approved';

  let requestBlock;
  if (owner) requestBlock = <div className="alert alert-info">This is your listing. <Link href="/dashboard">Manage it in your dashboard</Link>.</div>;
  else if (isAdmin) requestBlock = <div className="alert alert-info">Administrator view. <Link href="/admin">Moderate in the admin panel</Link>.</div>;
  else if (!approved) requestBlock = <div className="alert alert-warn">This listing is not published yet.</div>;
  else requestBlock = (
    <>
      <button className="btn btn-block" onClick={() => setRequestOpen(true)}>Request a service</button>
      <p className="tiny muted center" style={{ marginTop: '.5rem' }}>Free to send. The provider replies with a quote.</p>
    </>
  );

  return (
    <main className="container" style={{ padding: '1.8rem 1.15rem 2.6rem' }}>
      <nav className="small muted" style={{ marginBottom: '.9rem' }}>
        <Link href="/">Home</Link> › <Link href="/providers">Services</Link> › {provider.businessName}
      </nav>
      <div className="grid-side">
        <div className="stack">
          <div className="card card-pad-lg">
            <div className="row" style={{ alignItems: 'flex-start' }}>
              <div className="thumb thumb-clay" style={{ width: 56, height: 56, fontSize: '1.6rem' }}>{provider.category?.icon || '🔧'}</div>
              <div className="grow">
                <h1 style={{ fontSize: '1.55rem', marginBottom: '.2rem' }}>{provider.businessName}</h1>
                <p className="muted mb0">{provider.tagline || provider.category?.name || 'Local service provider'}</p>
                <div className="row small" style={{ marginTop: '.5rem' }}>
                  {provider.rating
                    ? <><Stars rating={provider.rating} /><b>{provider.rating}</b><span className="muted">({provider.ratingCount} review{provider.ratingCount === 1 ? '' : 's'})</span></>
                    : <span className="muted">No reviews yet</span>}
                </div>
              </div>
              <div className="chips" style={{ flexDirection: 'column', alignItems: 'flex-end' }}>
                {provider.verified && <span className="badge badge-green">✓ Verified</span>}
                {provider.featured && <span className="badge badge-clay">Featured</span>}
                <Badge status={provider.availability} label={provider.availabilityLabel} />
              </div>
            </div>
            {provider.rejectionReason && <div className="alert alert-error" style={{ marginTop: '1rem' }}>Moderator note: {provider.rejectionReason}</div>}
          </div>

          <div className="card">
            <h3>About this provider</h3>
            <div className="prose"><p style={{ whiteSpace: 'pre-line' }}>{provider.description}</p></div>
            {provider.services && provider.services.length > 0 && (
              <>
                <h3 style={{ marginTop: '1.1rem' }}>Services offered</h3>
                <div className="tag-list">{provider.services.map((s, i) => <span className="tag" key={i}>{s}</span>)}</div>
              </>
            )}
          </div>

          <div className="card">
            <div className="card-title">
              <h3>Reviews ({reviews.length})</h3>
              {user && !owner && !isAdmin && approved && (
                <button className="btn btn-sm btn-outline" onClick={() => setReviewOpen(true)}>
                  {myReview ? 'Edit your review' : 'Write a review'}
                </button>
              )}
            </div>
            {reviews.length === 0
              ? <p className="muted small">No reviews yet. Be the first to review this provider.</p>
              : reviews.map((r) => (
                <div key={r.id} style={{ borderBottom: '1px solid var(--line)', padding: '.7rem 0' }}>
                  <div className="spread">
                    <div className="row">
                      <div className="avatar" style={{ width: 32, height: 32, fontSize: '.8rem' }}>{initials(r.userName || '')}</div>
                      <div>
                        <b className="small">{r.userName}</b>
                        {r.userId === user?.id && <span className="badge badge-blue"> You</span>}
                        <div className="tiny muted">{dateLabel(r.createdAt)}</div>
                      </div>
                    </div>
                    <Stars rating={r.rating} />
                  </div>
                  {r.comment && <p className="small" style={{ margin: '.5rem 0 0' }}>{r.comment}</p>}
                </div>
              ))}
          </div>
        </div>

        <aside className="stack sticky-side">
          <div className="card">
            <h3>Contact &amp; request</h3>
            {requestBlock}
            <div className="divider" />
            <dl className="kv">
              <dt>Phone</dt><dd><a href={`tel:${provider.phone || ''}`}>{provider.phone || '—'}</a></dd>
              {provider.whatsapp && <><dt>WhatsApp</dt><dd><a href={`https://wa.me/${String(provider.whatsapp).replace(/[^0-9]/g, '')}`} target="_blank" rel="noopener">{provider.whatsapp}</a></dd></>}
              {provider.email && <><dt>Email</dt><dd>{provider.email}</dd></>}
              {provider.address && <><dt>Address</dt><dd>{provider.address}</dd></>}
            </dl>
          </div>
          <div className="card">
            <h3>Details</h3>
            <dl className="kv">
              <dt>Category</dt><dd>{provider.category?.name || '—'}</dd>
              <dt>Area</dt><dd>{provider.location ? <>{provider.location.name} <span className="tiny muted">({provider.location.kind})</span></> : '—'}</dd>
              <dt>Starting price</dt><dd><b style={{ color: 'var(--clay-700)' }}>{money(provider.priceFrom, provider.currency)}</b></dd>
              <dt>Experience</dt><dd>{provider.yearsExperience} years</dd>
              <dt>Availability</dt><dd>{provider.availabilityLabel}</dd>
              <dt>Listed since</dt><dd>{dateLabel(provider.createdAt)}</dd>
              <dt>Views</dt><dd>{provider.views}</dd>
            </dl>
            <div className="divider" />
            <button className="btn btn-ghost btn-block btn-sm" onClick={toggleSave}>{provider.saved ? '★ Saved' : '☆ Save this provider'}</button>
          </div>
        </aside>
      </div>

      {requestOpen && (
        <RequestModal provider={provider} user={user} onClose={() => setRequestOpen(false)} onSent={(msg) => { setRequestOpen(false); toast(msg); }} />
      )}
      {reviewOpen && (
        <ReviewModal provider={provider} existing={myReview} onClose={() => setReviewOpen(false)} onSaved={() => { setReviewOpen(false); toast('Thank you, your review has been saved'); load(); }} />
      )}
    </main>
  );
}

function RequestModal({ provider, user, onClose, onSent }: { provider: Provider; user: any; onClose: () => void; onSent: (msg: string) => void }) {
  const { toast } = useUi();
  const [form, setForm] = useState({
    name: user?.name || '', phone: user?.phone || '', email: user?.email || '',
    preferredDate: '', serviceNeeded: '', details: '', budget: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    try {
      const res = await api<{ message: string }>(`/providers/${provider.id}/request`, { method: 'POST', body: form });
      onSent(res.message || 'Request sent');
    } catch (err) {
      if (err instanceof ApiError && err.data?.errors) setErrors(err.data.errors);
      else toast((err as Error).message, 'err');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="Request a service" onClose={onClose}>
      <div className="alert alert-info">Sending a request to <b>{provider.businessName}</b>. They will contact you with a quote.</div>
      <form onSubmit={submit}>
        <div className="grid-2">
          <label className="field"><span className="lbl">Your name <span className="req">*</span></span>
            <input type="text" value={form.name} onChange={(e) => set('name', e.target.value)} />
            {errors.name && <span className="field-error">{errors.name}</span>}
          </label>
          <label className="field"><span className="lbl">Phone <span className="req">*</span></span>
            <input type="tel" placeholder="+263…" value={form.phone} onChange={(e) => set('phone', e.target.value)} />
            {errors.phone && <span className="field-error">{errors.phone}</span>}
          </label>
        </div>
        <div className="grid-2">
          <label className="field"><span className="lbl">Email</span>
            <input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} />
          </label>
          <label className="field"><span className="lbl">Preferred date</span>
            <input type="date" value={form.preferredDate} onChange={(e) => set('preferredDate', e.target.value)} />
          </label>
        </div>
        <label className="field"><span className="lbl">Service needed <span className="req">*</span></span>
          <input type="text" list="service-options" placeholder="e.g. Borehole drilling" value={form.serviceNeeded} onChange={(e) => set('serviceNeeded', e.target.value)} />
          <datalist id="service-options">{(provider.services || []).map((s, i) => <option key={i} value={s} />)}</datalist>
          {errors.serviceNeeded && <span className="field-error">{errors.serviceNeeded}</span>}
        </label>
        <label className="field"><span className="lbl">Details</span>
          <textarea rows={4} placeholder="Describe the job, location and timing…" value={form.details} onChange={(e) => set('details', e.target.value)} />
        </label>
        <label className="field"><span className="lbl">Budget (USD)</span>
          <input type="number" min={0} step={10} placeholder="Optional" value={form.budget} onChange={(e) => set('budget', e.target.value)} />
        </label>
        <div className="form-actions">
          <button className="btn" type="submit" disabled={busy}>{busy ? 'Sending…' : 'Send request'}</button>
          <button className="btn btn-ghost" type="button" onClick={onClose}>Cancel</button>
        </div>
      </form>
    </Modal>
  );
}

function ReviewModal({ provider, existing, onClose, onSaved }: { provider: Provider; existing: { rating: number; comment: string | null } | null; onClose: () => void; onSaved: () => void }) {
  const { toast } = useUi();
  const [rating, setRating] = useState(existing?.rating || 5);
  const [comment, setComment] = useState(existing?.comment || '');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api(`/providers/${provider.id}/reviews`, { method: 'POST', body: { rating, comment } });
      onSaved();
    } catch (err) {
      toast((err as Error).message, 'err');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={`Review ${provider.businessName}`} onClose={onClose}>
      <form onSubmit={submit}>
        <label className="field"><span className="lbl">Rating <span className="req">*</span></span>
          <select value={rating} onChange={(e) => setRating(Number(e.target.value))}>
            {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{'★'.repeat(n)} {n} star{n === 1 ? '' : 's'}</option>)}
          </select>
        </label>
        <label className="field"><span className="lbl">Your review</span>
          <textarea rows={4} placeholder="How was the work, the price and the service?" value={comment} onChange={(e) => setComment(e.target.value)} />
        </label>
        <div className="form-actions">
          <button className="btn" type="submit" disabled={busy}>{busy ? 'Saving…' : (existing ? 'Update review' : 'Post review')}</button>
          <button className="btn btn-ghost" type="button" onClick={onClose}>Cancel</button>
        </div>
      </form>
    </Modal>
  );
}
