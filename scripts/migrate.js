#!/usr/bin/env node
// Simple migration runner. Executes all .sql files in db/migrations/ in
// filename order, tracking applied files in a `_migrations` table.

const fs = require('node:fs');
const path = require('node:path');
const mysql = require('mysql2/promise');

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL is not set');
    process.exit(1);
  }

  const conn = await mysql.createConnection({ uri: url, multipleStatements: true });

  await conn.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      name VARCHAR(255) NOT NULL PRIMARY KEY,
      applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB;
  `);

  const dir = path.join(__dirname, '..', 'db', 'migrations');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();

  const [applied] = await conn.query('SELECT name FROM _migrations');
  const appliedSet = new Set(applied.map((r) => r.name));

  for (const file of files) {
    if (appliedSet.has(file)) {
      console.log(`· skip  ${file}`);
      continue;
    }
    console.log(`→ apply ${file}`);
    const sql = fs.readFileSync(path.join(dir, file), 'utf8');
    await conn.query(sql);
    await conn.query('INSERT INTO _migrations (name) VALUES (?)', [file]);
  }

  await conn.end();
  console.log('done.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
