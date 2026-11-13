'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api } from '@/lib/client/api';
import { useUi } from '@/lib/client/ui';
import Spinner from '@/components/Spinner';

export default function AdminSettings() {
  const { toast } = useUi();
  const [form, setForm] = useState<Record<string, string> | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<{ settings: Record<string, string> }>('/admin/settings')
      .then((d) => setForm(d.settings))
      .catch((e) => { toast((e as Error).message, 'err'); setForm({}); });
  }, [toast]);

  if (!form) return <Spinner />;

  const set = (k: string, v: string) => setForm((f) => ({ ...(f || {}), [k]: v }));
  const checked = (k: string) => form[k] === 'true';

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setSaved(false);
    try {
      const res = await api<{ message: string }>('/admin/settings', { method: 'PATCH', body: form });
      toast(res.message || 'Saved');
      setSaved(true);
    } catch (err) { toast((err as Error).message, 'err'); }
    finally { setBusy(false); }
  };

  return (
    <>
      <div className="page-head">
        <div><h2>Settings</h2><p className="sub">Platform identity and moderation behaviour</p></div>
      </div>
      <div className="grid-side">
        <div className="card">
          <h3>General</h3>
          {saved && <div className="alert alert-ok">Settings saved.</div>}
          <form onSubmit={submit}>
            <div className="grid-2">
              <label className="field"><span className="lbl">Site name</span>
                <input type="text" value={form.site_name || ''} onChange={(e) => set('site_name', e.target.value)} />
              </label>
              <label className="field"><span className="lbl">Province</span>
                <input type="text" value={form.province || ''} onChange={(e) => set('province', e.target.value)} />
              </label>
            </div>
            <div className="grid-2">
              <label className="field"><span className="lbl">Town</span>
                <input type="text" value={form.town || ''} onChange={(e) => set('town', e.target.value)} />
              </label>
              <label className="field"><span className="lbl">Contact email</span>
                <input type="email" value={form.contact_email || ''} onChange={(e) => set('contact_email', e.target.value)} />
              </label>
            </div>
            <div className="divider" />
            <h3>Moderation</h3>
            <label className="field row" style={{ gap: '.5rem', alignItems: 'center' }}>
              <input type="checkbox" style={{ width: 'auto' }} checked={checked('auto_approve_jobs')} onChange={(e) => set('auto_approve_jobs', e.target.checked ? 'true' : 'false')} />
              <span className="lbl" style={{ margin: 0 }}>Auto-approve new job listings</span>
            </label>
            <label className="field row" style={{ gap: '.5rem', alignItems: 'center' }}>
              <input type="checkbox" style={{ width: 'auto' }} checked={checked('auto_approve_providers')} onChange={(e) => set('auto_approve_providers', e.target.checked ? 'true' : 'false')} />
              <span className="lbl" style={{ margin: 0 }}>Auto-approve new service listings</span>
            </label>
            <p className="tiny muted">When off (recommended), new listings wait for an administrator to approve them.</p>
            <div className="form-actions">
              <button className="btn" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save settings'}</button>
            </div>
          </form>
        </div>
        <div className="stack">
          <div className="card">
            <h3>Platform</h3>
            <dl className="kv">
              <dt>Coverage</dt><dd>Plumtree town and the wards of Bulilima, Mangwe, Tshitshi, Matjinge, Empandeni</dd>
              <dt>Currency</dt><dd>USD (listings)</dd>
              <dt>API</dt><dd><Link href="/api/health" target="_blank" rel="noopener">/api/health</Link></dd>
            </dl>
          </div>
          <div className="card">
            <h3>Moderation policy</h3>
            <ul className="list-check">
              <li>Approve listings with a clear description and contact details.</li>
              <li>Reject duplicate, misleading or unsafe listings with a reason.</li>
              <li>Verify providers you have confirmed are genuine local businesses.</li>
              <li>Hide reviews that are abusive or clearly fake.</li>
            </ul>
          </div>
        </div>
      </div>
    </>
  );
}
