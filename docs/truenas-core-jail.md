# Deploying bdblan in a TrueNAS CORE jail

This guide installs the **bdblan app only** into an [iocage] jail on
**TrueNAS CORE** (FreeBSD). The MySQL database is **not** installed here — the
app connects to a MySQL server running elsewhere on your LAN via
`DATABASE_URL`.

The result: an iocage jail that auto-starts with the NAS, running an rc.d
service that auto-starts the app whenever the jail boots.

[iocage]: https://www.truenas.com/docs/core/coretutorials/jails/

## Prerequisites

- TrueNAS CORE with an SSH/root shell on the host.
- A reachable MySQL 8 server on the LAN with a `bdblan` database, a user, and
  the schema-creation permissions the migration runner needs. The server must
  accept remote connections (bind address + a user grant for the jail's IP) —
  the dev setup in [README.md](../README.md) uses `127.0.0.1`, which will not
  work from another host.
- An OpenDota API key — https://www.opendota.com/api-keys

Throughout, replace these placeholders with your real values:

| Placeholder        | Meaning                                            |
|--------------------|----------------------------------------------------|
| `192.168.1.0/24`   | your LAN subnet                                    |
| `192.168.1.1`      | your LAN gateway                                   |
| `192.168.1.29`     | the host running MySQL                             |
| `<JAIL_IP>`        | the address the jail ends up with                  |

## 1. Create the jail

Run on the **TrueNAS host** as root. First check which FreeBSD release matches
your TrueNAS version and fetch it:

```sh
freebsd-version        # e.g. 13.4-RELEASE-p1 -> use 13.4-RELEASE below
iocage fetch -r 13.4-RELEASE
```

Create a VNET jail with DHCP. `boot=on` makes the **jail** start automatically
when the NAS boots (the app service inside it is configured in step 5):

```sh
iocage create -n bdblan -r 13.4-RELEASE \
  vnet=on \
  bpf=yes \
  dhcp=on \
  boot=on
```

To use a **static IP** instead of DHCP, drop `bpf`/`dhcp` and use:

```sh
  ip4_addr="vnet0|192.168.1.30/24" \
  defaultrouter="192.168.1.1" \
```

Start the jail and note its address:

```sh
iocage start bdblan
iocage get ip4_addr bdblan      # this is <JAIL_IP>
```

You can also create the jail from the TrueNAS web UI under **Jails → Add**;
just make sure **Auto-start** is enabled.

## 2. Install Node.js and fetch the app

Open a shell inside the jail:

```sh
iocage console bdblan
```

Everything from here runs **inside the jail**. Install Node.js 20+ and Git:

```sh
pkg update
pkg install -y node22 npm-node22 git
```

Clone the app into `/usr/local/www`:

```sh
mkdir -p /usr/local/www
cd /usr/local/www
git clone https://github.com/JakeTheSnake/bdblan.git
cd bdblan
npm install
```

## 3. Configure the environment

`.env.local` is gitignored, so create it inside the jail. Generate the secrets
first (`bcryptjs` is available after `npm install`):

```sh
node -e "console.log(require('bcryptjs').hashSync('your-admin-password', 10))"
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Create `/usr/local/www/bdblan/.env.local`:

```
DATABASE_URL=mysql://bdblan:bdblan@192.168.1.20:3306/bdblan
OPENDOTA_API_KEY=your-opendota-key
ADMIN_USERNAME=admin
ADMIN_PASSWORD_HASH=\$2a\$10\$abcdefghijklmnopqrstuvwxyz...
SESSION_SECRET=...the randomBytes output...
```

> **Escape every `$` in `ADMIN_PASSWORD_HASH` with a backslash.** Next.js runs
> `dotenv-expand` on env values and would otherwise mangle the bcrypt hash.
> See [README.md](../README.md) for the full explanation.

## 4. Build, migrate, create the app user

Apply the database schema (this connects to the remote MySQL server) and build
the production bundle:

```sh
cd /usr/local/www/bdblan
npm run migrate
npm run build
```

Create an unprivileged user to run the app, and give it ownership:

```sh
pw useradd -n bdblan -d /usr/local/www/bdblan -s /usr/sbin/nologin -c "bdblan app"
chown -R bdblan:bdblan /usr/local/www/bdblan
```

## 5. Create the autostart service

Create the rc.d script `/usr/local/etc/rc.d/bdblan`:

```sh
#!/bin/sh
#
# PROVIDE: bdblan
# REQUIRE: LOGIN NETWORKING
# KEYWORD: shutdown

. /etc/rc.subr

name="bdblan"
rcvar="bdblan_enable"

load_rc_config $name

: ${bdblan_enable:="NO"}
: ${bdblan_user:="bdblan"}
: ${bdblan_dir:="/usr/local/www/bdblan"}

pidfile="/var/run/${name}.pid"
logfile="/var/log/${name}.log"

command="/usr/sbin/daemon"
command_args="-r -P ${pidfile} -o ${logfile} -t ${name} -u ${bdblan_user} \
  /bin/sh -c 'cd ${bdblan_dir} && PATH=/usr/local/bin:/usr/bin:/bin exec npm start'"

run_rc_command "$1"
```

What this does:

- `npm start` runs `next start`, which serves the production build on port
  `3000` and loads `.env.local` from the working directory.
- `daemon -r` supervises the process and restarts it if it exits; `-P` records
  the supervisor's PID so `service` can stop it; `-u` drops to the `bdblan`
  user; `-o` captures stdout/stderr to `/var/log/bdblan.log`.
- The explicit `PATH` ensures `npm` can find `node` when started at boot (the
  `bdblan` user has no login shell to set one up).

Make it executable, enable it, and start it:

```sh
chmod +x /usr/local/etc/rc.d/bdblan
sysrc bdblan_enable=YES
service bdblan start
```

`sysrc bdblan_enable=YES` is what makes the **app** start on every jail boot.
Combined with `boot=on` from step 1, the chain is:
NAS boots → jail boots → `bdblan` service starts the app.

## 6. Verify

```sh
service bdblan status
tail -f /var/log/bdblan.log
```

From any machine on the LAN, open `http://<JAIL_IP>:3000`. Then follow the
**First-run checklist** in [README.md](../README.md): log in at
`/admin/login`, click **Sync heroes**, and create your first LAN.

To confirm autostart end to end, restart the jail and re-check:

```sh
exit                              # leave the jail console
iocage restart bdblan
iocage console bdblan -- service bdblan status
```

## Updating the app

```sh
iocage console bdblan
cd /usr/local/www/bdblan
git pull
npm install
npm run migrate          # applies any new migrations; idempotent
npm run build
chown -R bdblan:bdblan /usr/local/www/bdblan
service bdblan restart
```

## Troubleshooting

- **Service won't start / restarts in a loop** — read `/var/log/bdblan.log`.
  Most failures are a bad `DATABASE_URL`, the MySQL server refusing the jail's
  IP, or a missing/mis-escaped `ADMIN_PASSWORD_HASH`.
- **`next start` errors about a missing build** — run `npm run build` again;
  the `.next/` directory must exist and be owned by `bdblan`.
- **Can't reach the app from the LAN** — confirm `<JAIL_IP>` with
  `iocage get ip4_addr bdblan` and that the jail has VNET networking.
- **Database connection refused** — verify from inside the jail with
  `nc -z 192.168.1.20 3306`, and that the MySQL user is granted access from
  the jail's host/IP.
