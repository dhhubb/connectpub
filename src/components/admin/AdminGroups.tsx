'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/client/api';
import { useUi } from '@/lib/client/ui';
import type { AdminGroup } from '@/lib/client/types';
import Modal from '@/components/Modal';
import Spinner from '@/components/Spinner';

const SCOPE_LABEL: Record<string, string> = { job: 'Jobs only', service: 'Services only', both: 'Jobs & services' };

export default function AdminGroups({ reloadMeta }: { reloadMeta: () => Promise<void> }) {
  const { toast, confirm } = useUi();
  const [groups, setGroups] = useState<AdminGroup[] | null>(null);
  const [editing, setEditing] = useState<AdminGroup | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(() => {
    api<{ groups: AdminGroup[] }>('/admin/groups')
      .then((d) => setGroups(d.groups))
      .catch((e) => { toast((e as Error).message, 'err'); setGroups([]); });
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const del = async (g: AdminGroup) => {
    if (!(await confirm('Delete this industry group?', { confirmLabel: 'Delete', danger: true }))) return;
    try { await api('/admin/groups/' + g.id, { method: 'DELETE' }); toast('Group deleted'); load(); reloadMeta(); }
    catch (e) { toast((e as Error).message, 'err'); }
  };

  if (!groups) return <Spinner />;

  return (
    <>
      <div className="page-head">
        <div><h2>Industry groups</h2><p className="sub">Groupings that organise categories into browsable industries on the public site.</p></div>
        <button className="btn" onClick={() => { setEditing(null); setCreating(true); }}>+ Add group</button>
      </div>
      <div className="panel">
        <div className="table-wrap">
          <table className="data">
            <thead><tr><th>Group</th><th>Scope</th><th>Categories</th><th>Listings</th><th></th></tr></thead>
            <tbody>
              {groups.map((g) => (
                <tr key={g.id}>
                  <td>
                    <b>{g.icon || '🏷️'} {g.name}</b>
                    <div className="tiny muted mono">{g.slug}</div>
                    <div className="tiny muted">{g.description || ''}</div>
                  </td>
                  <td className="small"><span className="badge badge-plain">{SCOPE_LABEL[g.scope] || g.scope}</span></td>
                  <td className="small">{g.categoryCount}</td>
                  <td className="small">{g.jobCount} jobs · {g.providerCount} providers</td>
                  <td className="actions">
                    <button className="btn btn-xs btn-ghost" onClick={() => { setCreating(false); setEditing(g); }}>Edit</button>
                    <button className="btn btn-xs btn-ghost" onClick={() => del(g)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {(creating || editing) && (
        <GroupFormModal group={editing} onClose={() => { setEditing(null); setCreating(false); }}
          onSaved={() => { setEditing(null); setCreating(false); load(); reloadMeta(); }} />
      )}
    </>
  );
}

function GroupFormModal({ group, onClose, onSaved }: { group: AdminGroup | null; onClose: () => void; onSaved: () => void }) {
  const { toast } = useUi();
  const g: Partial<AdminGroup> = group || {};
  const [form, setForm] = useState({ name: g.name || '', scope: g.scope || 'both', icon: g.icon || '🏷️', description: g.description || '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    try {
      if (g.id) await api('/admin/groups/' + g.id, { method: 'PATCH', body: form });
      else await api('/admin/groups', { method: 'POST', body: form });
      toast('Group saved');
      onSaved();
    } catch (err) {
      if (err instanceof ApiError && err.data?.errors) setErrors(err.data.errors);
      else toast((err as Error).message, 'err');
      setBusy(false);
    }
  };

  return (
    <Modal title={g.id ? 'Edit industry group' : 'Add industry group'} onClose={onClose}
      footer={
        <div className="form-actions">
          <button className="btn" type="submit" form="group-form" disabled={busy}>{busy ? 'Saving…' : (g.id ? 'Save changes' : 'Create group')}</button>
          <button className="btn btn-ghost" type="button" onClick={onClose}>Cancel</button>
        </div>
      }>
      <form id="group-form" onSubmit={submit}>
        <label className="field"><span className="lbl">Name <span className="req">*</span></span>
          <input type="text" value={form.name} onChange={(e) => set('name', e.target.value)} />
          {errors.name && <span className="field-error">{errors.name}</span>}
        </label>
        <div className="grid-2">
          <label className="field"><span className="lbl">Scope</span>
            <select value={form.scope} onChange={(e) => set('scope', e.target.value)}>
              <option value="both">Jobs &amp; services</option>
              <option value="job">Jobs only</option>
              <option value="service">Services only</option>
            </select>
          </label>
          <label className="field"><span className="lbl">Icon (emoji)</span>
            <input type="text" maxLength={4} value={form.icon} onChange={(e) => set('icon', e.target.value)} />
          </label>
        </div>
        <label className="field"><span className="lbl">Description</span>
          <textarea rows={3} value={form.description} onChange={(e) => set('description', e.target.value)} />
        </label>
      </form>
    </Modal>
  );
}
