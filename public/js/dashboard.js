/* User dashboard (job seeker, employer, service provider) */
(function () {
  'use strict';
  const PC = window.PC;
  const { api, escapeHtml, money, dateLabel, timeAgo, statusBadge, toast, modal, closeModal, confirmDialog, busy, state, formToObject, showErrors, initials, stars } = PC;

  const root = document.getElementById('dashboard-root');
  let meta = { jobCategories: [], serviceCategories: [], locations: [] };
  let overview = null;
  let activeView = PC.qs('view') || 'overview';

  const NAV = {
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
  };

  function navFor(user) {
    if (user.role === 'admin') return [['overview', 'Overview', '📊'], ['profile', 'My profile', '👤']];
    return NAV[user.role] || NAV.seeker;
  }

  function shell() {
    const user = state.user;
    const items = navFor(user);
    root.innerHTML = `
      <div class="app-shell">
        <aside class="app-nav">
          <div class="who">
            <div class="row">
              <div class="avatar">${escapeHtml(initials(user.name))}</div>
              <div style="min-width:0">
                <b style="overflow:hidden;text-overflow:ellipsis">${escapeHtml(user.name)}</b>
                <span>${escapeHtml(PC.roleLabel(user.role))}</span>
              </div>
            </div>
            ${user.ward ? `<div class="tiny muted" style="margin-top:.4rem">📍 ${escapeHtml(user.ward)}</div>` : ''}
          </div>
          <nav id="dash-nav">
            ${items.map(([key, label, ic]) => `<button data-view="${key}" class="${key === activeView ? 'active' : ''}"><span class="ic">${ic}</span>${escapeHtml(label)}</button>`).join('')}
          </nav>
          ${user.role === 'admin' ? '<div class="divider"></div><a class="btn btn-block btn-sm" href="/admin.html">Open admin panel</a>' : ''}
        </aside>
        <main class="app-main" id="dash-main"><div class="spinner"></div></main>
      </div>`;

    root.querySelector('#dash-nav').addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-view]');
      if (!btn) return;
      setView(btn.dataset.view);
    });
  }

  function setView(view) {
    activeView = view;
    PC.setQuery({ view }, { replace: true });
    root.querySelectorAll('#dash-nav button').forEach((b) => b.classList.toggle('active', b.dataset.view === view));
    render();
  }

  // A fresh container per render so delegated listeners never accumulate
  // across view switches.
  async function render() {
    const host = document.getElementById('dash-main');
    host.innerHTML = '<div id="dash-view"><div class="spinner"></div></div>';
    const main = document.getElementById('dash-view');
    try {
      if (activeView === 'overview') return await renderOverview(main);
      if (activeView === 'profile') return await renderProfile(main);
      if (activeView === 'applications') return await renderMyApplications(main);
      if (activeView === 'requests') return await renderRequests(main);
      if (activeView === 'saved') return await renderSaved(main);
      if (activeView === 'listings') return await renderListings(main);
      if (activeView === 'applicants') return await renderApplicants(main);
      main.innerHTML = '<div class="empty">Unknown view.</div>';
    } catch (e) {
      main.innerHTML = `<div class="alert alert-error">${escapeHtml(e.message)}</div>`;
    }
  }

  /* ---------- overview ---------- */
  const CARD_LABELS = {
    applications: 'Applications', shortlisted: 'In progress', savedJobs: 'Saved jobs', savedProviders: 'Saved providers',
    jobs: 'Job listings', published: 'Published', pendingReview: 'Awaiting review', hired: 'Hired', jobViews: 'Listing views',
    listings: 'Service listings', requests: 'Service requests', newRequests: 'New requests', completed: 'Completed jobs',
    listingViews: 'Listing views', averageRating: 'Average rating', users: 'Users',
  };

  async function renderOverview(main) {
    overview = await api('/dashboard/overview');
    const cards = overview.cards;
    const priority = ['applications', 'published', 'published', 'shortlisted', 'newRequests', 'hired', 'completed', 'savedJobs', 'savedProviders', 'jobs', 'listings', 'requests', 'pendingReview', 'averageRating', 'jobViews', 'listingViews'];
    const keys = Object.keys(cards);
    const ordered = [...new Set([...priority.filter((k) => keys.includes(k)), ...keys])];

    const cardHtml = ordered.map((k, i) => `
      <div class="stat-card ${i === 0 ? 'accent' : i === 1 ? 'clay' : ''}">
        <div class="k">${escapeHtml(CARD_LABELS[k] || k)}</div>
        <div class="v">${k === 'averageRating' ? (cards[k] ?? '—') : Number(cards[k]).toLocaleString('en-US')}</div>
      </div>`).join('');

    const isEmployer = state.user.role === 'employer';
    const isProvider = state.user.role === 'provider';

    main.innerHTML = `
      <div class="page-head">
        <div>
          <h2>Welcome back, ${escapeHtml(state.user.name.split(' ')[0])}</h2>
          <p class="sub">${escapeHtml(PC.roleLabel(state.user.role))} dashboard · ${escapeHtml(state.user.email)}</p>
        </div>
        <div class="btn-group">
          ${isEmployer ? '<button class="btn" data-new-job>+ Post a job</button>' : ''}
          ${isProvider ? '<button class="btn" data-new-listing>+ Add a service listing</button>' : ''}
          ${state.user.role === 'seeker' ? '<a class="btn" href="/jobs.html">Browse jobs</a>' : ''}
        </div>
      </div>
      <div class="stat-grid">${cardHtml}</div>

      ${overview.recentApplications.length ? `
        <div class="panel" style="margin-top:1.4rem">
          <div class="panel-head"><b>Recent applications</b><button class="btn btn-xs btn-ghost" data-goto="${isEmployer ? 'applicants' : 'applications'}">View all</button></div>
          <div class="table-wrap"><table class="data">
            <thead><tr><th>${isEmployer ? 'Applicant' : 'Job'}</th><th>${isEmployer ? 'Job' : 'Company'}</th><th>Status</th><th>Applied</th></tr></thead>
            <tbody>${overview.recentApplications.map((a) => `
              <tr>
                <td>${escapeHtml(isEmployer ? (a.applicantName || '—') : (a.jobTitle || '—'))}</td>
                <td>${escapeHtml(isEmployer ? (a.jobTitle || '—') : (a.company || '—'))}</td>
                <td>${statusBadge(a.status, a.statusLabel)}</td>
                <td class="small muted">${escapeHtml(timeAgo(a.createdAt))}</td>
              </tr>`).join('')}</tbody>
          </table></div>
        </div>` : ''}

      ${overview.recentRequests.length ? `
        <div class="panel" style="margin-top:1.2rem">
          <div class="panel-head"><b>Recent service requests</b><button class="btn btn-xs btn-ghost" data-goto="requests">View all</button></div>
          <div class="table-wrap"><table class="data">
            <thead><tr><th>Service</th><th>${isProvider ? 'Customer' : 'Provider'}</th><th>Status</th><th>Received</th></tr></thead>
            <tbody>${overview.recentRequests.map((r) => `
              <tr>
                <td>${escapeHtml(r.serviceNeeded)}</td>
                <td>${escapeHtml(isProvider ? r.name : (r.businessName || '—'))}</td>
                <td>${statusBadge(r.status, r.statusLabel)}</td>
                <td class="small muted">${escapeHtml(timeAgo(r.createdAt))}</td>
              </tr>`).join('')}</tbody>
          </table></div>
        </div>` : ''}

      ${!overview.recentApplications.length && !overview.recentRequests.length ? `
        <div class="card" style="margin-top:1.4rem">
          <h3>Getting started</h3>
          <ul class="list-check">
            ${state.user.role === 'seeker' ? '<li>Complete your profile so employers know your skills.</li><li><a href="/jobs.html">Browse jobs</a> and apply — applications appear here.</li><li>Save jobs you like and come back to them.</li>' : ''}
            ${isEmployer ? '<li>Post your first vacancy — an administrator reviews it before it goes live.</li><li>Applicants land in the Applicants tab.</li><li>Move candidates through shortlist, interview and hired.</li>' : ''}
            ${isProvider ? '<li>Publish a service listing with your prices and services.</li><li>Requests from customers appear in Service requests.</li><li>Encourage happy customers to leave a review.</li>' : ''}
          </ul>
        </div>` : ''}`;

    main.querySelectorAll('[data-goto]').forEach((b) => b.addEventListener('click', () => setView(b.dataset.goto)));
    main.querySelector('[data-new-job]')?.addEventListener('click', () => openJobForm());
    main.querySelector('[data-new-listing]')?.addEventListener('click', () => openListingForm());
  }

  /* ---------- profile ---------- */
  async function renderProfile(main) {
    const { user } = await api('/auth/me');
    main.innerHTML = `
      <div class="page-head"><div><h2>My profile</h2><p class="sub">Keep your details up to date — they are used on applications and listings.</p></div></div>
      <div class="grid-side">
        <div class="card">
          <h3>Account details</h3>
          <div id="profile-alert"></div>
          <form id="profile-form">
            <label class="field"><span class="lbl">Full name</span><input type="text" name="name" value="${escapeHtml(user.name)}"></label>
            <label class="field"><span class="lbl">Email</span><input type="email" value="${escapeHtml(user.email)}" disabled></label>
            <div class="grid-2">
              <label class="field"><span class="lbl">Phone</span><input type="tel" name="phone" value="${escapeHtml(user.phone || '')}"></label>
              <label class="field"><span class="lbl">Ward / area</span>
                <select name="ward"><option value="">Select area</option>${meta.locations.map((l) => `<option value="${escapeHtml(l.name)}" ${user.ward === l.name ? 'selected' : ''}>${escapeHtml(l.name)}</option>`).join('')}</select>
              </label>
            </div>
            <label class="field"><span class="lbl">Short profile</span><textarea name="bio" rows="4">${escapeHtml(user.bio || '')}</textarea></label>
            <div class="form-actions"><button class="btn" type="submit" id="profile-save">Save changes</button></div>
          </form>
        </div>
        <div class="stack">
          <div class="card">
            <h3>Account</h3>
            <dl class="kv">
              <dt>Role</dt><dd>${escapeHtml(PC.roleLabel(user.role))}</dd>
              <dt>Status</dt><dd>${statusBadge(user.status, user.status === 'active' ? 'Active' : 'Suspended')}</dd>
              <dt>Member since</dt><dd>${escapeHtml(dateLabel(user.createdAt))}</dd>
              <dt>Last sign in</dt><dd>${escapeHtml(user.lastLoginAt ? timeAgo(user.lastLoginAt) : '—')}</dd>
            </dl>
          </div>
          <div class="card">
            <h3>Change password</h3>
            <div id="password-alert"></div>
            <form id="password-form">
              <label class="field"><span class="lbl">Current password</span><input type="password" name="currentPassword" autocomplete="current-password"></label>
              <label class="field"><span class="lbl">New password</span><input type="password" name="newPassword" autocomplete="new-password"></label>
              <button class="btn btn-outline btn-block" type="submit" id="password-save">Update password</button>
            </form>
          </div>
        </div>
      </div>`;

    document.getElementById('profile-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = document.getElementById('profile-save');
      const host = document.getElementById('profile-alert');
      host.innerHTML = '';
      busy(btn, true, 'Saving…');
      try {
        const { user: updated } = await api('/auth/me', { method: 'PATCH', body: formToObject(e.target) });
        PC.setSession(state.token, updated);
        toast('Profile updated');
        host.innerHTML = '<div class="alert alert-ok">Profile saved.</div>';
      } catch (err) {
        if (err.data && err.data.errors) showErrors(e.target, err.data.errors);
        host.innerHTML = `<div class="alert alert-error">${escapeHtml(err.message)}</div>`;
      } finally { busy(btn, false); }
    });

    document.getElementById('password-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = document.getElementById('password-save');
      const host = document.getElementById('password-alert');
      host.innerHTML = '';
      busy(btn, true, 'Updating…');
      try {
        await api('/auth/change-password', { method: 'POST', body: formToObject(e.target) });
        e.target.reset();
        host.innerHTML = '<div class="alert alert-ok">Password updated.</div>';
        toast('Password updated');
      } catch (err) {
        if (err.data && err.data.errors) showErrors(e.target, err.data.errors);
        host.innerHTML = `<div class="alert alert-error">${escapeHtml(err.message)}</div>`;
      } finally { busy(btn, false); }
    });
  }

  /* ---------- seeker: my applications ---------- */
  const APPLY_STATUSES = [
    ['submitted', 'Submitted'], ['reviewing', 'Reviewing'], ['shortlisted', 'Shortlisted'],
    ['interview', 'Interview'], ['hired', 'Hired'], ['rejected', 'Rejected'], ['withdrawn', 'Withdrawn'],
  ];

  async function renderMyApplications(main) {
    const { applications } = await api('/dashboard/applications');
    main.innerHTML = `
      <div class="page-head"><div><h2>My applications</h2><p class="sub">${applications.length} application${applications.length === 1 ? '' : 's'} submitted</p></div><a class="btn btn-outline" href="/jobs.html">Find more jobs</a></div>
      ${applications.length ? `<div class="panel"><div class="table-wrap"><table class="data">
        <thead><tr><th>Job</th><th>Company</th><th>Area</th><th>Expected</th><th>Status</th><th>Applied</th><th></th></tr></thead>
        <tbody>${applications.map((a) => `
          <tr>
            <td><a href="/job.html?id=${a.jobId}"><b>${escapeHtml(a.jobTitle)}</b></a>${a.categoryName ? `<div class="tiny muted">${escapeHtml(a.categoryIcon || '')} ${escapeHtml(a.categoryName)}</div>` : ''}</td>
            <td>${escapeHtml(a.company || '—')}</td>
            <td class="small muted">${escapeHtml(a.locationName || '—')}</td>
            <td class="small">${a.expectedSalary ? escapeHtml(money(a.expectedSalary, 'USD')) : '—'}</td>
            <td>${statusBadge(a.status, a.statusLabel)}${a.employerNote ? `<div class="tiny muted" title="${escapeHtml(a.employerNote)}">Note: ${escapeHtml(a.employerNote.slice(0, 40))}${a.employerNote.length > 40 ? '…' : ''}</div>` : ''}</td>
            <td class="small muted nowrap">${escapeHtml(timeAgo(a.createdAt))}</td>
            <td class="actions">
              <button class="btn btn-xs btn-ghost" data-detail='${escapeHtml(JSON.stringify(a))}'>View</button>
              ${['submitted', 'reviewing', 'shortlisted', 'interview'].includes(a.status) ? `<button class="btn btn-xs btn-ghost" data-withdraw="${a.id}">Withdraw</button>` : ''}
            </td>
          </tr>`).join('')}</tbody>
      </table></div></div>` : '<div class="empty"><span class="icon">📨</span><b>No applications yet</b><p>Browse the job board and apply to roles that fit you.</p><a class="btn" href="/jobs.html">Browse jobs</a></div>'}`;

    main.addEventListener('click', async (e) => {
      const detail = e.target.closest('[data-detail]');
      if (detail) {
        const a = JSON.parse(detail.dataset.detail);
        modal({
          title: a.jobTitle,
          body: `
            <dl class="kv">
              <dt>Company</dt><dd>${escapeHtml(a.company || '—')}</dd>
              <dt>Status</dt><dd>${statusBadge(a.status, a.statusLabel)}</dd>
              <dt>Applied</dt><dd>${escapeHtml(dateLabel(a.createdAt))}</dd>
              <dt>Expected salary</dt><dd>${a.expectedSalary ? escapeHtml(money(a.expectedSalary, 'USD')) : '—'}</dd>
              <dt>CV link</dt><dd>${a.cvUrl ? `<a href="${escapeHtml(a.cvUrl)}" target="_blank" rel="noopener">Open</a>` : '—'}</dd>
            </dl>
            <div class="divider"></div>
            <h4>Cover letter</h4>
            <p class="small" style="white-space:pre-line">${escapeHtml(a.coverLetter || 'No cover letter provided.')}</p>
            ${a.employerNote ? `<div class="alert alert-info" style="margin-top:1rem"><b>Employer note:</b> ${escapeHtml(a.employerNote)}</div>` : ''}`,
        });
      }
      const wd = e.target.closest('[data-withdraw]');
      if (wd) {
        if (!(await confirmDialog('Withdraw this application? The employer will see it as withdrawn.', { confirmLabel: 'Withdraw', danger: true }))) return;
        try {
          await api(`/dashboard/applications/${wd.dataset.withdraw}`, { method: 'PATCH', body: { status: 'withdrawn' } });
          toast('Application withdrawn');
          render();
        } catch (err) { toast(err.message, 'err'); }
      }
    });
  }

  /* ---------- seeker: service requests sent ---------- */
  async function renderRequests(main) {
    const isProvider = state.user.role === 'provider';
    const { requests } = await api('/dashboard/service-requests' + (isProvider ? '' : '?mine=1'));
    main.innerHTML = `
      <div class="page-head">
        <div><h2>${isProvider ? 'Service requests' : 'My service requests'}</h2>
          <p class="sub">${isProvider ? 'Requests customers sent to your business.' : 'Requests you sent to service providers.'}</p></div>
        ${isProvider ? '<a class="btn btn-outline" href="/providers.html">View directory</a>' : '<a class="btn btn-outline" href="/providers.html">Find a provider</a>'}
      </div>
      ${requests.length ? `<div class="panel"><div class="table-wrap"><table class="data">
        <thead><tr><th>Service</th><th>${isProvider ? 'Customer' : 'Provider'}</th><th>Budget</th><th>Status</th><th>${isProvider ? 'Received' : 'Sent'}</th><th></th></tr></thead>
        <tbody>${requests.map((r) => `
          <tr>
            <td><b>${escapeHtml(r.serviceNeeded)}</b>${r.preferredDate ? `<div class="tiny muted">Preferred: ${escapeHtml(dateLabel(r.preferredDate))}</div>` : ''}</td>
            <td>${isProvider ? escapeHtml(r.name) : `<a href="/provider.html?id=${r.providerId}">${escapeHtml(r.businessName)}</a>`}<div class="tiny muted">${escapeHtml(r.phone)}</div></td>
            <td class="small">${r.budget ? escapeHtml(money(r.budget, 'USD')) : '—'}</td>
            <td>${statusBadge(r.status, r.statusLabel)}</td>
            <td class="small muted nowrap">${escapeHtml(timeAgo(r.createdAt))}</td>
            <td class="actions">
              <button class="btn btn-xs btn-ghost" data-req='${escapeHtml(JSON.stringify(r))}'>View</button>
              ${isProvider ? `<button class="btn btn-xs" data-manage="${r.id}">Manage</button>`
                : ['new', 'contacted', 'quoted'].includes(r.status) ? `<button class="btn btn-xs btn-ghost" data-cancel="${r.id}">Cancel</button>` : ''}
            </td>
          </tr>`).join('')}</tbody>
      </table></div></div>` : `<div class="empty"><span class="icon">🔧</span><b>No service requests ${isProvider ? 'received' : 'sent'} yet</b>
        <p>${isProvider ? 'When customers request your services they appear here.' : 'Browse the service directory and send a request.'}</p>
        <a class="btn" href="/providers.html">Browse services</a></div>`}`;

    main.addEventListener('click', async (e) => {
      const view = e.target.closest('[data-req]');
      if (view) {
        const r = JSON.parse(view.dataset.req);
        modal({
          title: r.serviceNeeded,
          body: `<dl class="kv">
              <dt>${isProvider ? 'Customer' : 'Provider'}</dt><dd>${escapeHtml(isProvider ? r.name : r.businessName)}</dd>
              <dt>Phone</dt><dd>${escapeHtml(r.phone)}</dd>
              <dt>Email</dt><dd>${escapeHtml(r.email || '—')}</dd>
              <dt>Preferred date</dt><dd>${r.preferredDate ? escapeHtml(dateLabel(r.preferredDate)) : '—'}</dd>
              <dt>Budget</dt><dd>${r.budget ? escapeHtml(money(r.budget, 'USD')) : '—'}</dd>
              <dt>Status</dt><dd>${statusBadge(r.status, r.statusLabel)}</dd>
              <dt>Sent</dt><dd>${escapeHtml(dateLabel(r.createdAt))}</dd>
            </dl>
            <div class="divider"></div>
            <h4>Details</h4><p class="small" style="white-space:pre-line">${escapeHtml(r.details || 'No extra details provided.')}</p>
            ${r.response ? `<div class="alert alert-info" style="margin-top:1rem"><b>Provider response:</b> ${escapeHtml(r.response)}</div>` : ''}`,
        });
      }
      const manage = e.target.closest('[data-manage]');
      if (manage) openRequestManager(requests.find((r) => r.id === Number(manage.dataset.manage)));
      const cancel = e.target.closest('[data-cancel]');
      if (cancel) {
        if (!(await confirmDialog('Cancel this service request?', { confirmLabel: 'Cancel request', danger: true }))) return;
        try {
          await api(`/dashboard/service-requests/${cancel.dataset.cancel}`, { method: 'PATCH', body: { status: 'cancelled' } });
          toast('Request cancelled');
          render();
        } catch (err) { toast(err.message, 'err'); }
      }
    });
  }

  function openRequestManager(r) {
    const options = [['new', 'New'], ['contacted', 'Contacted'], ['quoted', 'Quoted'], ['accepted', 'Accepted'], ['completed', 'Completed'], ['declined', 'Declined']];
    modal({
      title: `Manage request: ${r.serviceNeeded}`,
      body: `<form id="req-form">
          <div class="alert alert-info">Customer <b>${escapeHtml(r.name)}</b> · ${escapeHtml(r.phone)}${r.email ? ' · ' + escapeHtml(r.email) : ''}</div>
          <p class="small" style="white-space:pre-line">${escapeHtml(r.details || '')}</p>
          <label class="field"><span class="lbl">Status</span><select name="status">${options.map(([v, l]) => `<option value="${v}" ${r.status === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
          <label class="field"><span class="lbl">Your response to the customer</span><textarea name="response" rows="4" placeholder="e.g. Quoted USD 250 including materials.">${escapeHtml(r.response || '')}</textarea></label>
          <div class="form-actions"><button class="btn" type="submit" id="req-save">Save</button><button class="btn btn-ghost" type="button" data-close>Close</button></div>
        </form>`,
    });
    document.getElementById('req-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = document.getElementById('req-save');
      busy(btn, true, 'Saving…');
      try {
        await api(`/dashboard/service-requests/${r.id}`, { method: 'PATCH', body: formToObject(e.target) });
        closeModal();
        toast('Request updated');
        render();
      } catch (err) { busy(btn, false); toast(err.message, 'err'); }
    });
  }

  /* ---------- saved items ---------- */
  async function renderSaved(main) {
    const data = await api('/dashboard/saved');
    main.innerHTML = `
      <div class="page-head"><div><h2>Saved items</h2><p class="sub">${data.jobs.length} job${data.jobs.length === 1 ? '' : 's'} and ${data.providers.length} provider${data.providers.length === 1 ? '' : 's'} saved</p></div></div>
      <h3 style="margin-top:.6rem">Saved jobs</h3>
      ${data.jobs.length ? `<div class="grid-cards">${data.jobs.map((j) => `
        <article class="listing">
          <div class="row"><div class="thumb">${escapeHtml(j.category?.icon || '💼')}</div>
            <div class="grow"><h3><a href="/job.html?id=${j.id}">${escapeHtml(j.title)}</a></h3><div class="org">${escapeHtml(j.company)}</div></div></div>
          <div class="chips">${j.location ? `<span class="tag">📍 ${escapeHtml(j.location.name)}</span>` : ''}<span class="tag">${escapeHtml(j.jobTypeLabel)}</span><span class="tag">${escapeHtml(j.salaryLabel)}</span></div>
          <div class="foot"><span class="tiny muted">Saved ${escapeHtml(timeAgo(j.savedAt))}</span>
            <span class="btn-group"><a class="btn btn-xs btn-outline" href="/job.html?id=${j.id}">Open</a><button class="btn btn-xs btn-ghost" data-unsave-job="${j.id}">Remove</button></span></div>
        </article>`).join('')}</div>` : '<p class="muted small">No saved jobs yet.</p>'}

      <h3 style="margin-top:1.6rem">Saved providers</h3>
      ${data.providers.length ? `<div class="grid-cards">${data.providers.map((p) => `
        <article class="listing">
          <div class="row"><div class="thumb thumb-clay">${escapeHtml(p.category?.icon || '🔧')}</div>
            <div class="grow"><h3><a href="/provider.html?id=${p.id}">${escapeHtml(p.businessName)}</a></h3><div class="org">${escapeHtml(p.category?.name || '')}</div></div></div>
          <div class="row small">${p.rating ? stars(p.rating) : '<span class="muted tiny">No reviews</span>'}</div>
          <div class="chips">${p.location ? `<span class="tag">📍 ${escapeHtml(p.location.name)}</span>` : ''}<span class="tag">${escapeHtml(p.availabilityLabel)}</span></div>
          <div class="foot"><span class="tiny muted">Saved ${escapeHtml(timeAgo(p.savedAt))}</span>
            <span class="btn-group"><a class="btn btn-xs btn-outline" href="/provider.html?id=${p.id}">Open</a><button class="btn btn-xs btn-ghost" data-unsave-provider="${p.id}">Remove</button></span></div>
        </article>`).join('')}</div>` : '<p class="muted small">No saved providers yet.</p>'}`;

    main.addEventListener('click', async (e) => {
      const job = e.target.closest('[data-unsave-job]');
      if (job) { await api(`/jobs/${job.dataset.unsaveJob}/save`, { method: 'POST' }); toast('Removed'); render(); }
      const prov = e.target.closest('[data-unsave-provider]');
      if (prov) { await api(`/providers/${prov.dataset.unsaveProvider}/save`, { method: 'POST' }); toast('Removed'); render(); }
    });
  }

  /* ---------- employer/provider listings ---------- */
  async function renderListings(main) {
    const isEmployer = state.user.role === 'employer';
    const endpoint = isEmployer ? '/jobs/mine/list' : '/providers/mine/list';
    const key = isEmployer ? 'jobs' : 'providers';
    const data = await api(endpoint);
    const rows = data[key];

    main.innerHTML = `
      <div class="page-head">
        <div><h2>${isEmployer ? 'My job listings' : 'My service listings'}</h2><p class="sub">${rows.length} listing${rows.length === 1 ? '' : 's'} · pending items are reviewed by an administrator</p></div>
        <button class="btn" id="new-listing">+ ${isEmployer ? 'Post a job' : 'Add a service listing'}</button>
      </div>
      ${rows.length ? `<div class="panel"><div class="table-wrap"><table class="data">
        <thead><tr><th>${isEmployer ? 'Job' : 'Business'}</th><th>Category</th><th>Area</th>${isEmployer ? '<th>Applicants</th>' : '<th>Requests</th>'}<th>Views</th><th>Status</th><th></th></tr></thead>
        <tbody>${rows.map((r) => `
          <tr>
            <td>${isEmployer
              ? `<a href="/job.html?id=${r.id}"><b>${escapeHtml(r.title)}</b></a><div class="tiny muted">${escapeHtml(r.salaryLabel || '')}</div>`
              : `<a href="/provider.html?id=${r.id}"><b>${escapeHtml(r.businessName)}</b></a><div class="tiny muted">${escapeHtml(r.tagline || '')}</div>`}</td>
            <td class="small">${escapeHtml(r.category?.name || '—')}</td>
            <td class="small muted">${escapeHtml(r.location?.name || '—')}</td>
            <td class="small">${isEmployer ? r.applicationCount : (r.requestCount ?? '—')}</td>
            <td class="small">${r.views}</td>
            <td>${statusBadge(r.status, r.statusLabel || r.status)}${isEmployer && r.featured ? ' <span class="badge badge-clay">Featured</span>' : ''}${!isEmployer && r.verified ? ' <span class="badge badge-green">✓</span>' : ''}${r.rejectionReason ? `<div class="tiny" style="color:var(--danger)">${escapeHtml(r.rejectionReason)}</div>` : ''}</td>
            <td class="actions">
              <button class="btn btn-xs btn-ghost" data-edit="${r.id}">Edit</button>
              ${r.status === 'approved' ? `<button class="btn btn-xs btn-ghost" data-close-listing="${r.id}">Close</button>` : ''}
              <button class="btn btn-xs btn-ghost" data-delete="${r.id}">Delete</button>
            </td>
          </tr>`).join('')}</tbody>
      </table></div></div>` : `<div class="empty"><span class="icon">${isEmployer ? '💼' : '🔧'}</span><b>No listings yet</b>
        <p>${isEmployer ? 'Post your first vacancy to reach local candidates.' : 'Publish your business so customers can find you.'}</p>
        <button class="btn" id="empty-new">+ Create listing</button></div>`}`;

    const cache = rows;
    document.getElementById('new-listing')?.addEventListener('click', () => isEmployer ? openJobForm() : openListingForm());
    document.getElementById('empty-new')?.addEventListener('click', () => isEmployer ? openJobForm() : openListingForm());
    main.addEventListener('click', async (e) => {
      const edit = e.target.closest('[data-edit]');
      if (edit) {
        const item = cache.find((x) => x.id === Number(edit.dataset.edit));
        isEmployer ? openJobForm(item) : openListingForm(item);
      }
      const del = e.target.closest('[data-delete]');
      if (del) {
        if (!(await confirmDialog('Delete this listing permanently? This cannot be undone.', { confirmLabel: 'Delete', danger: true }))) return;
        try {
          await api(`${isEmployer ? '/jobs' : '/providers'}/${del.dataset.delete}`, { method: 'DELETE' });
          toast('Listing deleted');
          render();
        } catch (err) { toast(err.message, 'err'); }
      }
      const close = e.target.closest('[data-close-listing]');
      if (close) {
        if (!(await confirmDialog('Close this listing so it stops showing publicly?', { confirmLabel: 'Close listing' }))) return;
        try {
          await api(`${isEmployer ? '/jobs' : '/providers'}/${close.dataset.closeListing}`, { method: 'PATCH', body: isEmployer ? { ...itemBodyForJob(cache.find((x) => x.id === Number(close.dataset.closeListing))), status: 'closed' } : { status: 'suspended' } });
          toast('Listing closed');
          render();
        } catch (err) { toast(err.message, 'err'); }
      }
    });
  }

  function itemBodyForJob(job) {
    return {
      title: job.title, company: job.company, description: job.description,
      requirements: (job.requirements || []).join('\n'), jobType: job.jobType, workMode: job.workMode,
      salaryMin: job.salaryMin, salaryMax: job.salaryMax, currency: job.currency, vacancies: job.vacancies,
      deadline: job.deadline, contactEmail: job.contactEmail, contactPhone: job.contactPhone,
      categoryId: job.category?.id, locationId: job.location?.id,
    };
  }

  function jobFormHtml(job) {
    return `<form id="job-form">
      <div class="grid-2">
        <label class="field"><span class="lbl">Job title <span class="req">*</span></span><input type="text" name="title" value="${escapeHtml(job.title || '')}" placeholder="e.g. Irrigation Field Supervisor"></label>
        <label class="field"><span class="lbl">Company / employer <span class="req">*</span></span><input type="text" name="company" value="${escapeHtml(job.company || '')}"></label>
      </div>
      <div class="grid-2">
        <label class="field"><span class="lbl">Category</span><select name="categoryId">${optionsHtml(meta.jobCategories, job.category?.id, 'Select a category')}</select></label>
        <label class="field"><span class="lbl">Area</span><select name="locationId">${optionsHtml(meta.locations, job.location?.id, 'Select an area')}</select></label>
      </div>
      <div class="grid-3">
        <label class="field"><span class="lbl">Job type <span class="req">*</span></span><select name="jobType">${['full_time', 'part_time', 'contract', 'casual', 'internship'].map((t) => `<option value="${t}" ${job.jobType === t ? 'selected' : ''}>${PC.escapeHtml(t.replace('_', ' '))}</option>`).join('')}</select></label>
        <label class="field"><span class="lbl">Work mode</span><select name="workMode">${['on_site', 'hybrid', 'remote'].map((t) => `<option value="${t}" ${job.workMode === t ? 'selected' : ''}>${PC.escapeHtml(t.replace('_', ' '))}</option>`).join('')}</select></label>
        <label class="field"><span class="lbl">Vacancies</span><input type="number" name="vacancies" min="1" value="${job.vacancies || 1}"></label>
      </div>
      <div class="grid-3">
        <label class="field"><span class="lbl">Salary from (USD)</span><input type="number" name="salaryMin" min="0" step="10" value="${job.salaryMin ?? ''}"></label>
        <label class="field"><span class="lbl">Salary to (USD)</span><input type="number" name="salaryMax" min="0" step="10" value="${job.salaryMax ?? ''}"></label>
        <label class="field"><span class="lbl">Application deadline</span><input type="date" name="deadline" value="${job.deadline ? String(job.deadline).slice(0, 10) : ''}"></label>
      </div>
      <label class="field"><span class="lbl">Role description <span class="req">*</span></span><textarea name="description" rows="5" placeholder="Describe the duties, working hours and conditions.">${escapeHtml(job.description || '')}</textarea></label>
      <label class="field"><span class="lbl">Requirements (one per line)</span><textarea name="requirements" rows="4" placeholder="Class 2 licence&#10;3 years experience">${escapeHtml((job.requirements || []).join('\n'))}</textarea></label>
      <div class="grid-2">
        <label class="field"><span class="lbl">Contact email</span><input type="email" name="contactEmail" value="${escapeHtml(job.contactEmail || state.user.email)}"></label>
        <label class="field"><span class="lbl">Contact phone</span><input type="tel" name="contactPhone" value="${escapeHtml(job.contactPhone || state.user.phone || '')}"></label>
      </div>
      <div class="form-actions"><button class="btn" type="submit" id="job-save">${job.id ? 'Save changes' : 'Submit for review'}</button><button class="btn btn-ghost" type="button" data-close>Cancel</button></div>
    </form>`;
  }

  async function openJobForm(job) {
    if (!meta.jobCategories.length) await loadMeta();
    const j = job || {};
    modal({ title: j.id ? 'Edit job listing' : 'Post a new job', body: jobFormHtml(j), large: true });
    document.getElementById('job-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = document.getElementById('job-save');
      busy(btn, true, 'Saving…');
      try {
        const payload = formToObject(e.target);
        const res = j.id
          ? await api('/jobs/' + j.id, { method: 'PATCH', body: payload })
          : await api('/jobs', { method: 'POST', body: payload });
        closeModal();
        toast(res.message || 'Saved');
        render();
      } catch (err) {
        busy(btn, false);
        if (err.data && err.data.errors) showErrors(e.target, err.data.errors);
        else toast(err.message, 'err');
      }
    });
  }

  function listingFormHtml(p) {
    return `<form id="listing-form">
      <div class="grid-2">
        <label class="field"><span class="lbl">Business name <span class="req">*</span></span><input type="text" name="businessName" value="${escapeHtml(p.businessName || '')}"></label>
        <label class="field"><span class="lbl">Tagline</span><input type="text" name="tagline" value="${escapeHtml(p.tagline || '')}" placeholder="One line that sells your service"></label>
      </div>
      <div class="grid-2">
        <label class="field"><span class="lbl">Service category</span><select name="categoryId">${optionsHtml(meta.serviceCategories, p.category?.id, 'Select a category')}</select></label>
        <label class="field"><span class="lbl">Area</span><select name="locationId">${optionsHtml(meta.locations, p.location?.id, 'Select an area')}</select></label>
      </div>
      <div class="grid-3">
        <label class="field"><span class="lbl">Phone <span class="req">*</span></span><input type="tel" name="phone" value="${escapeHtml(p.phone || state.user.phone || '')}"></label>
        <label class="field"><span class="lbl">WhatsApp</span><input type="tel" name="whatsapp" value="${escapeHtml(p.whatsapp || '')}"></label>
        <label class="field"><span class="lbl">Email</span><input type="email" name="email" value="${escapeHtml(p.email || state.user.email)}"></label>
      </div>
      <div class="grid-3">
        <label class="field"><span class="lbl">Starting price (USD)</span><input type="number" name="priceFrom" min="0" step="5" value="${p.priceFrom ?? ''}"></label>
        <label class="field"><span class="lbl">Years of experience</span><input type="number" name="yearsExperience" min="0" value="${p.yearsExperience ?? 0}"></label>
        <label class="field"><span class="lbl">Availability</span><select name="availability">${[['available', 'Available now'], ['busy', 'Busy'], ['unavailable', 'Unavailable']].map(([v, l]) => `<option value="${v}" ${p.availability === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
      </div>
      <label class="field"><span class="lbl">Address</span><input type="text" name="address" value="${escapeHtml(p.address || '')}" placeholder="e.g. Tshitshi Business Centre, Plumtree"></label>
      <label class="field"><span class="lbl">About your business <span class="req">*</span></span><textarea name="description" rows="5">${escapeHtml(p.description || '')}</textarea></label>
      <label class="field"><span class="lbl">Services offered (one per line)</span><textarea name="services" rows="5" placeholder="Borehole drilling&#10;Pump installation">${escapeHtml((p.services || []).join('\n'))}</textarea></label>
      <div class="form-actions"><button class="btn" type="submit" id="listing-save">${p.id ? 'Save changes' : 'Submit for review'}</button><button class="btn btn-ghost" type="button" data-close>Cancel</button></div>
    </form>`;
  }

  async function openListingForm(p) {
    if (!meta.serviceCategories.length) await loadMeta();
    const item = p || {};
    modal({ title: item.id ? 'Edit service listing' : 'Add a service listing', body: listingFormHtml(item), large: true });
    document.getElementById('listing-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = document.getElementById('listing-save');
      busy(btn, true, 'Saving…');
      try {
        const payload = formToObject(e.target);
        const res = item.id
          ? await api('/providers/' + item.id, { method: 'PATCH', body: payload })
          : await api('/providers', { method: 'POST', body: payload });
        closeModal();
        toast(res.message || 'Saved');
        render();
      } catch (err) {
        busy(btn, false);
        if (err.data && err.data.errors) showErrors(e.target, err.data.errors);
        else toast(err.message, 'err');
      }
    });
  }

  function optionsHtml(list, selectedId, placeholder) {
    return `<option value="">${escapeHtml(placeholder)}</option>` + list.map((x) =>
      `<option value="${x.id}" ${Number(selectedId) === x.id ? 'selected' : ''}>${escapeHtml(x.name)}</option>`).join('');
  }

  /* ---------- employer: applicants ---------- */
  const STATUS_FLOW = [['submitted', 'Submitted'], ['reviewing', 'Reviewing'], ['shortlisted', 'Shortlisted'], ['interview', 'Interview'], ['hired', 'Hired'], ['rejected', 'Rejected']];

  async function renderApplicants(main) {
    const [{ jobs }, { applications }] = await Promise.all([api('/jobs/mine/list'), api('/dashboard/job-applications')]);
    const jobOptions = jobs.map((j) => `<option value="${j.id}">${escapeHtml(j.title)} (${j.applicationCount})</option>`).join('');

    main.innerHTML = `
      <div class="page-head"><div><h2>Applicants</h2><p class="sub">${applications.length} application${applications.length === 1 ? '' : 's'} across your listings</p></div></div>
      <div class="panel" style="margin-bottom:1rem"><div class="panel-body row row-wrap">
        <select id="filter-job" style="max-width:320px"><option value="">All job listings</option>${jobOptions}</select>
        <select id="filter-status" style="max-width:200px"><option value="">All statuses</option>${STATUS_FLOW.map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select>
        <span class="small muted grow" id="app-count">${applications.length} shown</span>
      </div></div>
      <div id="applicant-list"></div>`;

    let current = applications;
    const listHost = document.getElementById('applicant-list');

    function draw() {
      const jobId = document.getElementById('filter-job').value;
      const status = document.getElementById('filter-status').value;
      current = applications.filter((a) => (!jobId || a.jobId === Number(jobId)) && (!status || a.status === status));
      document.getElementById('app-count').textContent = current.length + ' shown';
      listHost.innerHTML = current.length ? `<div class="panel"><div class="table-wrap"><table class="data">
        <thead><tr><th>Applicant</th><th>Job</th><th>Expected</th><th>Status</th><th>Applied</th><th></th></tr></thead>
        <tbody>${current.map((a) => `
          <tr>
            <td><div class="row"><div class="avatar" style="width:30px;height:30px;font-size:.75rem">${escapeHtml(initials(a.applicantName))}</div>
              <div><b class="small">${escapeHtml(a.applicantName)}</b><div class="tiny muted">${escapeHtml(a.applicantEmail || '')}</div></div></div></td>
            <td class="small">${escapeHtml(a.jobTitle)}</td>
            <td class="small">${a.expectedSalary ? escapeHtml(money(a.expectedSalary, 'USD')) : '—'}</td>
            <td>${statusBadge(a.status, a.statusLabel)}</td>
            <td class="small muted nowrap">${escapeHtml(timeAgo(a.createdAt))}</td>
            <td class="actions"><button class="btn btn-xs" data-review="${a.id}">Review</button></td>
          </tr>`).join('')}</tbody>
      </table></div></div>` : '<div class="empty"><span class="icon">📭</span><b>No applications match</b><p>Try a different filter.</p></div>';
    }

    document.getElementById('filter-job').addEventListener('change', draw);
    document.getElementById('filter-status').addEventListener('change', draw);
    draw();

    listHost.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-review]');
      if (!btn) return;
      openApplicant(current.find((a) => a.id === Number(btn.dataset.review)));
    });
  }

  function openApplicant(a) {
    modal({
      title: `Application: ${a.applicantName}`,
      large: true,
      body: `<div class="grid-2" style="gap:0 1.4rem">
          <div>
            <div class="row"><div class="avatar">${escapeHtml(initials(a.applicantName))}</div>
              <div><b>${escapeHtml(a.applicantName)}</b><div class="tiny muted">${escapeHtml(a.applicantEmail || '')}</div></div></div>
            <dl class="kv" style="margin-top:.9rem">
              <dt>Phone</dt><dd>${escapeHtml(a.applicantPhone || '—')}</dd>
              <dt>Area</dt><dd>${escapeHtml(a.applicantWard || '—')}</dd>
              <dt>Applied for</dt><dd>${escapeHtml(a.jobTitle)}</dd>
              <dt>Expected salary</dt><dd>${a.expectedSalary ? escapeHtml(money(a.expectedSalary, 'USD')) : '—'}</dd>
              <dt>Applied</dt><dd>${escapeHtml(dateLabel(a.createdAt))}</dd>
              <dt>CV link</dt><dd>${a.cvUrl ? `<a href="${escapeHtml(a.cvUrl)}" target="_blank" rel="noopener">Open CV</a>` : '—'}</dd>
            </dl>
            ${a.applicantBio ? `<div class="divider"></div><h4>Profile</h4><p class="small">${escapeHtml(a.applicantBio)}</p>` : ''}
            <div class="divider"></div><h4>Cover letter</h4>
            <p class="small" style="white-space:pre-line">${escapeHtml(a.coverLetter || 'No cover letter provided.')}</p>
          </div>
          <div>
            <form id="applicant-form">
              <label class="field"><span class="lbl">Application status</span>
                <select name="status">${STATUS_FLOW.map(([v, l]) => `<option value="${v}" ${a.status === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
              <label class="field"><span class="lbl">Internal note (not shown to applicant)</span>
                <textarea name="employerNote" rows="5" placeholder="Interview notes, reference checks…">${escapeHtml(a.employerNote || '')}</textarea></label>
              <button class="btn btn-block" type="submit" id="applicant-save">Update application</button>
            </form>
            <div class="divider"></div>
            <div class="btn-group">
              <a class="btn btn-sm btn-ghost" href="mailto:${escapeHtml(a.applicantEmail || '')}">✉ Email</a>
              ${a.applicantPhone ? `<a class="btn btn-sm btn-ghost" href="tel:${escapeHtml(a.applicantPhone)}">☎ Call</a>` : ''}
              <a class="btn btn-sm btn-ghost" href="/job.html?id=${a.jobId}">View job</a>
            </div>
          </div>
        </div>`,
    });
    document.getElementById('applicant-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = document.getElementById('applicant-save');
      busy(btn, true, 'Saving…');
      try {
        await api(`/dashboard/applications/${a.id}`, { method: 'PATCH', body: formToObject(e.target) });
        closeModal();
        toast('Application updated');
        render();
      } catch (err) { busy(btn, false); toast(err.message, 'err'); }
    });
  }

  async function loadMeta() {
    try {
      const [jc, sc, locs] = await Promise.all([
        api('/meta/categories?kind=job'), api('/meta/categories?kind=service'), api('/meta/locations'),
      ]);
      meta = { jobCategories: jc.categories, serviceCategories: sc.categories, locations: locs.locations };
    } catch { /* keep defaults */ }
  }

  async function boot() {
    if (!PC.requireLogin()) return;
    await PC.refreshUser();
    if (!state.user) { location.href = '/login.html'; return; }
    if (state.user.role === 'admin') { location.href = '/admin.html'; return; }
    const valid = navFor(state.user).map(([k]) => k);
    if (!valid.includes(activeView)) activeView = 'overview';
    shell();
    await loadMeta();
    await render();
  }

  boot();
})();
