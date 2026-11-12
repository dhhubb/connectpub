/* Job detail page */
(function () {
  'use strict';
  const { api, escapeHtml, money, dateLabel, daysLeft, statusBadge, toast, modal, closeModal, busy, state, requireLogin, formToObject, showErrors, qs } = window.PC;

  const jobId = Number(qs('id'));
  const page = document.getElementById('page');
  let job = null;

  function notFound() {
    page.innerHTML = `<div class="empty"><span class="icon">🔍</span><b>Job not found</b><p>This listing may have been removed or is awaiting review.</p><a class="btn" href="/jobs.html">Back to jobs</a></div>`;
  }

  function render(data) {
    job = data.job;
    const left = daysLeft(job.deadline);
    const closed = job.status !== 'approved' || (left !== null && left < 0);
    const owner = state.user && state.user.id === job.employerId;
    const isAdmin = state.user && state.user.role === 'admin';

    let applyBlock;
    if (owner) {
      applyBlock = `<div class="alert alert-info">You posted this vacancy. <a href="/dashboard.html">Manage it in your dashboard</a>.</div>`;
    } else if (isAdmin) {
      applyBlock = `<div class="alert alert-info">Administrator view. <a href="/admin.html">Moderate in the admin panel</a>.</div>`;
    } else if (closed) {
      applyBlock = `<div class="alert alert-warn"><b>Applications are closed.</b> This vacancy is no longer accepting applications.</div>`;
    } else if (job.myApplication) {
      applyBlock = `<div class="alert alert-ok"><b>You applied on ${escapeHtml(dateLabel(job.myApplication.createdAt))}.</b>
        Status: ${statusBadge(job.myApplication.status, job.myApplication.statusLabel || job.myApplication.status)}.
        <a href="/dashboard.html">Track it in your dashboard</a>.</div>`;
    } else {
      applyBlock = `<button class="btn btn-block" id="apply-btn">Apply for this job</button>
        <p class="tiny muted center" style="margin-top:.5rem">${state.user ? 'One click — we use your profile details.' : 'You will be asked to sign in first.'}</p>`;
    }

    page.innerHTML = `
      <nav class="small muted" style="margin-bottom:.9rem"><a href="/">Home</a> › <a href="/jobs.html">Jobs</a> › ${escapeHtml(job.title)}</nav>
      <div class="grid-side">
        <div class="stack">
          <div class="card card-pad-lg">
            <div class="row" style="align-items:flex-start">
              <div class="thumb" style="width:56px;height:56px;font-size:1.6rem">${escapeHtml(job.category?.icon || '💼')}</div>
              <div class="grow">
                <h1 style="font-size:1.6rem;margin-bottom:.2rem">${escapeHtml(job.title)}</h1>
                <p class="muted mb0"><b style="color:var(--ink-700)">${escapeHtml(job.company)}</b>${job.location ? ' · 📍 ' + escapeHtml(job.location.name) : ''}</p>
              </div>
              ${job.featured ? '<span class="badge badge-clay">Featured</span>' : ''}
            </div>
            <div class="chips" style="margin-top:.9rem">
              <span class="tag">${escapeHtml(job.jobTypeLabel)}</span>
              <span class="tag">${escapeHtml(job.workModeLabel)}</span>
              <span class="tag">${job.vacancies} post${job.vacancies === 1 ? '' : 's'}</span>
              ${job.category ? `<span class="tag">${escapeHtml(job.category.name)}</span>` : ''}
              ${statusBadge(job.status, job.statusLabel)}
            </div>
            ${job.rejectionReason ? `<div class="alert alert-error" style="margin-top:1rem">Moderator note: ${escapeHtml(job.rejectionReason)}</div>` : ''}
          </div>

          <div class="card">
            <h3>About the role</h3>
            <div class="prose"><p style="white-space:pre-line">${escapeHtml(job.description)}</p></div>
            ${job.requirements && job.requirements.length ? `
              <h3 style="margin-top:1.2rem">Requirements</h3>
              <ul class="list-check">${job.requirements.map((r) => `<li>${escapeHtml(r)}</li>`).join('')}</ul>` : ''}
          </div>

          <div class="card">
            <h3>How to apply</h3>
            ${applyBlock}
            ${(job.contactEmail || job.contactPhone) ? `
              <div class="divider"></div>
              <p class="small muted">You can also contact the employer directly:</p>
              <div class="row row-wrap small">
                ${job.contactEmail ? `<span class="badge badge-blue">✉ ${escapeHtml(job.contactEmail)}</span>` : ''}
                ${job.contactPhone ? `<span class="badge badge-blue">☎ ${escapeHtml(job.contactPhone)}</span>` : ''}
              </div>` : ''}
          </div>
        </div>

        <aside class="stack sticky-side">
          <div class="card">
            <h3>Summary</h3>
            <dl class="kv">
              <dt>Salary</dt><dd><b style="color:var(--green-800)">${escapeHtml(job.salaryLabel)}</b></dd>
              <dt>Job type</dt><dd>${escapeHtml(job.jobTypeLabel)}</dd>
              <dt>Work mode</dt><dd>${escapeHtml(job.workModeLabel)}</dd>
              <dt>Location</dt><dd>${job.location ? escapeHtml(job.location.name) + ` <span class="tiny muted">(${escapeHtml(job.location.kind)})</span>` : 'Not specified'}</dd>
              <dt>Vacancies</dt><dd>${job.vacancies}</dd>
              <dt>Deadline</dt><dd>${job.deadline ? escapeHtml(dateLabel(job.deadline)) + (left !== null && left >= 0 ? ` <span class="badge badge-amber">${left}d left</span>` : '') : 'Rolling'}</dd>
              <dt>Posted</dt><dd>${escapeHtml(dateLabel(job.createdAt))}</dd>
              <dt>Applicants</dt><dd>${job.applicationCount}</dd>
              <dt>Views</dt><dd>${job.views}</dd>
            </dl>
          </div>
          <div class="card">
            <h3>Employer</h3>
            <div class="row">
              <div class="avatar">${escapeHtml(window.PC.initials(job.employerName || job.company))}</div>
              <div class="grow"><b>${escapeHtml(job.company)}</b><div class="tiny muted">${escapeHtml(job.employerName || '')}</div></div>
            </div>
            <div class="divider"></div>
            <button class="btn btn-ghost btn-block btn-sm" id="save-btn">${job.saved ? '★ Saved' : '☆ Save this job'}</button>
            <button class="btn btn-ghost btn-block btn-sm" id="share-btn" style="margin-top:.4rem">🔗 Copy link</button>
          </div>
        </aside>
      </div>`;

    document.getElementById('save-btn')?.addEventListener('click', toggleSave);
    document.getElementById('share-btn')?.addEventListener('click', () => {
      navigator.clipboard?.writeText(location.href).then(() => toast('Link copied to clipboard')).catch(() => toast('Copy failed', 'err'));
    });
    document.getElementById('apply-btn')?.addEventListener('click', openApply);
  }

  async function toggleSave() {
    if (!requireLogin()) return;
    try {
      const res = await api(`/jobs/${job.id}/save`, { method: 'POST' });
      job.saved = res.saved;
      document.getElementById('save-btn').textContent = res.saved ? '★ Saved' : '☆ Save this job';
      toast(res.saved ? 'Job saved' : 'Removed from saved jobs');
    } catch (e) { toast(e.message, 'err'); }
  }

  function openApply() {
    if (!requireLogin()) return;
    const body = document.createElement('div');
    body.innerHTML = `
      <div class="alert alert-info">Applying as <b>${escapeHtml(state.user.name)}</b> (${escapeHtml(state.user.email)})${state.user.phone ? ' · ' + escapeHtml(state.user.phone) : ''}</div>
      <form id="apply-form">
        <label class="field">
          <span class="lbl">Cover letter <span class="req">*</span></span>
          <textarea name="coverLetter" rows="6" placeholder="Tell the employer why you are a good fit for this role…"></textarea>
        </label>
        <div class="grid-2">
          <label class="field">
            <span class="lbl">Expected salary (USD)</span>
            <input type="number" name="expectedSalary" min="0" step="10" placeholder="e.g. 350">
          </label>
          <label class="field">
            <span class="lbl">CV link (optional)</span>
            <input type="text" name="cvUrl" placeholder="https://…">
          </label>
        </div>
        <div class="form-actions">
          <button class="btn" type="submit" id="apply-submit">Submit application</button>
          <button class="btn btn-ghost" type="button" data-close>Cancel</button>
        </div>
      </form>`;
    modal({ title: `Apply: ${job.title}`, body, footer: null });
    const form = document.getElementById('apply-form');
    form.elements.coverLetter.value = `I am interested in the ${job.title} role at ${job.company}. `;
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = document.getElementById('apply-submit');
      busy(btn, true, 'Submitting…');
      try {
        await api(`/jobs/${job.id}/apply`, { method: 'POST', body: formToObject(form) });
        closeModal();
        toast('Application submitted — track it in your dashboard');
        load();
      } catch (err) {
        busy(btn, false);
        if (err.data && err.data.errors) showErrors(form, err.data.errors);
        else toast(err.message, 'err');
      }
    });
  }

  async function load() {
    if (!jobId) return notFound();
    try {
      render(await api('/jobs/' + jobId));
    } catch (e) {
      if (e.status === 404) notFound(); else { notFound(); toast(e.message, 'err'); }
    }
  }

  load();
})();
