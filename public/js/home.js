/* Home page */
(function () {
  'use strict';
  const { api, escapeHtml, money, dateLabel, daysLeft, statusBadge, stars, toast } = window.PC;

  function jobCard(job) {
    const left = daysLeft(job.deadline);
    const deadlineChip = left === null ? '' :
      left < 0 ? '<span class="badge badge-red">Closed</span>' :
      left <= 7 ? `<span class="badge badge-amber">Closes in ${left} day${left === 1 ? '' : 's'}</span>` :
      `<span class="badge">Closes ${escapeHtml(dateLabel(job.deadline))}</span>`;
    return `
      <article class="listing">
        <div class="row">
          <div class="thumb">${escapeHtml(job.category?.icon || '💼')}</div>
          <div class="grow">
            <h3><a href="/job.html?id=${job.id}">${escapeHtml(job.title)}</a></h3>
            <div class="org">${escapeHtml(job.company)}</div>
          </div>
          ${job.featured ? '<span class="badge badge-clay">Featured</span>' : ''}
        </div>
        <p class="desc">${escapeHtml((job.description || '').slice(0, 150))}</p>
        <div class="chips">
          <span class="tag">${escapeHtml(job.jobTypeLabel)}</span>
          <span class="tag">${escapeHtml(job.workModeLabel)}</span>
          ${job.location ? `<span class="tag">📍 ${escapeHtml(job.location.name)}</span>` : ''}
        </div>
        <div class="row small muted"><b style="color:var(--green-800)">${escapeHtml(job.salaryLabel)}</b><span>·</span><span>${job.vacancies} post${job.vacancies === 1 ? '' : 's'}</span></div>
        <div class="foot">
          <span class="tiny muted">${escapeHtml(job.applicationCount)} application${job.applicationCount === 1 ? '' : 's'}</span>
          ${deadlineChip}
        </div>
      </article>`;
  }

  function providerCard(p) {
    return `
      <article class="listing">
        <div class="row">
          <div class="thumb thumb-clay">${escapeHtml(p.category?.icon || '🔧')}</div>
          <div class="grow">
            <h3><a href="/provider.html?id=${p.id}">${escapeHtml(p.businessName)}</a></h3>
            <div class="org">${escapeHtml(p.category?.name || 'Service')}</div>
          </div>
          ${p.verified ? '<span class="badge badge-green">✓ Verified</span>' : ''}
        </div>
        <p class="desc">${escapeHtml(p.tagline || p.description || '')}</p>
        <div class="row small">
          ${p.rating ? stars(p.rating) + `<span class="muted">${p.rating} (${p.ratingCount})</span>` : '<span class="muted small">No reviews yet</span>'}
        </div>
        <div class="chips">
          ${p.location ? `<span class="tag">📍 ${escapeHtml(p.location.name)}</span>` : ''}
          <span class="tag">${escapeHtml(p.availabilityLabel)}</span>
          <span class="tag">${escapeHtml(p.yearsExperience)}+ yrs</span>
        </div>
        <div class="foot">
          <span class="small"><b style="color:var(--clay-700)">${escapeHtml(money(p.priceFrom, p.currency))}</b> <span class="muted tiny">starting</span></span>
          <a class="btn btn-xs btn-outline" href="/provider.html?id=${p.id}">Request service</a>
        </div>
      </article>`;
  }

  async function loadHero() {
    try {
      const { totals } = await api('/meta/stats');
      document.getElementById('hero-stats').innerHTML = `
        <div class="stat"><b>${totals.approvedJobs}</b><span>Open jobs</span></div>
        <div class="stat"><b>${totals.approvedProviders}</b><span>Service providers</span></div>
        <div class="stat"><b>${totals.openVacancies}</b><span>Vacancies</span></div>
        <div class="stat"><b>${totals.registeredUsers}</b><span>Registered users</span></div>`;
      const bars = document.getElementById('location-bars');
      const rows = (await api('/meta/stats')).byLocation.slice(0, 8);
      const max = Math.max(1, ...rows.map((r) => r.jobs + r.providers));
      bars.innerHTML = rows.map((r) => {
        const total = r.jobs + r.providers;
        return `<div class="bar-row">
          <span class="bl" title="${escapeHtml(r.name)}">${escapeHtml(r.name)}</span>
          <span class="bar-track"><span class="bar-fill" style="width:${(total / max) * 100}%"></span></span>
          <span class="bv">${total}</span>
        </div>`;
      }).join('') || '<p class="muted small">No location activity yet.</p>';
    } catch (e) { toast('Could not load platform statistics', 'err'); }
  }

  async function loadFeatured() {
    try {
      const { jobs } = await api('/jobs?featured=1&per_page=6');
      const host = document.getElementById('featured-jobs');
      const list = jobs.length ? jobs : (await api('/jobs?per_page=6')).jobs;
      host.innerHTML = list.length ? list.map(jobCard).join('') : '<div class="empty"><span class="icon">📭</span>No jobs published yet.</div>';
    } catch { document.getElementById('featured-jobs').innerHTML = '<div class="empty">Could not load jobs.</div>'; }
  }

  async function loadProviders() {
    try {
      const { providers } = await api('/providers?sort=rating&per_page=6');
      document.getElementById('top-providers').innerHTML = providers.length
        ? providers.map(providerCard).join('')
        : '<div class="empty"><span class="icon">🔧</span>No providers published yet.</div>';
    } catch { document.getElementById('top-providers').innerHTML = '<div class="empty">Could not load providers.</div>'; }
  }

  async function loadCategories(kind) {
    try {
      const { categories } = await api('/meta/categories?kind=' + kind);
      document.getElementById('cat-grid').innerHTML = categories.map((c) => `
        <a class="card" href="/${kind === 'job' ? 'jobs' : 'providers'}.html?category=${encodeURIComponent(c.slug)}" style="text-decoration:none">
          <div class="row">
            <div class="thumb">${escapeHtml(c.icon)}</div>
            <div class="grow">
              <b style="color:var(--ink-900)">${escapeHtml(c.name)}</b>
              <div class="tiny muted">${kind === 'job' ? c.jobCount + ' open job' + (c.jobCount === 1 ? '' : 's') : c.providerCount + ' provider' + (c.providerCount === 1 ? '' : 's')}</div>
            </div>
          </div>
          <p class="small muted" style="margin:.6rem 0 0">${escapeHtml(c.description || '')}</p>
        </a>`).join('');
    } catch { /* ignore */ }
  }

  async function loadLocations() {
    try {
      const { locations } = await api('/meta/locations');
      const sel = document.getElementById('hero-location');
      for (const l of locations) {
        const opt = document.createElement('option');
        opt.value = l.slug;
        opt.textContent = `${l.name} (${l.jobCount + l.providerCount})`;
        sel.appendChild(opt);
      }
    } catch { /* ignore */ }
  }

  document.getElementById('hero-search').addEventListener('submit', (e) => {
    e.preventDefault();
    const data = window.PC.formToObject(e.target);
    const base = data.type === 'providers' ? '/providers.html' : '/jobs.html';
    const params = new URLSearchParams();
    if (data.q) params.set('q', data.q);
    if (data.location) params.set('location', data.location);
    location.href = base + (params.toString() ? '?' + params.toString() : '');
  });

  document.getElementById('cat-tabs').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-kind]');
    if (!btn) return;
    document.querySelectorAll('#cat-tabs .tab').forEach((t) => t.classList.toggle('active', t === btn));
    loadCategories(btn.dataset.kind);
  });

  loadHero();
  loadFeatured();
  loadProviders();
  loadCategories('job');
  loadLocations();
})();
