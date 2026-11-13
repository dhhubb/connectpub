'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/client/api';
import { useUi } from '@/lib/client/ui';
import type { Location } from '@/lib/client/types';
import Modal from '@/components/Modal';
import Spinner from '@/components/Spinner';

export default function AdminLocations({ reloadMeta }: { reloadMeta: () => Promise<void> }) {
  const { toast, confirm } = useUi();
  const [locations, setLocations] = useState<Location[] | null>(null);
  const [editing, setEditing] = useState<Location | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(() => {
    api<{ locations: Location[] }>('/admin/locations')
      .then((d) => setLocations(d.locations))
      .catch((e) => { toast((e as Error).message, 'err'); setLocations([]); });
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const del = async (l: Location) => {
    if (!(await confirm('Delete this location?', { confirmLabel: 'Delete', danger: true }))) return;
    try { await api('/admin/locations/' + l.id, { method: 'DELETE' }); toast('Location deleted'); load(); reloadMeta(); }
    catch (e) { toast((e as Error).message, 'err'); }
  };

  if (!locations) return <Spinner />;

  return (
    <>
      <div className="page-head">
        <div><h2>Locations</h2><p className="sub">{locations.length} towns, wards and villages in the coverage area</p></div>
        <button className="btn" onClick={() => { setEditing(null); setCreating(true); }}>+ Add location</button>
      </div>
      <div className="panel">
        <div className="table-wrap">
          <table className="data">
            <thead><tr><th>Location</th><th>Type</th><th>Notes</th><th>Jobs</th><th>Providers</th><th></th></tr></thead>
            <tbody>
              {locations.map((l) => (
                <tr key={l.id}>
                  <td><b>{l.name}</b><div className="tiny muted mono">{l.slug}</div></td>
                  <td><span className="badge">{l.kind}</span></td>
                  <td className="small muted">{l.notes || '—'}</td>
                  <td className="small">{l.jobCount}</td>
                  <td className="small">{l.providerCount}</td>
                  <td className="actions">
                    <button className="btn btn-xs btn-ghost" onClick={() => { setCreating(false); setEditing(l); }}>Edit</button>
                    <button className="btn btn-xs btn-ghost" onClick={() => del(l)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {(creating || editing) && (
        <LocationFormModal location={editing} onClose={() => { setEditing(null); setCreating(false); }}
          onSaved={() => { setEditing(null); setCreating(false); load(); reloadMeta(); }} />
      )}
    </>
  );
}

function LocationFormModal({ location, onClose, onSaved }: { location: Location | null; onClose: () => void; onSaved: () => void }) {
  const { toast } = useUi();
  const l: Partial<Location> = location || {};
  const [form, setForm] = useState({ name: l.name || '', kind: l.kind || 'ward', notes: l.notes || '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    try {
      if (l.id) await api('/admin/locations/' + l.id, { method: 'PATCH', body: form });
      else await api('/admin/locations', { method: 'POST', body: form });
      toast('Location saved');
      onSaved();
    } catch (err) {
      if (err instanceof ApiError && err.data?.errors) setErrors(err.data.errors);
      else toast((err as Error).message, 'err');
      setBusy(false);
    }
  };

  return (
    <Modal title={l.id ? 'Edit location' : 'Add location'} onClose={onClose}
      footer={
        <div className="form-actions">
          <button className="btn" type="submit" form="loc-form" disabled={busy}>{busy ? 'Saving…' : (l.id ? 'Save changes' : 'Create location')}</button>
          <button className="btn btn-ghost" type="button" onClick={onClose}>Cancel</button>
        </div>
      }>
      <form id="loc-form" onSubmit={submit}>
        <div className="grid-2">
          <label className="field"><span className="lbl">Name <span className="req">*</span></span>
            <input type="text" value={form.name} onChange={(e) => set('name', e.target.value)} />
            {errors.name && <span className="field-error">{errors.name}</span>}
          </label>
          <label className="field"><span className="lbl">Type</span>
            <select value={form.kind} onChange={(e) => set('kind', e.target.value)}>
              <option value="town">Town</option>
              <option value="ward">Ward</option>
              <option value="village">Village</option>
            </select>
          </label>
        </div>
        <label className="field"><span className="lbl">Notes</span>
          <textarea rows={3} value={form.notes} onChange={(e) => set('notes', e.target.value)} />
        </label>
      </form>
    </Modal>
  );
}
