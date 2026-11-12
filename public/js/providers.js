/* Service providers browsing page */
(function () {
  'use strict';
  const { api, escapeHtml, money, stars, toast, qs, setQuery, debounce } = window.PC;

  const filters = {
    q: qs('q') || '',
    category: qs('category') || '',
    location: qs('location') || '',
    availability: qs('availability') || '',
    max_price: qs('max_price') || '',
    verified: qs('verified') || '',
    sort: qs('sort') || 'rating',
    page: Number(qs('page') || 1),
  };

  const meta = { categories: [], locations: [], availability: [] };

  function card(p) {
    return `
      <article class="listing">
        <div class="row" style="align-items:flex-start">
          <div class="thumb thumb-clay">${escapeHtml(p.category?.icon || '🔧')}</div>
          <div class="grow" style="min-width:0">
            <div class="spread" style="gap:.4rem">
              <h3><a href="/provider.html?id=${p.id}">${escapeHtml(p.businessName)}</a></h3>
              <div class="chips">${p.verified ? '<span class="badge badge-green">✓ Verified</span>' : ''}${p.featured ? '<span class="badge badge-clay">Featured</span>' : ''}</div>
            </div>
            <div class="org">${escapeHtml(p.category?.name || 'Service')}</div>
          </div>
        </div>
        <p class="desc">${escapeHtml(p.tagline || p.description || '')}</p>
        <div class="row small">
          ${p.rating ? stars(p.rating) + `<span class="muted">${p.rating} · ${p.ratingCount} review${p.ratingCount === 1 ? '' : 's'}</span>` : '<span class="muted small">No reviews yet</span>'}
        </div>
        <div class="chips">
          ${p.location ? `<span class="tag">📍 ${escapeHtml(p.location.name)}</span>` : ''}
          <span class="tag">${escapeHtml(p.availabilityLabel)}</span>
          <span class="tag">${p.yearsExperience} yrs exp</span>
          ${p.saved ? '<span class="badge badge-green">Saved</span>' : ''}
        </div>
        <div class="foot">
          <span class="small"><b style="color:var(--clay-700)">${escapeHtml(money(p.priceFrom, p.currency))}</b> <span class="tiny muted">starting</span></span>
          <a class="btn btn-sm" href="/provider.html?id=${p.id}">Request service</a>
        </div>
      </article>`;
  }

  function renderFilterLists() {
    document.getElementById('f-categories').innerHTML =
      `<button type="button" data-cat="" class="${!filters.category ? 'active' : ''}">All categories</button>` +
      meta.categories.map((c) => `<button type="button" data-cat="${escapeHtml(c.slug)}" class="${filters.category === c.slug ? 'active' : ''}">
        <span>${escapeHtml(c.icon)} ${escapeHtml(c.name)}</span><span class="n">${c.providerCount}</span></button>`).join('');

    document.getElementById('f-locations').innerHTML =
      `<button type="button" data-loc="" class="${!filters.location ? 'active' : ''}">All areas</button>` +
      meta.locations.map((l) => `<button type="button" data-loc="${escapeHtml(l.slug)}" class="${filters.location === l.slug ? 'active' : ''}">
        <span>${escapeHtml(l.name)}</span><span class="n">${l.providerCount}</span></button>`).join('');

    document.getElementById('f-availability').innerHTML = meta.availability.map((a) =>
      `<button type="button" class="chip ${filters.availability === a.value ? 'active' : ''}" data-av="${a.value}">${escapeHtml(a.label)}</button>`).join('');
    document.getElementById('f-verified').checked = filters.verified === '1';
  }

  function renderActiveChips() {
    const chips = [];
    if (filters.q) chips.push(['q', `“${filters.q}”`]);
    if (filters.category) chips.push(['category', meta.categories.find((c) => c.slug === filters.category)?.name || filters.category]);
    if (filters.location) chips.push(['location', meta.locations.find((l) => l.slug === filters.location)?.name || filters.location]);
    if (filters.availability) chips.push(['availability', meta.availability.find((a) => a.value === filters.availability)?.label || filters.availability]);
    if (filters.max_price) chips.push(['max_price', `Up to USD ${filters.max_price}`]);
    if (filters.verified) chips.push(['verified', 'Verified only']);
    document.getElementById('active-chips').innerHTML = chips.map(([key, label]) =>
      `<button class="chip active" data-remove="${key}">${escapeHtml(label)} ✕</button>`).join('');
  }

  function buildQuery() {
    const params = new URLSearchParams();
    for (const key of ['q', 'category', 'location', 'availability', 'max_price', 'verified']) {
      if (filters[key]) params.set(key, filters[key]);
    }
    if (filters.sort && filters.sort !== 'rating') params.set('sort', filters.sort);
    if (filters.page > 1) params.set('page', filters.page);
    params.set('per_page', '9');
    return params;
  }

  async function load() {
    const host = document.getElementById('provider-list');
    host.innerHTML = '<div class="spinner"></div>';
    setQuery(Object.fromEntries(buildQuery()), { replace: true });
    try {
      const data = await api('/providers?' + buildQuery().toString());
      document.getElementById('result-count').innerHTML = data.pagination.total
        ? `<b>${data.pagination.total}</b> provider${data.pagination.total === 1 ? '' : 's'} found`
        : 'No providers match your filters';
      host.className = 'grid-cards';
      host.innerHTML = data.providers.length
        ? data.providers.map(card).join('')
        : `<div class="empty" style="grid-column:1/-1"><span class="icon">🔍</span><b>Nothing matched</b><p>Try a different category or clear your filters.</p><button class="btn btn-ghost" id="empty-clear">Clear all filters</button></div>`;
      document.getElementById('empty-clear')?.addEventListener('click', clearAll);
      renderPager(data.pagination);
      renderActiveChips();
    } catch (e) {
      host.innerHTML = '<div class="empty">Could not load providers.</div>';
      toast(e.message, 'err');
    }
  }

  function renderPager({ page, pages, total, perPage }) {
    const pager = document.getElementById('pager');
    if (pages <= 1) { pager.innerHTML = ''; return; }
    const from = (page - 1) * perPage + 1;
    const to = Math.min(total, page * perPage);
    const buttons = [`<button data-page="1" ${page === 1 ? 'disabled' : ''}>«</button>`, `<button data-page="${page - 1}" ${page === 1 ? 'disabled' : ''}>‹</button>`];
    const start = Math.max(1, page - 2);
    const end = Math.min(pages, start + 4);
    for (let p = start; p <= end; p += 1) buttons.push(`<button data-page="${p}" class="${p === page ? 'active' : ''}">${p}</button>`);
    buttons.push(`<button data-page="${page + 1}" ${page === pages ? 'disabled' : ''}>›</button>`, `<button data-page="${pages}" ${page === pages ? 'disabled' : ''}>»</button>`);
    pager.innerHTML = `<span class="small muted" style="margin-right:.6rem">Showing ${from}–${to} of ${total}</span>` + buttons.join('');
    pager.querySelectorAll('button[data-page]').forEach((b) => b.addEventListener('click', () => {
      filters.page = Number(b.dataset.page); load(); window.scrollTo({ top: 0, behavior: 'smooth' });
    }));
  }

  function clearAll() {
    Object.assign(filters, { q: '', category: '', location: '', availability: '', max_price: '', verified: '', sort: 'rating', page: 1 });
    document.getElementById('filter-form').reset();
    document.getElementById('quick-search').value = '';
    document.getElementById('sort').value = 'rating';
    renderFilterLists();
    load();
  }

  document.getElementById('filter-form').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-cat],button[data-loc],button[data-av]');
    if (!btn) return;
    e.preventDefault();
    if (btn.dataset.cat !== undefined) filters.category = filters.category === btn.dataset.cat ? '' : btn.dataset.cat;
    if (btn.dataset.loc !== undefined) filters.location = filters.location === btn.dataset.loc ? '' : btn.dataset.loc;
    if (btn.dataset.av !== undefined) filters.availability = filters.availability === btn.dataset.av ? '' : btn.dataset.av;
    filters.page = 1;
    renderFilterLists();
    load();
  });

  document.getElementById('filter-form').addEventListener('submit', (e) => {
    e.preventDefault();
    filters.q = document.getElementById('f-q').value.trim();
    filters.max_price = document.getElementById('f-max-price').value.trim();
    filters.verified = document.getElementById('f-verified').checked ? '1' : '';
    filters.page = 1;
    load();
  });

  document.getElementById('f-q').value = filters.q;
  document.getElementById('quick-search').value = filters.q;
  document.getElementById('f-max-price').value = filters.max_price;
  document.getElementById('sort').value = filters.sort;
  document.getElementById('quick-search').addEventListener('input', debounce((e) => {
    filters.q = e.target.value.trim(); document.getElementById('f-q').value = filters.q; filters.page = 1; load();
  }, 400));
  document.getElementById('f-verified').addEventListener('change', (e) => { filters.verified = e.target.checked ? '1' : ''; filters.page = 1; load(); });
  document.getElementById('sort').addEventListener('change', (e) => { filters.sort = e.target.value; filters.page = 1; load(); });
  document.getElementById('clear-filters').addEventListener('click', clearAll);
  document.getElementById('active-chips').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-remove]');
    if (!btn) return;
    const key = btn.dataset.remove;
    filters[key] = '';
    if (key === 'q') { document.getElementById('quick-search').value = ''; document.getElementById('f-q').value = ''; }
    if (key === 'max_price') document.getElementById('f-max-price').value = '';
    if (key === 'verified') document.getElementById('f-verified').checked = false;
    filters.page = 1;
    renderFilterLists();
    load();
  });

  (async function init() {
    try {
      const [cats, locs, provMeta] = await Promise.all([
        api('/meta/categories?kind=service'), api('/meta/locations'), api('/providers?per_page=1'),
      ]);
      meta.categories = cats.categories;
      meta.locations = locs.locations;
      meta.availability = provMeta.filters.availability;
    } catch { /* keep empty */ }
    renderFilterLists();
    load();
  })();
})();
