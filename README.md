# Plumtree Connect

A web app for job listings and service provider listings in **Plumtree, Matabeleland South province, Zimbabwe** — with a public board, role-based user dashboards and a full administrator panel.

Plumtree Connect brings two things together that usually live apart: paid work, and the local trades people need. Employers post vacancies, artisans and service businesses list what they do, and everyone searches the same moderated board.

---

## Features

### Public site
- **Home** — live platform statistics, featured jobs, top-rated providers, category explorer and district activity chart.
- **Category explorer** (`/categories`) — every industry group (real estate, agriculture, transport and logistics, retail and wholesale, professional services, construction and trades, manufacturing, energy, ICT, health, education, hospitality, home and domestic, personal care, security, events and media) in one grid, searchable and filterable by scope.
- **Category page** (`/categories/:slug`) — one industry with its sub-categories, switching between the jobs and providers inside it.
- **Job board** (`/jobs`) — search and filter by keyword, industry, category, area, job type, work mode and minimum salary. Sort by newest, closing soon, highest salary or most viewed. Full pagination with per-page control.
- **Job detail** (`/jobs/:id`) — full description, requirements checklist, salary, deadline countdown, employer contact details and a one-click apply flow.
- **Service directory** (`/providers`) — filter by industry, service category, area, availability, price and verified status. Sort by rating, experience, price or popularity.
- **Provider detail** (`/providers/:id`) — services offered, star ratings and reviews, contact details (phone, WhatsApp, email) and a service request form.
- **About** (`/about`) — how the platform works and the role matrix.

### Accounts and roles
| Role | Capabilities | Dashboard |
| --- | --- | --- |
| **Job seeker** | Browse and apply for jobs, save jobs and providers, send service requests, track applications | Applications, service requests, saved items, profile |
| **Employer** | Post and manage vacancies, review applicants, shortlist, interview, hire | Listings, applicants, profile |
| **Service provider** | Publish a business listing, receive and manage service requests, collect reviews | Listings, requests, profile |
| **Administrator** | Moderate all listings, verify providers, manage users, categories, locations, reviews and settings | Full admin panel with statistics |

### User dashboard (`/dashboard`)
Role-aware navigation. Includes an overview with role-specific statistic cards and recent activity, full application tracking (submitted → reviewing → shortlisted → interview → hired), service request management with quotes and status flow, saved items, listing CRUD with validation, applicant review with internal notes, and profile plus password management.

### Admin panel (`/admin`)
- **Dashboard** — 10 headline metrics, a 14-day stacked activity column chart, four donut charts, status breakdowns, category breakdowns, busiest locations, most-viewed jobs and providers, and a live activity feed.
- **Job moderation** — filter by status, inspect full listings, approve, reject with a reason, feature/unfeature.
- **Service moderation** — approve, reject, verify and feature providers.
- **Users** — filter by role and status, create, edit, suspend, activate, reset password and delete, with safety guards (cannot suspend yourself, cannot remove the last administrator).
- **Applications / Service requests / Reviews** — platform-wide visibility; hide or delete abusive reviews with automatic rating recalculation.
- **Categories, Industry groups and Locations** — full CRUD with in-use protection; categories can be moved between industry groups.
- **Audit log** — every administrative action recorded, filterable by entity.
- **Settings** — site identity and auto-approval toggles for jobs and providers.

---

## Tech stack

| Layer | Choice | Why |
| --- | --- | --- |
| Runtime | Node.js 22.5+ | Required for the built-in SQLite module |
| Framework | Next.js 14 (App Router) + React 18 | File-based routing, server components, one toolchain for UI and API |
| Language | TypeScript (strict) | Type-safe API contracts and components |
| Database | `node:sqlite` (`DatabaseSync`) | Built into Node — zero native dependencies to compile |
| Search | SQLite FTS5 (`jobs_fts`, `providers_fts`) | Full-text keyword search with no extra service |
| Auth | `node:crypto` scrypt + in-memory bearer sessions | No external auth dependency |
| Styling | Hand-written CSS design system | No CSS framework or build-time styling pipeline |

There are no compiled native modules. `node:sqlite` is built into Node, so `npm install` only pulls Next.js, React and TypeScript.

The original Express + vanilla-JS implementation is preserved under `legacy/` for reference and is not part of the build.

---

## Getting started

```bash
npm install          # installs Next.js, React and TypeScript
npm run dev          # development server with hot reload on port 3000
```

Open <http://localhost:3000>.

For a production run:

```bash
npm run build        # compile the app
npm start            # serve the build on port 3000
```

- Change the port with `PORT=8080 npm start` (or `npm run dev -- -p 8080`).
- Point at a different database file with `DB_PATH=/path/to/file.db npm start`.
- Rebuild the sample data with `npm run seed -- --force` (destructive — wipes and reseeds).
- Typecheck the whole project with `npm run typecheck`.

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

An end-to-end smoke test covers all four roles, both moderation queues, authorisation boundaries, validation errors and the public API:

```bash
npm run build && npm start            # in one terminal
BASE=http://localhost:3000 npm run smoke   # in another
```

Result: **116 assertions passing**. The test creates and cleans up its own records, so it is safe to run repeatedly. Override the target with `BASE=http://localhost:8080 npm run smoke`. `npm run typecheck` must pass before committing.

---

## Project structure

```
src/
  app/
    layout.tsx       Root layout: metadata, SessionProvider, UiProvider
    globals.css      Imports the design system
    not-found.tsx    404 page
    (site)/          Public + dashboard pages (shared header/footer layout)
      page.tsx                 Home
      categories/              Category explorer and category detail
      jobs/                    Job board and job detail
      providers/               Service directory and provider detail
      login/ register/ about/  Auth and info pages
      dashboard/               Role-aware user dashboard
      admin/                   Administrator panel
    api/             Route handlers, mirroring the endpoints below
  components/        Shared UI plus admin/ and dashboard/ view components
  lib/
    db.ts            Schema, migrations, FTS indexes, boot (node:sqlite)
    http.ts          route() wrapper, Ctx, requireAuth / requireRole
    auth.ts          scrypt password hashing and bearer session store
    catalogue.ts     Source-of-truth taxonomy: industry groups and categories
    seed.ts          Plumtree-specific sample data
    util.ts          Shared helpers, enums, labels, pagination, audit logging
    jobs.ts providers.ts groups.ts serialize.ts   Domain serializers
    client/          Browser helpers: api, session, ui, format, types
  styles/app.css     Design system
scripts/
  seed.ts            Reseed entry point (npm run seed)
test/
  smoke.ts           End-to-end API test (npm run smoke)
legacy/              Original Express + vanilla-JS app (reference only)
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
| `GET` | `/meta/groups?kind=job\|service` | Industry groups with category and listing counts |
| `GET` | `/meta/groups/:slug` | One industry group with its categories |
| `GET` | `/meta/categories?kind=job\|service` | Categories with listing counts and their group |
| `GET` | `/meta/locations` | Towns, wards and villages |
| `GET` | `/meta/stats` | Public statistics, chart series and per-group activity |
| `GET` | `/jobs` | Browse approved jobs (filters: `q`, `group`, `category`, `location`, `job_type`, `work_mode`, `min_salary`, `featured`, `sort`, `page`, `per_page`) |
| `GET` | `/jobs/:id` | Job detail (increments views) |
| `GET` | `/providers` | Browse approved providers (filters: `q`, `group`, `category`, `location`, `availability`, `verified`, `max_price`, `min_rating`, `sort`, `page`, `per_page`) |
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
| `GET`/`POST`/`PATCH`/`DELETE` | `/admin/groups`, `/admin/groups/:id` | Industry group management |
| `GET`/`POST`/`PATCH`/`DELETE` | `/admin/categories`, `/admin/locations` | Taxonomy management |
| `GET`/`PATCH`/`DELETE` | `/admin/reviews`, `/admin/reviews/:id` | Review moderation |
| `GET` | `/admin/audit` | Audit trail |
| `GET`/`PATCH` | `/admin/settings` | Platform settings |

---

## Browsing by category

The catalogue is two levels deep, defined once in `src/catalogue.js` and mirrored into the database by `syncCatalogue()` on every boot:

1. **Industry groups** — the broad sectors people recognise: real estate and property, agriculture and livestock, transport and logistics, retail and wholesale, professional services, construction and trades, manufacturing and industry, energy and utilities, ICT and admin, health and care, education and training, hospitality and tourism, home and domestic, personal care and wellness, security services, events and media.
2. **Categories** — the specific trades inside each group, each tagged `job` or `service` and carrying the icon and description shown on the site.

`/categories` lists every group as a card with live job and provider counts. `/categories/<slug>` opens one group, shows its sub-categories as filter chips, and toggles between the jobs and providers inside it. The job board and service directory also expose the group as a top-level "Industry" filter, which narrows the category list beneath it.

Keyword search on both boards runs through SQLite FTS5 (`jobs_fts`, `providers_fts`). The indexes are populated at seed time and backfilled on boot if a database predates them.

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
