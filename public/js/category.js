/* Category (group) page — jobs and providers for one industry, with pagination */
(function () {
  'use strict';
  const { api, escapeHtml, money, dateLabel, daysLeft, stars, toast, qs, setQuery, debounce, pager } = window.PC;

  const filters = {
    group: qs('group') || '',
    kind: qs('kind') === 'service' ? 'service' : 'job',
    category: qs('category') || '',
    q: qs('q') || '',
    sort: qs('sort') || 'recent',
    page: Number(qs('page') || 1),
    perPage: Number(qs('per_page') || 12),
  };

  let group = null;
  let categories = [];

  function jobCard(job) {
    const left = daysLeft(job.deadline);
    const deadline = job.deadline
      ? (left < 0 ? '<span class="badge badge-red">Closed</span>'
        : left <= 7 ? `<span class="badge badge-amber">${left} day${left === 1 ? '' : 's'} left</span>`
        : `<span class="badge">Closes ${escapeHtml(dateLabel(job.deadline))}</span>`)
      : '<span class="badge">Rolling</span>';
    return `
      <article class="listing">
        <div class="row" style="align-items:flex-start">
          <div class="thumb">${escapeHtml(job.category?.icon || '💼')}</div>
          <div class="grow" style="min-width:0">
            <div class="spread" style="gap:.5rem">
              <h3><a href="/job.html?id=${job.id}">${escapeHtml(job.title)}</a></h3>
              <div class="chips">${job.featured ? '<span class="badge badge-clay">Featured</span>' : ''}${deadline}</div>
            </div>
            <div class="org">${escapeHtml(job.company)} ${job.location ? '· 📍 ' + escapeHtml(job.location.name) : ''}</div>
            <p class="desc" style="margin-top:.4rem">${escapeHtml((job.description || '').slice(0, 200))}</p>
            <div class="chips" style="margin-top:.3rem">
              <span class="tag">${escapeHtml(job.jobTypeLabel)}</span>
              <span class="tag">${escapeHtml(job.workModeLabel)}</span>
              <span class="tag">${escapeHtml(job.category?.name || 'General')}</span>
            </div>
          </div>
        </div>
        <div class="foot">
          <div><b style="color:var(--green-800)">${escapeHtml(job.salaryLabel)}</b>
            <span class="tiny muted">· ${job.applicationCount} applicant${job.applicationCount === 1 ? '' : 's'}</span></div>
          <a class="btn btn-sm" href="/job.html?id=${job.id}">View &amp; apply</a>
        </div>
      </article>`;
  }

  function providerCard(p) {
    return `
      <article class="listing">
        <div class="row" style="align-items:flex-start">
          <div class="thumb thumb-clay">${escapeHtml(p.category?.icon || '🔧')}</div>
          <div class="grow" style="min-width:0">
            <div class="spread" style="gap:.5rem">
              <h3><a href="/provider.html?id=${p.id}">${escapeHtml(p.businessName)}</a></h3>
              <div class="chips">${p.verified ? '<span class="badge badge-green">✓ Verified</span>' : ''}${p.featured ? '<span class="badge badge-clay">Featured</span>' : ''}</div>
            </div>
            <div class="org">${escapeHtml(p.category?.name || 'Service')} ${p.location ? '· 📍 ' + escapeHtml(p.location.name) : ''}</div>
            <p class="desc" style="margin-top:.4rem">${escapeHtml(p.tagline || (p.description || '').slice(0, 160))}</p>
            <div class="chips" style="margin-top:.3rem">
              ${p.rating ? `<span class="tag">${stars(p.rating)} ${p.rating} (${p.ratingCount})</span>` : '<span class="tag">No reviews yet</span>'}
              <span class="tag">${escapeHtml(p.availabilityLabel)}</span>
              <span class="tag">${p.yearsExperience}+ yrs</span>
            </div>
          </div>
        </div>
        <div class="foot">
          <span class="small"><b style="color:var(--clay-700)">${escapeHtml(money(p.priceFrom, p.currency))}</b> <span class="muted tiny">starting</span></span>
          <a class="btn btn-sm" href="/provider.html?id=${p.id}">Request service</a>
        </div>
      </article>`;
  }

  function buildQuery() {
    const params = new URLSearchParams();
    if (filters.group) params.set('group', filters.group);
    if (filters.category) params.set('category', filters.category);
    if (filters.q) params.set('q', filters.q);
    if (filters.sort && filters.sort !== 'recent') params.set('sort', filters.sort);
    if (filters.page > 1) params.set('page', filters.page);
    params.set('per_page', String(filters.perPage));
    return params;
  }

  function renderSubcats() {
    const host = document.getElementById('subcats');
    const relevant = categories.filter((c) => c.kind === filters.kind);
    if (!relevant.length) { host.innerHTML = ''; return; }
    const all = `<button type="button" class="chip ${!filters.category ? 'active' : ''}" data-sub="">All in ${escapeHtml(group ? group.name : 'category')}</button>`;
    host.innerHTML = all + relevant.map((c) => {
      const n = filters.kind === 'job' ? c.jobCount : c.providerCount;
      return `<button type="button" class="chip ${filters.category === c.slug ? 'active' : ''}" data-sub="${escapeHtml(c.slug)}">${escapeHtml(c.icon)} ${escapeHtml(c.name)} <span class="muted">${n}</span></button>`;
    }).join('');
  }

  function renderActiveChips() {
    const chips = [];
    if (filters.q) chips.push(['q', `“${filters.q}”`]);
    if (filters.category) {
      const c = categories.find((x) => x.slug === filters.category);
      chips.push(['category', c ? c.name : filters.category]);
    }
    document.getElementById('cat-active-chips').innerHTML = chips.map(([key, label]) =>
      `<button class="chip active" data-remove="${key}" title="Remove filter">${escapeHtml(label)} ✕</button>`).join('');
  }

  async function loadGroup() {
    try {
      const data = await api('/meta/groups/' + encodeURIComponent(filters.group));
      group = data.group;
      categories = data.categories;
      document.getElementById('cat-icon').textContent = group.icon || '📁';
      document.getElementById('cat-name').textContent = group.name;
      document.getElementById('cat-desc').textContent = group.description || '';
      document.title = group.name + ' · Plumtree Connect';
      document.getElementById('cat-stats').innerHTML = `
        <span class="badge badge-green">${group.jobCount} open job${group.jobCount === 1 ? '' : 's'}</span>
        <span class="badge badge-clay">${group.providerCount} provider${group.providerCount === 1 ? '' : 's'}</span>
        <span class="badge badge-plain">${group.categoryCount} categor${group.categoryCount === 1 ? 'y' : 'ies'}</span>`;
      renderSubcats();
    } catch (e) {
      document.getElementById('cat-name').textContent = 'Category not found';
      document.getElementById('cat-desc').textContent = 'That category page does not exist.';
      toast(e.message, 'err');
    }
  }

  async function loadList() {
    const host = document.getElementById('cat-list');
    host.innerHTML = '<div class="spinner"></div>';
    setQuery(Object.fromEntries(buildQuery()));
    const endpoint = filters.kind === 'job' ? '/jobs?' : '/providers?';
    try {
      const data = await api(endpoint + buildQuery().toString());
      const rows = filters.kind === 'job' ? data.jobs : data.providers;
      document.getElementById('cat-result-count').innerHTML = data.pagination.total
        ? `<b>${data.pagination.total}</b> ${filters.kind === 'job' ? 'job' : 'provider'}${data.pagination.total === 1 ? '' : 's'} found`
        : `No ${filters.kind === 'job' ? 'jobs' : 'providers'} in this category yet`;
      host.innerHTML = rows.length
        ? rows.map(filters.kind === 'job' ? jobCard : providerCard).join('')
        : `<div class="empty"><span class="icon">🔍</span><b>Nothing here yet</b><p>Try another sub-category or clear your search.</p></div>`;
      pager('cat-pager', data.pagination, {
        unit: filters.kind === 'job' ? 'job' : 'provider',
        onPage: (p) => { filters.page = p; loadList(); window.scrollTo({ top: 0, behavior: 'smooth' }); },
        onPerPage: (n) => { filters.perPage = n; filters.page = 1; loadList(); },
      });
      renderActiveChips();
    } catch (e) {
      host.innerHTML = '<div class="empty">Could not load listings. Please refresh.</div>';
      toast(e.message, 'err');
    }
  }

  function setKind(kind) {
    filters.kind = kind;
    filters.category = '';
    filters.page = 1;
    document.querySelectorAll('#kind-tabs .tab').forEach((t) => t.classList.toggle('active', t.dataset.kind === kind));
    document.getElementById('cat-sort').value = 'recent';
    filters.sort = 'recent';
    renderSubcats();
    loadList();
  }

  document.getElementById('kind-tabs').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-kind]');
    if (btn) setKind(btn.dataset.kind);
  });

  document.getElementById('subcats').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-sub]');
    if (!btn) return;
    filters.category = btn.dataset.sub || '';
    filters.page = 1;
    renderSubcats();
    loadList();
  });

  document.getElementById('cat-active-chips').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-remove]');
    if (!btn) return;
    filters[btn.dataset.remove] = '';
    if (btn.dataset.remove === 'q') document.getElementById('cat-quick-search').value = '';
    filters.page = 1;
    renderSubcats();
    loadList();
  });

  document.getElementById('cat-quick-search').value = filters.q;
  document.getElementById('cat-quick-search').addEventListener('input', debounce((e) => {
    filters.q = e.target.value.trim();
    filters.page = 1;
    loadList();
  }, 350));
  document.getElementById('cat-sort').addEventListener('change', (e) => { filters.sort = e.target.value; filters.page = 1; loadList(); });

  (async function init() {
    if (!filters.group) {
      document.getElementById('cat-name').textContent = 'Category not found';
      document.getElementById('cat-desc').textContent = 'Open a category from the categories page.';
      document.getElementById('cat-list').innerHTML = '<div class="empty"><span class="icon">📁</span><b>No category selected</b><p><a href="/categories.html">Browse all categories</a></p></div>';
      return;
    }
    await loadGroup();
    if (filters.kind === 'service') {
      document.querySelectorAll('#kind-tabs .tab').forEach((t) => t.classList.toggle('active', t.dataset.kind === 'service'));
      document.getElementById('cat-sort').innerHTML = `
        <option value="recent">Newest first</option>
        <option value="rating">Highest rated</option>
        <option value="experience">Most experienced</option>
        <option value="price">Lowest starting price</option>
        <option value="popular">Most viewed</option>`;
      document.getElementById('cat-sort').value = filters.sort;
    }
    loadList();
  })();
})();
