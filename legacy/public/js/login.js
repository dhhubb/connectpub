/* Sign in page */
(function () {
  'use strict';
  const { api, setSession, toast, busy, formToObject, showErrors, qs } = window.PC;

  const form = document.getElementById('login-form');
  const alertHost = document.getElementById('form-alert');

  document.getElementById('quick-logins').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-email]');
    if (!btn) return;
    form.elements.email.value = btn.dataset.email;
    form.elements.password.value = btn.dataset.password;
    form.elements.password.focus();
  });

  function afterLogin(user) {
    const next = qs('next');
    const fallback = user.role === 'admin' ? '/admin.html' : '/dashboard.html';
    location.href = next && next.startsWith('/') ? next : fallback;
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('submit-btn');
    alertHost.innerHTML = '';
    busy(btn, true, 'Signing in…');
    try {
      const { token, user } = await api('/auth/login', { method: 'POST', body: formToObject(form) });
      setSession(token, user);
      toast(`Welcome back, ${user.name.split(' ')[0]}`);
      afterLogin(user);
    } catch (err) {
      busy(btn, false);
      alertHost.innerHTML = `<div class="alert alert-error">${window.PC.escapeHtml(err.message)}</div>`;
    }
  });
})();
