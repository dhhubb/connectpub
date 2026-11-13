'use client';

import { useState } from 'react';
import { api, ApiError, type SessionUser } from '@/lib/client/api';
import { useSession } from '@/lib/client/session';
import { useUi } from '@/lib/client/ui';
import { dateLabel, roleLabel, timeAgo } from '@/lib/client/format';
import type { DashboardMeta } from './meta';
import Badge from '@/components/Badge';

export default function Profile({ user, meta }: { user: SessionUser; meta: DashboardMeta }) {
  const { setSession, token } = useSession();
  const { toast } = useUi();
  const [profile, setProfile] = useState({ name: user.name, phone: user.phone || '', ward: user.ward || '', bio: user.bio || '' });
  const [profileErrors, setProfileErrors] = useState<Record<string, string>>({});
  const [profileBusy, setProfileBusy] = useState(false);

  const [pw, setPw] = useState({ currentPassword: '', newPassword: '' });
  const [pwErrors, setPwErrors] = useState<Record<string, string>>({});
  const [pwBusy, setPwBusy] = useState(false);

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileBusy(true);
    setProfileErrors({});
    try {
      const { user: updated } = await api<{ user: SessionUser }>('/auth/me', { method: 'PATCH', body: profile });
      setSession(token, updated);
      toast('Profile updated');
    } catch (err) {
      if (err instanceof ApiError && err.data?.errors) setProfileErrors(err.data.errors);
      else toast((err as Error).message, 'err');
    } finally { setProfileBusy(false); }
  };

  const savePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwBusy(true);
    setPwErrors({});
    try {
      await api('/auth/change-password', { method: 'POST', body: pw });
      setPw({ currentPassword: '', newPassword: '' });
      toast('Password updated');
    } catch (err) {
      if (err instanceof ApiError && err.data?.errors) setPwErrors(err.data.errors);
      else toast((err as Error).message, 'err');
    } finally { setPwBusy(false); }
  };

  return (
    <>
      <div className="page-head">
        <div><h2>My profile</h2><p className="sub">Keep your details up to date — they are used on applications and listings.</p></div>
      </div>
      <div className="grid-side">
        <div className="card">
          <h3>Account details</h3>
          <form onSubmit={saveProfile}>
            <label className="field"><span className="lbl">Full name</span>
              <input type="text" value={profile.name} onChange={(e) => setProfile((p) => ({ ...p, name: e.target.value }))} />
              {profileErrors.name && <span className="field-error">{profileErrors.name}</span>}
            </label>
            <label className="field"><span className="lbl">Email</span>
              <input type="email" value={user.email} disabled />
            </label>
            <div className="grid-2">
              <label className="field"><span className="lbl">Phone</span>
                <input type="tel" value={profile.phone} onChange={(e) => setProfile((p) => ({ ...p, phone: e.target.value }))} />
              </label>
              <label className="field"><span className="lbl">Ward / area</span>
                <select value={profile.ward} onChange={(e) => setProfile((p) => ({ ...p, ward: e.target.value }))}>
                  <option value="">Select area</option>
                  {meta.locations.map((l) => <option key={l.id} value={l.name}>{l.name}</option>)}
                </select>
              </label>
            </div>
            <label className="field"><span className="lbl">Short profile</span>
              <textarea rows={4} value={profile.bio} onChange={(e) => setProfile((p) => ({ ...p, bio: e.target.value }))} />
            </label>
            <div className="form-actions">
              <button className="btn" type="submit" disabled={profileBusy}>{profileBusy ? 'Saving…' : 'Save changes'}</button>
            </div>
          </form>
        </div>

        <div className="stack">
          <div className="card">
            <h3>Account</h3>
            <dl className="kv">
              <dt>Role</dt><dd>{roleLabel(user.role)}</dd>
              <dt>Status</dt><dd><Badge status={user.status} label={user.status === 'active' ? 'Active' : 'Suspended'} /></dd>
              <dt>Member since</dt><dd>{dateLabel(user.createdAt)}</dd>
              <dt>Last sign in</dt><dd>{user.lastLoginAt ? timeAgo(user.lastLoginAt) : '—'}</dd>
            </dl>
          </div>
          <div className="card">
            <h3>Change password</h3>
            <form onSubmit={savePassword}>
              <label className="field"><span className="lbl">Current password</span>
                <input type="password" autoComplete="current-password" value={pw.currentPassword} onChange={(e) => setPw((p) => ({ ...p, currentPassword: e.target.value }))} />
                {pwErrors.currentPassword && <span className="field-error">{pwErrors.currentPassword}</span>}
              </label>
              <label className="field"><span className="lbl">New password</span>
                <input type="password" autoComplete="new-password" value={pw.newPassword} onChange={(e) => setPw((p) => ({ ...p, newPassword: e.target.value }))} />
                {pwErrors.newPassword && <span className="field-error">{pwErrors.newPassword}</span>}
              </label>
              <button className="btn btn-outline btn-block" type="submit" disabled={pwBusy}>{pwBusy ? 'Updating…' : 'Update password'}</button>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}
