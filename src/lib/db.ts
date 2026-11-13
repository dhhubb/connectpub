import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';
import { GROUPS, categoriesFor, LOCATIONS } from './catalogue';
import { seed } from './seed';

export const DB_PATH = process.env.DB_PATH || path.join(process.cwd(), 'data', 'plumtree.db');

interface DbGlobal {
  __plumtreeDb?: DatabaseSync;
  __plumtreeBooted?: boolean;
}

// Next.js dev mode re-evaluates modules on hot reload. Cache the connection on
// globalThis so we never open a second handle to the same SQLite file.
const g = globalThis as unknown as DbGlobal;

function createDb(): DatabaseSync {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  const db = new DatabaseSync(DB_PATH);
  // busy_timeout first so the WAL switch below retries instead of failing when
  // another process (e.g. a parallel build worker) momentarily holds the lock.
  db.exec('PRAGMA busy_timeout = 5000;');
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec('PRAGMA synchronous = NORMAL;');
  // WAL keeps readers unblocked while a write is in flight and survives
  // restarts, so the file under data/ is the durable store. Only switch when
  // needed — the pragma takes a write lock and can race other connections.
  const mode = (db.prepare('PRAGMA journal_mode').get() as { journal_mode?: string } | undefined)?.journal_mode;
  if (mode !== 'wal') {
    try { db.exec('PRAGMA journal_mode = WAL;'); } catch { /* another connection is switching */ }
  }
  return db;
}

function connection(): DatabaseSync {
  return g.__plumtreeDb ?? (g.__plumtreeDb = createDb());
}

/**
 * Lazy handle to the database. Connecting is deferred until the first real
 * query so merely importing a route module (Next.js does this while collecting
 * page data at build time, often across parallel workers) never opens the file.
 */
export const db: DatabaseSync = new Proxy({} as DatabaseSync, {
  get(_target, prop) {
    const conn = connection() as unknown as Record<string | symbol, unknown>;
    const value = conn[prop];
    return typeof value === 'function' ? (value as (...a: unknown[]) => unknown).bind(conn) : value;
  },
});

export function columnExists(table: string, column: string): boolean {
  return (db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>).some((c) => c.name === column);
}

export function migrate(): void {
  db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    phone TEXT,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'seeker' CHECK (role IN ('seeker','employer','provider','admin')),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended')),
    ward TEXT,
    bio TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    last_login_at TEXT
  );

  CREATE TABLE IF NOT EXISTS category_groups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    icon TEXT,
    scope TEXT NOT NULL DEFAULT 'both' CHECK (scope IN ('job','service','both')),
    description TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    kind TEXT NOT NULL CHECK (kind IN ('job','service')),
    icon TEXT,
    description TEXT,
    group_id INTEGER REFERENCES category_groups(id) ON DELETE SET NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS locations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    kind TEXT NOT NULL CHECK (kind IN ('town','ward','village')),
    notes TEXT
  );

  CREATE TABLE IF NOT EXISTS jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
    location_id INTEGER REFERENCES locations(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    company TEXT NOT NULL,
    description TEXT NOT NULL,
    requirements TEXT,
    job_type TEXT NOT NULL DEFAULT 'full_time' CHECK (job_type IN ('full_time','part_time','contract','casual','internship')),
    work_mode TEXT NOT NULL DEFAULT 'on_site' CHECK (work_mode IN ('on_site','hybrid','remote')),
    salary_min REAL,
    salary_max REAL,
    currency TEXT NOT NULL DEFAULT 'USD',
    vacancies INTEGER NOT NULL DEFAULT 1,
    deadline TEXT,
    contact_email TEXT,
    contact_phone TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','closed','expired')),
    featured INTEGER NOT NULL DEFAULT 0,
    views INTEGER NOT NULL DEFAULT 0,
    rejection_reason TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS providers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
    location_id INTEGER REFERENCES locations(id) ON DELETE SET NULL,
    business_name TEXT NOT NULL,
    tagline TEXT,
    description TEXT NOT NULL,
    services TEXT,
    phone TEXT,
    whatsapp TEXT,
    email TEXT,
    address TEXT,
    price_from REAL,
    currency TEXT NOT NULL DEFAULT 'USD',
    years_experience INTEGER DEFAULT 0,
    availability TEXT NOT NULL DEFAULT 'available' CHECK (availability IN ('available','busy','unavailable')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','suspended')),
    verified INTEGER NOT NULL DEFAULT 0,
    featured INTEGER NOT NULL DEFAULT 0,
    rating_sum REAL NOT NULL DEFAULT 0,
    rating_count INTEGER NOT NULL DEFAULT 0,
    views INTEGER NOT NULL DEFAULT 0,
    rejection_reason TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS applications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    applicant_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    cover_letter TEXT,
    cv_url TEXT,
    expected_salary REAL,
    status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted','reviewing','shortlisted','interview','hired','rejected','withdrawn')),
    employer_note TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (job_id, applicant_id)
  );

  CREATE TABLE IF NOT EXISTS service_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    provider_id INTEGER NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
    requester_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT,
    service_needed TEXT NOT NULL,
    details TEXT,
    preferred_date TEXT,
    budget REAL,
    status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','contacted','quoted','accepted','completed','declined','cancelled')),
    response TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    provider_id INTEGER NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment TEXT,
    status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('published','hidden')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (provider_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS saved_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    item_type TEXT NOT NULL CHECK (item_type IN ('job','provider')),
    item_id INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (user_id, item_type, item_id)
  );

  CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    actor_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    entity TEXT NOT NULL,
    entity_id INTEGER,
    details TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );
  `);

  // Columns added after the first release: existing databases need them bolted on.
  if (!columnExists('categories', 'group_id')) {
    db.exec('ALTER TABLE categories ADD COLUMN group_id INTEGER REFERENCES category_groups(id) ON DELETE SET NULL');
  }
  if (!columnExists('categories', 'sort_order')) {
    db.exec('ALTER TABLE categories ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0');
  }

  db.exec(`
  CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
  CREATE INDEX IF NOT EXISTS idx_jobs_category ON jobs(category_id);
  CREATE INDEX IF NOT EXISTS idx_jobs_location ON jobs(location_id);
  CREATE INDEX IF NOT EXISTS idx_providers_status ON providers(status);
  CREATE INDEX IF NOT EXISTS idx_providers_category ON providers(category_id);
  CREATE INDEX IF NOT EXISTS idx_applications_job ON applications(job_id);
  CREATE INDEX IF NOT EXISTS idx_applications_applicant ON applications(applicant_id);
  CREATE INDEX IF NOT EXISTS idx_requests_provider ON service_requests(provider_id);
  CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at);

  -- Composite indexes matching the filter + sort shapes used by the public
  -- boards, so listing pages stay fast as the dataset grows.
  CREATE INDEX IF NOT EXISTS idx_jobs_status_created ON jobs(status, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_jobs_status_category ON jobs(status, category_id);
  CREATE INDEX IF NOT EXISTS idx_jobs_status_location ON jobs(status, location_id);
  CREATE INDEX IF NOT EXISTS idx_jobs_status_type ON jobs(status, job_type);
  CREATE INDEX IF NOT EXISTS idx_jobs_status_views ON jobs(status, views DESC);
  CREATE INDEX IF NOT EXISTS idx_providers_status_created ON providers(status, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_providers_status_category ON providers(status, category_id);
  CREATE INDEX IF NOT EXISTS idx_providers_status_location ON providers(status, location_id);
  CREATE INDEX IF NOT EXISTS idx_providers_status_views ON providers(status, views DESC);
  CREATE INDEX IF NOT EXISTS idx_categories_kind ON categories(kind);
  CREATE INDEX IF NOT EXISTS idx_categories_group ON categories(group_id);
  CREATE INDEX IF NOT EXISTS idx_category_groups_scope ON category_groups(scope);
  CREATE INDEX IF NOT EXISTS idx_saved_items_user ON saved_items(user_id, item_type);
  CREATE INDEX IF NOT EXISTS idx_reviews_provider ON reviews(provider_id, status);
  CREATE INDEX IF NOT EXISTS idx_users_role_status ON users(role, status);
  `);

  migrateSearchIndex();
}

/**
 * Full text search index over the public listing text. FTS5 is an inverted
 * index, so keyword search avoids a LIKE '%term%' table scan. Triggers keep it
 * in step with writes; rebuildSearchIndex() backfills existing rows.
 */
function migrateSearchIndex(): void {
  db.exec(`
  CREATE VIRTUAL TABLE IF NOT EXISTS jobs_fts USING fts5(title, company, description, requirements, tokenize = 'unicode61 remove_diacritics 2');

  CREATE TRIGGER IF NOT EXISTS jobs_fts_ai AFTER INSERT ON jobs BEGIN
    INSERT INTO jobs_fts(rowid, title, company, description, requirements)
    VALUES (new.id, new.title, new.company, new.description, COALESCE(new.requirements, ''));
  END;
  CREATE TRIGGER IF NOT EXISTS jobs_fts_ad AFTER DELETE ON jobs BEGIN
    DELETE FROM jobs_fts WHERE rowid = old.id;
  END;
  CREATE TRIGGER IF NOT EXISTS jobs_fts_au AFTER UPDATE ON jobs BEGIN
    DELETE FROM jobs_fts WHERE rowid = old.id;
    INSERT INTO jobs_fts(rowid, title, company, description, requirements)
    VALUES (new.id, new.title, new.company, new.description, COALESCE(new.requirements, ''));
  END;

  CREATE VIRTUAL TABLE IF NOT EXISTS providers_fts USING fts5(business_name, tagline, description, services, tokenize = 'unicode61 remove_diacritics 2');

  CREATE TRIGGER IF NOT EXISTS providers_fts_ai AFTER INSERT ON providers BEGIN
    INSERT INTO providers_fts(rowid, business_name, tagline, description, services)
    VALUES (new.id, new.business_name, COALESCE(new.tagline, ''), new.description, COALESCE(new.services, ''));
  END;
  CREATE TRIGGER IF NOT EXISTS providers_fts_ad AFTER DELETE ON providers BEGIN
    DELETE FROM providers_fts WHERE rowid = old.id;
  END;
  CREATE TRIGGER IF NOT EXISTS providers_fts_au AFTER UPDATE ON providers BEGIN
    DELETE FROM providers_fts WHERE rowid = old.id;
    INSERT INTO providers_fts(rowid, business_name, tagline, description, services)
    VALUES (new.id, new.business_name, COALESCE(new.tagline, ''), new.description, COALESCE(new.services, ''));
  END;
  `);
}

/** Rebuild the FTS tables from scratch. Cheap enough to run on boot. */
export function rebuildSearchIndex(): void {
  db.exec(`
    DELETE FROM jobs_fts;
    INSERT INTO jobs_fts(rowid, title, company, description, requirements)
      SELECT id, title, company, description, COALESCE(requirements, '') FROM jobs;
    DELETE FROM providers_fts;
    INSERT INTO providers_fts(rowid, business_name, tagline, description, services)
      SELECT id, business_name, COALESCE(tagline, ''), description, COALESCE(services, '') FROM providers;
  `);
}

/** Slugify kept local so db.ts has no dependency on util.ts (avoids a cycle). */
function localSlugify(value: string): string {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

/**
 * Keep the taxonomy in the database aligned with src/lib/catalogue.ts. Upserts
 * by slug, so admin-created categories are left untouched and catalogue
 * categories are re-parented whenever a group is renamed or moved.
 */
export function syncCatalogue(): void {
  const upsertGroup = db.prepare(`
    INSERT INTO category_groups (name, slug, icon, scope, description, sort_order)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(slug) DO UPDATE SET
      name = excluded.name, icon = excluded.icon, scope = excluded.scope,
      description = excluded.description, sort_order = excluded.sort_order`);
  GROUPS.forEach(([slug, name, icon, scope, description], i) => {
    upsertGroup.run(name, slug, icon, scope, description, i);
  });

  const groupIds = new Map(
    (db.prepare('SELECT id, slug FROM category_groups').all() as Array<{ id: number; slug: string }>)
      .map((r) => [r.slug, r.id]),
  );

  const upsertCategory = db.prepare(`
    INSERT INTO categories (name, slug, kind, icon, description, group_id, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(slug) DO UPDATE SET
      name = excluded.name, kind = excluded.kind, icon = excluded.icon,
      description = excluded.description, group_id = excluded.group_id,
      sort_order = excluded.sort_order`);

  for (const kind of ['job', 'service'] as const) {
    categoriesFor(kind).forEach((c, i) => {
      upsertCategory.run(c.name, c.slug, kind, c.icon, c.description, groupIds.get(c.group) ?? null, i);
    });
  }

  const upsertLocation = db.prepare(`
    INSERT INTO locations (name, slug, kind, notes) VALUES (?, ?, ?, ?)
    ON CONFLICT(slug) DO UPDATE SET name = excluded.name, kind = excluded.kind, notes = excluded.notes`);
  for (const [name, kind, notes] of LOCATIONS) {
    upsertLocation.run(name, localSlugify(name), kind, notes);
  }
}

/**
 * Idempotent boot: create the schema, sync the taxonomy, seed sample data on an
 * empty database and backfill the search index. Safe to call on every request;
 * the work happens once per process.
 */
export function ensureBoot(): void {
  if (g.__plumtreeBooted) return;
  migrate();
  syncCatalogue();
  const result = seed({ force: false });
  if (result.seeded) {
    console.log('[seed] database initialised with sample data', JSON.stringify(result.counts));
  }
  const missing = db.prepare(`
    SELECT (SELECT COUNT(*) FROM jobs) - (SELECT COUNT(*) FROM jobs_fts) AS jobs,
           (SELECT COUNT(*) FROM providers) - (SELECT COUNT(*) FROM providers_fts) AS providers`).get() as { jobs: number; providers: number };
  if (missing.jobs > 0 || missing.providers > 0) {
    rebuildSearchIndex();
    console.log('[search] rebuilt full text index', JSON.stringify(missing));
  }
  g.__plumtreeBooted = true;
}
