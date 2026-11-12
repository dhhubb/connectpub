# Plumtree Connect

A web app for job listings and service provider listings in **Plumtree, Matabeleland South province, Zimbabwe** — with a public board, role-based user dashboards and a full administrator panel.

Plumtree Connect brings two things together that usually live apart: paid work, and the local trades people need. Employers post vacancies, artisans and service businesses list what they do, and everyone searches the same moderated board.

---

## Features

### Public site
- **Home** — live platform statistics, featured jobs, top-rated providers, category explorer and district activity chart.
- **Job board** (`/jobs.html`) — search and filter by keyword, category, area, job type, work mode and minimum salary. Sort by newest, closing soon, highest salary or most viewed. Full pagination.
- **Job detail** (`/job.html?id=`) — full description, requirements checklist, salary, deadline countdown, employer contact details and a one-click apply flow.
- **Service directory** (`/providers.html`) — filter by service category, area, availability, price and verified status. Sort by rating, experience, price or popularity.
- **Provider detail** (`/provider.html?id=`) — services offered, star ratings and reviews, contact details (phone, WhatsApp, email) and a service request form.
- **About** (`/about.html`) — how the platform works and the role matrix.

### Accounts and roles
| Role | Capabilities | Dashboard |
| --- | --- | --- |
| **Job seeker** | Browse and apply for jobs, save jobs and providers, send service requests, track applications | Applications, service requests, saved items, profile |
| **Employer** | Post and manage vacancies, review applicants, shortlist, interview, hire | Listings, applicants, profile |
| **Service provider** | Publish a business listing, receive and manage service requests, collect reviews | Listings, requests, profile |
| **Administrator** | Moderate all listings, verify providers, manage users, categories, locations, reviews and settings | Full admin panel with statistics |

### User dashboard (`/dashboard.html`)
Role-aware navigation. Includes an overview with role-specific statistic cards and recent activity, full application tracking (submitted → reviewing → shortlisted → interview → hired), service request management with quotes and status flow, saved items, listing CRUD with validation, applicant review with internal notes, and profile plus password management.

### Admin panel (`/admin.html`)
- **Dashboard** — 10 headline metrics, a 14-day stacked activity column chart, four donut charts, status breakdowns, category breakdowns, busiest locations, most-viewed jobs and providers, and a live activity feed.
- **Job moderation** — filter by status, inspect full listings, approve, reject with a reason, feature/unfeature.
- **Service moderation** — approve, reject, verify and feature providers.
- **Users** — filter by role and status, create, edit, suspend, activate, reset password and delete, with safety guards (cannot suspend yourself, cannot remove the last administrator).
- **Applications / Service requests / Reviews** — platform-wide visibility; hide or delete abusive reviews with automatic rating recalculation.
- **Categories and Locations** — full CRUD with in-use protection.
- **Audit log** — every administrative action recorded, filterable by entity.
- **Settings** — site identity and auto-approval toggles for jobs and providers.

---

## Tech stack

| Layer | Choice | Why |
| --- | --- | --- |
| Runtime | Node.js 22.5+ | Required for the built-in SQLite module |
| Server | Express 4 | Minimal, well-understood HTTP layer |
| Database | `node:sqlite` (`DatabaseSync`) | Built into Node — zero native dependencies to compile |
| Auth | `node:crypto` scrypt + in-memory bearer sessions | No external auth dependency |
| Frontend | Vanilla HTML, CSS and ES5-safe JavaScript | No build step, no bundler, instant start |

There are no compiled native modules and no build tooling, so `npm install` installs a single package (Express).

---

## Getting started

```bash
npm install     # installs Express (the only dependency)
npm start       # seeds the database on first run and serves on port 3000
```

Open <http://localhost:3000>.

- Change the port with `PORT=8080 npm start`.
- Point at a different database file with `DB_PATH=/path/to/file.db npm start`.
- Rebuild the sample data with `npm run seed` (destructive — wipes and reseeds).

### Demo accounts

The database is seeded automatically on first start.

| Role | Email | Password |
| --- | --- | --- |
| Administrator | `admin@plumtreeconnect.co.zw` | `admin1234` |
| Job seeker | `thandiwe@example.com` | `seeker1234` |
| Employer | `hr@plumtreeagro.co.zw` | `employer1234` |
| Service provider | `info@tshitshiboreholes.co.zw` | `provider1234` |

The sign-in page has one-click buttons that fill these credentials.

---

## Testing

An end-to-end smoke test covers all four roles, both moderation queues, authorisation boundaries, validation errors, the public API and static file serving:

```bash
npm start                 # in one terminal
npm run smoke             # in another
```

Result: **106 assertions passing**. The test creates and cleans up its own records, so it is safe to run repeatedly. Override the target with `BASE=http://localhost:8080 npm run smoke`.

---

## Project structure

```
src/
  server.js          Express app, static hosting, error handling, startup
  db.js              Schema, migrations and indexes (node:sqlite)
  seed.js            Plumtree-specific sample data
  auth.js            scrypt password hashing and bearer session store
  util.js            Shared helpers, enums, labels, audit logging
  routes/
    auth.js          Register, login, logout, profile, password change
    meta.js          Public categories, locations, statistics, settings
    jobs.js          Job CRUD, browsing, filters, apply, save
    providers.js     Provider CRUD, browsing, filters, requests, reviews, save
    dashboard.js     Role-aware user dashboard endpoints
    admin.js         Moderation, users, categories, locations, reviews, audit, settings
public/
  index.html         Home
  jobs.html          Job board          js/jobs.js
  job.html           Job detail         js/job.js
  providers.html     Service directory  js/providers.js
  provider.html      Provider detail    js/provider.js
  login.html         Sign in            js/login.js
  register.html      Registration       js/register.js
  dashboard.html     User dashboard     js/dashboard.js
  admin.html         Admin panel        js/admin.js
  about.html         404.html
  css/app.css        Design system
  js/core.js         API client, formatting, toasts, modals, header/footer
test/
  smoke.js           End-to-end API and static-site test
data/
  plumtree.db        SQLite database (created on first run)
```

---

## API reference

All endpoints are under `/api`. Authenticated routes expect `Authorization: Bearer <token>`.

### Public
| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/health` | Service health |
| `GET` | `/meta/categories?kind=job\|service` | Categories with listing counts |
| `GET` | `/meta/locations` | Towns, wards and villages |
| `GET` | `/meta/stats` | Public statistics and chart series |
| `GET` | `/jobs` | Browse approved jobs (filters: `q`, `category`, `location`, `job_type`, `work_mode`, `min_salary`, `featured`, `sort`, `page`, `per_page`) |
| `GET` | `/jobs/:id` | Job detail (increments views) |
| `GET` | `/providers` | Browse approved providers (filters: `q`, `category`, `location`, `availability`, `verified`, `max_price`, `min_rating`, `sort`, `page`) |
| `GET` | `/providers/:id` | Provider detail with reviews |
| `POST` | `/providers/:id/request` | Send a service request (guest allowed) |

### Authenticated
| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/auth/register`, `/auth/login`, `/auth/logout` | Session lifecycle |
| `GET`/`PATCH` | `/auth/me` | Read or update own profile |
| `POST` | `/auth/change-password` | Change own password |
| `POST` | `/jobs/:id/apply`, `/jobs/:id/save` | Apply for or save a job |
| `POST` | `/providers/:id/reviews`, `/providers/:id/save` | Review or save a provider |
| `GET`/`POST` | `/jobs`, `PATCH`/`DELETE` `/jobs/:id` | Employer job management |
| `GET`/`POST` | `/providers`, `PATCH`/`DELETE` `/providers/:id` | Provider listing management |
| `GET` | `/dashboard/overview`, `/dashboard/applications`, `/dashboard/job-applications`, `/dashboard/service-requests`, `/dashboard/saved` | Dashboard data |
| `PATCH` | `/dashboard/applications/:id`, `/dashboard/service-requests/:id` | Status updates |
| `GET` | `/admin/stats` | Full analytics |
| `GET`/`PATCH` | `/admin/jobs`, `/admin/jobs/:id` | Job moderation |
| `GET`/`PATCH` | `/admin/providers`, `/admin/providers/:id` | Provider moderation |
| `GET`/`POST`/`PATCH`/`DELETE` | `/admin/users`, `/admin/users/:id` | User management |
| `POST` | `/admin/users/:id/reset-password` | Administrator password reset |
| `GET`/`POST`/`PATCH`/`DELETE` | `/admin/categories`, `/admin/locations` | Taxonomy management |
| `GET`/`PATCH`/`DELETE` | `/admin/reviews`, `/admin/reviews/:id` | Review moderation |
| `GET` | `/admin/audit` | Audit trail |
| `GET`/`PATCH` | `/admin/settings` | Platform settings |

---

## How moderation works

1. Employers and providers submit listings, which are stored with status `pending`.
2. An administrator reviews each item and sets it to `approved` or `rejected`.
3. Only `approved` listings are visible on the public board — a rejected listing is hidden and the owner sees the reason on their own copy.
4. An administrator can enable auto-approval in Settings to publish new listings immediately.

Approved listings that are edited by their owner return to `pending` so the change is reviewed.

---

## Notes

- The session store is in memory, so a restart signs everyone out. Passwords are stored as salted scrypt hashes.
- The seeded data is fictional and intended for demonstration.
