'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { api, setQuery } from '@/lib/client/api';
import { useSession } from '@/lib/client/session';
import { initials, roleLabel } from '@/lib/client/format';
import Spinner from '@/components/Spinner';
import Overview from '@/components/dashboard/Overview';
import Profile from '@/components/dashboard/Profile';
import MyApplications from '@/components/dashboard/MyApplications';
import ServiceRequests from '@/components/dashboard/ServiceRequests';
import SavedItems from '@/components/dashboard/SavedItems';
import Listings from '@/components/dashboard/Listings';
import Applicants from '@/components/dashboard/Applicants';
import { useDashboardMeta } from '@/components/dashboard/meta';

type View = 'overview' | 'applications' | 'requests' | 'saved' | 'profile' | 'listings' | 'applicants';

const NAV: Record<string, [View, string, string][]> = {
  seeker: [
    ['overview', 'Overview', '📊'], ['applications', 'My applications', '📨'],
    ['requests', 'My service requests', '🔧'], ['saved', 'Saved items', '★'], ['profile', 'My profile', '👤'],
  ],
  employer: [
    ['overview', 'Overview', '📊'], ['listings', 'My job listings', '💼'],
    ['applicants', 'Applicants', '📨'], ['profile', 'Company profile', '👤'],
  ],
  provider: [
    ['overview', 'Overview', '📊'], ['listings', 'My service listings', '🔧'],
    ['requests', 'Service requests', '📥'], ['profile', 'Business profile', '👤'],
  ],
  admin: [['overview', 'Overview', '📊'], ['profile', 'My profile', '👤']],
};

export default function DashboardPage() {
  const { user, ready, refresh } = useSession();
  const [view, setView] = useState<View>('overview');
  const [meta] = useDashboardMeta();

  useEffect(() => {
    if (!ready) return;
    if (!user) { window.location.href = '/login?next=/dashboard'; return; }
    refresh();
  }, [ready, user, refresh]);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get('view') as View | null;
    if (p) setView(p);
  }, []);

  const items = user ? NAV[user.role] || NAV.seeker : NAV.seeker;
  const valid = items.map(([k]) => k);
  const activeView = (valid.includes(view) ? view : 'overview') as View;

  const go = useCallback((next: View) => {
    setView(next);
    setQuery({ view: next });
  }, []);

  if (!ready || !user) {
    return <main className="container" style={{ padding: '1.6rem 1.15rem 3rem' }}><Spinner /></main>;
  }

  return (
    <div className="app-shell">
      <aside className="app-nav">
        <div className="who">
          <div className="row">
            <div className="avatar">{initials(user.name)}</div>
            <div style={{ minWidth: 0 }}>
              <b style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.name}</b>
              <span>{roleLabel(user.role)}</span>
            </div>
          </div>
          {user.ward && <div className="tiny muted" style={{ marginTop: '.4rem' }}>📍 {user.ward}</div>}
        </div>
        <nav>
          {items.map(([key, label, ic]) => (
            <button key={key} className={key === activeView ? 'active' : ''} onClick={() => go(key)}>
              <span className="ic">{ic}</span>{label}
            </button>
          ))}
        </nav>
        {user.role === 'admin' && (
          <>
            <div className="divider" />
            <Link className="btn btn-block btn-sm" href="/admin">Open admin panel</Link>
          </>
        )}
      </aside>
      <main className="app-main" style={{ padding: '1.4rem 1.4rem 3rem' }}>
        {activeView === 'overview' && <Overview user={user} meta={meta} go={go} />}
        {activeView === 'profile' && <Profile user={user} meta={meta} />}
        {activeView === 'applications' && <MyApplications go={go} />}
        {activeView === 'requests' && <ServiceRequests user={user} go={go} />}
        {activeView === 'saved' && <SavedItems />}
        {activeView === 'listings' && <Listings user={user} meta={meta} />}
        {activeView === 'applicants' && <Applicants />}
      </main>
    </div>
  );
}
