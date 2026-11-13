'use client';

import Link from 'next/link';
import { useState } from 'react';
import { api } from '@/lib/client/api';
import { useSession } from '@/lib/client/session';
import { useUi } from '@/lib/client/ui';

const DEMO = [
  ['Administrator', 'admin@plumtreeconnect.co.zw', 'admin1234'],
  ['Job seeker', 'thandiwe@example.com', 'seeker1234'],
  ['Employer', 'hr@plumtreeagro.co.zw', 'employer1234'],
  ['Service provider', 'info@tshitshiboreholes.co.zw', 'provider1234'],
];

export default function LoginPage() {
  const { setSession } = useSession();
  const { toast } = useUi();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const { token, user } = await api<{ token: string; user: any }>('/auth/login', { method: 'POST', body: { email, password } });
      setSession(token, user);
      toast(`Welcome back, ${String(user.name).split(' ')[0]}`);
      const next = new URLSearchParams(window.location.search).get('next');
      const fallback = user.role === 'admin' ? '/admin' : '/dashboard';
      window.location.href = next && next.startsWith('/') ? next : fallback;
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  return (
    <main className="container" style={{ padding: '2.4rem 1.15rem 3rem' }}>
      <div style={{ maxWidth: 440, margin: '0 auto' }}>
        <div className="card card-pad-lg">
          <p className="eyebrow">Welcome back</p>
          <h1 style={{ fontSize: '1.5rem' }}>Sign in to Plumtree Connect</h1>
          <p className="muted small">Access your dashboard, applications and service requests.</p>
          {error && <div className="alert alert-error">{error}</div>}
          <form onSubmit={submit}>
            <label className="field">
              <span className="lbl">Email address <span className="req">*</span></span>
              <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
            <label className="field">
              <span className="lbl">Password <span className="req">*</span></span>
              <input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
            </label>
            <button className="btn btn-block" type="submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
          </form>
          <p className="small center" style={{ marginTop: '1rem' }}>New here? <Link href="/register">Create an account</Link></p>
        </div>

        <div className="card" style={{ marginTop: '1rem' }}>
          <h3 style={{ fontSize: '.95rem' }}>Demo accounts</h3>
          <p className="tiny muted">Sample data is preloaded. Use any of these to explore each role.</p>
          <div className="table-wrap">
            <table className="data">
              <thead><tr><th>Role</th><th>Email</th><th>Password</th></tr></thead>
              <tbody>
                {DEMO.map(([role, mail, pass]) => (
                  <tr key={mail}><td>{role}</td><td className="mono">{mail}</td><td className="mono">{pass}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="btn-group" style={{ marginTop: '.7rem' }}>
            {DEMO.map(([role, mail, pass]) => (
              <button key={mail} className="btn btn-xs btn-ghost" onClick={() => { setEmail(mail); setPassword(pass); }}>
                Fill {role.split(' ')[0].toLowerCase()}
              </button>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
