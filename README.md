# bdblan

Next.js app that ingests Dota 2 match data from the OpenDota API and aggregates
it into admin-defined "LAN" events — groups of matches played by a set of
friends inside a date window.

## Prerequisites

- Node.js 20+
- Docker (for MySQL)
- An OpenDota API key — https://www.opendota.com/api-keys

## Development setup

### 1. Start MySQL in Docker

Run MySQL 8 on the host network so it's reachable at `127.0.0.1:3306`:

```sh
docker run -d \
  --name bdblan-mysql \
  --network=host \
  -e MYSQL_ROOT_PASSWORD=rootpw \
  -e MYSQL_DATABASE=bdblan \
  -e MYSQL_USER=bdblan \
  -e MYSQL_PASSWORD=bdblan \
  -v bdblan-mysql-data:/var/lib/mysql \
  mysql:8
```

Notes:
- `--network=host` means the container shares the host's network stack, so
  `-p` port mapping is not needed (and would be ignored). MySQL listens on
  `127.0.0.1:3306` directly.
- Data persists in the named volume `bdblan-mysql-data` across restarts.
- To stop: `docker stop bdblan-mysql`. To start again: `docker start bdblan-mysql`.
- To wipe and start fresh: `docker rm -f bdblan-mysql && docker volume rm bdblan-mysql-data`.

Wait a few seconds for MySQL to initialize, then verify:

```sh
docker logs bdblan-mysql 2>&1 | grep "ready for connections"
```

### 2. Install dependencies

```sh
npm install
```

### 3. Configure environment

Copy the example env file and fill in the blanks:

```sh
cp .env.example .env.local
```

Generate the admin password hash:

```sh
node -e "console.log(require('bcryptjs').hashSync('your-password', 10))"
```

**Important:** when you paste the hash into `.env.local`, **escape every `$`
with a backslash**. Bcrypt hashes contain `$` characters (`$2a$10$...`), and
Next.js runs `dotenv-expand` on env values, which interprets `$foo` as a
variable reference — stripping parts of your hash. Quoting (single or
double) is unreliable across `@next/env` versions; escaping always works.

```
ADMIN_PASSWORD_HASH=\$2a\$10\$abcdefghijklmnopqrstuvwxyz...
```

Generate a session secret:

```sh
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Minimal working `.env.local`:

```
DATABASE_URL=mysql://bdblan:bdblan@127.0.0.1:3306/bdblan
OPENDOTA_API_KEY=your-opendota-key
ADMIN_USERNAME=admin
ADMIN_PASSWORD_HASH=$2a$10$...            # from the bcrypt command above
SESSION_SECRET=...                         # from the randomBytes command above
```

### 4. Run migrations

```sh
npm run migrate
```

This creates all tables and records applied migrations in `_migrations`.

### 5. Start the dev server

```sh
npm run dev
```

Open http://localhost:3000.

## First-run checklist

1. Log in at http://localhost:3000/admin/login with the credentials you
   configured in `.env.local`.
2. Click **Sync heroes** on the admin dashboard — this populates the `heroes`
   table (names + portrait URLs) from OpenDota. Only needed once, and whenever
   new heroes are released.
3. Click **New LAN**, fill in the dates and player account IDs (Steam32,
   visible in any OpenDota player URL), and mark one player as host.
   Submitting will create the LAN and immediately pull each player's recent
   match history from OpenDota, filter to matches inside the date window, and
   ingest the full match details for each.
4. Browse the LAN summary, player, and match views from the public routes
   under `/lan/[lanId]`.

## Useful commands

```sh
# Start / stop the MySQL container
docker start bdblan-mysql
docker stop bdblan-mysql

# Open a MySQL shell in the container
docker exec -it bdblan-mysql mysql -ubdblan -pbdblan bdblan

# Re-run migrations (idempotent)
npm run migrate

# Production build
npm run build && npm start
```

## Project layout

```
app/                  Next.js App Router pages and API routes
  (public pages)      /, /lan/[lanId], /lan/[lanId]/players/[accountId],
                      /lan/[lanId]/matches/[matchId]
  admin/              login, dashboard, new-LAN form
  api/                auth + admin API routes
lib/                  db (Kysely), opendota client, auth, sync pipeline,
                      aggregations (lanSummary, playerStats, matchDetails,
                      filters), formatting helpers
db/migrations/        hand-written .sql migration files
scripts/migrate.js    migration runner
middleware.js         gates /admin/* and /api/admin/* behind the session cookie
```
