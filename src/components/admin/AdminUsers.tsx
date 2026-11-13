'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, ApiError, setQuery, toQuery, useDebounced } from '@/lib/client/api';
import { useUi } from '@/lib/client/ui';
import { dateLabel, initials, roleLabel } from '@/lib/client/format';
import type { AdminUser } from '@/lib/client/types';
import type { AdminMeta } from './meta';
import Badge from '@/components/Badge';
import Modal from '@/components/Modal';
import Spinner from '@/components/Spinner';

const ROLES: [string, string][] = [['', 'All roles'], ['seeker', 'Seekers'], ['employer', 'Employers'], ['provider', 'Providers'], ['admin', 'Admins']];
const STATUSES: [string, string][] = [['', 'Any status'], ['active', 'Active'], ['suspended', 'Suspended']];

export default function AdminUsers({ meta }: { meta: AdminMeta }) {
  const { toast, confirm } = useUi();
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [total, setTotal] = useState(0);
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [creating, setCreating] = useState(false);
  const [resetFor, setResetFor] = useState<AdminUser | null>(null);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    setRole(p.get('role') || '');
    setStatus(p.get('ustatus') || '');
    setQ(p.get('q') || '');
  }, []);

  const load = useCallback(() => {
    api<{ users: AdminUser[]; pagination: { total: number } }>('/admin/users?' + toQuery({ per_page: 50, role, status, q }))
      .then((d) => { setUsers(d.users); setTotal(d.pagination.total); })
      .catch((e) => { toast((e as Error).message, 'err'); setUsers([]); });
  }, [role, status, q, toast]);

  useEffect(() => { load(); }, [load]);

  const debounced = useDebounced((v: string) => { setQ(v); setQuery({ q: v, view: 'users' }); }, 450);

  const patch = async (id: number, body: Record<string, any>) => {
    try { await api('/admin/users/' + id, { method: 'PATCH', body }); toast('User updated'); load(); }
    catch (e) { toast((e as Error).message, 'err'); }
  };

  const suspend = async (u: AdminUser) => {
    if (!(await confirm('Suspend this account? The user will be signed out and cannot log in.', { confirmLabel: 'Suspend', danger: true }))) return;
    patch(u.id, { status: 'suspended' });
  };

  const del = async (u: AdminUser) => {
    if (!(await confirm('Permanently delete this user and all their listings, applications and requests?', { confirmLabel: 'Delete user', danger: true }))) return;
    try { await api('/admin/users/' + u.id, { method: 'DELETE' }); toast('User deleted'); load(); }
    catch (e) { toast((e as Error).message, 'err'); }
  };

  if (!users) return <Spinner />;

  return (
    <>
      <div className="page-head">
        <div><h2>Users</h2><p className="sub">{total} account{total === 1 ? '' : 's'}</p></div>
        <button className="btn" onClick={() => { setEditing(null); setCreating(true); }}>+ Add user</button>
      </div>

      <div className="panel" style={{ marginBottom: '1rem' }}>
        <div className="panel-body row row-wrap">
          <div className="chips">
            {ROLES.map(([v, l]) => (
              <button key={v} className={'chip' + (role === v ? ' active' : '')} onClick={() => { setRole(v); setQuery({ role: v, view: 'users' }); }}>{l}</button>
            ))}
          </div>
          <div className="chips">
            {STATUSES.map(([v, l]) => (
              <button key={v} className={'chip' + (status === v ? ' active' : '')} onClick={() => { setStatus(v); setQuery({ ustatus: v, view: 'users' }); }}>{l}</button>
            ))}
          </div>
          <div className="grow" />
          <input type="search" placeholder="Search name, email, phone…" defaultValue={q} style={{ maxWidth: 280 }} onChange={(e) => debounced(e.target.value)} />
        </div>
      </div>

      <div className="panel">
        <div className="table-wrap">
          <table className="data">
            <thead><tr><th>User</th><th>Role</th><th>Area</th><th>Activity</th><th>Status</th><th>Joined</th><th></th></tr></thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className={u.status === 'suspended' ? 'row-flag' : ''}>
                  <td>
                    <div className="row">
                      <div className="avatar" style={{ width: 30, height: 30, fontSize: '.75rem' }}>{initials(u.name)}</div>
                      <div><b className="small">{u.name}</b><div className="tiny muted">{u.email}{u.phone ? ` · ${u.phone}` : ''}</div></div>
                    </div>
                  </td>
                  <td><Badge status={u.role} label={roleLabel(u.role)} /></td>
                  <td className="small muted">{u.ward || '—'}</td>
                  <td className="tiny muted">
                    {u.jobCount ? `${u.jobCount} jobs · ` : ''}{u.providerCount ? `${u.providerCount} listings · ` : ''}{u.applicationCount ? `${u.applicationCount} applications` : ''}
                    {!u.jobCount && !u.providerCount && !u.applicationCount ? '—' : ''}
                  </td>
                  <td><Badge status={u.status} label={u.status === 'active' ? 'Active' : 'Suspended'} /></td>
                  <td className="small muted nowrap">{dateLabel(u.createdAt)}</td>
                  <td className="actions">
                    <button className="btn btn-xs btn-ghost" onClick={() => { setCreating(false); setEditing(u); }}>Edit</button>
                    <button className="btn btn-xs btn-ghost" onClick={() => setResetFor(u)}>Password</button>
                    {u.status === 'active'
                      ? <button className="btn btn-xs btn-ghost" onClick={() => suspend(u)}>Suspend</button>
                      : <button className="btn btn-xs" onClick={() => patch(u.id, { status: 'active' })}>Activate</button>}
                    <button className="btn btn-xs btn-ghost" onClick={() => del(u)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {(creating || editing) && (
        <UserFormModal user={editing} meta={meta} onClose={() => { setEditing(null); setCreating(false); }}
          onSaved={() => { setEditing(null); setCreating(false); load(); }} />
      )}
      {resetFor && (
        <ResetPasswordModal user={resetFor} onClose={() => setResetFor(null)} />
      )}
    </>
  );
}

function UserFormModal({ user, meta, onClose, onSaved }: { user: AdminUser | null; meta: AdminMeta; onClose: () => void; onSaved: () => void }) {
  const { toast } = useUi();
  const u: Partial<AdminUser> = user || {};
  const [form, setForm] = useState({
    name: u.name || '', email: u.email || '', password: '', role: u.role || 'seeker',
    status: u.status || 'active', ward: u.ward || '', phone: u.phone || '', bio: u.bio || '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    try {
      if (u.id) await api('/admin/users/' + u.id, { method: 'PATCH', body: form });
      else await api('/admin/users', { method: 'POST', body: form });
      toast(u.id ? 'User updated' : 'User created');
      onSaved();
    } catch (err) {
      if (err instanceof ApiError && err.data?.errors) setErrors(err.data.errors);
      else toast((err as Error).message, 'err');
      setBusy(false);
    }
  };

  return (
    <Modal title={u.id ? 'Edit user' : 'Add user'} onClose={onClose}
      footer={
        <div className="form-actions">
          <button className="btn" type="submit" form="user-form" disabled={busy}>{busy ? 'Saving…' : (u.id ? 'Save changes' : 'Create user')}</button>
          <button className="btn btn-ghost" type="button" onClick={onClose}>Cancel</button>
        </div>
      }>
      <form id="user-form" onSubmit={submit}>
        <div className="grid-2">
          <label className="field"><span className="lbl">Full name <span className="req">*</span></span>
            <input type="text" value={form.name} onChange={(e) => set('name', e.target.value)} />
            {errors.name && <span className="field-error">{errors.name}</span>}
          </label>
          <label className="field"><span className="lbl">Email <span className="req">*</span></span>
            <input type="email" value={form.email} disabled={!!u.id} onChange={(e) => set('email', e.target.value)} />
            {errors.email && <span className="field-error">{errors.email}</span>}
          </label>
        </div>
        {!u.id && (
          <label className="field"><span className="lbl">Temporary password <span className="req">*</span></span>
            <input type="text" placeholder="At least 8 characters" value={form.password} onChange={(e) => set('password', e.target.value)} />
            {errors.password && <span className="field-error">{errors.password}</span>}
          </label>
        )}
        <div className="grid-3">
          <label className="field"><span className="lbl">Role</span>
            <select value={form.role} onChange={(e) => set('role', e.target.value)}>
              {['seeker', 'employer', 'provider', 'admin'].map((r) => <option key={r} value={r}>{roleLabel(r)}</option>)}
            </select>
          </label>
          <label className="field"><span className="lbl">Status</span>
            <select value={form.status} onChange={(e) => set('status', e.target.value)}>
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
            </select>
          </label>
          <label className="field"><span className="lbl">Area</span>
            <select value={form.ward} onChange={(e) => set('ward', e.target.value)}>
              <option value="">—</option>
              {meta.locations.map((l) => <option key={l.id} value={l.name}>{l.name}</option>)}
            </select>
          </label>
        </div>
        <label className="field"><span className="lbl">Phone</span>
          <input type="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)} />
        </label>
        <label className="field"><span className="lbl">Bio</span>
          <textarea rows={3} value={form.bio} onChange={(e) => set('bio', e.target.value)} />
        </label>
      </form>
    </Modal>
  );
}

function ResetPasswordModal({ user, onClose }: { user: AdminUser; onClose: () => void }) {
  const { toast } = useUi();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api(`/admin/users/${user.id}/reset-password`, { method: 'POST', body: { password } });
      onClose();
      toast('Password updated');
    } catch (err) {
      if (err instanceof ApiError && err.data?.errors?.password) setError(err.data.errors.password);
      else toast((err as Error).message, 'err');
      setBusy(false);
    }
  };

  return (
    <Modal title={`Reset password: ${user.name}`} onClose={onClose}
      footer={
        <div className="form-actions">
          <button className="btn" type="submit" form="reset-form" disabled={busy}>{busy ? 'Updating…' : 'Update password'}</button>
          <button className="btn btn-ghost" type="button" onClick={onClose}>Cancel</button>
        </div>
      }>
      <p className="small muted">Set a new password for {user.email}. Share it with the user securely.</p>
      <form id="reset-form" onSubmit={submit}>
        <label className="field"><span className="lbl">New password <span className="req">*</span></span>
          <input type="text" placeholder="At least 8 characters" value={password} onChange={(e) => setPassword(e.target.value)} />
          {error && <span className="field-error">{error}</span>}
        </label>
      </form>
    </Modal>
  );
}
