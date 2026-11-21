# Deploying Plumtree Connect to production

This guide takes you from a fresh clone in **Visual Studio Code** to a running public
site. It assumes you have never deployed this project before and that you are working
on your own machine.

Every command below was run against this repository. Where a step depends on your
provider (Vercel, a VPS, Docker), the differences are called out.

---

## Contents

1. [What you are deploying](#1-what-you-are-deploying)
2. [Before you start: the two things that decide everything](#2-before-you-start-the-two-things-that-decide-everything)
3. [Step 1 - Install the tools](#step-1---install-the-tools)
4. [Step 2 - Clone the project and open it in VS Code](#step-2---clone-the-project-and-open-it-in-vs-code)
5. [Step 3 - Install dependencies](#step-3---install-dependencies)
6. [Step 4 - Run it locally](#step-4---run-it-locally)
7. [Step 5 - Sign in and check the four roles](#step-5---sign-in-and-check-the-four-roles)
8. [Step 6 - Run the tests before you change anything](#step-6---run-the-tests-before-you-change-anything)
9. [Step 7 - Make your changes on a branch](#step-7---make-your-changes-on-a-branch)
10. [Step 8 - Prepare for production: the security step you must not skip](#step-8---prepare-for-production-the-security-step-you-must-not-skip)
11. [Step 9 - Choose where to host](#step-9---choose-where-to-host)
12. [Step 10a - Deploy to a VPS with Node and systemd](#step-10a---deploy-to-a-vps-with-node-and-systemd)
13. [Step 10b - Deploy with Docker](#step-10b---deploy-with-docker)
14. [Step 10c - Deploy to a managed platform (Vercel and friends)](#step-10c---deploy-to-a-managed-platform-vercel-and-friends)
15. [Step 11 - Put HTTPS in front of it](#step-11---put-https-in-front-of-it)
16. [Step 12 - Verify the live site](#step-12---verify-the-live-site)
17. [Step 13 - Back up the database](#step-13---back-up-the-database)
18. [Step 14 - Ship later changes](#step-14---ship-later-changes)
19. [Troubleshooting](#troubleshooting)
20. [Cheat sheet](#cheat-sheet)

---

## 1. What you are deploying

Plumtree Connect is a **Next.js 14** application written in TypeScript. It has three
surfaces: a public job and service board, a role-based dashboard, and an administrator
panel.

Three facts shape every deployment decision:

| Fact | Consequence |
| --- | --- |
| It stores data in **SQLite** via the built-in `node:sqlite` module | The database is a **file on disk**. The app needs a filesystem that persists between restarts. |
| It needs **Node.js 22.5 or newer** | Older Node cannot load `node:sqlite` at all. |
| Sessions are held **in memory** | Restarting the process signs everyone out. This is acceptable for a small site; see [Troubleshooting](#troubleshooting) if you need more. |

There is **no external database, no Redis, no S3 bucket**. One process, one file.

---

## 2. Before you start: the two things that decide everything

Read this section before you pick a host. Skipping it is the most common way this
deployment goes wrong.

### 2.1 The app seeds demo data on an empty database

The first time the app starts against a database that does not exist, it creates the
schema and fills it with **sample data**, including a demo administrator:

```
Email:    admin@plumtreeconnect.co.zw
Password: admin1234
```

This is wonderful for a demo and **dangerous in production**. A stranger who finds your
site can sign in as administrator on day one.

You have two safe options:

1. **Change that password immediately after the first deploy** (Step 8.1), or
2. **Start from an empty database without demo rows** (Step 8.2).

Do one of them. Do not launch with `admin1234` live.

### 2.2 SQLite needs a persistent disk

Because the whole site lives in `data/plumtree.db`, your host must keep that file:

- On a VPS or Docker host: mount a volume on `data/` (or set `DB_PATH`).
- On Vercel: **this will not work as-is.** Vercel's filesystem is ephemeral and
  read-only for writes that must persist. See [Step 10c](#step-10c---deploy-to-a-managed-platform-vercel-and-friends)
  for what to do instead.

---

## Step 1 - Install the tools

You need three things on your own computer.

### 1.1 Node.js 22.5 or newer

Check what you have:

```bash
node -v
```

If it prints `v22.5.0` or higher, you are done. Otherwise install the current LTS from
<https://nodejs.org>. On macOS with Homebrew:

```bash
brew install node
```

On Ubuntu/Debian, use NodeSource rather than the distro package, which is often too old:

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs
```

Verify the SQLite module is present (this is the single most important check):

```bash
node -e "require('node:sqlite'); console.log('node:sqlite OK')"
```

You should see `node:sqlite OK`. If you see an error, your Node is too old — fix this
before continuing, nothing else will work.

### 1.2 Git

```bash
git --version
```

Install from <https://git-scm.com> if missing.

### 1.3 Visual Studio Code

Download from <https://code.visualstudio.com>. Two extensions are worth adding:

- **ESLint** (`dbaeumer.vscode-eslint`) — flags problems as you type.
- **SQLite Viewer** (`qwtel.sqlite-viewer`) — lets you click `data/plumtree.db` and
  browse tables without installing anything else.

---

## Step 2 - Clone the project and open it in VS Code

In VS Code, open the Command Palette (`Ctrl+Shift+P`, or `Cmd+Shift+P` on macOS) and run
**Git: Clone**. Paste the repository URL and choose a folder.

Or do it in a terminal:

```bash
git clone https://github.com/dhhubb/plumtreeconnectpublic.git
cd plumtreeconnectpublic
code .
```

Confirm you are on the branch you expect:

```bash
git branch --show-current
```

### 2.1 Open the integrated terminal

`Ctrl+` ` ` (backtick), or **Terminal → New Terminal**. Everything below runs there.

---

## Step 3 - Install dependencies

```bash
npm install
```

This installs Next.js, React, TypeScript and `tsx` (used by the seed and test scripts).
There are no native modules to compile, so it takes under a minute.

> **If `npm install` fails**, check `node -v` first. Version mismatches cause most
> install errors here.

---

## Step 4 - Run it locally

```bash
npm run dev
```

Open <http://localhost:3000>. On the very first run the terminal prints:

```
[seed] database initialised with sample data {"users":20,"jobs":21,...}
```

That line means the database was created at `data/plumtree.db` and filled with demo
content. It only happens once; later starts reuse the file.

Leave this terminal running while you work. Edits reload automatically.

---

## Step 5 - Sign in and check the four roles

Sign in at <http://localhost:3000/login> with each account below. The login page has
one-click buttons that fill the credentials for you.

| Role | Email | Password |
| --- | --- | --- |
| Administrator | `admin@plumtreeconnect.co.zw` | `admin1234` |
| Job seeker | `thandiwe@example.com` | `seeker1234` |
| Employer | `hr@plumtreeagro.co.zw` | `employer1234` |
| Service provider | `info@tshitshiboreholes.co.zw` | `provider1234` |

Check these pages load and behave:

- `/` — home page with live statistics
- `/jobs` — job board, try the filters
- `/providers` — service directory
- `/categories` — industry groups
- `/dashboard` — different content per role
- `/admin` — administrator panel (admin account only)

If the administrator account can see `/admin` and the seeker account cannot, the
role system is working.

---

## Step 6 - Run the tests before you change anything

Establish a known-good baseline. With the dev server running, open a **second**
terminal (`Ctrl+Shift+5`) and run:

```bash
npm run smoke
```

Expected result:

```
========================================================
  116 passed, 0 failed
========================================================
```

Also run the type checker:

```bash
npm run typecheck
```

No output means success.

> **If tests fail on a fresh clone**, the database may be half-written from an
> interrupted run. Reset it: `npm run seed -- --force`, then run the tests again.

---

## Step 7 - Make your changes on a branch

Never build directly on `main`. Create a branch per change:

```bash
git checkout -b my-change
```

Edit files in VS Code. When you are ready:

```bash
npm run typecheck     # must pass
npm run smoke         # must be 116 passed
git add -A
git commit -m "Describe your change"
git push -u origin my-change
```

---

## Step 8 - Prepare for production: the security step you must not skip

### 8.1 Option A - Keep the demo data but change the admin password

Simplest path. Deploy, sign in as `admin@plumtreeconnect.co.zw` / `admin1234`, then
change the password from **Dashboard → Profile** immediately.

Also change or delete the other three demo accounts (they all share known passwords)
from **Admin → Users**.

### 8.2 Option B - Start with an empty database (recommended for a real launch)

The app always creates the schema on boot, so you only need to supply a database that
has no users in it. Two ways:

**Way 1 — let it seed, then wipe the demo rows.** After the first start, stop the app and
delete the database file; the schema is recreated on the next boot. But note the app
*re-seeds* an empty database, so this alone does not help.

**Way 2 — create the admin you want, then remove the rest.** This is the reliable
route:

1. Deploy and sign in as the demo administrator.
2. Go to **Admin → Users**, create your real administrator account with a strong
   password, and set its role to `admin`.
3. Delete every demo user.
4. Sign in as your new administrator and delete the demo administrator.

### 8.3 Set a custom database location (optional)

By default the database lives at `data/plumtree.db` inside the project. To put it
somewhere else — for example a mounted volume — set `DB_PATH`:

```bash
DB_PATH=/var/lib/plumtree/plumtree.db npm start
```

Create the directory first and make sure the user running the app can write to it.

---

## Step 9 - Choose where to host

| Option | Good for | SQLite works? | Effort |
| --- | --- | --- | --- |
| **VPS + systemd** (Step 10a) | Full control, cheapest at scale | Yes, on the server's disk | Medium |
| **Docker** (Step 10b) | Repeatable deploys, easy rollback | Yes, with a volume | Medium |
| **Vercel / Netlify** (Step 10c) | Zero server admin | **No, not without changing the database** | Low, but needs code changes |

For a single small site, **a $5 VPS with systemd (Step 10a) is the least surprising
choice**: one process, one file, one backup command.

---

## Step 10a - Deploy to a VPS with Node and systemd

Assumes Ubuntu 22.04 or 24.04 and a domain pointed at the server's IP.

### 10a.1 Create a user and install Node

```bash
sudo adduser --system --group --home /var/www/plumtree plumtree
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs git
node -v          # must be v22.5.0 or newer
```

### 10a.2 Get the code

```bash
sudo -u plumtree git clone https://github.com/dhhubb/plumtreeconnectpublic.git /var/www/plumtree/app
cd /var/www/plumtree/app
sudo -u plumtree git checkout main
```

### 10a.3 Install and build

```bash
sudo -u plumtree npm ci
sudo -u plumtree npm run build
```

> `npm run build` **must be run on the server**, not copied from your laptop. Next.js
> compiles per-platform.

### 10a.4 Fix ownership of the data directory

The app creates `data/` itself on first boot, but it needs permission to write there.
The `git clone` above ran as the `plumtree` user, so this is usually already correct;
run it anyway to be sure:

```bash
sudo chown -R plumtree:plumtree /var/www/plumtree
```

### 10a.5 Create a systemd service

Create `/etc/systemd/system/plumtree.service`:

```ini
[Unit]
Description=Plumtree Connect
After=network.target

[Service]
Type=simple
User=plumtree
Group=plumtree
WorkingDirectory=/var/www/plumtree/app
Environment=NODE_ENV=production
Environment=PORT=3000
Environment=DB_PATH=/var/www/plumtree/app/data/plumtree.db
ExecStart=/usr/bin/npm run start
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Enable and start it:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now plumtree
sudo systemctl status plumtree
```

Look for `Active: active (running)`. Then check it responds:

```bash
curl -s http://localhost:3000/api/health
```

You should get JSON containing `"ok":true`.

### 10a.6 Watch the logs

```bash
sudo journalctl -u plumtree -f
```

This is where the `[seed] database initialised` line appears on first boot.

---

## Step 10b - Deploy with Docker

The repository ships a `Dockerfile` and `.dockerignore` that have been built and run
against this code.

### 10b.1 Build

```bash
docker build -t plumtree-connect .
```

### 10b.2 Run with a persistent volume

```bash
docker run -d \
  --name plumtree \
  -p 3000:3000 \
  -v plumtree-data:/app/data \
  --restart unless-stopped \
  plumtree-connect
```

The `-v plumtree-data:/app/data` is the important part: without it, **every restart
wipes your database** because the container filesystem is discarded.

### 10b.3 Check it

```bash
docker logs plumtree          # look for "Ready" and the [seed] line
curl -s http://localhost:3000/api/health
```

### 10b.4 Useful commands

```bash
docker restart plumtree                      # restart
docker logs -f plumtree                      # follow logs
docker exec -it plumtree npm run seed -- --force   # reseed demo data
docker rm -f plumtree                        # remove the container
```

Removing the container does **not** delete the `plumtree-data` volume, so your data
survives. Delete it deliberately with `docker volume rm plumtree-data`.

---

## Step 10c - Deploy to a managed platform (Vercel and friends)

Vercel is the natural home for Next.js, and the site will *build* and *start* there.
The problem is data:

- The filesystem is **ephemeral**. A SQLite file written at runtime disappears on the
  next deploy and is not shared between serverless instances.
- So the app will appear to work, then silently lose registrations and listings.

**Do not run this app on Vercel with SQLite if you expect data to persist.**

If you want a managed platform, you must first move the data layer off SQLite onto a
hosted database (for example Postgres via Neon or Supabase, or Turso for SQLite-
compatible storage over HTTP). That is a code change in `src/lib/db.ts` and the query
layer — it is not a configuration toggle.

If you only need a **demo** (no real data), Vercel is fine:

1. Push the repo to GitHub.
2. In Vercel, **Add New → Project**, import the repo.
3. Framework preset: **Next.js**. Build command `npm run build`, output default.
4. Deploy.
5. Remember the demo admin password is public — change it or accept that anyone can
   administer the demo.

---

## Step 11 - Put HTTPS in front of it

Never serve a login form over plain HTTP. On a VPS, put nginx in front and let
Let's Encrypt issue a certificate.

```bash
sudo apt-get install -y nginx certbot python3-certbot-nginx
```

Create `/etc/nginx/sites-available/plumtree`:

```nginx
server {
    listen 80;
    server_name your-domain.co.zw;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable it and get a certificate:

```bash
sudo ln -s /etc/nginx/sites-available/plumtree /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
sudo certbot --nginx -d your-domain.co.zw
```

`certbot` rewrites the config to redirect HTTP to HTTPS and installs a renewal timer.
Test renewal with `sudo certbot renew --dry-run`.

---

## Step 12 - Verify the live site

Work through this list on the **public** URL, not localhost.

- [ ] `https://your-domain.co.zw/` loads and shows statistics
- [ ] `https://your-domain.co.zw/api/health` returns `{"ok":true,...}`
- [ ] `/jobs` and `/providers` list items and the filters work
- [ ] `/categories` shows all 16 industry groups
- [ ] You can **register a new account** and it signs you in
- [ ] You can sign in as the administrator and open `/admin`
- [ ] A non-admin account **cannot** open `/admin` (try it)
- [ ] The demo admin password has been changed, or demo users deleted (Step 8)
- [ ] The padlock appears in the browser address bar

Run the automated suite against production too:

```bash
BASE=https://your-domain.co.zw npm run smoke
```

> Be aware this creates and deletes test records in your live database. On a real site
> with real users, run it against a staging copy instead.

---

## Step 13 - Back up the database

Everything lives in one file. Back it up on a schedule.

### 13.1 A safe one-off copy

SQLite in WAL mode (which this app uses) writes to `plumtree.db`, `plumtree.db-wal` and
`plumtree.db-shm`. Copying only the `.db` file while the app is running can capture a
half-written state. Use SQLite's own backup, which is safe on a live database:

```bash
sqlite3 data/plumtree.db ".backup '/backups/plumtree-$(date +%F).db'"
```

If `sqlite3` is not installed: `sudo apt-get install -y sqlite3`.

### 13.2 Daily automatic backup

Create `/usr/local/bin/plumtree-backup.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail
mkdir -p /backups
sqlite3 /var/www/plumtree/app/data/plumtree.db ".backup '/backups/plumtree-$(date +%F).db'"
find /backups -name 'plumtree-*.db' -mtime +30 -delete
```

```bash
sudo chmod +x /usr/local/bin/plumtree-backup.sh
sudo crontab -e     # add:
# 0 2 * * * /usr/local/bin/plumtree-backup.sh
```

Copy backups off the server as well — a backup on the same disk does not survive a
disk failure.

### 13.3 Restoring

```bash
sudo systemctl stop plumtree
cp /backups/plumtree-2026-11-12.db /var/www/plumtree/app/data/plumtree.db
sudo rm -f /var/www/plumtree/app/data/plumtree.db-wal /var/www/plumtree/app/data/plumtree.db-shm
sudo chown plumtree:plumtree /var/www/plumtree/app/data/plumtree.db
sudo systemctl start plumtree
```

---

## Step 14 - Ship later changes

### On a VPS

```bash
cd /var/www/plumtree/app
sudo -u plumtree git pull
sudo -u plumtree npm ci
sudo -u plumtree npm run build
sudo systemctl restart plumtree
```

Run `npm run typecheck` and `npm run smoke` against a staging copy before doing this on
a live site.

### With Docker

```bash
git pull
docker build -t plumtree-connect .
docker rm -f plumtree
docker run -d --name plumtree -p 3000:3000 -v plumtree-data:/app/data \
  --restart unless-stopped plumtree-connect
```

The volume is untouched, so data survives the upgrade.

> **Schema changes:** the app has no migration versioning. If a release adds a column,
> the schema is only created for *new* databases. Read the release notes; you may need
> to run a one-off `ALTER TABLE` or restore into a fresh database.

---

## Troubleshooting

**`node:sqlite` cannot be found / `ERR_UNKNOWN_BUILTIN_MODULE`**
Node is older than 22.5. Run `node -v` and upgrade.

**Build fails with `FOREIGN KEY constraint failed` on an `/api/...` route**
You are on an old checkout. All API routes carry `export const dynamic = 'force-dynamic'`
so Next.js does not try to prerender them (which would seed the database at build time).
Pull the latest `main`.

**`EADDRINUSE: address already in use`**
Something already listens on the port. Find and stop it:

```bash
sudo lsof -i :3000
```

Or start on another port: `PORT=3001 npm start`.

**Everyone is logged out after a restart**
Expected. Sessions live in memory. Users simply sign in again.

**The site lost all data after a redeploy (Docker)**
You forgot the volume. `-v plumtree-data:/app/data` is required.

**Tests fail with `Cannot read properties of undefined`**
The database is half-written. `npm run seed -- --force` and rerun.

**`npm run smoke` says connection refused**
The server is not running, or `BASE` points at the wrong port. Start it first:
`npm run build && npm start`, then `BASE=http://localhost:3000 npm run smoke`.

**Registration returns 404**
You are on an old build without the register route. Rebuild: `npm run build`.

---

## Cheat sheet

```bash
# Local development
npm install                 # install dependencies
npm run dev                 # dev server on :3000
npm run build               # production build (run on the target machine)
npm start                   # serve the build

# Quality gates
npm run typecheck           # TypeScript, no output = pass
npm run smoke               # 116 API assertions, server must be running
BASE=https://site npm run smoke   # run against another environment

# Data
npm run seed -- --force     # wipe and reseed demo data (destructive)
DB_PATH=/path/to.db npm start     # use a different database file

# Docker
docker build -t plumtree-connect .
docker run -d --name plumtree -p 3000:3000 -v plumtree-data:/app/data \
  --restart unless-stopped plumtree-connect
docker logs -f plumtree

# VPS service
sudo systemctl restart plumtree
sudo journalctl -u plumtree -f

# Backup (safe while running)
sqlite3 data/plumtree.db ".backup '/backups/plumtree-$(date +%F).db'"
```

---

## One-paragraph summary

Clone the repo, confirm `node -v` is 22.5 or newer, run `npm install`, then `npm run
dev` and check the four demo logins. Before going live, change the demo administrator
password (or replace the demo users), then either run it on a VPS under systemd with
`DB_PATH` pointing at a real directory, or build the Docker image and run it with a
volume on `/app/data`. Put nginx and a Let's Encrypt certificate in front of it, verify
`/api/health` and the registration flow on the public URL, and schedule the `sqlite3
.backup` command daily. Do not deploy to Vercel with SQLite unless you are only running
a demo — its filesystem does not keep your data.
