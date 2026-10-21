const path = require('node:path');

const connectionString = process.env.DATABASE_URL;
let sqlite;
let pool;

const sqliteSchema = `
CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  unit_price REAL NOT NULL DEFAULT 0,
  quantity INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS customers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  street TEXT, number TEXT, neighborhood TEXT, city TEXT, zip TEXT,
  cpf TEXT, cnpj TEXT, email TEXT, phone TEXT,
  stage TEXT NOT NULL DEFAULT 'conversando'
);
CREATE TABLE IF NOT EXISTS sales (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  total REAL NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE TABLE IF NOT EXISTS sale_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sale_id INTEGER NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  unit_price REAL NOT NULL,
  quantity INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS suppliers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  link TEXT, phone TEXT, notes TEXT
);
CREATE TABLE IF NOT EXISTS supplier_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  supplier_id INTEGER NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  item TEXT NOT NULL,
  platform TEXT,
  link TEXT
);
`;

const pgSchema = [
  `CREATE TABLE IF NOT EXISTS products (id SERIAL PRIMARY KEY, name TEXT NOT NULL, unit_price DOUBLE PRECISION NOT NULL DEFAULT 0, quantity INTEGER NOT NULL DEFAULT 0)`,
  `CREATE TABLE IF NOT EXISTS customers (id SERIAL PRIMARY KEY, name TEXT NOT NULL, street TEXT, number TEXT, neighborhood TEXT, city TEXT, zip TEXT, cpf TEXT, cnpj TEXT, email TEXT, phone TEXT, stage TEXT NOT NULL DEFAULT 'conversando')`,
  `CREATE TABLE IF NOT EXISTS sales (id SERIAL PRIMARY KEY, customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE, total DOUBLE PRECISION NOT NULL, created_at TIMESTAMP NOT NULL DEFAULT LOCALTIMESTAMP)`,
  `CREATE TABLE IF NOT EXISTS sale_items (id SERIAL PRIMARY KEY, sale_id INTEGER NOT NULL REFERENCES sales(id) ON DELETE CASCADE, product_id INTEGER REFERENCES products(id) ON DELETE SET NULL, product_name TEXT NOT NULL, unit_price DOUBLE PRECISION NOT NULL, quantity INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS suppliers (id SERIAL PRIMARY KEY, name TEXT NOT NULL, link TEXT, phone TEXT, notes TEXT)`,
  `CREATE TABLE IF NOT EXISTS supplier_items (id SERIAL PRIMARY KEY, supplier_id INTEGER NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE, item TEXT NOT NULL, platform TEXT, link TEXT)`,
];

const ready = connectionString
  ? (async () => {
      const { Pool } = require('pg');
      pool = new Pool({ connectionString, max: 3, idleTimeoutMillis: 10000, connectionTimeoutMillis: 10000 });
      for (const statement of pgSchema) await pool.query(statement);
    })()
  : (() => {
      if (process.env.VERCEL) {
        throw new Error('DATABASE_URL ausente: conecte um PostgreSQL persistente para habilitar a API na Vercel.');
      }
      const { DatabaseSync } = require('node:sqlite');
      const dbPath = process.env.SQLITE_PATH || path.join(__dirname, '..', 'vendas.db');
      sqlite = new DatabaseSync(dbPath);
      sqlite.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
      sqlite.exec(sqliteSchema);
      return Promise.resolve();
    })();

function postgresPlaceholders(statement) {
  let index = 0;
  return statement.replace(/\?/g, () => `$${++index}`);
}

async function query(statement, params = [], client) {
  await ready;
  if (connectionString) return (client || pool).query(postgresPlaceholders(statement), params);

  const prepared = sqlite.prepare(statement);
  if (/\bRETURNING\b/i.test(statement) || /^\s*(SELECT|PRAGMA|WITH)\b/i.test(statement)) {
    const rows = prepared.all(...params);
    return { rows, rowCount: rows.length };
  }
  const info = prepared.run(...params);
  return { rows: [], rowCount: Number(info.changes), lastInsertRowid: info.lastInsertRowid };
}

async function transaction(callback) {
  await ready;
  if (connectionString) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await callback((statement, params = []) => query(statement, params, client));
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  sqlite.exec('BEGIN');
  try {
    const result = await callback((statement, params = []) => query(statement, params));
    sqlite.exec('COMMIT');
    return result;
  } catch (error) {
    sqlite.exec('ROLLBACK');
    throw error;
  }
}

async function close() {
  if (connectionString && pool) await pool.end();
  if (sqlite) sqlite.close();
}

module.exports = { query, transaction, ready, close };
