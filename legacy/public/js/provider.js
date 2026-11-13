/* Service provider detail page */
(function () {
  'use strict';
  const { api, escapeHtml, money, dateLabel, stars, statusBadge, toast, modal, closeModal, busy, state, requireLogin, formToObject, showErrors, qs, initials } = window.PC;

  const providerId = Number(qs('id'));
  const page = document.getElementById('page');
  let provider = null;

  function notFound() {
    page.innerHTML = `<div class="empty"><span class="icon">🔍</span><b>Provider not found</b><p>This listing may have been removed or is awaiting review.</p><a class="btn" href="/providers.html">Back to services</a></div>`;
  }

  function reviewList(reviews, myReview) {
    if (!reviews.length) return '<p class="muted small">No reviews yet. Be the first to review this provider.</p>';
    return reviews.map((r) => `
      <div style="border-bottom:1px solid var(--line);padding:.7rem 0">
        <div class="spread">
          <div class="row">
            <div class="avatar" style="width:32px;height:32px;font-size:.8rem">${escapeHtml(initials(r.userName))}</div>
            <div><b class="small">${escapeHtml(r.userName)}</b>${r.userId === (state.user && state.user.id) ? ' <span class="badge badge-blue">You</span>' : ''}<div class="tiny muted">${escapeHtml(dateLabel(r.createdAt))}</div></div>
          </div>
          ${stars(r.rating)}
        </div>
        ${r.comment ? `<p class="small" style="margin:.5rem 0 0">${escapeHtml(r.comment)}</p>` : ''}
      </div>`).join('');
  }

  function render(data) {
    provider = data.provider;
    const owner = state.user && state.user.id === provider.ownerId;
    const isAdmin = state.user && state.user.role === 'admin';
    const approved = provider.status === 'approved';

    let requestBlock;
    if (owner) requestBlock = `<div class="alert alert-info">This is your listing. <a href="/dashboard.html">Manage it in your dashboard</a>.</div>`;
    else if (isAdmin) requestBlock = `<div class="alert alert-info">Administrator view. <a href="/admin.html">Moderate in the admin panel</a>.</div>`;
    else if (!approved) requestBlock = `<div class="alert alert-warn">This listing is not published yet.</div>`;
    else requestBlock = `<button class="btn btn-block" id="request-btn">Request a service</button>
      <p class="tiny muted center" style="margin-top:.5rem">Free to send. The provider replies with a quote.</p>`;

    page.innerHTML = `
      <nav class="small muted" style="margin-bottom:.9rem"><a href="/">Home</a> › <a href="/providers.html">Services</a> › ${escapeHtml(provider.businessName)}</nav>
      <div class="grid-side">
        <div class="stack">
          <div class="card card-pad-lg">
            <div class="row" style="align-items:flex-start">
              <div class="thumb thumb-clay" style="width:56px;height:56px;font-size:1.6rem">${escapeHtml(provider.category?.icon || '🔧')}</div>
              <div class="grow">
                <h1 style="font-size:1.55rem;margin-bottom:.2rem">${escapeHtml(provider.businessName)}</h1>
                <p class="muted mb0">${escapeHtml(provider.tagline || provider.category?.name || 'Local service provider')}</p>
                <div class="row small" style="margin-top:.5rem">
                  ${provider.rating ? stars(provider.rating) + `<b>${provider.rating}</b><span class="muted">(${provider.ratingCount} review${provider.ratingCount === 1 ? '' : 's'})</span>` : '<span class="muted">No reviews yet</span>'}
                </div>
              </div>
              <div class="chips" style="flex-direction:column;align-items:flex-end">
                ${provider.verified ? '<span class="badge badge-green">✓ Verified</span>' : ''}
                ${provider.featured ? '<span class="badge badge-clay">Featured</span>' : ''}
                ${statusBadge(provider.availability, provider.availabilityLabel)}
              </div>
            </div>
            ${provider.rejectionReason ? `<div class="alert alert-error" style="margin-top:1rem">Moderator note: ${escapeHtml(provider.rejectionReason)}</div>` : ''}
          </div>

          <div class="card">
            <h3>About this provider</h3>
            <div class="prose"><p style="white-space:pre-line">${escapeHtml(provider.description)}</p></div>
            ${provider.services && provider.services.length ? `
              <h3 style="margin-top:1.1rem">Services offered</h3>
              <div class="tag-list">${provider.services.map((s) => `<span class="tag">${escapeHtml(s)}</span>`).join('')}</div>` : ''}
          </div>

          <div class="card">
            <div class="card-title"><h3>Reviews (${data.reviews.length})</h3>
              ${state.user && !owner && !isAdmin && approved ? '<button class="btn btn-sm btn-outline" id="review-btn">' + (data.myReview ? 'Edit your review' : 'Write a review') + '</button>' : ''}
            </div>
            ${reviewList(data.reviews, data.myReview)}
          </div>
        </div>

        <aside class="stack sticky-side">
          <div class="card">
            <h3>Contact &amp; request</h3>
            ${requestBlock}
            <div class="divider"></div>
            <dl class="kv">
              <dt>Phone</dt><dd><a href="tel:${escapeHtml(provider.phone || '')}">${escapeHtml(provider.phone || '—')}</a></dd>
              ${provider.whatsapp ? `<dt>WhatsApp</dt><dd><a href="https://wa.me/${escapeHtml(String(provider.whatsapp).replace(/[^0-9]/g, ''))}" target="_blank" rel="noopener">${escapeHtml(provider.whatsapp)}</a></dd>` : ''}
              ${provider.email ? `<dt>Email</dt><dd>${escapeHtml(provider.email)}</dd>` : ''}
              ${provider.address ? `<dt>Address</dt><dd>${escapeHtml(provider.address)}</dd>` : ''}
            </dl>
          </div>
          <div class="card">
            <h3>Details</h3>
            <dl class="kv">
              <dt>Category</dt><dd>${escapeHtml(provider.category?.name || '—')}</dd>
              <dt>Area</dt><dd>${provider.location ? escapeHtml(provider.location.name) + ` <span class="tiny muted">(${escapeHtml(provider.location.kind)})</span>` : '—'}</dd>
              <dt>Starting price</dt><dd><b style="color:var(--clay-700)">${escapeHtml(money(provider.priceFrom, provider.currency))}</b></dd>
              <dt>Experience</dt><dd>${provider.yearsExperience} years</dd>
              <dt>Availability</dt><dd>${escapeHtml(provider.availabilityLabel)}</dd>
              <dt>Listed since</dt><dd>${escapeHtml(dateLabel(provider.createdAt))}</dd>
              <dt>Views</dt><dd>${provider.views}</dd>
            </dl>
            <div class="divider"></div>
            <button class="btn btn-ghost btn-block btn-sm" id="save-btn">${provider.saved ? '★ Saved' : '☆ Save this provider'}</button>
          </div>
        </aside>
      </div>`;

    document.getElementById('request-btn')?.addEventListener('click', openRequest);
    document.getElementById('review-btn')?.addEventListener('click', () => openReview(data.myReview));
    document.getElementById('save-btn')?.addEventListener('click', toggleSave);
  }

  async function toggleSave() {
    if (!requireLogin()) return;
    try {
      const res = await api(`/providers/${provider.id}/save`, { method: 'POST' });
      provider.saved = res.saved;
      document.getElementById('save-btn').textContent = res.saved ? '★ Saved' : '☆ Save this provider';
      toast(res.saved ? 'Provider saved' : 'Removed from saved providers');
    } catch (e) { toast(e.message, 'err'); }
  }

  function openRequest() {
    const body = document.createElement('div');
    body.innerHTML = `
      <div class="alert alert-info">Sending a request to <b>${escapeHtml(provider.businessName)}</b>. They will contact you with a quote.</div>
      <form id="request-form">
        <div class="grid-2">
          <label class="field"><span class="lbl">Your name <span class="req">*</span></span><input type="text" name="name" value="${escapeHtml(state.user?.name || '')}"></label>
          <label class="field"><span class="lbl">Phone <span class="req">*</span></span><input type="tel" name="phone" value="${escapeHtml(state.user?.phone || '')}" placeholder="+263…"></label>
        </div>
        <div class="grid-2">
          <label class="field"><span class="lbl">Email</span><input type="email" name="email" value="${escapeHtml(state.user?.email || '')}"></label>
          <label class="field"><span class="lbl">Preferred date</span><input type="date" name="preferredDate"></label>
        </div>
        <label class="field"><span class="lbl">Service needed <span class="req">*</span></span>
          <input type="text" name="serviceNeeded" list="service-options" placeholder="e.g. Borehole drilling">
          <datalist id="service-options">${(provider.services || []).map((s) => `<option value="${escapeHtml(s)}">`).join('')}</datalist>
        </label>
        <label class="field"><span class="lbl">Details</span><textarea name="details" rows="4" placeholder="Describe the job, location and timing…"></textarea></label>
        <label class="field"><span class="lbl">Budget (USD)</span><input type="number" name="budget" min="0" step="10" placeholder="Optional"></label>
        <div class="form-actions">
          <button class="btn" type="submit" id="request-submit">Send request</button>
          <button class="btn btn-ghost" type="button" data-close>Cancel</button>
        </div>
      </form>`;
    modal({ title: 'Request a service', body });
    const form = document.getElementById('request-form');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = document.getElementById('request-submit');
      busy(btn, true, 'Sending…');
      try {
        const res = await api(`/providers/${provider.id}/request`, { method: 'POST', body: formToObject(form) });
        closeModal();
        toast(res.message || 'Request sent');
      } catch (err) {
        busy(btn, false);
        if (err.data && err.data.errors) showErrors(form, err.data.errors);
        else toast(err.message, 'err');
      }
    });
  }

  function openReview(existing) {
    const body = document.createElement('div');
    body.innerHTML = `
      <form id="review-form">
        <label class="field"><span class="lbl">Rating <span class="req">*</span></span>
          <select name="rating" id="rating-select">
            ${[5, 4, 3, 2, 1].map((n) => `<option value="${n}" ${existing && existing.rating === n ? 'selected' : ''}>${'★'.repeat(n)} ${n} star${n === 1 ? '' : 's'}</option>`).join('')}
          </select>
        </label>
        <label class="field"><span class="lbl">Your review</span><textarea name="comment" rows="4" placeholder="How was the work, the price and the service?">${escapeHtml(existing?.comment || '')}</textarea></label>
        <div class="form-actions">
          <button class="btn" type="submit" id="review-submit">${existing ? 'Update review' : 'Post review'}</button>
          <button class="btn btn-ghost" type="button" data-close>Cancel</button>
        </div>
      </form>`;
    modal({ title: `Review ${provider.businessName}`, body });
    const form = document.getElementById('review-form');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = document.getElementById('review-submit');
      busy(btn, true, 'Saving…');
      try {
        const payload = formToObject(form);
        payload.rating = Number(payload.rating);
        await api(`/providers/${provider.id}/reviews`, { method: 'POST', body: payload });
        closeModal();
        toast('Thank you, your review has been saved');
        load();
      } catch (err) {
        busy(btn, false);
        toast(err.message, 'err');
      }
    });
  }

  async function load() {
    if (!providerId) return notFound();
    try {
      render(await api('/providers/' + providerId));
    } catch (e) {
      notFound();
      if (e.status !== 404) toast(e.message, 'err');
    }
  }

  load();
})();
