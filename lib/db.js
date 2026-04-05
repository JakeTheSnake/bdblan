// Kysely instance backed by a mysql2 pool, used purely as a JS query builder.
// No ORM, no codegen — just composable SQL.
import { Kysely, MysqlDialect } from 'kysely';
import { createPool } from 'mysql2';

let _db = null;

/** @returns {import('kysely').Kysely<any>} */
export function getDb() {
  if (_db) return _db;

  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set');

  const pool = createPool({
    uri: url,
    connectionLimit: 10,
    waitForConnections: true,
    decimalNumbers: true,
  });

  _db = new Kysely({
    dialect: new MysqlDialect({ pool }),
  });

  return _db;
}
