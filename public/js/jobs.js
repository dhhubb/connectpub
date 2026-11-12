/* Jobs browsing page */
(function () {
  'use strict';
  const { api, escapeHtml, dateLabel, daysLeft, statusBadge, toast, qs, setQuery, debounce, state } = window.PC;

  const filters = {
    q: qs('q') || '',
    category: qs('category') || '',
    location: qs('location') || '',
    job_type: qs('job_type') || '',
    work_mode: qs('work_mode') || '',
    min_salary: qs('min_salary') || '',
    sort: qs('sort') || 'recent',
    page: Number(qs('page') || 1),
  };

  let meta = { categories: [], locations: [], jobTypes: [], workModes: [] };

  function jobRow(job) {
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
            <p class="desc" style="margin-top:.4rem">${escapeHtml((job.description || '').slice(0, 220))}</p>
            <div class="chips" style="margin-top:.3rem">
              <span class="tag">${escapeHtml(job.jobTypeLabel)}</span>
              <span class="tag">${escapeHtml(job.workModeLabel)}</span>
              <span class="tag">${escapeHtml(job.category?.name || 'General')}</span>
              <span class="tag">${job.vacancies} post${job.vacancies === 1 ? '' : 's'}</span>
              ${job.saved ? '<span class="badge badge-green">Saved</span>' : ''}
            </div>
          </div>
        </div>
        <div class="foot">
          <div>
            <b style="color:var(--green-800)">${escapeHtml(job.salaryLabel)}</b>
            <span class="tiny muted">· ${job.applicationCount} applicant${job.applicationCount === 1 ? '' : 's'} · ${job.views} views</span>
          </div>
          <a class="btn btn-sm" href="/job.html?id=${job.id}">View &amp; apply</a>
        </div>
      </article>`;
  }

  function renderFilterLists() {
    const catHost = document.getElementById('f-categories');
    catHost.innerHTML = `<button type="button" data-cat="" class="${!filters.category ? 'active' : ''}">All categories</button>` +
      meta.categories.map((c) => `<button type="button" data-cat="${escapeHtml(c.slug)}" class="${filters.category === c.slug ? 'active' : ''}">
        <span>${escapeHtml(c.icon)} ${escapeHtml(c.name)}</span><span class="n">${c.jobCount}</span></button>`).join('');

    const locHost = document.getElementById('f-locations');
    locHost.innerHTML = `<button type="button" data-loc="" class="${!filters.location ? 'active' : ''}">All areas</button>` +
      meta.locations.map((l) => `<button type="button" data-loc="${escapeHtml(l.slug)}" class="${filters.location === l.slug ? 'active' : ''}">
        <span>${escapeHtml(l.name)}</span><span class="n">${l.jobCount}</span></button>`).join('');

    document.getElementById('f-job-types').innerHTML = meta.jobTypes.map((t) =>
      `<button type="button" class="chip ${filters.job_type === t.value ? 'active' : ''}" data-jt="${t.value}">${escapeHtml(t.label)}</button>`).join('');
    document.getElementById('f-work-modes').innerHTML = meta.workModes.map((w) =>
      `<button type="button" class="chip ${filters.work_mode === w.value ? 'active' : ''}" data-wm="${w.value}">${escapeHtml(w.label)}</button>`).join('');
  }

  function renderActiveChips() {
    const chips = [];
    if (filters.q) chips.push(['q', `“${filters.q}”`]);
    if (filters.category) chips.push(['category', meta.categories.find((c) => c.slug === filters.category)?.name || filters.category]);
    if (filters.location) chips.push(['location', meta.locations.find((l) => l.slug === filters.location)?.name || filters.location]);
    if (filters.job_type) chips.push(['job_type', meta.jobTypes.find((t) => t.value === filters.job_type)?.label || filters.job_type]);
    if (filters.work_mode) chips.push(['work_mode', meta.workModes.find((w) => w.value === filters.work_mode)?.label || filters.work_mode]);
    if (filters.min_salary) chips.push(['min_salary', `From USD ${filters.min_salary}`]);
    document.getElementById('active-chips').innerHTML = chips.map(([key, label]) =>
      `<button class="chip active" data-remove="${key}" title="Remove filter">${escapeHtml(label)} ✕</button>`).join('');
  }

  function buildQuery() {
    const params = new URLSearchParams();
    for (const key of ['q', 'category', 'location', 'job_type', 'work_mode', 'min_salary']) {
      if (filters[key]) params.set(key, filters[key]);
    }
    if (filters.sort && filters.sort !== 'recent') params.set('sort', filters.sort);
    if (filters.page > 1) params.set('page', filters.page);
    params.set('per_page', '10');
    return params;
  }

  async function load() {
    const host = document.getElementById('job-list');
    host.innerHTML = '<div class="spinner"></div>';
    setQuery(Object.fromEntries(buildQuery()), { replace: true });
    try {
      const data = await api('/jobs?' + buildQuery().toString());
      document.getElementById('result-count').innerHTML = data.pagination.total
        ? `<b>${data.pagination.total}</b> job${data.pagination.total === 1 ? '' : 's'} found`
        : 'No jobs match your filters';
      host.innerHTML = data.jobs.length
        ? data.jobs.map(jobRow).join('')
        : `<div class="empty"><span class="icon">🔍</span><b>Nothing matched</b><p>Try widening your search or clearing a filter.</p><button class="btn btn-ghost" id="empty-clear">Clear all filters</button></div>`;
      document.getElementById('empty-clear')?.addEventListener('click', clearAll);
      renderPager(data.pagination);
      renderActiveChips();
    } catch (e) {
      host.innerHTML = '<div class="empty">Could not load jobs. Please refresh.</div>';
      toast(e.message, 'err');
    }
  }

  function renderPager({ page, pages, total, perPage }) {
    const pager = document.getElementById('pager');
    if (pages <= 1) { pager.innerHTML = ''; return; }
    const from = (page - 1) * perPage + 1;
    const to = Math.min(total, page * perPage);
    const buttons = [];
    buttons.push(`<button data-page="1" ${page === 1 ? 'disabled' : ''}>«</button>`);
    buttons.push(`<button data-page="${page - 1}" ${page === 1 ? 'disabled' : ''}>‹</button>`);
    const start = Math.max(1, page - 2);
    const end = Math.min(pages, start + 4);
    for (let p = start; p <= end; p += 1) buttons.push(`<button data-page="${p}" class="${p === page ? 'active' : ''}">${p}</button>`);
    buttons.push(`<button data-page="${page + 1}" ${page === pages ? 'disabled' : ''}>›</button>`);
    buttons.push(`<button data-page="${pages}" ${page === pages ? 'disabled' : ''}>»</button>`);
    pager.innerHTML = `<span class="small muted" style="margin-right:.6rem">Showing ${from}–${to} of ${total}</span>` + buttons.join('');
    pager.querySelectorAll('button[data-page]').forEach((b) => b.addEventListener('click', () => {
      filters.page = Number(b.dataset.page);
      load();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }));
  }

  function clearAll() {
    Object.assign(filters, { q: '', category: '', location: '', job_type: '', work_mode: '', min_salary: '', sort: 'recent', page: 1 });
    document.getElementById('filter-form').reset();
    document.getElementById('quick-search').value = '';
    document.getElementById('sort').value = 'recent';
    renderFilterLists();
    load();
  }

  document.getElementById('filter-form').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-cat],button[data-loc],button[data-jt],button[data-wm]');
    if (!btn) return;
    e.preventDefault();
    if (btn.dataset.cat !== undefined) filters.category = filters.category === btn.dataset.cat ? '' : btn.dataset.cat;
    if (btn.dataset.loc !== undefined) filters.location = filters.location === btn.dataset.loc ? '' : btn.dataset.loc;
    if (btn.dataset.jt !== undefined) filters.job_type = filters.job_type === btn.dataset.jt ? '' : btn.dataset.jt;
    if (btn.dataset.wm !== undefined) filters.work_mode = filters.work_mode === btn.dataset.wm ? '' : btn.dataset.wm;
    filters.page = 1;
    renderFilterLists();
    load();
  });

  document.getElementById('filter-form').addEventListener('submit', (e) => {
    e.preventDefault();
    filters.q = document.getElementById('f-q').value.trim();
    filters.min_salary = document.getElementById('f-min-salary').value.trim();
    filters.page = 1;
    load();
    // On phones, collapse the panel again so results are visible.
    if (filterAside.classList.contains('filter-open')) filterToggle.click();
  });

  document.getElementById('quick-search').value = filters.q;
  document.getElementById('f-q').value = filters.q;
  document.getElementById('f-min-salary').value = filters.min_salary;
  document.getElementById('sort').value = filters.sort;
  document.getElementById('quick-search').addEventListener('input', debounce((e) => {
    filters.q = e.target.value.trim();
    document.getElementById('f-q').value = filters.q;
    filters.page = 1;
    load();
  }, 400));
  document.getElementById('sort').addEventListener('change', (e) => { filters.sort = e.target.value; filters.page = 1; load(); });
  document.getElementById('clear-filters').addEventListener('click', clearAll);
  const filterAside = document.querySelector('.sticky-side');
  const filterToggle = document.getElementById('filter-toggle');
  filterToggle.addEventListener('click', () => {
    const open = filterAside.classList.toggle('filter-open');
    filterToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    filterToggle.textContent = open ? 'Hide filters' : 'Show filters';
  });
  document.getElementById('active-chips').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-remove]');
    if (!btn) return;
    filters[btn.dataset.remove] = '';
    if (btn.dataset.remove === 'q') { document.getElementById('quick-search').value = ''; document.getElementById('f-q').value = ''; }
    if (btn.dataset.remove === 'min_salary') document.getElementById('f-min-salary').value = '';
    filters.page = 1;
    renderFilterLists();
    load();
  });

  (async function init() {
    try {
      const [cats, locs, jobsMeta] = await Promise.all([
        api('/meta/categories?kind=job'), api('/meta/locations'), api('/jobs?per_page=1'),
      ]);
      meta.categories = cats.categories;
      meta.locations = locs.locations;
      meta.jobTypes = jobsMeta.filters.jobTypes;
      meta.workModes = jobsMeta.filters.workModes;
    } catch { /* defaults stay empty */ }
    renderFilterLists();
    load();
  })();
})();
