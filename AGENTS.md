# AGENTS.md

Repository memory for AI agents working on **Plumtree Connect**.

## What this project is

A job listings and service provider listings web app for Plumtree, Matabeleland South province, Zimbabwe. Three surfaces: a public board, role-based user dashboards, and an administrator panel.

The app runs on **Next.js 14 (App Router) with TypeScript**. The original Express + vanilla-JS implementation is kept under `legacy/` for reference only and is not built or served.

## Commands

| Task | Command |
| --- | --- |
| Install dependencies | `npm install` |
| Dev server (hot reload) | `npm run dev` (port 3000, `-p` to override) |
| Production build | `npm run build` |
| Run the built server | `npm start` (port 3000, `PORT` env to override) |
| Typecheck | `npm run typecheck` |
| Reseed sample data (destructive) | `npm run seed -- --force` |
| End-to-end test (server must be running) | `BASE=http://localhost:3000 npm run smoke` |

`npm run seed` and `npm run smoke` run the TypeScript scripts in `scripts/seed.ts` and `test/smoke.ts` through `tsx`.

## Architecture rules

- **App Router layout.** UI lives in `src/app/(site)/`; the route group shares a layout (`src/app/(site)/layout.tsx`) that renders the header and footer. Root layout `src/app/layout.tsx` wraps everything in `SessionProvider` and `UiProvider`. `src/app/not-found.tsx` is the 404 page.
- **API routes are Route Handlers.** Every endpoint is `src/app/api/**/route.ts` exporting `GET`/`POST`/`PATCH`/`DELETE`. They are thin: parse input, call a `src/lib/*` module, return `{ body }`.
- **`src/lib/http.ts` is the request harness.** Wrap every handler in `route(fn)`. It calls `ensureBoot()`, builds the `Ctx` (`req`, `params`, `query`, `user`, `token`, `body`, `method`), runs the handler, maps thrown errors to JSON, and sets `Cache-Control: no-store`. Handlers return `{ status?, body? }`. Use `requireAuth(ctx)` / `requireRole(ctx, ...)` for authorisation; they throw errors carrying a `status`.
- **Persistence is `node:sqlite` (`DatabaseSync`).** `src/lib/db.ts` exposes a lazy `db` proxy, `migrate()`, `syncCatalogue()`, `rebuildSearchIndex()` and `ensureBoot()`. `ensureBoot()` is idempotent (guarded by a `globalThis` flag) and runs on every request through `route()`, so the schema, taxonomy, sample seed and FTS backfill are handled in one place. Do not open a second connection — cache on `globalThis` because Next.js re-evaluates modules on hot reload.
- **`src/lib/util.ts` is the shared vocabulary**: enum arrays (`JOB_TYPES`, `USER_ROLES`, …), display label maps, `pickEnum`, `pageParams`, `ftsQuery`, `logAudit(db, actorId, action, entity, entityId, details)`, and `publicUser` to strip password hashes. Serializers live beside their domain: `src/lib/jobs.ts`, `src/lib/providers.ts`, `src/lib/groups.ts`, `src/lib/serialize.ts`.
- **The taxonomy lives in `src/lib/catalogue.ts`.** `GROUPS` and `categoriesFor(kind)` are the source of truth; `syncCatalogue()` in `src/lib/db.ts` mirrors them into `category_groups` and `categories` on every boot, so editing the catalogue and restarting is enough to change the taxonomy. Public `/api/meta/groups` and `/api/meta/groups/:slug` expose it; jobs and providers accept a `group` filter that resolves a slug (or id) to `category_groups.id`.
- **Keyword search uses FTS5.** `jobs_fts` and `providers_fts` are maintained by triggers and backfilled by `rebuildSearchIndex()`; `ftsQuery()` turns raw input into a safe `MATCH` expression.
- **Auth is hand-rolled** in `src/lib/auth.ts`: scrypt password hashing plus an in-memory `Map` of bearer tokens (7 day TTL). There is no cookie session and no JWT. The client stores the token in `localStorage` and sends `Authorization: Bearer <token>`.

## Frontend conventions

- **Client helpers live under `src/lib/client/`.** `api.ts` is the fetch wrapper (`api<T>(path, { method, body })`, throws `ApiError`), `session.tsx` is the `useSession()` context, `ui.tsx` is `useUi()` (toasts and `confirm`), `format.ts` has `initials`/`roleLabel`, `types.ts` holds shared types.
- **Components** live in `src/components/`. Page shells are server components; anything interactive is a `'use client'` component. Role dashboards and the admin panel are composed from `src/components/dashboard/*` and `src/components/admin/*`, switched by a nav that branches on the session role.
- **Styles** are plain CSS: `src/styles/app.css` (the design system, imported through `src/app/globals.css`). Do not add a CSS framework.
- Prefer typed props and `type` imports; `strict` is on in `tsconfig.json`.

## Data model (SQLite, `data/plumtree.db`)

`users`, `category_groups`, `categories` (kind = job|service, `group_id` → `category_groups`), `locations` (town|ward|village), `jobs`, `providers`, `applications`, `service_requests`, `reviews`, `saved_items` (polymorphic over job|provider), `audit_log`, `settings` (key/value), plus the FTS5 shadow tables `jobs_fts` and `providers_fts`.

Status vocabularies are enforced by `CHECK` constraints — see `src/lib/db.ts`:
- jobs: `pending | approved | rejected | closed | expired`
- providers: `pending | approved | rejected | suspended`
- applications: `submitted | reviewing | shortlisted | interview | hired | rejected | withdrawn`
- service_requests: `new | contacted | quoted | accepted | completed | declined | cancelled`

Provider ratings are denormalised into `rating_sum` / `rating_count`. Whenever reviews are created, hidden or deleted you must recalculate them — see `src/app/api/providers/[id]/reviews/route.ts` and `src/app/api/admin/reviews/[id]/route.ts`.

The schema is created with `CREATE TABLE IF NOT EXISTS` in `migrate()` and runs on every boot, so it is safe to call repeatedly. There is no migration versioning: changing a column means adding an explicit `ALTER TABLE` guard (see `columnExists`) or deleting `data/plumtree.db*` and reseeding.

## Testing notes

- `test/smoke.ts` is the single source of truth for behaviour. It makes ~116 assertions across health, public catalogue, industry groups, filters, pagination, full-text search, auth, all three user roles, admin moderation, authorisation boundaries, validation and audit.
- It creates its own fixtures (users, jobs, listings, categories, locations) using `Date.now()` suffixes and cleans them up at the end, so it is repeatable.
- Run against a fresh database for the most reliable result: stop the server, `rm -f data/plumtree.db*`, `npm run build && npm start`, then `BASE=http://localhost:3000 npm run smoke`.
- The test asserts that pending listings never leak into public responses, that non-owners cannot mutate others' records, and that suspended users cannot authenticate. Keep those properties when changing code.
- `npm run typecheck` must pass before committing.

## Seeded demo accounts

| Role | Email | Password |
| --- | --- | --- |
| Administrator | `admin@plumtreeconnect.co.zw` | `admin1234` |
| Job seeker | `thandiwe@example.com` | `seeker1234` |
| Employer | `hr@plumtreeagro.co.zw` | `employer1234` |
| Service provider | `info@tshitshiboreholes.co.zw` | `provider1234` |

Seeded geography: Plumtree Town, Dingumuzi, Empandeni, Tshitshi, Matjinge, Marula, Ndiweni, Bhango, Mangwe, Bulilima, Figtree, Gwanda, Esigodini, Filabusi, Beitbridge. All data is fictional.

## Gotchas

- `node:sqlite` emits an experimental-feature warning on some Node versions. It is harmless.
- Sessions are in memory: restarting the server invalidates every token, and the client clears its stored token on any 401.
- Editing an approved listing as its owner resets it to `pending` by design, so moderators see the change.
- The last active administrator cannot be demoted, suspended or deleted; the API returns 400 with an explanation.
- The `db` export in `src/lib/db.ts` is a `Proxy` that connects on first use, so importing a route module at build time never opens the database file.

## Responsive layout

`src/styles/app.css` drives every page. Breakpoints live in the
`/* ---------- Responsive ---------- */` block at the end of the file and are written
mobile-last, so the widest rules come first:

| Range | What changes |
| --- | --- |
| `min-width: 1400px` | `--maxw` grows to 1320px for large monitors |
| `max-width: 1100px` | footer drops to three columns |
| `max-width: 1000px` | two-column grids collapse to one; dashboard sidebar becomes a horizontal scrolling nav |
| `max-width: 720px` | header collapses behind the ☰ Menu button; filter sidebars collapse behind a Show/Hide button; small controls grow to 32px+ tap targets |
| `max-width: 560px` | single-column cards, tighter padding, smaller charts and donuts |

Conventions to keep it working:

- Grid and flex children get `min-width: 0`. Without it, a wide child (a long badge, a horizontal nav, a table) stretches its column past the viewport.
- Prefer fluid grids: `repeat(auto-fill, minmax(min(310px, 100%), 1fr))` so a track never exceeds a narrow screen.
- Never put `grid-template-columns` in an inline `style` attribute on a page - it beats the media queries. Use a class such as `.grid-register` instead.
- Wide tables scroll inside `.table-wrap`; leave the scroll hint background intact.
- When adding a `.btn` that should be hidden until a breakpoint, qualify it (for example `.site-header .nav-toggle`) so the `.btn` rule cannot win on source order.

Verify layout changes in a headless browser: load every page at roughly 320, 390, 768 and 1440 px
wide and confirm no page scrolls horizontally (compare `documentElement.scrollWidth` with
`clientWidth`) and that the mobile header and filter toggles open and close. The API smoke test in
`test/smoke.ts` does not cover layout.
