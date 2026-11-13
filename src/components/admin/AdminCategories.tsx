'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/client/api';
import { useUi } from '@/lib/client/ui';
import type { Category } from '@/lib/client/types';
import type { AdminMeta } from './meta';
import Modal from '@/components/Modal';
import Spinner from '@/components/Spinner';

export default function AdminCategories({ meta, reloadMeta }: { meta: AdminMeta; reloadMeta: () => Promise<void> }) {
  const { toast, confirm } = useUi();
  const [categories, setCategories] = useState<Category[] | null>(null);
  const [editing, setEditing] = useState<Category | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(() => {
    api<{ categories: Category[] }>('/admin/categories')
      .then((d) => setCategories(d.categories))
      .catch((e) => { toast((e as Error).message, 'err'); setCategories([]); });
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const del = async (c: Category) => {
    if (!(await confirm('Delete this category?', { confirmLabel: 'Delete', danger: true }))) return;
    try { await api('/admin/categories/' + c.id, { method: 'DELETE' }); toast('Category deleted'); load(); reloadMeta(); }
    catch (e) { toast((e as Error).message, 'err'); }
  };

  if (!categories) return <Spinner />;

  const job = categories.filter((c) => c.kind === 'job');
  const service = categories.filter((c) => c.kind === 'service');

  const table = (rows: Category[]) => (
    <div className="table-wrap">
      <table className="data">
        <thead><tr><th>Category</th><th>Industry</th><th>Description</th><th>Listings</th><th></th></tr></thead>
        <tbody>
          {rows.map((c) => (
            <tr key={c.id}>
              <td><b>{c.icon || ''} {c.name}</b><div className="tiny muted mono">{c.slug}</div></td>
              <td className="small">{c.group ? `${c.group.icon || ''} ${c.group.name}` : <span className="badge badge-amber">Unassigned</span>}</td>
              <td className="small muted">{c.description || '—'}</td>
              <td className="small">{c.kind === 'job' ? `${c.jobCount} jobs` : `${c.providerCount} providers`}</td>
              <td className="actions">
                <button className="btn btn-xs btn-ghost" onClick={() => { setCreating(false); setEditing(c); }}>Edit</button>
                <button className="btn btn-xs btn-ghost" onClick={() => del(c)}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <>
      <div className="page-head">
        <div><h2>Categories</h2><p className="sub">{job.length} job categories and {service.length} service categories</p></div>
        <button className="btn" onClick={() => { setEditing(null); setCreating(true); }}>+ Add category</button>
      </div>
      <div className="panel" style={{ marginBottom: '1.2rem' }}>
        <div className="panel-head"><b>Job categories</b></div>
        {table(job)}
      </div>
      <div className="panel">
        <div className="panel-head"><b>Service categories</b></div>
        {table(service)}
      </div>

      {(creating || editing) && (
        <CategoryFormModal category={editing} meta={meta} onClose={() => { setEditing(null); setCreating(false); }}
          onSaved={() => { setEditing(null); setCreating(false); load(); reloadMeta(); }} />
      )}
    </>
  );
}

function CategoryFormModal({ category, meta, onClose, onSaved }: { category: Category | null; meta: AdminMeta; onClose: () => void; onSaved: () => void }) {
  const { toast } = useUi();
  const c: Partial<Category> = category || {};
  const [form, setForm] = useState({
    name: c.name || '', kind: c.kind || 'job', group_id: c.group?.id ? String(c.group.id) : '',
    icon: c.icon || '📌', description: c.description || '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    try {
      if (c.id) await api('/admin/categories/' + c.id, { method: 'PATCH', body: form });
      else await api('/admin/categories', { method: 'POST', body: form });
      toast('Category saved');
      onSaved();
    } catch (err) {
      if (err instanceof ApiError && err.data?.errors) setErrors(err.data.errors);
      else toast((err as Error).message, 'err');
      setBusy(false);
    }
  };

  return (
    <Modal title={c.id ? 'Edit category' : 'Add category'} onClose={onClose}
      footer={
        <div className="form-actions">
          <button className="btn" type="submit" form="cat-form" disabled={busy}>{busy ? 'Saving…' : (c.id ? 'Save changes' : 'Create category')}</button>
          <button className="btn btn-ghost" type="button" onClick={onClose}>Cancel</button>
        </div>
      }>
      <form id="cat-form" onSubmit={submit}>
        <div className="grid-2">
          <label className="field"><span className="lbl">Name <span className="req">*</span></span>
            <input type="text" value={form.name} onChange={(e) => set('name', e.target.value)} />
            {errors.name && <span className="field-error">{errors.name}</span>}
          </label>
          <label className="field"><span className="lbl">Type</span>
            <select value={form.kind} onChange={(e) => set('kind', e.target.value)}>
              <option value="job">Job category</option>
              <option value="service">Service category</option>
            </select>
          </label>
        </div>
        <label className="field"><span className="lbl">Industry group</span>
          <select value={form.group_id} onChange={(e) => set('group_id', e.target.value)}>
            <option value="">— Unassigned —</option>
            {meta.groups.map((g) => <option key={g.id} value={g.id}>{g.icon || ''} {g.name}</option>)}
          </select>
        </label>
        <label className="field"><span className="lbl">Icon (emoji)</span>
          <input type="text" maxLength={4} value={form.icon} onChange={(e) => set('icon', e.target.value)} />
        </label>
        <label className="field"><span className="lbl">Description</span>
          <textarea rows={3} value={form.description} onChange={(e) => set('description', e.target.value)} />
        </label>
      </form>
    </Modal>
  );
}
