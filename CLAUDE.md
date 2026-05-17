# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```sh
npm run dev               # dev server on http://localhost:3000
npm run build && npm start  # production build + serve
npm run migrate           # apply pending SQL migrations
```

There is no lint or test setup, and no test runner — the only npm scripts are
`dev`, `build`, `start`, and `migrate`.

MySQL must be running and reachable via `DATABASE_URL` before `dev`, `start`,
or `migrate` will work. See README.md for the Docker MySQL one-liner.

## Environment gotcha

`ADMIN_PASSWORD_HASH` (a bcrypt hash, full of `$`) **must have every `$`
escaped with a backslash** in `.env.local`. Next.js runs `dotenv-expand` on
env values, so an unescaped `$2a$10$...` gets mangled as variable references.
Quoting does not reliably help; escaping does.

## Architecture

Next.js 16 App Router app. Pages are `.jsx`, library code and API routes are
plain `.js` — no TypeScript despite the `tsconfig.json`. The `@/` import alias
maps to the repo root.

**Purpose:** ingest Dota 2 match data from the OpenDota API and aggregate it
into admin-defined "LAN" events — a named group of players plus a date window.
Matches those players played inside the window become the LAN's match set.

**Data layer (`lib/db.js`).** Kysely is used purely as a SQL query builder
over a `mysql2` connection pool — no ORM, no codegen, no typed schema.
`getDb()` returns a lazily-created singleton. Schema lives in hand-written SQL
under `db/migrations/`; `scripts/migrate.js` runs every `.sql` file in filename
order and records applied files in a `_migrations` table (idempotent).

**Tables** (all in `db/migrations/0001_init.sql`): `players`, `heroes`,
`lans`, `lan_players`, `matches`, `lan_matches`, `match_players`,
`match_objectives`. `matches.raw_json` stores the full OpenDota payload
verbatim so new denormalized columns/filters can be added later without
re-fetching.

**OpenDota client (`lib/opendota.js`).** All API access goes through one
throttled client: a token-bucket limiter (`OPENDOTA_RPS`) and exponential
backoff retry on 429/5xx.

**Sync pipeline (`lib/sync.js`).** `syncLan(lanId)` pulls each LAN player's
recent match history, filters to matches whose `start_time` is inside the LAN
date window (UTC), and calls `ingestMatch` for each new id. `ingestMatch`
upserts `matches` + `match_players` + `match_objectives` in a transaction and
is a no-op if the match already exists. `syncHeroes()` populates the `heroes`
table. Sync runs synchronously inside the LAN-create / LAN-sync API requests.

**"Our team" resolution (`lib/lanTeam.js`).** OpenDota matches have radiant/
dire sides; the LAN's W/L is from the attendees' perspective. `ourTeamIsRadiant`
picks the side containing the most LAN players, tie-broken by which side the
LAN host is on. Every aggregation that reports wins/losses depends on this.

**Aggregations (`lib/aggregations/`).** Each file exports a function taking a
`lanId` and returning computed stats (LAN summary, per-player stats, match
details, highscores like hero damage / healing / tower damage, the composable
match `filters.js`). These are the read model rendered by the public pages.

**Auth (`lib/auth.js` + `proxy.js`).** Single hardcoded-in-env admin account.
`verifyCredentials` compares against `ADMIN_USERNAME` / `ADMIN_PASSWORD_HASH`;
a signed JWT (`SESSION_SECRET`) is stored in the `bdblan_session` cookie.
`proxy.js` is the Next.js 16 middleware equivalent — it gates `/admin/*` and
`/api/admin/*` behind that cookie, redirecting unauthed page requests to
`/admin/login` and returning 401 for API requests.

**Routes.** Public read pages under `app/lan/[lanId]/...`; admin pages under
`app/admin/`; API routes under `app/api/` (`api/auth/*` for login/logout,
`api/admin/*` for LAN CRUD, sync, and hero sync).
