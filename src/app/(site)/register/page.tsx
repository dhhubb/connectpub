'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/client/api';
import { useSession } from '@/lib/client/session';
import { useUi } from '@/lib/client/ui';
import type { Location } from '@/lib/client/types';

const BENEFITS: Record<string, string[]> = {
  seeker: [
    'Apply for local jobs in one click',
    'Track every application from submitted to hired',
    'Save jobs and providers for later',
    'Get a public profile employers can view',
  ],
  employer: [
    'Post vacancies to the local job board',
    'Review and shortlist applicants in a dashboard',
    'Move candidates through interview to hired',
    'See views and applicant counts per listing',
  ],
  provider: [
    'Publish your business in the service directory',
    'Receive service requests from customers',
    'Collect star ratings and reviews',
    'Show your experience, prices and availability',
  ],
};

export default function RegisterPage() {
  const { setSession } = useSession();
  const { toast } = useUi();
  const [role, setRole] = useState<'seeker' | 'employer' | 'provider'>('seeker');
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', ward: '', bio: '' });
  const [locations, setLocations] = useState<Location[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<{ locations: Location[] }>('/meta/locations').then((d) => setLocations(d.locations)).catch(() => {});
  }, []);

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    setError('');
    try {
      const { token, user } = await api<{ token: string; user: any }>('/auth/register', { method: 'POST', body: { ...form, role } });
      setSession(token, user);
      toast('Account created. Welcome to Plumtree Connect!');
      window.location.href = '/dashboard';
    } catch (err) {
      if (err instanceof ApiError && err.data?.errors) setErrors(err.data.errors);
      setError((err as Error).message);
      setBusy(false);
    }
  };

  return (
    <main className="container" style={{ padding: '2.4rem 1.15rem 3rem' }}>
      <div className="grid-side grid-register" style={{ maxWidth: 1000, margin: '0 auto' }}>
        <div className="card card-pad-lg">
          <p className="eyebrow">Get started</p>
          <h1 style={{ fontSize: '1.5rem' }}>Create your free account</h1>
          <p className="muted small">Choose the account type that fits you. You can browse jobs and services either way.</p>
          {error && <div className="alert alert-error">{error}</div>}
          <form onSubmit={submit}>
            <div className="filter-group">
              <span className="lbl">I am registering as <span className="req">*</span></span>
              <div className="grid-3">
                {([['seeker', '🧑‍🌾', 'Job seeker', 'Find and apply for work'],
                   ['employer', '🏢', 'Employer', 'Post vacancies'],
                   ['provider', '🔧', 'Service provider', 'List your business']] as const).map(([value, icon, title, sub]) => (
                  <label key={value} className="feature-tile" style={{ cursor: 'pointer', textAlign: 'center' }}>
                    <input type="radio" name="role" value={value} checked={role === value} style={{ width: 'auto' }} onChange={() => setRole(value)} />
                    <div className="ic">{icon}</div><b className="small">{title}</b><div className="tiny muted">{sub}</div>
                  </label>
                ))}
              </div>
            </div>
            <label className="field">
              <span className="lbl">Full name <span className="req">*</span></span>
              <input type="text" autoComplete="name" required value={form.name} onChange={(e) => set('name', e.target.value)} />
              {errors.name && <span className="field-error">{errors.name}</span>}
            </label>
            <div className="grid-2">
              <label className="field">
                <span className="lbl">Email address <span className="req">*</span></span>
                <input type="email" autoComplete="email" required value={form.email} onChange={(e) => set('email', e.target.value)} />
                {errors.email && <span className="field-error">{errors.email}</span>}
              </label>
              <label className="field">
                <span className="lbl">Phone number</span>
                <input type="tel" placeholder="+263…" autoComplete="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)} />
              </label>
            </div>
            <div className="grid-2">
              <label className="field">
                <span className="lbl">Password <span className="req">*</span></span>
                <input type="password" autoComplete="new-password" required value={form.password} onChange={(e) => set('password', e.target.value)} />
                <span className="tiny muted">At least 8 characters.</span>
                {errors.password && <span className="field-error">{errors.password}</span>}
              </label>
              <label className="field">
                <span className="lbl">Ward or area</span>
                <select value={form.ward} onChange={(e) => set('ward', e.target.value)}>
                  <option value="">Select your area</option>
                  {locations.map((l) => <option key={l.id} value={l.name}>{l.name}</option>)}
                </select>
              </label>
            </div>
            <label className="field">
              <span className="lbl">Short profile</span>
              <textarea rows={3} placeholder="Tell employers or customers a little about yourself." value={form.bio} onChange={(e) => set('bio', e.target.value)} />
            </label>
            <button className="btn btn-block" type="submit" disabled={busy}>{busy ? 'Creating account…' : 'Create account'}</button>
            <p className="tiny muted center" style={{ marginTop: '.7rem' }}>By registering you agree to keep listings honest and respectful.</p>
          </form>
          <p className="small center" style={{ marginTop: '1rem' }}>Already have an account? <Link href="/login">Sign in</Link></p>
        </div>

        <aside className="stack">
          <div className="card">
            <h3>What you get</h3>
            <ul className="list-check">{BENEFITS[role].map((b, i) => <li key={i}>{b}</li>)}</ul>
          </div>
          <div className="card">
            <h3>Built for the district</h3>
            <p className="small muted mb0">Plumtree Connect covers Plumtree town and the wards of Bulilima, Mangwe, Tshitshi, Matjinge, Empandeni and neighbouring areas. Listings are reviewed by an administrator before they go live.</p>
          </div>
        </aside>
      </div>
    </main>
  );
}
