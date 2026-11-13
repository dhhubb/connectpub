# AGENTS.md

Repository memory for AI agents working on **Plumtree Connect**.

## What this project is

A job listings and service provider listings web app for Plumtree, Matabeleland South province, Zimbabwe. Three surfaces: a public board, role-based user dashboards, and an administrator panel.

## Commands

| Task | Command |
| --- | --- |
| Install dependencies | `npm install` |
| Run the server | `npm start` (port 3000, `PORT` env to override) |
| Run with reload | `npm run dev` |
| Reseed sample data (destructive) | `npm run seed` |
| End-to-end test (server must be running) | `npm run smoke` |
| Syntax check one file | `node --check path/to/file.js` |
| Syntax check everything | `for f in src/*.js src/routes/*.js public/js/*.js test/*.js; do node --check "$f"; done` |

## Architecture rules

- **No build step and no bundler.** Frontend is plain HTML + `public/css/app.css` + plain-script JavaScript loaded with `<script src>` tags. Every `public/js/*.js` file is an IIFE that reads shared helpers from the global `window.PC` object defined in `public/js/core.js`. Load `core.js` before any page script.
- **Only one runtime dependency: Express.** Persistence uses the built-in `node:sqlite` module (`DatabaseSync`). Do not add an npm SQLite driver — it would require native compilation. Node 22.5+ is required and enforced in `package.json` engines.
- **Auth is hand-rolled** in `src/auth.js`: scrypt password hashing plus an in-memory `Map` of bearer tokens. There is no cookie session and no JWT. `attachUser(loadUser)` is registered in `src/server.js` and populates `req.user`; `loadUser` is injected to avoid a circular import between `auth.js` and `db.js`.
- **Route modules export their router.** `src/routes/jobs.js`, `providers.js` and `dashboard.js` export objects (`{ router, serializeX }`) because the admin router reuses their serializers. `src/routes/auth.js`, `meta.js` and `admin.js` export a bare router.
- **`src/util.js` is the shared vocabulary**: enum arrays (`JOB_TYPES`, `USER_ROLES`, …), display label maps, `pickEnum` for validating enum input, `pageParams` for pagination, `ftsQuery` for sanitising keyword search, `logAudit` for the audit trail, and `publicUser` to strip password hashes before anything reaches the client.
- **The taxonomy lives in `src/catalogue.js`.** `GROUPS` and `categoriesFor(kind)` are the source of truth; `syncCatalogue()` in `src/db.js` mirrors them into the `category_groups` and `categories` tables on every boot, so editing the catalogue and restarting is enough to change the taxonomy. Public `/meta/groups` and `/meta/groups/:slug` expose it; jobs and providers accept a `group` filter that resolves a slug (or id) to `category_groups.id`.
- **Keyword search uses FTS5.** `jobs_fts` and `providers_fts` are external-content-free tables rebuilt by `rebuildSearchIndex()`; `ftsQuery()` turns raw user input into a safe `MATCH` expression. The server backfills them on boot if they are empty.

## Conventions

- Errors: throw `httpError(status, message)` (from `src/util.js`) or return `res.status(400).json({ error, errors })` for field-level validation. The central error handler in `src/server.js` converts thrown errors into JSON; 5xx messages are generic and details only go to the server log.
- Validation returns a `{ errors: { fieldName: 'message' } }` object. The frontend maps these onto form fields with `PC.showErrors(form, errors)` — input `name` attributes must match the error keys.
- SQL is always parameterised with `?` placeholders. Never interpolate user input into a query string.
- Roles are enforced with `requireAuth` and `requireRole(...)` from `src/auth.js`. Ownership checks (a user may only edit their own listing) are done inside the handler against `req.user.id`.
- Status changes that matter are written to the audit log via `logAudit(actorId, action, entity, entityId, details)`.
- Frontend security: always pass dynamic text through `PC.escapeHtml()` before inserting into `innerHTML`.
- Frontend re-renders into a **fresh** container element each time (`#admin-view`, `#dash-view`) because those views attach delegated `click` listeners to their container. Reusing a persistent node would stack duplicate listeners on every re-render.
- Job seeker / employer / provider dashboards share `public/js/dashboard.js` and branch on `PC.state.user.role`. The nav definition lives in the `NAV` object near the top.

## Data model (SQLite, `data/plumtree.db`)

`users`, `category_groups`, `categories` (kind = job|service, `group_id` → `category_groups`), `locations` (town|ward|village), `jobs`, `providers`, `applications`, `service_requests`, `reviews`, `saved_items` (polymorphic over job|provider), `audit_log`, `settings` (key/value), plus the FTS5 shadow tables `jobs_fts` and `providers_fts`.

Status vocabularies are enforced by `CHECK` constraints — see `src/db.js`:
- jobs: `pending | approved | rejected | closed | expired`
- providers: `pending | approved | rejected | suspended`
- applications: `submitted | reviewing | shortlisted | interview | hired | rejected | withdrawn`
- service_requests: `new | contacted | quoted | accepted | completed | declined | cancelled`

Provider ratings are denormalised into `rating_sum` / `rating_count`. Whenever reviews are created, hidden or deleted you must recalculate them — the pattern is repeated in `src/routes/providers.js` and `src/routes/admin.js`.

The schema is created with `CREATE TABLE IF NOT EXISTS` in `migrate()` and runs on every boot, so it is safe to call repeatedly. There is no migration versioning: changing a column means deleting `data/plumtree.db` and reseeding, or adding an explicit `ALTER TABLE` guard.

## Testing notes

- `test/smoke.js` is the single source of truth for behaviour. It makes ~135 assertions across health, public catalogue, industry groups, filters, pagination, full-text search, auth, all three user roles, admin moderation, authorisation boundaries, validation, audit and static serving.
- It creates its own fixtures (users, jobs, listings, categories, locations) using `Date.now()` suffixes and cleans them up at the end, so it is repeatable.
- Run against a fresh database for the most reliable result: stop the server, `rm -f data/plumtree.db*`, `npm start`, then `npm run smoke`.
- The test asserts that pending listings never leak into public responses, that non-owners cannot mutate others' records, and that suspended users cannot authenticate. Keep those properties when changing code.

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
- Sessions are in memory: restarting the server invalidates every token, and the frontend clears its stored token on any 401.
- Editing an approved listing as its owner resets it to `pending` by design, so moderators see the change.
- The last active administrator cannot be demoted, suspended or deleted; the API returns 400 with an explanation.

## Responsive layout

The single stylesheet `public/css/app.css` drives every page. Breakpoints live in the
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
`test/smoke.js` does not cover layout.

