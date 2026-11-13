'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { setQuery } from '@/lib/client/api';
import { useSession } from '@/lib/client/session';
import { initials } from '@/lib/client/format';
import Spinner from '@/components/Spinner';
import { useAdminMeta } from '@/components/admin/meta';
import AdminOverview from '@/components/admin/AdminOverview';
import AdminJobs from '@/components/admin/AdminJobs';
import AdminProviders from '@/components/admin/AdminProviders';
import AdminUsers from '@/components/admin/AdminUsers';
import AdminApplications from '@/components/admin/AdminApplications';
import AdminRequests from '@/components/admin/AdminRequests';
import AdminReviews from '@/components/admin/AdminReviews';
import AdminCategories from '@/components/admin/AdminCategories';
import AdminGroups from '@/components/admin/AdminGroups';
import AdminLocations from '@/components/admin/AdminLocations';
import AdminAudit from '@/components/admin/AdminAudit';
import AdminSettings from '@/components/admin/AdminSettings';

type View = 'overview' | 'jobs' | 'providers' | 'users' | 'applications' | 'requests' | 'reviews' | 'categories' | 'groups' | 'locations' | 'audit' | 'settings';

const NAV: [View, string, string][] = [
  ['overview', 'Dashboard', '📊'], ['jobs', 'Job moderation', '💼'], ['providers', 'Service moderation', '🔧'],
  ['users', 'Users', '👥'], ['applications', 'Applications', '📨'], ['requests', 'Service requests', '📥'],
  ['reviews', 'Reviews', '⭐'], ['categories', 'Categories', '🗂️'], ['groups', 'Industry groups', '🏷️'],
  ['locations', 'Locations', '📍'], ['audit', 'Audit log', '🕓'], ['settings', 'Settings', '⚙️'],
];

export default function AdminPage() {
  const { user, ready, refresh } = useSession();
  const [meta, reloadMeta] = useAdminMeta();
  const [view, setView] = useState<View>('overview');

  useEffect(() => {
    if (!ready) return;
    if (!user) { window.location.href = '/login?next=/admin'; return; }
    if (user.role !== 'admin') { window.location.href = '/dashboard'; return; }
    refresh();
  }, [ready, user, refresh]);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get('view') as View | null;
    if (p) setView(p);
  }, []);

  const go = useCallback((next: View) => {
    setView(next);
    setQuery({ view: next });
  }, []);

  if (!ready || !user || user.role !== 'admin') {
    return <main className="container" style={{ padding: '1.6rem 1.15rem 3rem' }}><Spinner /></main>;
  }

  return (
    <div className="app-shell">
      <aside className="app-nav">
        <div className="who">
          <div className="row">
            <div className="avatar avatar-clay">{initials(user.name)}</div>
            <div style={{ minWidth: 0 }}><b>{user.name}</b><span>Administrator</span></div>
          </div>
        </div>
        <nav>
          {NAV.map(([key, label, ic]) => (
            <button key={key} className={key === view ? 'active' : ''} onClick={() => go(key)}>
              <span className="ic">{ic}</span>{label}
            </button>
          ))}
        </nav>
        <div className="divider" />
        <Link className="btn btn-ghost btn-block btn-sm" href="/">← Back to site</Link>
      </aside>
      <main className="app-main" style={{ padding: '1.4rem 1.4rem 3rem' }}>
        {view === 'overview' && <AdminOverview go={go} />}
        {view === 'jobs' && <AdminJobs />}
        {view === 'providers' && <AdminProviders />}
        {view === 'users' && <AdminUsers meta={meta} />}
        {view === 'applications' && <AdminApplications />}
        {view === 'requests' && <AdminRequests />}
        {view === 'reviews' && <AdminReviews />}
        {view === 'categories' && <AdminCategories meta={meta} reloadMeta={reloadMeta} />}
        {view === 'groups' && <AdminGroups reloadMeta={reloadMeta} />}
        {view === 'locations' && <AdminLocations reloadMeta={reloadMeta} />}
        {view === 'audit' && <AdminAudit />}
        {view === 'settings' && <AdminSettings />}
      </main>
    </div>
  );
}
