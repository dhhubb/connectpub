/* Registration page */
(function () {
  'use strict';
  const { api, setSession, toast, busy, formToObject, showErrors, escapeHtml } = window.PC;

  const form = document.getElementById('register-form');
  const alertHost = document.getElementById('form-alert');

  const BENEFITS = {
    seeker: [
      'Apply for local jobs in one click',
      'Track every application from submitted to hired',
      'Save jobs and providers for later',
      'Get a public profile employers can view',
    ],
    employer: [
      'Post vacancies to the local job board',
      'Review and shortlist applicants in a dashboard',
      'Move candidates through interview to hired',
      'See views and applicant counts per listing',
    ],
    provider: [
      'Publish your business in the service directory',
      'Receive service requests from customers',
      'Collect star ratings and reviews',
      'Show your experience, prices and availability',
    ],
  };

  function renderBenefits() {
    const role = form.querySelector('input[name=role]:checked').value;
    document.getElementById('benefits').innerHTML = BENEFITS[role].map((b) => `<li>${escapeHtml(b)}</li>`).join('');
  }

  document.getElementById('role-picker').addEventListener('change', renderBenefits);
  renderBenefits();

  (async function loadWards() {
    try {
      const { locations } = await api('/meta/locations');
      const sel = document.getElementById('ward-select');
      for (const l of locations) {
        const opt = document.createElement('option');
        opt.value = l.name;
        opt.textContent = l.name;
        sel.appendChild(opt);
      }
    } catch { /* optional */ }
  })();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('submit-btn');
    alertHost.innerHTML = '';
    busy(btn, true, 'Creating account…');
    try {
      const { token, user } = await api('/auth/register', { method: 'POST', body: formToObject(form) });
      setSession(token, user);
      toast('Account created. Welcome to Plumtree Connect!');
      location.href = '/dashboard.html';
    } catch (err) {
      busy(btn, false);
      if (err.data && err.data.errors) {
        showErrors(form, err.data.errors);
        alertHost.innerHTML = `<div class="alert alert-error">${escapeHtml(err.message)}</div>`;
      } else {
        alertHost.innerHTML = `<div class="alert alert-error">${escapeHtml(err.message)}</div>`;
      }
    }
  });
})();
