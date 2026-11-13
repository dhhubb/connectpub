'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/client/api';
import { useUi } from '@/lib/client/ui';
import { money, timeAgo } from '@/lib/client/format';
import type { Application } from '@/lib/client/types';
import Badge from '@/components/Badge';
import Spinner from '@/components/Spinner';

export default function AdminApplications() {
  const { toast } = useUi();
  const [applications, setApplications] = useState<Application[] | null>(null);

  useEffect(() => {
    api<{ applications: Application[] }>('/admin/applications')
      .then((d) => setApplications(d.applications))
      .catch((e) => { toast((e as Error).message, 'err'); setApplications([]); });
  }, [toast]);

  if (!applications) return <Spinner />;

  return (
    <>
      <div className="page-head">
        <div><h2>Applications</h2><p className="sub">Latest {applications.length} application{applications.length === 1 ? '' : 's'} across the platform</p></div>
      </div>
      <div className="panel">
        <div className="table-wrap">
          <table className="data">
            <thead><tr><th>Applicant</th><th>Job</th><th>Company</th><th>Expected</th><th>Status</th><th>Applied</th></tr></thead>
            <tbody>
              {applications.length ? applications.map((a) => (
                <tr key={a.id}>
                  <td><b className="small">{a.applicantName}</b><div className="tiny muted">{a.applicantEmail || ''}</div></td>
                  <td className="small">{a.jobTitle}</td>
                  <td className="small muted">{a.company || '—'}</td>
                  <td className="small">{a.expectedSalary ? money(a.expectedSalary, 'USD') : '—'}</td>
                  <td><Badge status={a.status} label={a.statusLabel || a.status} /></td>
                  <td className="small muted nowrap">{timeAgo(a.createdAt)}</td>
                </tr>
              )) : <tr><td colSpan={6} className="muted small" style={{ padding: '1.4rem' }}>No applications yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
