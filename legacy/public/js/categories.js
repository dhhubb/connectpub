/* Categories index — every job and service group in one portable grid */
(function () {
  'use strict';
  const { api, escapeHtml, toast, qs, setQuery, debounce } = window.PC;

  const state = { scope: qs('scope') || 'both', q: qs('q') || '' };
  let groups = [];

  function matches(group) {
    if (state.q) {
      const hay = (group.name + ' ' + (group.description || '')).toLowerCase();
      if (!hay.includes(state.q.toLowerCase())) return false;
    }
    return true;
  }

  function countsFor(group) {
    // A job-only view reports vacancies; a service-only view reports providers.
    if (state.scope === 'job') return `${group.jobCount} open job${group.jobCount === 1 ? '' : 's'}`;
    if (state.scope === 'service') return `${group.providerCount} provider${group.providerCount === 1 ? '' : 's'}`;
    const parts = [];
    if (group.jobCount) parts.push(`${group.jobCount} job${group.jobCount === 1 ? '' : 's'}`);
    if (group.providerCount) parts.push(`${group.providerCount} provider${group.providerCount === 1 ? '' : 's'}`);
    return parts.length ? parts.join(' · ') : 'No listings yet';
  }

  function groupCard(group) {
    const kindParam = state.scope === 'both' ? '' : `&kind=${state.scope}`;
    return `
      <a class="card cat-card" href="/category.html?group=${encodeURIComponent(group.slug)}${kindParam}">
        <div class="row">
          <div class="thumb">${escapeHtml(group.icon || '📁')}</div>
          <div class="grow">
            <b style="color:var(--ink-900)">${escapeHtml(group.name)}</b>
            <div class="tiny muted">${escapeHtml(countsFor(group))}</div>
          </div>
        </div>
        <p class="small muted" style="margin:.6rem 0 0">${escapeHtml(group.description || '')}</p>
        <div class="cat-card-foot">
          <span class="tag">${group.categoryCount} categor${group.categoryCount === 1 ? 'y' : 'ies'}</span>
          <span class="cat-go">Open →</span>
        </div>
      </a>`;
  }

  function render() {
    const visible = groups.filter(matches);
    const grid = document.getElementById('group-grid');
    grid.innerHTML = visible.map(groupCard).join('');
    document.getElementById('group-empty').hidden = visible.length > 0;
  }

  function setScope(scope) {
    state.scope = scope;
    document.querySelectorAll('#scope-tabs .chip').forEach((c) => c.classList.toggle('active', c.dataset.scope === scope));
    setQuery({ scope: scope === 'both' ? null : scope, q: state.q || null });
    load();
  }

  async function load() {
    const grid = document.getElementById('group-grid');
    grid.innerHTML = '<div class="skeleton" style="height:150px"></div><div class="skeleton" style="height:150px"></div><div class="skeleton" style="height:150px"></div>';
    try {
      const kind = state.scope === 'both' ? '' : `?kind=${state.scope}`;
      const { groups: rows } = await api('/meta/groups' + kind);
      groups = rows;
      render();
    } catch (e) {
      grid.innerHTML = '<div class="empty">Could not load categories. Please refresh.</div>';
      toast(e.message, 'err');
    }
  }

  document.getElementById('cat-search').value = state.q;
  document.getElementById('cat-search').addEventListener('input', debounce((e) => {
    state.q = e.target.value.trim();
    setQuery({ q: state.q || null });
    render();
  }, 250));

  document.getElementById('scope-tabs').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-scope]');
    if (btn) setScope(btn.dataset.scope);
  });

  document.querySelectorAll('#scope-tabs .chip').forEach((c) => c.classList.toggle('active', c.dataset.scope === state.scope));
  load();
})();
