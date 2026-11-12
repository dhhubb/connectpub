/* Plumtree Connect shared frontend core */
(function () {
  'use strict';

  const TOKEN_KEY = 'pc_token';
  const USER_KEY = 'pc_user';

  const state = {
    token: localStorage.getItem(TOKEN_KEY) || null,
    user: safeParse(localStorage.getItem(USER_KEY)),
  };

  function safeParse(raw) {
    if (!raw) return null;
    try { return JSON.parse(raw); } catch { return null; }
  }

  function setSession(token, user) {
    state.token = token || null;
    state.user = user || null;
    if (token) localStorage.setItem(TOKEN_KEY, token); else localStorage.removeItem(TOKEN_KEY);
    if (user) localStorage.setItem(USER_KEY, JSON.stringify(user)); else localStorage.removeItem(USER_KEY);
    renderHeader();
  }

  async function api(path, { method = 'GET', body, headers = {} } = {}) {
    const opts = { method, headers: { ...headers } };
    if (body !== undefined) {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    }
    if (state.token) opts.headers['Authorization'] = 'Bearer ' + state.token;
    const res = await fetch('/api' + path, opts);
    let data = null;
    const text = await res.text();
    if (text) { try { data = JSON.parse(text); } catch { data = { error: text }; } }
    if (!res.ok) {
      if (res.status === 401 && state.token && !path.startsWith('/auth/login')) {
        setSession(null, null);
      }
      const err = new Error((data && (data.error || data.message)) || `Request failed (${res.status})`);
      err.status = res.status;
      err.data = data || {};
      throw err;
    }
    return data || {};
  }

  /* ---------- formatting ---------- */
  function escapeHtml(value) {
    if (value === null || value === undefined) return '';
    return String(value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function money(amount, currency) {
    if (amount === null || amount === undefined || amount === '') return 'Negotiable';
    const n = Number(amount);
    return (currency ? currency + ' ' : '') + n.toLocaleString('en-US', { maximumFractionDigits: 0 });
  }

  function dateLabel(value) {
    if (!value) return '—';
    const iso = String(value).includes('T') ? value : String(value).replace(' ', 'T') + 'Z';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return String(value);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  function dateTimeLabel(value) {
    if (!value) return '—';
    const iso = String(value).includes('T') ? value : String(value).replace(' ', 'T') + 'Z';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return String(value);
    return d.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  function timeAgo(value) {
    if (!value) return '';
    const iso = String(value).includes('T') ? value : String(value).replace(' ', 'T') + 'Z';
    const then = new Date(iso).getTime();
    if (isNaN(then)) return '';
    const secs = Math.floor((Date.now() - then) / 1000);
    if (secs < 60) return 'just now';
    const mins = Math.floor(secs / 60);
    if (mins < 60) return mins + ' min ago';
    const hours = Math.floor(mins / 60);
    if (hours < 24) return hours + (hours === 1 ? ' hour ago' : ' hours ago');
    const days = Math.floor(hours / 24);
    if (days < 31) return days + (days === 1 ? ' day ago' : ' days ago');
    return dateLabel(value);
  }

  function daysLeft(deadline) {
    if (!deadline) return null;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const end = new Date(String(deadline).slice(0, 10) + 'T00:00:00Z');
    if (isNaN(end.getTime())) return null;
    return Math.round((end - today) / 86400000);
  }

  function initials(name) {
    return String(name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');
  }

  function stars(rating) {
    const full = Math.round(rating || 0);
    let out = '';
    for (let i = 1; i <= 5; i += 1) out += i <= full ? '★' : '<span class="off">★</span>';
    return `<span class="stars">${out}</span>`;
  }

  function statusBadge(status, label) {
    const map = {
      approved: 'badge-green', active: 'badge-green', published: 'badge-green', completed: 'badge-green',
      hired: 'badge-green', accepted: 'badge-green', available: 'badge-green',
      pending: 'badge-amber', reviewing: 'badge-blue', contacted: 'badge-blue', quoted: 'badge-blue',
      submitted: 'badge-blue', new: 'badge-blue', shortlisted: 'badge-clay', interview: 'badge-clay', busy: 'badge-clay',
      rejected: 'badge-red', suspended: 'badge-red', declined: 'badge-red', cancelled: 'badge-red',
      closed: 'badge-plain', expired: 'badge-plain', withdrawn: 'badge-plain', unavailable: 'badge-plain', hidden: 'badge-plain',
    };
    const cls = map[status] || 'badge-plain';
    return `<span class="badge ${cls}">${escapeHtml(label || status)}</span>`;
  }

  /* ---------- toast + modal ---------- */
  function toastHost() {
    let host = document.getElementById('toast-host');
    if (!host) {
      host = document.createElement('div');
      host.id = 'toast-host';
      document.body.appendChild(host);
    }
    return host;
  }

  function toast(message, kind = 'ok') {
    const host = toastHost();
    const el = document.createElement('div');
    el.className = 'toast ' + (kind === 'err' ? 'err' : kind === 'ok' ? 'ok' : '');
    el.textContent = message;
    host.appendChild(el);
    setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity .3s'; }, 3200);
    setTimeout(() => el.remove(), 3600);
  }

  let modalHost = null;
  function closeModal() {
    if (modalHost) { modalHost.remove(); modalHost = null; }
    document.removeEventListener('keydown', onModalKey);
  }
  function onModalKey(e) { if (e.key === 'Escape') closeModal(); }

  function modal({ title, body, footer, large = false }) {
    closeModal();
    modalHost = document.createElement('div');
    modalHost.className = 'modal-backdrop';
    modalHost.innerHTML = `
      <div class="modal ${large ? 'modal-lg' : ''}" role="dialog" aria-modal="true">
        <div class="modal-head"><h3>${escapeHtml(title || '')}</h3><button class="x-btn" data-close aria-label="Close">×</button></div>
        <div class="modal-body"></div>
        ${footer ? '<div class="modal-foot"></div>' : ''}
      </div>`;
    const bodyEl = modalHost.querySelector('.modal-body');
    if (typeof body === 'string') bodyEl.innerHTML = body;
    else if (body) bodyEl.appendChild(body);
    if (footer) {
      const foot = modalHost.querySelector('.modal-foot');
      if (typeof footer === 'string') foot.innerHTML = footer;
      else foot.appendChild(footer);
    }
    modalHost.addEventListener('click', (e) => {
      if (e.target === modalHost || e.target.hasAttribute('data-close')) closeModal();
    });
    document.addEventListener('keydown', onModalKey);
    document.body.appendChild(modalHost);
    return modalHost;
  }

  function confirmDialog(message, { title = 'Please confirm', confirmLabel = 'Confirm', danger = false } = {}) {
    return new Promise((resolve) => {
      const foot = document.createElement('div');
      foot.className = 'btn-group';
      const cancel = document.createElement('button');
      cancel.className = 'btn btn-ghost'; cancel.textContent = 'Cancel';
      const ok = document.createElement('button');
      ok.className = 'btn' + (danger ? ' btn-danger' : ''); ok.textContent = confirmLabel;
      foot.append(cancel, ok);
      const host = modal({ title, body: `<p>${escapeHtml(message)}</p>`, footer: foot });
      cancel.onclick = () => { closeModal(); resolve(false); };
      ok.onclick = () => { closeModal(); resolve(true); };
      host.addEventListener('click', (e) => { if (e.target === host) resolve(false); });
    });
  }

  /* ---------- forms ---------- */
  function formToObject(form) {
    const out = {};
    new FormData(form).forEach((value, key) => {
      if (value instanceof File) return;
      out[key] = typeof value === 'string' ? value.trim() : value;
    });
    return out;
  }

  function showErrors(form, errors) {
    form.querySelectorAll('.field-error').forEach((el) => el.remove());
    form.querySelectorAll('.invalid').forEach((el) => el.classList.remove('invalid'));
    if (!errors) return;
    let first = null;
    for (const [name, message] of Object.entries(errors)) {
      const input = form.elements[name] || form.querySelector(`[name="${name}"]`);
      const target = input && input.closest('.field') ? input.closest('.field') : input;
      if (target) {
        target.classList.add('invalid');
        const span = document.createElement('span');
        span.className = 'field-error';
        span.textContent = message;
        target.appendChild(span);
        if (!first) first = target;
      }
    }
    if (first && first.scrollIntoView) first.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }

  function busy(button, isBusy, labelWhenBusy = 'Working…') {
    if (!button) return;
    if (isBusy) {
      button.dataset.label = button.textContent;
      button.textContent = labelWhenBusy;
      button.disabled = true;
    } else {
      if (button.dataset.label) button.textContent = button.dataset.label;
      button.disabled = false;
    }
  }

  function qs(name) {
    return new URLSearchParams(location.search).get(name);
  }

  function setQuery(params, { replace = true } = {}) {
    const url = new URL(location.href);
    for (const [key, value] of Object.entries(params)) {
      if (value === null || value === undefined || value === '') url.searchParams.delete(key);
      else url.searchParams.set(key, value);
    }
    history[replace ? 'replaceState' : 'pushState']({}, '', url);
  }

  /* ---------- header / footer ---------- */
  function renderHeader() {
    const host = document.querySelector('[data-header]');
    if (!host) return;
    const user = state.user;
    const here = location.pathname.replace(/\/index\.html$/, '/');
    const link = (href, label, extra = '') => {
      const active = here === href || (href !== '/' && here.startsWith(href)) ? ' active' : '';
      return `<a class="navlink${active}" href="${href}" ${extra}>${label}</a>`;
    };

    let account;
    if (user) {
      const dash = user.role === 'admin' ? '/admin.html' : '/dashboard.html';
      account = `
        ${link('/jobs.html', 'Jobs')}
        ${link('/providers.html', 'Services')}
        <a class="navlink" href="${dash}">Dashboard</a>
        <span class="badge badge-green" title="${escapeHtml(user.email)}">${escapeHtml(initials(user.name))} · ${escapeHtml(roleLabel(user.role))}</span>
        <button class="btn btn-ghost btn-sm" data-logout>Sign out</button>`;
    } else {
      account = `
        ${link('/jobs.html', 'Jobs')}
        ${link('/providers.html', 'Services')}
        <a class="navlink" href="/login.html">Sign in</a>
        <a class="btn btn-sm" href="/register.html">Create account</a>`;
    }

    host.innerHTML = `
      <header class="site-header">
        <div class="container inner">
          <a class="brand" href="/">
            <span class="brand-mark">🌳</span>
            <span>Plumtree Connect<small>Matabeleland South</small></span>
          </a>
          <button class="btn btn-ghost btn-sm nav-toggle" data-nav-toggle aria-label="Menu">☰ Menu</button>
          <nav class="nav">${account}</nav>
        </div>
      </header>`;

    host.querySelector('[data-nav-toggle]')?.addEventListener('click', () => {
      host.querySelector('.nav').classList.toggle('open');
    });
    host.querySelector('[data-logout]')?.addEventListener('click', async () => {
      try { await api('/auth/logout', { method: 'POST' }); } catch { /* ignore */ }
      setSession(null, null);
      toast('You have been signed out');
      setTimeout(() => { location.href = '/'; }, 500);
    });
  }

  function roleLabel(role) {
    return { seeker: 'Job seeker', employer: 'Employer', provider: 'Service provider', admin: 'Administrator' }[role] || role;
  }

  function renderFooter() {
    const host = document.querySelector('[data-footer]');
    if (!host) return;
    const year = new Date().getFullYear();
    host.innerHTML = `
      <footer class="site-footer">
        <div class="container">
          <div class="footer-grid">
            <div>
              <div class="brand" style="color:#fff"><span class="brand-mark">🌳</span><span>Plumtree Connect</span></div>
              <p class="small" style="margin-top:.7rem;max-width:38ch">The local jobs and services board for Plumtree and the wider Matabeleland South province. Post work, find work, and book trusted service providers near you.</p>
            </div>
            <div>
              <h4>Find work</h4>
              <a href="/jobs.html">Browse jobs</a>
              <a href="/jobs.html?job_type=full_time">Full time roles</a>
              <a href="/jobs.html?work_mode=remote">Remote work</a>
              <a href="/register.html">Create a job seeker profile</a>
            </div>
            <div>
              <h4>Find services</h4>
              <a href="/providers.html">Browse providers</a>
              <a href="/providers.html?verified=1">Verified providers</a>
              <a href="/providers.html?category=plumbing-boreholes">Boreholes & plumbing</a>
              <a href="/register.html">List your business</a>
            </div>
            <div>
              <h4>Platform</h4>
              <a href="/dashboard.html">User dashboard</a>
              <a href="/admin.html">Admin panel</a>
              <a href="/about.html">About &amp; how it works</a>
              <a href="/api/health">API status</a>
            </div>
          </div>
          <div class="footer-bottom">
            <span>© ${year} Plumtree Connect · Plumtree, Matabeleland South, Zimbabwe</span>
            <span>Built for the local community · Demo data</span>
          </div>
        </div>
      </footer>`;
  }

  function requireLogin(redirect) {
    if (state.user) return true;
    const target = redirect || location.pathname + location.search;
    location.href = '/login.html?next=' + encodeURIComponent(target);
    return false;
  }

  function requireRole(roles, redirect) {
    if (!requireLogin(redirect)) return false;
    if (roles.includes(state.user.role)) return true;
    toast('That area is not available for your account type', 'err');
    location.href = state.user.role === 'admin' ? '/admin.html' : '/dashboard.html';
    return false;
  }

  async function refreshUser() {
    if (!state.token) return null;
    try {
      const { user } = await api('/auth/me');
      state.user = user;
      localStorage.setItem(USER_KEY, JSON.stringify(user));
      return user;
    } catch {
      return null;
    }
  }

  function param(name) { return qs(name); }

  function debounce(fn, wait = 300) {
    let timer;
    return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), wait); };
  }

  window.PC = {
    state, api, setSession, refreshUser, requireLogin, requireRole,
    escapeHtml, money, dateLabel, dateTimeLabel, timeAgo, daysLeft, initials, stars, statusBadge,
    toast, modal, closeModal, confirmDialog,
    formToObject, showErrors, busy, qs, setQuery, param, debounce, roleLabel,
  };

  document.addEventListener('DOMContentLoaded', () => {
    renderHeader();
    renderFooter();
    refreshUser().then(() => renderHeader());
  });
})();
