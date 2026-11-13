'use client';

import { useState } from 'react';
import { api, ApiError } from '@/lib/client/api';
import { useUi } from '@/lib/client/ui';
import type { Job, Provider } from '@/lib/client/types';
import type { DashboardMeta } from './meta';
import type { SessionUser } from '@/lib/client/api';
import Modal from '@/components/Modal';

const JOB_TYPES = ['full_time', 'part_time', 'contract', 'casual', 'internship'];
const WORK_MODES = ['on_site', 'hybrid', 'remote'];
const AVAILABILITY: [string, string][] = [['available', 'Available now'], ['busy', 'Busy'], ['unavailable', 'Unavailable']];

function options(list: { id: number; name: string }[], placeholder: string) {
  return (
    <>
      <option value="">{placeholder}</option>
      {list.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
    </>
  );
}

function titleCase(v: string) {
  return v.replace('_', ' ');
}

export function JobFormModal({ job, meta, user, onClose, onSaved }: {
  job: Job | null;
  meta: DashboardMeta;
  user: SessionUser;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const { toast } = useUi();
  const j: Partial<Job> = job || {};
  const [form, setForm] = useState<Record<string, any>>({
    title: j.title || '', company: j.company || '',
    categoryId: j.category?.id || '', locationId: j.location?.id || '',
    jobType: j.jobType || 'full_time', workMode: j.workMode || 'on_site', vacancies: j.vacancies || 1,
    salaryMin: j.salaryMin ?? '', salaryMax: j.salaryMax ?? '',
    deadline: j.deadline ? String(j.deadline).slice(0, 10) : '',
    description: j.description || '', requirements: (j.requirements || []).join('\n'),
    contactEmail: j.contactEmail || user.email, contactPhone: j.contactPhone || user.phone || '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    try {
      const res = j.id
        ? await api<{ message: string }>('/jobs/' + j.id, { method: 'PATCH', body: form })
        : await api<{ message: string }>('/jobs', { method: 'POST', body: form });
      onSaved(res.message || 'Saved');
    } catch (err) {
      if (err instanceof ApiError && err.data?.errors) setErrors(err.data.errors);
      else toast((err as Error).message, 'err');
      setBusy(false);
    }
  };

  return (
    <Modal title={j.id ? 'Edit job listing' : 'Post a new job'} onClose={onClose} large
      footer={
        <div className="form-actions">
          <button className="btn" type="submit" form="job-form" disabled={busy}>{busy ? 'Saving…' : (j.id ? 'Save changes' : 'Submit for review')}</button>
          <button className="btn btn-ghost" type="button" onClick={onClose}>Cancel</button>
        </div>
      }>
      <form id="job-form" onSubmit={submit}>
        <div className="grid-2">
          <label className="field"><span className="lbl">Job title <span className="req">*</span></span>
            <input type="text" placeholder="e.g. Irrigation Field Supervisor" value={form.title} onChange={(e) => set('title', e.target.value)} />
            {errors.title && <span className="field-error">{errors.title}</span>}
          </label>
          <label className="field"><span className="lbl">Company / employer <span className="req">*</span></span>
            <input type="text" value={form.company} onChange={(e) => set('company', e.target.value)} />
            {errors.company && <span className="field-error">{errors.company}</span>}
          </label>
        </div>
        <div className="grid-2">
          <label className="field"><span className="lbl">Category</span>
            <select value={form.categoryId} onChange={(e) => set('categoryId', e.target.value)}>{options(meta.jobCategories, 'Select a category')}</select>
          </label>
          <label className="field"><span className="lbl">Area</span>
            <select value={form.locationId} onChange={(e) => set('locationId', e.target.value)}>{options(meta.locations, 'Select an area')}</select>
          </label>
        </div>
        <div className="grid-3">
          <label className="field"><span className="lbl">Job type <span className="req">*</span></span>
            <select value={form.jobType} onChange={(e) => set('jobType', e.target.value)}>
              {JOB_TYPES.map((t) => <option key={t} value={t}>{titleCase(t)}</option>)}
            </select>
            {errors.jobType && <span className="field-error">{errors.jobType}</span>}
          </label>
          <label className="field"><span className="lbl">Work mode</span>
            <select value={form.workMode} onChange={(e) => set('workMode', e.target.value)}>
              {WORK_MODES.map((t) => <option key={t} value={t}>{titleCase(t)}</option>)}
            </select>
          </label>
          <label className="field"><span className="lbl">Vacancies</span>
            <input type="number" min={1} value={form.vacancies} onChange={(e) => set('vacancies', e.target.value)} />
          </label>
        </div>
        <div className="grid-3">
          <label className="field"><span className="lbl">Salary from (USD)</span>
            <input type="number" min={0} step={10} value={form.salaryMin} onChange={(e) => set('salaryMin', e.target.value)} />
          </label>
          <label className="field"><span className="lbl">Salary to (USD)</span>
            <input type="number" min={0} step={10} value={form.salaryMax} onChange={(e) => set('salaryMax', e.target.value)} />
            {errors.salaryMax && <span className="field-error">{errors.salaryMax}</span>}
          </label>
          <label className="field"><span className="lbl">Application deadline</span>
            <input type="date" value={form.deadline} onChange={(e) => set('deadline', e.target.value)} />
            {errors.deadline && <span className="field-error">{errors.deadline}</span>}
          </label>
        </div>
        <label className="field"><span className="lbl">Role description <span className="req">*</span></span>
          <textarea rows={5} placeholder="Describe the duties, working hours and conditions." value={form.description} onChange={(e) => set('description', e.target.value)} />
          {errors.description && <span className="field-error">{errors.description}</span>}
        </label>
        <label className="field"><span className="lbl">Requirements (one per line)</span>
          <textarea rows={4} placeholder={'Class 2 licence\n3 years experience'} value={form.requirements} onChange={(e) => set('requirements', e.target.value)} />
        </label>
        <div className="grid-2">
          <label className="field"><span className="lbl">Contact email</span>
            <input type="email" value={form.contactEmail} onChange={(e) => set('contactEmail', e.target.value)} />
          </label>
          <label className="field"><span className="lbl">Contact phone</span>
            <input type="tel" value={form.contactPhone} onChange={(e) => set('contactPhone', e.target.value)} />
          </label>
        </div>
      </form>
    </Modal>
  );
}

export function ListingFormModal({ provider, meta, user, onClose, onSaved }: {
  provider: Provider | null;
  meta: DashboardMeta;
  user: SessionUser;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const { toast } = useUi();
  const p: Partial<Provider> = provider || {};
  const [form, setForm] = useState<Record<string, any>>({
    businessName: p.businessName || '', tagline: p.tagline || '',
    categoryId: p.category?.id || '', locationId: p.location?.id || '',
    phone: p.phone || user.phone || '', whatsapp: p.whatsapp || '', email: p.email || user.email,
    priceFrom: p.priceFrom ?? '', yearsExperience: p.yearsExperience ?? 0, availability: p.availability || 'available',
    address: p.address || '', description: p.description || '', services: (p.services || []).join('\n'),
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    try {
      const res = p.id
        ? await api<{ message: string }>('/providers/' + p.id, { method: 'PATCH', body: form })
        : await api<{ message: string }>('/providers', { method: 'POST', body: form });
      onSaved(res.message || 'Saved');
    } catch (err) {
      if (err instanceof ApiError && err.data?.errors) setErrors(err.data.errors);
      else toast((err as Error).message, 'err');
      setBusy(false);
    }
  };

  return (
    <Modal title={p.id ? 'Edit service listing' : 'Add a service listing'} onClose={onClose} large
      footer={
        <div className="form-actions">
          <button className="btn" type="submit" form="listing-form" disabled={busy}>{busy ? 'Saving…' : (p.id ? 'Save changes' : 'Submit for review')}</button>
          <button className="btn btn-ghost" type="button" onClick={onClose}>Cancel</button>
        </div>
      }>
      <form id="listing-form" onSubmit={submit}>
        <div className="grid-2">
          <label className="field"><span className="lbl">Business name <span className="req">*</span></span>
            <input type="text" value={form.businessName} onChange={(e) => set('businessName', e.target.value)} />
            {errors.businessName && <span className="field-error">{errors.businessName}</span>}
          </label>
          <label className="field"><span className="lbl">Tagline</span>
            <input type="text" placeholder="One line that sells your service" value={form.tagline} onChange={(e) => set('tagline', e.target.value)} />
          </label>
        </div>
        <div className="grid-2">
          <label className="field"><span className="lbl">Service category</span>
            <select value={form.categoryId} onChange={(e) => set('categoryId', e.target.value)}>{options(meta.serviceCategories, 'Select a category')}</select>
          </label>
          <label className="field"><span className="lbl">Area</span>
            <select value={form.locationId} onChange={(e) => set('locationId', e.target.value)}>{options(meta.locations, 'Select an area')}</select>
          </label>
        </div>
        <div className="grid-3">
          <label className="field"><span className="lbl">Phone <span className="req">*</span></span>
            <input type="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)} />
            {errors.phone && <span className="field-error">{errors.phone}</span>}
          </label>
          <label className="field"><span className="lbl">WhatsApp</span>
            <input type="tel" value={form.whatsapp} onChange={(e) => set('whatsapp', e.target.value)} />
          </label>
          <label className="field"><span className="lbl">Email</span>
            <input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} />
          </label>
        </div>
        <div className="grid-3">
          <label className="field"><span className="lbl">Starting price (USD)</span>
            <input type="number" min={0} step={5} value={form.priceFrom} onChange={(e) => set('priceFrom', e.target.value)} />
          </label>
          <label className="field"><span className="lbl">Years of experience</span>
            <input type="number" min={0} value={form.yearsExperience} onChange={(e) => set('yearsExperience', e.target.value)} />
          </label>
          <label className="field"><span className="lbl">Availability</span>
            <select value={form.availability} onChange={(e) => set('availability', e.target.value)}>
              {AVAILABILITY.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </label>
        </div>
        <label className="field"><span className="lbl">Address</span>
          <input type="text" placeholder="e.g. Tshitshi Business Centre, Plumtree" value={form.address} onChange={(e) => set('address', e.target.value)} />
        </label>
        <label className="field"><span className="lbl">About your business <span className="req">*</span></span>
          <textarea rows={5} value={form.description} onChange={(e) => set('description', e.target.value)} />
          {errors.description && <span className="field-error">{errors.description}</span>}
        </label>
        <label className="field"><span className="lbl">Services offered (one per line)</span>
          <textarea rows={5} placeholder={'Borehole drilling\nPump installation'} value={form.services} onChange={(e) => set('services', e.target.value)} />
        </label>
      </form>
    </Modal>
  );
}
