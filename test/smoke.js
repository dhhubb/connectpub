'use strict';

/**
 * End to end smoke test for the Plumtree Connect API.
 * Run against a live server:  BASE=http://localhost:3000 node test/smoke.js
 */

const BASE = process.env.BASE || 'http://localhost:3000';

let passed = 0;
let failed = 0;
const failures = [];

function check(name, condition, detail) {
  if (condition) {
    passed += 1;
    console.log(`  ok   ${name}`);
  } else {
    failed += 1;
    failures.push(name + (detail ? ` — ${detail}` : ''));
    console.log(`  FAIL ${name}${detail ? ' — ' + detail : ''}`);
  }
}

async function call(path, { method = 'GET', body, token } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = 'Bearer ' + token;
  const res = await fetch(BASE + '/api' + path, {
    method, headers, body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let data = null;
  if (text) { try { data = JSON.parse(text); } catch { data = { raw: text }; } }
  return { status: res.status, data };
}

async function login(email, password) {
  const { status, data } = await call('/auth/login', { method: 'POST', body: { email, password } });
  if (status !== 200) throw new Error(`login failed for ${email}: ${status} ${JSON.stringify(data)}`);
  return data.token;
}

async function main() {
  console.log(`\nPlumtree Connect smoke test → ${BASE}\n`);

  console.log('Health & public catalogue');
  const health = await call('/health');
  check('health endpoint responds ok', health.status === 200 && health.data.ok === true);

  const cats = await call('/meta/categories');
  check('job and service categories exist', cats.data.categories.filter((c) => c.kind === 'job').length >= 10 && cats.data.categories.filter((c) => c.kind === 'service').length >= 10);

  const locs = await call('/meta/locations');
  check('locations exist', locs.data.locations.length >= 10);

  const stats = await call('/meta/stats');
  check('public stats report approved jobs', stats.data.totals.approvedJobs > 0, JSON.stringify(stats.data.totals));
  check('public stats report approved providers', stats.data.totals.approvedProviders > 0);

  console.log('\nJob browsing & filtering');
  const jobs = await call('/jobs?per_page=5');
  check('approved jobs are listed', jobs.data.jobs.length > 0);
  check('pagination metadata present', jobs.data.pagination && jobs.data.pagination.total > 0);
  check('no pending job leaks into public list', jobs.data.jobs.every((j) => j.status === 'approved'));
  const filtered = await call('/jobs?q=borehole');
  check('keyword search returns matches', filtered.data.jobs.length > 0, `${filtered.data.jobs.length} results`);
  const byCat = await call('/jobs?category=agriculture-farming');
  check('category filter works', byCat.data.jobs.length > 0 && byCat.data.jobs.every((j) => j.category.slug === 'agriculture-farming'));
  const byType = await call('/jobs?job_type=contract');
  check('job type filter works', byType.data.jobs.length > 0 && byType.data.jobs.every((j) => j.jobType === 'contract'));
  const bySalary = await call('/jobs?min_salary=300');
  check('salary filter works', bySalary.data.jobs.length > 0 && bySalary.data.jobs.every((j) => Math.max(j.salaryMax || 0, j.salaryMin || 0) >= 300));

  const firstJob = jobs.data.jobs[0];
  const jobDetail = await call('/jobs/' + firstJob.id);
  check('job detail returns full record', jobDetail.status === 200 && jobDetail.data.job.description.length > 20);
  check('job detail includes requirements array', Array.isArray(jobDetail.data.job.requirements));
  check('job view counter increments', jobDetail.data.job.views > firstJob.views, `${firstJob.views} → ${jobDetail.data.job.views}`);

  const admin = await login('admin@plumtreeconnect.co.zw', 'admin1234');
  const publicJobs = await call('/jobs?per_page=100');
  const hiddenIds = new Set(publicJobs.data.jobs.map((j) => j.id));
  const pendingList = await call('/admin/jobs?status=pending', { token: admin });
  const aPendingJob = pendingList.data.jobs[0];
  check('pending job is hidden from public board', aPendingJob && !hiddenIds.has(aPendingJob.id));

  console.log('\nProvider browsing');
  const providers = await call('/providers?per_page=5');
  check('approved providers are listed', providers.data.providers.length > 0);
  const provFiltered = await call('/providers?category=plumbing-boreholes');
  check('provider category filter works', provFiltered.data.providers.length > 0 && provFiltered.data.providers.every((p) => p.category.slug === 'plumbing-boreholes'));
  const verifiedOnly = await call('/providers?verified=1');
  check('verified filter works', verifiedOnly.data.providers.length > 0 && verifiedOnly.data.providers.every((p) => p.verified === true));
  const provDetail = await call('/providers/' + providers.data.providers[0].id);
  check('provider detail includes reviews', Array.isArray(provDetail.data.reviews));
  check('provider detail includes services list', Array.isArray(provDetail.data.provider.services) && provDetail.data.provider.services.length > 0);

  console.log('\nAuthentication & validation');
  const badLogin = await call('/auth/login', { method: 'POST', body: { email: 'admin@plumtreeconnect.co.zw', password: 'wrong' } });
  check('wrong password is rejected', badLogin.status === 401);
  const badRegister = await call('/auth/register', { method: 'POST', body: { name: 'X', email: 'nope', password: '123' } });
  check('registration validation returns field errors', badRegister.status === 400 && badRegister.data.errors.email && badRegister.data.errors.password);
  const adminRegister = await call('/auth/register', { method: 'POST', body: { name: 'Sneaky Admin', email: 'sneaky' + Date.now() + '@x.com', password: 'password123', role: 'admin' } });
  check('cannot self register as admin', adminRegister.status === 400 && adminRegister.data.errors.role, JSON.stringify(adminRegister.data));
  const noRoleRegister = await call('/auth/register', { method: 'POST', body: { name: 'Default Role User', email: 'defaultrole' + Date.now() + '@x.com', password: 'password123' } });
  check('registration defaults to the seeker role', noRoleRegister.status === 201 && noRoleRegister.data.user.role === 'seeker');

  const stamp = Date.now();
  const newSeekerEmail = `test.seeker.${stamp}@example.com`;
  const reg = await call('/auth/register', { method: 'POST', body: { name: 'Test Seeker', email: newSeekerEmail, password: 'password123', role: 'seeker', ward: 'Plumtree Town', phone: '+263771000111' } });
  check('job seeker can register', reg.status === 201 && reg.data.token);
  const seeker = reg.data.token;
  const me = await call('/auth/me', { token: seeker });
  check('token authenticates /auth/me', me.status === 200 && me.data.user.email === newSeekerEmail);
  const noAuth = await call('/dashboard/overview');
  check('dashboard requires authentication', noAuth.status === 401);
  const profilePatch = await call('/auth/me', { method: 'PATCH', token: seeker, body: { bio: 'Hard working and available immediately.' } });
  check('user can update own profile', profilePatch.status === 200 && profilePatch.data.user.bio.includes('Hard working'));
  const pwChange = await call('/auth/change-password', { method: 'POST', token: seeker, body: { currentPassword: 'wrong', newPassword: 'newpassword1' } });
  check('wrong current password blocks change', pwChange.status === 400);

  console.log('\nJob seeker flows');
  const apply = await call(`/jobs/${firstJob.id}/apply`, { method: 'POST', token: seeker, body: { coverLetter: 'I am very interested in this role and have relevant local experience.', expectedSalary: 300 } });
  check('seeker can apply for a job', apply.status === 201 && apply.data.application.status === 'submitted');
  const dupeApply = await call(`/jobs/${firstJob.id}/apply`, { method: 'POST', token: seeker, body: { coverLetter: 'Again' } });
  check('duplicate application is rejected', dupeApply.status === 409);
  const saveJob = await call(`/jobs/${firstJob.id}/save`, { method: 'POST', token: seeker });
  check('seeker can save a job', saveJob.data.saved === true);
  const unsaveJob = await call(`/jobs/${firstJob.id}/save`, { method: 'POST', token: seeker });
  check('seeker can unsave a job', unsaveJob.data.saved === false);
  const saveProv = await call(`/providers/${providers.data.providers[0].id}/save`, { method: 'POST', token: seeker });
  check('seeker can save a provider', saveProv.data.saved === true);
  const myApps = await call('/dashboard/applications', { token: seeker });
  check('seeker sees own application', myApps.data.applications.some((a) => a.jobId === firstJob.id));
  const withdraw = await call(`/dashboard/applications/${apply.data.application.id}`, { method: 'PATCH', token: seeker, body: { status: 'withdrawn' } });
  check('seeker can withdraw own application', withdraw.status === 200 && withdraw.data.application.status === 'withdrawn');
  const seekerOverview = await call('/dashboard/overview', { token: seeker });
  check('seeker overview returns role cards', seekerOverview.data.role === 'seeker' && typeof seekerOverview.data.cards.applications === 'number');

  console.log('\nService request flow');
  const targetProvider = providers.data.providers[0];
  const svcReq = await call(`/providers/${targetProvider.id}/request`, { method: 'POST', body: { name: 'Test Customer', phone: '+263771000222', serviceNeeded: 'Borehole drilling', details: 'Need a 60m borehole.', budget: 800 } });
  check('anonymous visitor can send a service request', svcReq.status === 201 && svcReq.data.requestId);
  const badReq = await call(`/providers/${targetProvider.id}/request`, { method: 'POST', body: { name: 'X' } });
  check('service request validates required fields', badReq.status === 400 && badReq.data.errors.phone);
  const review = await call(`/providers/${targetProvider.id}/reviews`, { method: 'POST', token: seeker, body: { rating: 5, comment: 'Excellent work on our borehole.' } });
  check('seeker can review a provider', review.status === 201);
  const reviewUpdate = await call(`/providers/${targetProvider.id}/reviews`, { method: 'POST', token: seeker, body: { rating: 4, comment: 'Updated after a follow up visit.' } });
  check('review is updated not duplicated', reviewUpdate.status === 201);
  const detailAfter = await call(`/providers/${targetProvider.id}`, { token: seeker });
  check('provider rating recalculates', detailAfter.data.provider.ratingCount >= 1);

  console.log('\nEmployer flows');
  const employer = await login('hr@plumtreeagro.co.zw', 'employer1234');
  const employerJobs = await call('/jobs/mine/list', { token: employer });
  check('employer sees own jobs', employerJobs.data.jobs.length > 0);
  const newJob = await call('/jobs', {
    method: 'POST', token: employer,
    body: { title: 'Smoke Test Field Hand', company: 'Plumtree Agro Estates', description: 'A test listing created by the automated smoke test to verify the employer posting flow works end to end.', jobType: 'casual', workMode: 'on_site', category: 'agriculture-farming', location: 'matjinge', vacancies: 3, salaryMin: 100, salaryMax: 150, deadline: '2027-01-31' },
  });
  check('employer can post a job', newJob.status === 201 && newJob.data.job.status === 'pending');
  const newJobId = newJob.data.job.id;
  const seekerTriesPost = await call('/jobs', { method: 'POST', token: seeker, body: { title: 'Nope', company: 'No', description: 'x'.repeat(40), jobType: 'full_time' } });
  check('job seeker cannot post a job', seekerTriesPost.status === 403);
  const badJob = await call('/jobs', { method: 'POST', token: employer, body: { title: 'ab', company: '', description: 'short', jobType: 'nonsense' } });
  check('job posting validates input', badJob.status === 400 && badJob.data.errors.title && badJob.data.errors.description && badJob.data.errors.jobType);
  const ownedJob = employerJobs.data.jobs[0];
  const seekerTriesEdit = await call('/jobs/' + ownedJob.id, { method: 'PATCH', token: seeker, body: { title: 'Hijacked title here' } });
  check('non-owner cannot edit a job', seekerTriesEdit.status === 403);

  const applicantList = await call('/dashboard/job-applications', { token: employer });
  check('employer sees applications for own jobs', applicantList.data.applications.length > 0);
  check('employer application rows include applicant identity', applicantList.data.applications.every((a) => 'applicantName' in a));
  const targetApp = applicantList.data.applications[0];
  const moveApp = await call(`/dashboard/applications/${targetApp.id}`, { method: 'PATCH', token: employer, body: { status: 'shortlisted', employerNote: 'Strong candidate, shortlisted by smoke test.' } });
  check('employer can shortlist an applicant', moveApp.status === 200 && moveApp.data.application.status === 'shortlisted');
  const seekerTriesMove = await call(`/dashboard/applications/${targetApp.id}`, { method: 'PATCH', token: seeker, body: { status: 'hired' } });
  check('seeker cannot set arbitrary application status', seekerTriesMove.status === 403);

  console.log('\nService provider flows');
  const providerToken = await login('info@tshitshiboreholes.co.zw', 'provider1234');
  const myListings = await call('/providers/mine/list', { token: providerToken });
  check('provider sees own listings', myListings.data.providers.length > 0);
  const newListing = await call('/providers', {
    method: 'POST', token: providerToken,
    body: { businessName: 'Smoke Test Solar', description: 'A test service listing created by the automated smoke test to confirm providers can publish new services.', phone: '+263772000333', category: 'electrical-solar', location: 'plumtree-town', priceFrom: 50, yearsExperience: 3, services: 'Solar panels\nInverter repair' },
  });
  check('provider can create a listing', newListing.status === 201 && newListing.data.provider.status === 'pending');
  const badListing = await call('/providers', { method: 'POST', token: providerToken, body: { businessName: 'x', description: 'short', phone: '1' } });
  check('listing creation validates input', badListing.status === 400 && badListing.data.errors.businessName);
  const employerTriesListing = await call('/providers', { method: 'POST', token: employer, body: { businessName: 'Employer Ltd', description: 'x'.repeat(40), phone: '+263771234567' } });
  check('employer cannot create a service listing', employerTriesListing.status === 403);

  const recvReq = await call('/dashboard/service-requests', { token: providerToken });
  check('provider sees received requests', recvReq.data.requests.length > 0 && recvReq.data.view === 'received');
  const ownReq = recvReq.data.requests.find((r) => r.providerId === myListings.data.providers[0].id) || recvReq.data.requests[0];
  const updateReq = await call(`/dashboard/service-requests/${ownReq.id}`, { method: 'PATCH', token: providerToken, body: { status: 'quoted', response: 'Quoted USD 500 including materials.' } });
  check('provider can respond to a request', updateReq.status === 200 && updateReq.data.request.status === 'quoted');
  const seekerTriesReq = await call(`/dashboard/service-requests/${ownReq.id}`, { method: 'PATCH', token: seeker, body: { status: 'completed' } });
  check('unrelated user cannot change a request', seekerTriesReq.status === 403);

  console.log('\nAdmin panel');
  const adminStats = await call('/admin/stats', { token: admin });
  check('admin stats return counts', adminStats.status === 200 && adminStats.data.counts.users > 0);
  check('admin stats include chart series', adminStats.data.signups.length === 14 && adminStats.data.jobsByCategory.length > 0);
  check('admin stats include audit trail', Array.isArray(adminStats.data.recentAudit));
  const nonAdminStats = await call('/admin/stats', { token: employer });
  check('non-admin cannot read admin stats', nonAdminStats.status === 403);

  const approveJob = await call('/admin/jobs/' + newJobId, { method: 'PATCH', token: admin, body: { status: 'approved', featured: true } });
  check('admin can approve a job', approveJob.status === 200 && approveJob.data.job.status === 'approved');
  const nowPublic = await call('/jobs/' + newJobId);
  check('approved job becomes publicly visible', nowPublic.status === 200 && nowPublic.data.job.featured === true);
  const rejectJob = await call('/admin/jobs/' + newJobId, { method: 'PATCH', token: admin, body: { status: 'rejected', rejectionReason: 'Smoke test rejection reason.' } });
  check('admin can reject a job with a reason', rejectJob.status === 200 && rejectJob.data.job.rejectionReason === 'Smoke test rejection reason.');
  const hiddenAgain = await call('/jobs/' + newJobId);
  check('rejected job is hidden from the public board', hiddenAgain.status === 404);

  const approveProvider = await call('/admin/providers/' + newListing.data.provider.id, { method: 'PATCH', token: admin, body: { status: 'approved', verified: true } });
  check('admin can approve and verify a provider', approveProvider.status === 200 && approveProvider.data.provider.verified === true);
  const providerNowPublic = await call('/providers/' + newListing.data.provider.id);
  check('approved provider becomes publicly visible', providerNowPublic.status === 200);

  const userList = await call('/admin/users?role=seeker&per_page=50', { token: admin });
  check('admin can list users by role', userList.data.users.length > 0 && userList.data.users.every((u) => u.role === 'seeker'));
  const createdUser = await call('/admin/users', { method: 'POST', token: admin, body: { name: 'Smoke Created', email: `smoke.user.${stamp}@example.com`, password: 'password123', role: 'employer', ward: 'Plumtree Town' } });
  check('admin can create a user', createdUser.status === 201 && createdUser.data.user.role === 'employer');
  const suspend = await call('/admin/users/' + createdUser.data.user.id, { method: 'PATCH', token: admin, body: { status: 'suspended' } });
  check('admin can suspend a user', suspend.status === 200 && suspend.data.user.status === 'suspended');
  const suspendedLogin = await call('/auth/login', { method: 'POST', body: { email: `smoke.user.${stamp}@example.com`, password: 'password123' } });
  check('suspended user cannot sign in', suspendedLogin.status === 403);
  const adminId = (await call('/auth/me', { token: admin })).data.user.id;
  const selfSuspend = await call('/admin/users/' + adminId, { method: 'PATCH', token: admin, body: { status: 'suspended' } });
  check('admin cannot suspend own account', selfSuspend.status === 400);
  const resetPw = await call(`/admin/users/${createdUser.data.user.id}/reset-password`, { method: 'POST', token: admin, body: { password: 'brandnewpass1' } });
  check('admin can reset a password', resetPw.status === 200);
  const deleteUser = await call('/admin/users/' + createdUser.data.user.id, { method: 'DELETE', token: admin });
  check('admin can delete a user', deleteUser.status === 200);

  const newCat = await call('/admin/categories', { method: 'POST', token: admin, body: { name: 'Smoke Test Category ' + stamp, kind: 'job', icon: '🧪', description: 'Created by smoke test' } });
  check('admin can create a category', newCat.status === 201);
  const dupCat = await call('/admin/categories', { method: 'POST', token: admin, body: { name: 'Smoke Test Category ' + stamp, kind: 'job' } });
  check('duplicate category name is rejected', dupCat.status === 409);
  const catWithListings = await call('/admin/categories/' + ownedJob.category.id, { method: 'DELETE', token: admin });
  check('category in use cannot be deleted', catWithListings.status === 400);
  const delCat = await call('/admin/categories/' + newCat.data.category.id, { method: 'DELETE', token: admin });
  check('unused category can be deleted', delCat.status === 200);

  const newLoc = await call('/admin/locations', { method: 'POST', token: admin, body: { name: 'Smoke Village ' + stamp, kind: 'village', notes: 'Test location' } });
  check('admin can create a location', newLoc.status === 201);
  const delLoc = await call('/admin/locations/' + newLoc.data.location.id, { method: 'DELETE', token: admin });
  check('unused location can be deleted', delLoc.status === 200);

  const reviews = await call('/admin/reviews', { token: admin });
  check('admin can list reviews', reviews.data.reviews.length > 0);
  const aReview = reviews.data.reviews[0];
  const hideReview = await call('/admin/reviews/' + aReview.id, { method: 'PATCH', token: admin, body: { status: 'hidden' } });
  check('admin can hide a review', hideReview.status === 200);
  const publishReview = await call('/admin/reviews/' + aReview.id, { method: 'PATCH', token: admin, body: { status: 'published' } });
  check('admin can republish a review', publishReview.status === 200);

  const audit = await call('/admin/audit?per_page=50', { token: admin });
  check('audit log records admin actions', audit.data.entries.length > 0 && audit.data.entries.some((e) => e.action === 'moderate_job'));

  const settingsGet = await call('/admin/settings', { token: admin });
  check('admin can read settings', settingsGet.data.settings.site_name === 'Plumtree Connect');
  const settingsPatch = await call('/admin/settings', { method: 'PATCH', token: admin, body: { auto_approve_jobs: true } });
  check('admin can update settings', settingsPatch.status === 200 && settingsPatch.data.settings.auto_approve_jobs === 'true');
  const autoJob = await call('/jobs', { method: 'POST', token: employer, body: { title: 'Auto Approved Smoke Job', company: 'Plumtree Agro Estates', description: 'Created to verify the auto approve setting publishes listings immediately without review.', jobType: 'casual', workMode: 'on_site' } });
  check('auto approve setting publishes new jobs immediately', autoJob.status === 201 && autoJob.data.job.status === 'approved');
  await call('/jobs/' + autoJob.data.job.id, { method: 'DELETE', token: employer });
  await call('/admin/settings', { method: 'PATCH', token: admin, body: { auto_approve_jobs: false } });

  console.log('\nCleanup');
  const delJob = await call('/jobs/' + newJobId, { method: 'DELETE', token: employer });
  check('employer can delete own listing', delJob.status === 200);
  const delListing = await call('/providers/' + newListing.data.provider.id, { method: 'DELETE', token: providerToken });
  check('provider can delete own listing', delListing.status === 200);

  console.log('\nStatic frontend');
  for (const page of ['/', '/jobs.html', '/job.html', '/providers.html', '/provider.html', '/login.html', '/register.html', '/dashboard.html', '/admin.html', '/about.html', '/css/app.css', '/js/core.js', '/js/admin.js']) {
    const res = await fetch(BASE + page);
    check(`serves ${page}`, res.status === 200);
  }
  const missing = await fetch(BASE + '/no-such-page');
  check('unknown page returns 404', missing.status === 404);
  const missingApi = await call('/does-not-exist');
  check('unknown API route returns JSON 404', missingApi.status === 404 && Boolean(missingApi.data.error));

  console.log(`\n${'='.repeat(56)}`);
  console.log(`  ${passed} passed, ${failed} failed`);
  if (failures.length) {
    console.log('\nFailures:');
    for (const f of failures) console.log('  - ' + f);
  }
  console.log(`${'='.repeat(56)}\n`);
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error('\nSmoke test crashed:', err);
  process.exit(1);
});
