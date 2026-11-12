/* Admin panel */
(function () {
  'use strict';
  const PC = window.PC;
  const {
    api, escapeHtml, money, dateLabel, dateTimeLabel, timeAgo, statusBadge, toast, modal, closeModal,
    confirmDialog, busy, state, formToObject, showErrors, initials,
  } = PC;

  const root = document.getElementById('admin-root');
  let meta = { categories: [], locations: [], jobCategories: [], serviceCategories: [] };
  let activeView = PC.qs('view') || 'overview';
  let statsCache = null;

  const NAV = [
    ['overview', 'Dashboard', '📊'],
    ['jobs', 'Job moderation', '💼'],
    ['providers', 'Service moderation', '🔧'],
    ['users', 'Users', '👥'],
    ['applications', 'Applications', '📨'],
    ['requests', 'Service requests', '📥'],
    ['reviews', 'Reviews', '⭐'],
    ['categories', 'Categories', '🗂️'],
    ['locations', 'Locations', '📍'],
    ['audit', 'Audit log', '🕓'],
    ['settings', 'Settings', '⚙️'],
  ];

  function shell() {
    root.innerHTML = `
      <div class="app-shell">
        <aside class="app-nav">
          <div class="who">
            <div class="row">
              <div class="avatar avatar-clay">${escapeHtml(initials(state.user.name))}</div>
              <div style="min-width:0"><b>${escapeHtml(state.user.name)}</b><span>Administrator</span></div>
            </div>
          </div>
          <nav id="admin-nav">
            ${NAV.map(([key, label, ic]) => `<button data-view="${key}" class="${key === activeView ? 'active' : ''}"><span class="ic">${ic}</span>${escapeHtml(label)}</button>`).join('')}
          </nav>
          <div class="divider"></div>
          <a class="btn btn-ghost btn-block btn-sm" href="/">← Back to site</a>
        </aside>
        <main class="app-main" id="admin-main"><div class="spinner"></div></main>
      </div>`;
    root.querySelector('#admin-nav').addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-view]');
      if (!btn) return;
      setView(btn.dataset.view);
    });
  }

  function setView(view) {
    activeView = view;
    PC.setQuery({ view }, { replace: true });
    root.querySelectorAll('#admin-nav button').forEach((b) => b.classList.toggle('active', b.dataset.view === view));
    render();
  }

  // A fresh container per render so delegated listeners never accumulate
  // across view switches.
  async function render() {
    const host = document.getElementById('admin-main');
    host.innerHTML = '<div id="admin-view"><div class="spinner"></div></div>';
    const m = document.getElementById('admin-view');
    try {
      const map = {
        overview: renderOverview, jobs: renderJobs, providers: renderProviders, users: renderUsers,
        applications: renderApplications, requests: renderRequests, reviews: renderReviews,
        categories: renderCategories, locations: renderLocations, audit: renderAudit, settings: renderSettings,
      };
      await (map[activeView] || renderOverview)(m);
    } catch (e) {
      m.innerHTML = `<div class="alert alert-error">${escapeHtml(e.message)}</div>`;
    }
  }

  /* ---------- overview / dashboard ---------- */
  function barList(rows, { valueKey = 'count', labelKey = 'label', clay = false, iconKey = null } = {}) {
    if (!rows.length) return '<p class="muted small">No data yet.</p>';
    const max = Math.max(1, ...rows.map((r) => r[valueKey] || 0));
    return rows.map((r) => `
      <div class="bar-row">
        <span class="bl" title="${escapeHtml(r[labelKey])}">${iconKey && r[iconKey] ? escapeHtml(r[iconKey]) + ' ' : ''}${escapeHtml(r[labelKey])}</span>
        <span class="bar-track"><span class="bar-fill ${clay ? 'clay' : ''}" style="width:${((r[valueKey] || 0) / max) * 100}%"></span></span>
        <span class="bv">${r[valueKey] || 0}</span>
      </div>`).join('');
  }

  function donut(rows, colors) {
    const total = rows.reduce((s, r) => s + r.count, 0) || 1;
    let acc = 0;
    const stops = rows.map((r, i) => {
      const from = (acc / total) * 100;
      acc += r.count;
      const to = (acc / total) * 100;
      return `${colors[i % colors.length]} ${from}% ${to}%`;
    }).join(', ');
    return `<div class="donut-wrap">
      <div class="donut" style="background:conic-gradient(${stops})"></div>
      <div class="donut-legend grow">${rows.map((r, i) => `
        <div><i style="background:${colors[i % colors.length]}"></i>${escapeHtml(r.label)}<b>${r.count}</b></div>`).join('')}</div>
    </div>`;
  }

  const COLORS = ['#2d8a4e', '#d9822b', '#1d5a86', '#9aab9f', '#8a4b21', '#226b3d', '#b3261e', '#64776c'];

  async function renderOverview(m) {
    const s = await api('/admin/stats');
    statsCache = s;
    const c = s.counts;
    const pending = c.pendingJobs + c.pendingProviders;

    const card = (label, value, sub, cls = '') => `
      <div class="stat-card ${cls}"><div class="k">${escapeHtml(label)}</div><div class="v">${Number(value).toLocaleString('en-US')}</div>${sub ? `<div class="s">${escapeHtml(sub)}</div>` : ''}</div>`;

    const signupMax = Math.max(1, ...s.signups.map((d) => d.users + d.jobs + d.providers + d.applications));

    m.innerHTML = `
      <div class="page-head">
        <div><h2>Administrator dashboard</h2><p class="sub">Platform health for Plumtree Connect · ${escapeHtml(dateTimeLabel(new Date().toISOString()))}</p></div>
        <div class="btn-group">
          ${pending ? `<button class="btn btn-clay" data-goto="${c.pendingJobs >= c.pendingProviders ? 'jobs' : 'providers'}">⚑ ${pending} awaiting review</button>` : '<span class="badge badge-green">All queues clear</span>'}
          <button class="btn btn-ghost" id="refresh-stats">↻ Refresh</button>
        </div>
      </div>

      <div class="stat-grid">
        ${card('Total users', c.users, `${c.seekers} seekers · ${c.employers} employers · ${c.providers} providers`, 'accent')}
        ${card('Pending review', pending, `${c.pendingJobs} jobs · ${c.pendingProviders} providers`, pending ? 'clay' : '')}
        ${card('Live jobs', c.approvedJobs, `${c.jobs} total listings`)}
        ${card('Live providers', c.approvedProviders, `${c.verifiedProviders} verified`)}
        ${card('Applications', c.applications, 'across all jobs')}
        ${card('Service requests', c.serviceRequests, `${c.openRequests} open`)}
        ${card('Job views', c.jobViews, 'all listings')}
        ${card('Provider views', c.providerViews, 'all listings')}
        ${card('Reviews', c.reviews, `${c.hiddenReviews} hidden`)}
        ${card('Categories', c.categories, `${c.locations} locations`)}
      </div>

      <div class="chart-grid" style="margin-top:1.4rem">
        <div class="chart-box">
          <h3>New activity — last 14 days</h3>
          <div class="col-chart">
            ${s.signups.map((d) => {
              const total = d.users + d.jobs + d.providers + d.applications;
              const h = (total / signupMax) * 120;
              const seg = (v) => total ? (v / total) * h : 0;
              return `<div class="col" title="${d.day}: ${d.users} users, ${d.jobs} jobs, ${d.providers} providers, ${d.applications} applications">
                <div class="stack" style="height:${Math.max(h, total ? 3 : 1)}px">
                  <span class="seg users" style="height:${seg(d.users)}px"></span>
                  <span class="seg jobs" style="height:${seg(d.jobs)}px"></span>
                  <span class="seg providers" style="height:${seg(d.providers)}px"></span>
                  <span class="seg apps" style="height:${seg(d.applications)}px"></span>
                </div>
                <span class="cl">${escapeHtml(d.day.slice(5))}</span>
              </div>`;
            }).join('')}
          </div>
          <div class="legend">
            <span><i style="background:#2d8a4e"></i>Users</span>
            <span><i style="background:#d9822b"></i>Jobs</span>
            <span><i style="background:#1d5a86"></i>Providers</span>
            <span><i style="background:#9aab9f"></i>Applications</span>
          </div>
        </div>

        <div class="chart-box">
          <h3>Users by role</h3>
          ${donut(s.usersByRole.map((r) => ({ label: PC.roleLabel(r.label), count: r.count })), COLORS)}
        </div>

        <div class="chart-box">
          <h3>Job listings by status</h3>
          ${donut(s.jobsByStatus.map((r) => ({ label: r.label, count: r.count })), COLORS)}
        </div>

        <div class="chart-box">
          <h3>Service listings by status</h3>
          ${donut(s.providersByStatus.map((r) => ({ label: r.label, count: r.count })), COLORS)}
        </div>

        <div class="chart-box">
          <h3>Applications by status</h3>
          ${barList(s.applicationsByStatus.map((r) => ({ label: r.label, count: r.count })), { clay: true })}
        </div>

        <div class="chart-box">
          <h3>Service requests by status</h3>
          ${barList(s.requestsByStatus.map((r) => ({ label: r.label, count: r.count })), { clay: true })}
        </div>

        <div class="chart-box">
          <h3>Jobs by category</h3>
          ${barList(s.jobsByCategory.map((r) => ({ label: r.label, count: r.count })), { iconKey: 'icon' })}
        </div>

        <div class="chart-box">
          <h3>Providers by category</h3>
          ${barList(s.providersByCategory.map((r) => ({ label: r.label, count: r.count })), { iconKey: 'icon', clay: true })}
        </div>
      </div>

      <div class="chart-grid" style="margin-top:1rem">
        <div class="chart-box">
          <h3>Busiest locations</h3>
          <div class="table-wrap"><table class="data">
            <thead><tr><th>Location</th><th>Jobs</th><th>Providers</th><th>Total</th></tr></thead>
            <tbody>${s.activityByLocation.map((l) => `<tr><td>${escapeHtml(l.label)}</td><td>${l.jobs}</td><td>${l.providers}</td><td><b>${l.jobs + l.providers}</b></td></tr>`).join('')}</tbody>
          </table></div>
        </div>
        <div class="chart-box">
          <h3>Most viewed jobs</h3>
          <div class="table-wrap"><table class="data">
            <thead><tr><th>Job</th><th>Views</th><th>Applicants</th></tr></thead>
            <tbody>${s.topJobs.map((j) => `<tr><td><a href="/job.html?id=${j.id}">${escapeHtml(j.title)}</a><div class="tiny muted">${escapeHtml(j.company)}</div></td><td>${j.views}</td><td>${j.applications}</td></tr>`).join('')}</tbody>
          </table></div>
        </div>
        <div class="chart-box">
          <h3>Most viewed providers</h3>
          <div class="table-wrap"><table class="data">
            <thead><tr><th>Business</th><th>Views</th><th>Requests</th><th>Rating</th></tr></thead>
            <tbody>${s.topProviders.map((p) => `<tr><td><a href="/provider.html?id=${p.id}">${escapeHtml(p.business_name)}</a></td><td>${p.views}</td><td>${p.requests}</td><td>${p.rating ?? '—'}</td></tr>`).join('')}</tbody>
          </table></div>
        </div>
        <div class="chart-box">
          <h3>Recent admin activity</h3>
          <div class="table-wrap"><table class="data">
            <thead><tr><th>Action</th><th>Entity</th><th>By</th><th>When</th></tr></thead>
            <tbody>${s.recentAudit.map((a) => `<tr><td><b class="small">${escapeHtml(a.action)}</b></td><td class="small muted">${escapeHtml(a.entity)}${a.entityId ? ' #' + a.entityId : ''}</td><td class="small">${escapeHtml(a.actorName || 'system')}</td><td class="small muted nowrap">${escapeHtml(timeAgo(a.createdAt))}</td></tr>`).join('') || '<tr><td colspan="4" class="muted small">No activity logged yet.</td></tr>'}</tbody>
          </table></div>
        </div>
      </div>`;

    m.querySelectorAll('[data-goto]').forEach((b) => b.addEventListener('click', () => setView(b.dataset.goto)));
    document.getElementById('refresh-stats')?.addEventListener('click', () => { toast('Refreshed'); render(); });
  }

  /* ---------- job moderation ---------- */
  async function renderJobs(m) {
    const status = PC.qs('status') || '';
    const q = PC.qs('q') || '';
    const data = await api(`/admin/jobs?per_page=50${status ? '&status=' + status : ''}${q ? '&q=' + encodeURIComponent(q) : ''}`);
    m.innerHTML = `
      <div class="page-head">
        <div><h2>Job moderation</h2><p class="sub">${data.pagination.total} listing${data.pagination.total === 1 ? '' : 's'} · approve, reject or feature vacancies</p></div>
      </div>
      <div class="panel" style="margin-bottom:1rem"><div class="panel-body row row-wrap">
        <div class="chips">
          ${['', 'pending', 'approved', 'rejected', 'closed'].map((s) => `<button class="chip ${status === s ? 'active' : ''}" data-status="${s}">${s === '' ? 'All' : escapeHtml(s)}</button>`).join('')}
        </div>
        <div class="grow"></div>
        <input type="search" id="job-search" placeholder="Search title or company…" value="${escapeHtml(q)}" style="max-width:280px">
      </div></div>
      <div class="panel"><div class="table-wrap"><table class="data">
        <thead><tr><th>Job</th><th>Employer</th><th>Category</th><th>Applicants</th><th>Views</th><th>Status</th><th>Posted</th><th></th></tr></thead>
        <tbody>${data.jobs.length ? data.jobs.map((j) => `
          <tr class="${j.status === 'pending' ? 'row-flag' : ''}">
            <td><a href="/job.html?id=${j.id}"><b>${escapeHtml(j.title)}</b></a>
              <div class="tiny muted">${escapeHtml(j.jobTypeLabel)} · ${escapeHtml(j.workModeLabel)}${j.location ? ' · ' + escapeHtml(j.location.name) : ''}${j.featured ? ' · <span class="badge badge-clay">Featured</span>' : ''}</div></td>
            <td class="small">${escapeHtml(j.employerName || j.company)}</td>
            <td class="small muted">${escapeHtml(j.category?.name || '—')}</td>
            <td class="small">${j.applicationCount}</td>
            <td class="small">${j.views}</td>
            <td>${statusBadge(j.status, j.statusLabel)}${j.rejectionReason ? `<div class="tiny" style="color:var(--danger)">${escapeHtml(j.rejectionReason)}</div>` : ''}</td>
            <td class="small muted nowrap">${escapeHtml(timeAgo(j.createdAt))}</td>
            <td class="actions">
              <button class="btn btn-xs btn-ghost" data-inspect="${j.id}">Inspect</button>
              ${j.status !== 'approved' ? `<button class="btn btn-xs" data-approve="${j.id}">Approve</button>` : ''}
              ${j.status !== 'rejected' ? `<button class="btn btn-xs btn-ghost" data-reject="${j.id}">Reject</button>` : ''}
              <button class="btn btn-xs btn-ghost" data-feature="${j.id}" data-featured="${j.featured ? 1 : 0}">${j.featured ? '★ Unfeature' : '☆ Feature'}</button>
            </td>
          </tr>`).join('') : '<tr><td colspan="8" class="muted small" style="padding:1.4rem">No listings match.</td></tr>'}</tbody>
      </table></div></div>`;

    const jobs = data.jobs;
    m.querySelectorAll('[data-status]').forEach((b) => b.addEventListener('click', () => { PC.setQuery({ status: b.dataset.status, view: 'jobs' }); render(); }));
    const search = document.getElementById('job-search');
    search.addEventListener('input', PC.debounce((e) => { PC.setQuery({ q: e.target.value, view: 'jobs' }); render(); }, 450));
    search.focus();
    search.setSelectionRange(search.value.length, search.value.length);

    m.addEventListener('click', async (e) => {
      const approve = e.target.closest('[data-approve]');
      if (approve) return moderateJob(approve.dataset.approve, { status: 'approved' });
      const reject = e.target.closest('[data-reject]');
      if (reject) return rejectJob(reject.dataset.reject);
      const feature = e.target.closest('[data-feature]');
      if (feature) return moderateJob(feature.dataset.feature, { featured: feature.dataset.featured !== '1' });
      const inspect = e.target.closest('[data-inspect]');
      if (inspect) return inspectJob(jobs.find((j) => j.id === Number(inspect.dataset.inspect)));
    });
  }

  async function moderateJob(id, patch) {
    try {
      const res = await api('/admin/jobs/' + id, { method: 'PATCH', body: patch });
      toast(res.message || 'Job updated');
      render();
    } catch (e) { toast(e.message, 'err'); }
  }

  function rejectJob(id) {
    modal({
      title: 'Reject job listing',
      body: `<form id="reject-form">
        <p class="small muted">Give the employer a reason. It appears on their listing.</p>
        <label class="field"><span class="lbl">Reason</span>
          <textarea name="rejectionReason" rows="3">Does not meet listing guidelines</textarea></label>
        <div class="form-actions"><button class="btn btn-danger" type="submit" id="reject-save">Reject listing</button><button class="btn btn-ghost" type="button" data-close>Cancel</button></div>
      </form>`,
    });
    document.getElementById('reject-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = document.getElementById('reject-save');
      busy(btn, true, 'Rejecting…');
      try {
        await api('/admin/jobs/' + id, { method: 'PATCH', body: { status: 'rejected', rejectionReason: formToObject(e.target).rejectionReason } });
        closeModal();
        toast('Job rejected');
        render();
      } catch (err) { busy(btn, false); toast(err.message, 'err'); }
    });
  }

  function inspectJob(j) {
    modal({
      title: j.title, large: true,
      body: `<dl class="kv">
          <dt>Employer</dt><dd>${escapeHtml(j.employerName || j.company)} · ${escapeHtml(j.employerEmail || '')}</dd>
          <dt>Company</dt><dd>${escapeHtml(j.company)}</dd>
          <dt>Category</dt><dd>${escapeHtml(j.category?.name || '—')}</dd>
          <dt>Area</dt><dd>${escapeHtml(j.location?.name || '—')}</dd>
          <dt>Type</dt><dd>${escapeHtml(j.jobTypeLabel)} · ${escapeHtml(j.workModeLabel)}</dd>
          <dt>Salary</dt><dd>${escapeHtml(j.salaryLabel)}</dd>
          <dt>Vacancies</dt><dd>${j.vacancies}</dd>
          <dt>Deadline</dt><dd>${j.deadline ? escapeHtml(dateLabel(j.deadline)) : 'Rolling'}</dd>
          <dt>Contact</dt><dd>${escapeHtml(j.contactEmail || '—')} · ${escapeHtml(j.contactPhone || '—')}</dd>
          <dt>Status</dt><dd>${statusBadge(j.status, j.statusLabel)}</dd>
          <dt>Posted</dt><dd>${escapeHtml(dateTimeLabel(j.createdAt))}</dd>
        </dl>
        <div class="divider"></div><h4>Description</h4>
        <p class="small" style="white-space:pre-line">${escapeHtml(j.description)}</p>
        ${j.requirements && j.requirements.length ? `<h4>Requirements</h4><ul class="list-check">${j.requirements.map((r) => `<li>${escapeHtml(r)}</li>`).join('')}</ul>` : ''}
        <div class="divider"></div>
        <div class="btn-group">
          <a class="btn btn-sm btn-ghost" href="/job.html?id=${j.id}" target="_blank" rel="noopener">Open public page</a>
          <button class="btn btn-sm" data-close>Close</button>
        </div>`,
    });
  }

  /* ---------- provider moderation ---------- */
  async function renderProviders(m) {
    const status = PC.qs('status') || '';
    const q = PC.qs('q') || '';
    const data = await api(`/admin/providers?per_page=50${status ? '&status=' + status : ''}${q ? '&q=' + encodeURIComponent(q) : ''}`);
    m.innerHTML = `
      <div class="page-head"><div><h2>Service moderation</h2><p class="sub">${data.pagination.total} listing${data.pagination.total === 1 ? '' : 's'} · approve, verify or feature providers</p></div></div>
      <div class="panel" style="margin-bottom:1rem"><div class="panel-body row row-wrap">
        <div class="chips">${['', 'pending', 'approved', 'rejected', 'suspended'].map((s) => `<button class="chip ${status === s ? 'active' : ''}" data-status="${s}">${s === '' ? 'All' : escapeHtml(s)}</button>`).join('')}</div>
        <div class="grow"></div>
        <input type="search" id="prov-search" placeholder="Search business name…" value="${escapeHtml(q)}" style="max-width:280px">
      </div></div>
      <div class="panel"><div class="table-wrap"><table class="data">
        <thead><tr><th>Business</th><th>Owner</th><th>Category</th><th>Requests</th><th>Rating</th><th>Status</th><th></th></tr></thead>
        <tbody>${data.providers.length ? data.providers.map((p) => `
          <tr class="${p.status === 'pending' ? 'row-flag' : ''}">
            <td><a href="/provider.html?id=${p.id}"><b>${escapeHtml(p.businessName)}</b></a>
              <div class="tiny muted">${p.location ? escapeHtml(p.location.name) : '—'}${p.verified ? ' · <span class="badge badge-green">Verified</span>' : ''}${p.featured ? ' · <span class="badge badge-clay">Featured</span>' : ''}</div></td>
            <td class="small">${escapeHtml(p.ownerName || '—')}<div class="tiny muted">${escapeHtml(p.email || '')}</div></td>
            <td class="small muted">${escapeHtml(p.category?.name || '—')}</td>
            <td class="small">${p.requestCount}</td>
            <td class="small">${p.rating ? p.rating + ' ★ (' + p.ratingCount + ')' : '—'}</td>
            <td>${statusBadge(p.status, p.status)}${p.rejectionReason ? `<div class="tiny" style="color:var(--danger)">${escapeHtml(p.rejectionReason)}</div>` : ''}</td>
            <td class="actions">
              <button class="btn btn-xs btn-ghost" data-inspect="${p.id}">Inspect</button>
              ${p.status !== 'approved' ? `<button class="btn btn-xs" data-approve="${p.id}">Approve</button>` : ''}
              ${p.status !== 'rejected' ? `<button class="btn btn-xs btn-ghost" data-reject="${p.id}">Reject</button>` : ''}
              <button class="btn btn-xs btn-ghost" data-verify="${p.id}" data-verified="${p.verified ? 1 : 0}">${p.verified ? '✓ Unverify' : '✓ Verify'}</button>
              <button class="btn btn-xs btn-ghost" data-feature="${p.id}" data-featured="${p.featured ? 1 : 0}">${p.featured ? '★ Unfeature' : '☆ Feature'}</button>
            </td>
          </tr>`).join('') : '<tr><td colspan="7" class="muted small" style="padding:1.4rem">No listings match.</td></tr>'}</tbody>
      </table></div></div>`;

    const providers = data.providers;
    m.querySelectorAll('[data-status]').forEach((b) => b.addEventListener('click', () => { PC.setQuery({ status: b.dataset.status, view: 'providers' }); render(); }));
    const search = document.getElementById('prov-search');
    search.addEventListener('input', PC.debounce((e) => { PC.setQuery({ q: e.target.value, view: 'providers' }); render(); }, 450));
    search.focus();
    search.setSelectionRange(search.value.length, search.value.length);

    m.addEventListener('click', async (e) => {
      const approve = e.target.closest('[data-approve]');
      if (approve) return moderateProvider(approve.dataset.approve, { status: 'approved' });
      const verify = e.target.closest('[data-verify]');
      if (verify) return moderateProvider(verify.dataset.verify, { verified: verify.dataset.verified !== '1' });
      const feature = e.target.closest('[data-feature]');
      if (feature) return moderateProvider(feature.dataset.feature, { featured: feature.dataset.featured !== '1' });
      const reject = e.target.closest('[data-reject]');
      if (reject) return rejectProvider(reject.dataset.reject);
      const inspect = e.target.closest('[data-inspect]');
      if (inspect) return inspectProvider(providers.find((p) => p.id === Number(inspect.dataset.inspect)));
    });
  }

  async function moderateProvider(id, patch) {
    try {
      const res = await api('/admin/providers/' + id, { method: 'PATCH', body: patch });
      toast(res.message || 'Provider updated');
      render();
    } catch (e) { toast(e.message, 'err'); }
  }

  function rejectProvider(id) {
    modal({
      title: 'Reject service listing',
      body: `<form id="reject-form">
        <p class="small muted">Give the provider a reason. It appears on their listing.</p>
        <label class="field"><span class="lbl">Reason</span><textarea name="rejectionReason" rows="3">Does not meet listing guidelines</textarea></label>
        <div class="form-actions"><button class="btn btn-danger" type="submit" id="reject-save">Reject listing</button><button class="btn btn-ghost" type="button" data-close>Cancel</button></div>
      </form>`,
    });
    document.getElementById('reject-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = document.getElementById('reject-save');
      busy(btn, true, 'Rejecting…');
      try {
        await api('/admin/providers/' + id, { method: 'PATCH', body: { status: 'rejected', rejectionReason: formToObject(e.target).rejectionReason } });
        closeModal();
        toast('Provider rejected');
        render();
      } catch (err) { busy(btn, false); toast(err.message, 'err'); }
    });
  }

  function inspectProvider(p) {
    modal({
      title: p.businessName, large: true,
      body: `<dl class="kv">
          <dt>Owner</dt><dd>${escapeHtml(p.ownerName || '—')} · ${escapeHtml(p.ownerEmail || '')}</dd>
          <dt>Category</dt><dd>${escapeHtml(p.category?.name || '—')}</dd>
          <dt>Area</dt><dd>${escapeHtml(p.location?.name || '—')}</dd>
          <dt>Phone</dt><dd>${escapeHtml(p.phone || '—')}${p.whatsapp ? ' · WhatsApp ' + escapeHtml(p.whatsapp) : ''}</dd>
          <dt>Email</dt><dd>${escapeHtml(p.email || '—')}</dd>
          <dt>Address</dt><dd>${escapeHtml(p.address || '—')}</dd>
          <dt>Starting price</dt><dd>${escapeHtml(money(p.priceFrom, p.currency))}</dd>
          <dt>Experience</dt><dd>${p.yearsExperience} years</dd>
          <dt>Availability</dt><dd>${escapeHtml(p.availabilityLabel)}</dd>
          <dt>Status</dt><dd>${statusBadge(p.status, p.status)}</dd>
          <dt>Listed</dt><dd>${escapeHtml(dateTimeLabel(p.createdAt))}</dd>
        </dl>
        <div class="divider"></div><h4>Description</h4>
        <p class="small" style="white-space:pre-line">${escapeHtml(p.description)}</p>
        ${p.services && p.services.length ? `<h4>Services</h4><div class="tag-list">${p.services.map((s) => `<span class="tag">${escapeHtml(s)}</span>`).join('')}</div>` : ''}
        <div class="divider"></div>
        <div class="btn-group"><a class="btn btn-sm btn-ghost" href="/provider.html?id=${p.id}" target="_blank" rel="noopener">Open public page</a><button class="btn btn-sm" data-close>Close</button></div>`,
    });
  }

  /* ---------- users ---------- */
  async function renderUsers(m) {
    const role = PC.qs('role') || '';
    const status = PC.qs('ustatus') || '';
    const q = PC.qs('q') || '';
    const data = await api(`/admin/users?per_page=50${role ? '&role=' + role : ''}${status ? '&status=' + status : ''}${q ? '&q=' + encodeURIComponent(q) : ''}`);
    m.innerHTML = `
      <div class="page-head">
        <div><h2>Users</h2><p class="sub">${data.pagination.total} account${data.pagination.total === 1 ? '' : 's'}</p></div>
        <button class="btn" id="new-user">+ Add user</button>
      </div>
      <div class="panel" style="margin-bottom:1rem"><div class="panel-body row row-wrap">
        <div class="chips">${[['', 'All roles'], ['seeker', 'Seekers'], ['employer', 'Employers'], ['provider', 'Providers'], ['admin', 'Admins']].map(([v, l]) => `<button class="chip ${role === v ? 'active' : ''}" data-role="${v}">${l}</button>`).join('')}</div>
        <div class="chips">${[['', 'Any status'], ['active', 'Active'], ['suspended', 'Suspended']].map(([v, l]) => `<button class="chip ${status === v ? 'active' : ''}" data-ustatus="${v}">${l}</button>`).join('')}</div>
        <div class="grow"></div>
        <input type="search" id="user-search" placeholder="Search name, email, phone…" value="${escapeHtml(q)}" style="max-width:280px">
      </div></div>
      <div class="panel"><div class="table-wrap"><table class="data">
        <thead><tr><th>User</th><th>Role</th><th>Area</th><th>Activity</th><th>Status</th><th>Joined</th><th></th></tr></thead>
        <tbody>${data.users.map((u) => `
          <tr class="${u.status === 'suspended' ? 'row-flag' : ''}">
            <td><div class="row"><div class="avatar" style="width:30px;height:30px;font-size:.75rem">${escapeHtml(initials(u.name))}</div>
              <div><b class="small">${escapeHtml(u.name)}</b><div class="tiny muted">${escapeHtml(u.email)}${u.phone ? ' · ' + escapeHtml(u.phone) : ''}</div></div></div></td>
            <td>${statusBadge(u.role, PC.roleLabel(u.role))}</td>
            <td class="small muted">${escapeHtml(u.ward || '—')}</td>
            <td class="tiny muted">${u.jobCount ? u.jobCount + ' jobs · ' : ''}${u.providerCount ? u.providerCount + ' listings · ' : ''}${u.applicationCount ? u.applicationCount + ' applications' : ''}${!u.jobCount && !u.providerCount && !u.applicationCount ? '—' : ''}</td>
            <td>${statusBadge(u.status, u.status === 'active' ? 'Active' : 'Suspended')}</td>
            <td class="small muted nowrap">${escapeHtml(dateLabel(u.createdAt))}</td>
            <td class="actions">
              <button class="btn btn-xs btn-ghost" data-edit-user="${u.id}">Edit</button>
              <button class="btn btn-xs btn-ghost" data-reset="${u.id}">Password</button>
              ${u.status === 'active' ? `<button class="btn btn-xs btn-ghost" data-suspend="${u.id}">Suspend</button>` : `<button class="btn btn-xs" data-activate="${u.id}">Activate</button>`}
              <button class="btn btn-xs btn-ghost" data-del-user="${u.id}">Delete</button>
            </td>
          </tr>`).join('')}</tbody>
      </table></div></div>`;

    const users = data.users;
    m.querySelectorAll('[data-role]').forEach((b) => b.addEventListener('click', () => { PC.setQuery({ role: b.dataset.role, view: 'users' }); render(); }));
    m.querySelectorAll('[data-ustatus]').forEach((b) => b.addEventListener('click', () => { PC.setQuery({ ustatus: b.dataset.ustatus, view: 'users' }); render(); }));
    const search = document.getElementById('user-search');
    search.addEventListener('input', PC.debounce((e) => { PC.setQuery({ q: e.target.value, view: 'users' }); render(); }, 450));
    search.focus();
    search.setSelectionRange(search.value.length, search.value.length);

    document.getElementById('new-user').addEventListener('click', () => openUserForm(null));
    m.addEventListener('click', async (e) => {
      const edit = e.target.closest('[data-edit-user]');
      if (edit) return openUserForm(users.find((u) => u.id === Number(edit.dataset.editUser)));
      const reset = e.target.closest('[data-reset]');
      if (reset) return openResetForm(users.find((u) => u.id === Number(reset.dataset.reset)));
      const suspend = e.target.closest('[data-suspend]');
      if (suspend) {
        if (!(await confirmDialog('Suspend this account? The user will be signed out and cannot log in.', { confirmLabel: 'Suspend', danger: true }))) return;
        return patchUser(suspend.dataset.suspend, { status: 'suspended' });
      }
      const activate = e.target.closest('[data-activate]');
      if (activate) return patchUser(activate.dataset.activate, { status: 'active' });
      const del = e.target.closest('[data-del-user]');
      if (del) {
        if (!(await confirmDialog('Permanently delete this user and all their listings, applications and requests?', { confirmLabel: 'Delete user', danger: true }))) return;
        try { await api('/admin/users/' + del.dataset.delUser, { method: 'DELETE' }); toast('User deleted'); render(); }
        catch (err) { toast(err.message, 'err'); }
      }
    });
  }

  async function patchUser(id, patch) {
    try { await api('/admin/users/' + id, { method: 'PATCH', body: patch }); toast('User updated'); render(); }
    catch (e) { toast(e.message, 'err'); }
  }

  function openUserForm(user) {
    const u = user || {};
    modal({
      title: u.id ? 'Edit user' : 'Add user',
      body: `<form id="user-form">
        <div class="grid-2">
          <label class="field"><span class="lbl">Full name <span class="req">*</span></span><input type="text" name="name" value="${escapeHtml(u.name || '')}"></label>
          <label class="field"><span class="lbl">Email <span class="req">*</span></span><input type="email" name="email" value="${escapeHtml(u.email || '')}" ${u.id ? 'disabled' : ''}></label>
        </div>
        ${u.id ? '' : '<label class="field"><span class="lbl">Temporary password <span class="req">*</span></span><input type="text" name="password" placeholder="At least 8 characters"></label>'}
        <div class="grid-3">
          <label class="field"><span class="lbl">Role</span><select name="role">${['seeker', 'employer', 'provider', 'admin'].map((r) => `<option value="${r}" ${u.role === r ? 'selected' : ''}>${PC.roleLabel(r)}</option>`).join('')}</select></label>
          <label class="field"><span class="lbl">Status</span><select name="status">${[['active', 'Active'], ['suspended', 'Suspended']].map(([v, l]) => `<option value="${v}" ${u.status === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
          <label class="field"><span class="lbl">Area</span><select name="ward"><option value="">—</option>${meta.locations.map((l) => `<option value="${escapeHtml(l.name)}" ${u.ward === l.name ? 'selected' : ''}>${escapeHtml(l.name)}</option>`).join('')}</select></label>
        </div>
        <label class="field"><span class="lbl">Phone</span><input type="tel" name="phone" value="${escapeHtml(u.phone || '')}"></label>
        <label class="field"><span class="lbl">Bio</span><textarea name="bio" rows="3">${escapeHtml(u.bio || '')}</textarea></label>
        <div class="form-actions"><button class="btn" type="submit" id="user-save">${u.id ? 'Save changes' : 'Create user'}</button><button class="btn btn-ghost" type="button" data-close>Cancel</button></div>
      </form>`,
    });
    document.getElementById('user-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = document.getElementById('user-save');
      busy(btn, true, 'Saving…');
      try {
        const payload = formToObject(e.target);
        if (u.id) await api('/admin/users/' + u.id, { method: 'PATCH', body: payload });
        else await api('/admin/users', { method: 'POST', body: payload });
        closeModal();
        toast(u.id ? 'User updated' : 'User created');
        render();
      } catch (err) {
        busy(btn, false);
        if (err.data && err.data.errors) showErrors(e.target, err.data.errors);
        else toast(err.message, 'err');
      }
    });
  }

  function openResetForm(user) {
    modal({
      title: `Reset password: ${user.name}`,
      body: `<form id="reset-form">
        <p class="small muted">Set a new password for ${escapeHtml(user.email)}. Share it with the user securely.</p>
        <label class="field"><span class="lbl">New password <span class="req">*</span></span><input type="text" name="password" placeholder="At least 8 characters"></label>
        <div class="form-actions"><button class="btn" type="submit" id="reset-save">Update password</button><button class="btn btn-ghost" type="button" data-close>Cancel</button></div>
      </form>`,
    });
    document.getElementById('reset-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = document.getElementById('reset-save');
      busy(btn, true, 'Updating…');
      try {
        await api(`/admin/users/${user.id}/reset-password`, { method: 'POST', body: formToObject(e.target) });
        closeModal();
        toast('Password updated');
      } catch (err) {
        busy(btn, false);
        if (err.data && err.data.errors) showErrors(e.target, err.data.errors);
        else toast(err.message, 'err');
      }
    });
  }

  /* ---------- applications / requests / reviews ---------- */
  async function renderApplications(m) {
    const { applications } = await api('/admin/applications');
    m.innerHTML = `
      <div class="page-head"><div><h2>Applications</h2><p class="sub">Latest ${applications.length} application${applications.length === 1 ? '' : 's'} across the platform</p></div></div>
      <div class="panel"><div class="table-wrap"><table class="data">
        <thead><tr><th>Applicant</th><th>Job</th><th>Company</th><th>Expected</th><th>Status</th><th>Applied</th></tr></thead>
        <tbody>${applications.length ? applications.map((a) => `
          <tr><td><b class="small">${escapeHtml(a.applicantName)}</b><div class="tiny muted">${escapeHtml(a.applicantEmail || '')}</div></td>
            <td class="small">${escapeHtml(a.jobTitle)}</td>
            <td class="small muted">${escapeHtml(a.company || '—')}</td>
            <td class="small">${a.expectedSalary ? escapeHtml(money(a.expectedSalary, 'USD')) : '—'}</td>
            <td>${statusBadge(a.status, a.statusLabel)}</td>
            <td class="small muted nowrap">${escapeHtml(timeAgo(a.createdAt))}</td></tr>`).join('') : '<tr><td colspan="6" class="muted small" style="padding:1.4rem">No applications yet.</td></tr>'}</tbody>
      </table></div></div>`;
  }

  async function renderRequests(m) {
    const { requests } = await api('/admin/service-requests');
    m.innerHTML = `
      <div class="page-head"><div><h2>Service requests</h2><p class="sub">Latest ${requests.length} request${requests.length === 1 ? '' : 's'}</p></div></div>
      <div class="panel"><div class="table-wrap"><table class="data">
        <thead><tr><th>Service</th><th>Provider</th><th>Customer</th><th>Budget</th><th>Status</th><th>Sent</th></tr></thead>
        <tbody>${requests.length ? requests.map((r) => `
          <tr><td><b class="small">${escapeHtml(r.serviceNeeded)}</b></td>
            <td class="small">${escapeHtml(r.businessName)}</td>
            <td class="small">${escapeHtml(r.name)}<div class="tiny muted">${escapeHtml(r.phone)}</div></td>
            <td class="small">${r.budget ? escapeHtml(money(r.budget, 'USD')) : '—'}</td>
            <td>${statusBadge(r.status, r.statusLabel)}</td>
            <td class="small muted nowrap">${escapeHtml(timeAgo(r.createdAt))}</td></tr>`).join('') : '<tr><td colspan="6" class="muted small" style="padding:1.4rem">No service requests yet.</td></tr>'}</tbody>
      </table></div></div>`;
  }

  async function renderReviews(m) {
    const { reviews } = await api('/admin/reviews');
    m.innerHTML = `
      <div class="page-head"><div><h2>Reviews</h2><p class="sub">${reviews.length} review${reviews.length === 1 ? '' : 's'} · hide abusive or fake reviews</p></div></div>
      <div class="panel"><div class="table-wrap"><table class="data">
        <thead><tr><th>Provider</th><th>Reviewer</th><th>Rating</th><th>Comment</th><th>Status</th><th>When</th><th></th></tr></thead>
        <tbody>${reviews.length ? reviews.map((r) => `
          <tr>
            <td class="small"><a href="/provider.html?id=${r.providerId}">${escapeHtml(r.businessName)}</a></td>
            <td class="small">${escapeHtml(r.userName)}</td>
            <td class="small nowrap">${'★'.repeat(r.rating)}<span class="muted">${'★'.repeat(5 - r.rating)}</span></td>
            <td class="small muted" style="max-width:320px">${escapeHtml((r.comment || '').slice(0, 110))}${(r.comment || '').length > 110 ? '…' : ''}</td>
            <td>${statusBadge(r.status, r.status === 'published' ? 'Published' : 'Hidden')}</td>
            <td class="small muted nowrap">${escapeHtml(timeAgo(r.createdAt))}</td>
            <td class="actions">
              <button class="btn btn-xs btn-ghost" data-toggle="${r.id}" data-status="${r.status}">${r.status === 'published' ? 'Hide' : 'Publish'}</button>
              <button class="btn btn-xs btn-ghost" data-del-review="${r.id}">Delete</button>
            </td>
          </tr>`).join('') : '<tr><td colspan="7" class="muted small" style="padding:1.4rem">No reviews yet.</td></tr>'}</tbody>
      </table></div></div>`;

    m.addEventListener('click', async (e) => {
      const toggle = e.target.closest('[data-toggle]');
      if (toggle) {
        try {
          await api('/admin/reviews/' + toggle.dataset.toggle, { method: 'PATCH', body: { status: toggle.dataset.status === 'published' ? 'hidden' : 'published' } });
          toast('Review updated'); render();
        } catch (err) { toast(err.message, 'err'); }
      }
      const del = e.target.closest('[data-del-review]');
      if (del) {
        if (!(await confirmDialog('Delete this review permanently?', { confirmLabel: 'Delete', danger: true }))) return;
        try { await api('/admin/reviews/' + del.dataset.delReview, { method: 'DELETE' }); toast('Review deleted'); render(); }
        catch (err) { toast(err.message, 'err'); }
      }
    });
  }

  /* ---------- categories ---------- */
  async function renderCategories(m) {
    const { categories } = await api('/admin/categories');
    const job = categories.filter((c) => c.kind === 'job');
    const service = categories.filter((c) => c.kind === 'service');
    const table = (rows) => `<div class="table-wrap"><table class="data">
      <thead><tr><th>Category</th><th>Description</th><th>Listings</th><th></th></tr></thead>
      <tbody>${rows.map((c) => `
        <tr><td><b>${escapeHtml(c.icon || '')} ${escapeHtml(c.name)}</b><div class="tiny muted mono">${escapeHtml(c.slug)}</div></td>
          <td class="small muted">${escapeHtml(c.description || '—')}</td>
          <td class="small">${c.kind === 'job' ? c.jobCount + ' jobs' : c.providerCount + ' providers'}</td>
          <td class="actions">
            <button class="btn btn-xs btn-ghost" data-edit-cat="${c.id}">Edit</button>
            <button class="btn btn-xs btn-ghost" data-del-cat="${c.id}">Delete</button>
          </td></tr>`).join('')}</tbody>
    </table></div>`;

    m.innerHTML = `
      <div class="page-head"><div><h2>Categories</h2><p class="sub">${job.length} job categories and ${service.length} service categories</p></div>
        <button class="btn" id="new-cat">+ Add category</button></div>
      <div class="panel" style="margin-bottom:1.2rem"><div class="panel-head"><b>Job categories</b></div>${table(job)}</div>
      <div class="panel"><div class="panel-head"><b>Service categories</b></div>${table(service)}</div>`;

    const all = categories;
    document.getElementById('new-cat').addEventListener('click', () => openCategoryForm(null));
    m.addEventListener('click', async (e) => {
      const edit = e.target.closest('[data-edit-cat]');
      if (edit) return openCategoryForm(all.find((c) => c.id === Number(edit.dataset.editCat)));
      const del = e.target.closest('[data-del-cat]');
      if (del) {
        if (!(await confirmDialog('Delete this category?', { confirmLabel: 'Delete', danger: true }))) return;
        try { await api('/admin/categories/' + del.dataset.delCat, { method: 'DELETE' }); toast('Category deleted'); render(); }
        catch (err) { toast(err.message, 'err'); }
      }
    });
  }

  function openCategoryForm(cat) {
    const c = cat || {};
    modal({
      title: c.id ? 'Edit category' : 'Add category',
      body: `<form id="cat-form">
        <div class="grid-2">
          <label class="field"><span class="lbl">Name <span class="req">*</span></span><input type="text" name="name" value="${escapeHtml(c.name || '')}"></label>
          <label class="field"><span class="lbl">Type</span><select name="kind">${[['job', 'Job category'], ['service', 'Service category']].map(([v, l]) => `<option value="${v}" ${c.kind === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
        </div>
        <label class="field"><span class="lbl">Icon (emoji)</span><input type="text" name="icon" value="${escapeHtml(c.icon || '📌')}" maxlength="4"></label>
        <label class="field"><span class="lbl">Description</span><textarea name="description" rows="3">${escapeHtml(c.description || '')}</textarea></label>
        <div class="form-actions"><button class="btn" type="submit" id="cat-save">${c.id ? 'Save changes' : 'Create category'}</button><button class="btn btn-ghost" type="button" data-close>Cancel</button></div>
      </form>`,
    });
    document.getElementById('cat-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = document.getElementById('cat-save');
      busy(btn, true, 'Saving…');
      try {
        const payload = formToObject(e.target);
        if (c.id) await api('/admin/categories/' + c.id, { method: 'PATCH', body: payload });
        else await api('/admin/categories', { method: 'POST', body: payload });
        closeModal(); toast('Category saved'); render();
      } catch (err) {
        busy(btn, false);
        if (err.data && err.data.errors) showErrors(e.target, err.data.errors);
        else toast(err.message, 'err');
      }
    });
  }

  /* ---------- locations ---------- */
  async function renderLocations(m) {
    const { locations } = await api('/admin/locations');
    m.innerHTML = `
      <div class="page-head"><div><h2>Locations</h2><p class="sub">${locations.length} towns, wards and villages in the coverage area</p></div>
        <button class="btn" id="new-loc">+ Add location</button></div>
      <div class="panel"><div class="table-wrap"><table class="data">
        <thead><tr><th>Location</th><th>Type</th><th>Notes</th><th>Jobs</th><th>Providers</th><th></th></tr></thead>
        <tbody>${locations.map((l) => `
          <tr><td><b>${escapeHtml(l.name)}</b><div class="tiny muted mono">${escapeHtml(l.slug)}</div></td>
            <td><span class="badge">${escapeHtml(l.kind)}</span></td>
            <td class="small muted">${escapeHtml(l.notes || '—')}</td>
            <td class="small">${l.jobCount}</td>
            <td class="small">${l.providerCount}</td>
            <td class="actions">
              <button class="btn btn-xs btn-ghost" data-edit-loc="${l.id}">Edit</button>
              <button class="btn btn-xs btn-ghost" data-del-loc="${l.id}">Delete</button>
            </td></tr>`).join('')}</tbody>
      </table></div></div>`;

    document.getElementById('new-loc').addEventListener('click', () => openLocationForm(null));
    m.addEventListener('click', async (e) => {
      const edit = e.target.closest('[data-edit-loc]');
      if (edit) return openLocationForm(locations.find((l) => l.id === Number(edit.dataset.editLoc)));
      const del = e.target.closest('[data-del-loc]');
      if (del) {
        if (!(await confirmDialog('Delete this location?', { confirmLabel: 'Delete', danger: true }))) return;
        try { await api('/admin/locations/' + del.dataset.delLoc, { method: 'DELETE' }); toast('Location deleted'); render(); }
        catch (err) { toast(err.message, 'err'); }
      }
    });
  }

  function openLocationForm(loc) {
    const l = loc || {};
    modal({
      title: l.id ? 'Edit location' : 'Add location',
      body: `<form id="loc-form">
        <div class="grid-2">
          <label class="field"><span class="lbl">Name <span class="req">*</span></span><input type="text" name="name" value="${escapeHtml(l.name || '')}"></label>
          <label class="field"><span class="lbl">Type</span><select name="kind">${[['town', 'Town'], ['ward', 'Ward'], ['village', 'Village']].map(([v, lbl]) => `<option value="${v}" ${l.kind === v ? 'selected' : ''}>${lbl}</option>`).join('')}</select></label>
        </div>
        <label class="field"><span class="lbl">Notes</span><textarea name="notes" rows="3">${escapeHtml(l.notes || '')}</textarea></label>
        <div class="form-actions"><button class="btn" type="submit" id="loc-save">${l.id ? 'Save changes' : 'Create location'}</button><button class="btn btn-ghost" type="button" data-close>Cancel</button></div>
      </form>`,
    });
    document.getElementById('loc-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = document.getElementById('loc-save');
      busy(btn, true, 'Saving…');
      try {
        const payload = formToObject(e.target);
        if (l.id) await api('/admin/locations/' + l.id, { method: 'PATCH', body: payload });
        else await api('/admin/locations', { method: 'POST', body: payload });
        closeModal(); toast('Location saved'); render();
      } catch (err) {
        busy(btn, false);
        if (err.data && err.data.errors) showErrors(e.target, err.data.errors);
        else toast(err.message, 'err');
      }
    });
  }

  /* ---------- audit ---------- */
  async function renderAudit(m) {
    const entity = PC.qs('entity') || '';
    const data = await api(`/admin/audit?per_page=80${entity ? '&entity=' + entity : ''}`);
    const entities = ['', 'job', 'provider', 'user', 'application', 'service_request', 'review', 'category', 'location', 'settings'];
    m.innerHTML = `
      <div class="page-head"><div><h2>Audit log</h2><p class="sub">${data.pagination.total} recorded action${data.pagination.total === 1 ? '' : 's'}</p></div></div>
      <div class="panel" style="margin-bottom:1rem"><div class="panel-body chips">
        ${entities.map((en) => `<button class="chip ${entity === en ? 'active' : ''}" data-entity="${en}">${en === '' ? 'All' : escapeHtml(en.replace('_', ' '))}</button>`).join('')}
      </div></div>
      <div class="panel"><div class="table-wrap"><table class="data">
        <thead><tr><th>When</th><th>Actor</th><th>Action</th><th>Entity</th><th>Details</th></tr></thead>
        <tbody>${data.entries.length ? data.entries.map((a) => `
          <tr><td class="small muted nowrap">${escapeHtml(dateTimeLabel(a.createdAt))}</td>
            <td class="small">${escapeHtml(a.actorName || 'system')}</td>
            <td><b class="small">${escapeHtml(a.action)}</b></td>
            <td class="small muted">${escapeHtml(a.entity)}${a.entityId ? ' #' + a.entityId : ''}</td>
            <td class="tiny mono muted" style="max-width:360px;overflow:hidden;text-overflow:ellipsis">${escapeHtml(a.details ? JSON.stringify(a.details) : '')}</td></tr>`).join('') : '<tr><td colspan="5" class="muted small" style="padding:1.4rem">No entries.</td></tr>'}</tbody>
      </table></div></div>`;

    m.querySelectorAll('[data-entity]').forEach((b) => b.addEventListener('click', () => { PC.setQuery({ entity: b.dataset.entity, view: 'audit' }); render(); }));
  }

  /* ---------- settings ---------- */
  async function renderSettings(m) {
    const { settings } = await api('/admin/settings');
    m.innerHTML = `
      <div class="page-head"><div><h2>Settings</h2><p class="sub">Platform identity and moderation behaviour</p></div></div>
      <div class="grid-side">
        <div class="card">
          <h3>General</h3>
          <div id="settings-alert"></div>
          <form id="settings-form">
            <div class="grid-2">
              <label class="field"><span class="lbl">Site name</span><input type="text" name="site_name" value="${escapeHtml(settings.site_name || '')}"></label>
              <label class="field"><span class="lbl">Province</span><input type="text" name="province" value="${escapeHtml(settings.province || '')}"></label>
            </div>
            <div class="grid-2">
              <label class="field"><span class="lbl">Town</span><input type="text" name="town" value="${escapeHtml(settings.town || '')}"></label>
              <label class="field"><span class="lbl">Contact email</span><input type="email" name="contact_email" value="${escapeHtml(settings.contact_email || '')}"></label>
            </div>
            <div class="divider"></div>
            <h3>Moderation</h3>
            <label class="field row" style="gap:.5rem;align-items:center">
              <input type="checkbox" name="auto_approve_jobs" id="aa-jobs" style="width:auto" ${settings.auto_approve_jobs === 'true' ? 'checked' : ''}>
              <span class="lbl" style="margin:0">Auto-approve new job listings</span>
            </label>
            <label class="field row" style="gap:.5rem;align-items:center">
              <input type="checkbox" name="auto_approve_providers" id="aa-prov" style="width:auto" ${settings.auto_approve_providers === 'true' ? 'checked' : ''}>
              <span class="lbl" style="margin:0">Auto-approve new service listings</span>
            </label>
            <p class="tiny muted">When off (recommended), new listings wait for an administrator to approve them.</p>
            <div class="form-actions"><button class="btn" type="submit" id="settings-save">Save settings</button></div>
          </form>
        </div>
        <div class="stack">
          <div class="card">
            <h3>Platform</h3>
            <dl class="kv">
              <dt>Coverage</dt><dd>Plumtree town and the wards of Bulilima, Mangwe, Tshitshi, Matjinge, Empandeni</dd>
              <dt>Currency</dt><dd>USD (listings)</dd>
              <dt>API</dt><dd><a href="/api/health" target="_blank" rel="noopener">/api/health</a></dd>
            </dl>
          </div>
          <div class="card">
            <h3>Moderation policy</h3>
            <ul class="list-check">
              <li>Approve listings with a clear description and contact details.</li>
              <li>Reject duplicate, misleading or unsafe listings with a reason.</li>
              <li>Verify providers you have confirmed are genuine local businesses.</li>
              <li>Hide reviews that are abusive or clearly fake.</li>
            </ul>
          </div>
        </div>
      </div>`;

    document.getElementById('settings-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = document.getElementById('settings-save');
      busy(btn, true, 'Saving…');
      try {
        const payload = formToObject(e.target);
        payload.auto_approve_jobs = document.getElementById('aa-jobs').checked;
        payload.auto_approve_providers = document.getElementById('aa-prov').checked;
        const res = await api('/admin/settings', { method: 'PATCH', body: payload });
        document.getElementById('settings-alert').innerHTML = `<div class="alert alert-ok">${escapeHtml(res.message || 'Saved')}</div>`;
        toast('Settings saved');
      } catch (err) { toast(err.message, 'err'); }
      finally { busy(btn, false); }
    });
  }

  async function loadMeta() {
    try {
      const [cats, locs] = await Promise.all([api('/admin/categories'), api('/admin/locations')]);
      meta.categories = cats.categories;
      meta.locations = locs.locations;
      meta.jobCategories = cats.categories.filter((c) => c.kind === 'job');
      meta.serviceCategories = cats.categories.filter((c) => c.kind === 'service');
    } catch { /* ignore */ }
  }

  async function boot() {
    if (!PC.requireLogin()) return;
    await PC.refreshUser();
    if (!state.user) { location.href = '/login.html'; return; }
    if (state.user.role !== 'admin') {
      toast('Administrator access is required', 'err');
      location.href = '/dashboard.html';
      return;
    }
    if (!NAV.some(([k]) => k === activeView)) activeView = 'overview';
    shell();
    await loadMeta();
    await render();
  }

  boot();
})();
