// SQLite embutido no Node (22.13+). Não precisa instalar nada nativo.
const { DatabaseSync } = require('node:sqlite');
const path = require('path');

const db = new DatabaseSync(path.join(__dirname, '..', 'vendas.db'));
db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');

// Executa a função dentro de uma transação: ou grava tudo, ou nada
db.transaction = (fn) => (...args) => {
  db.exec('BEGIN');
  try {
    const result = fn(...args);
    db.exec('COMMIT');
    return result;
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
};

db.exec(`
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
`);
module.exports = db;
