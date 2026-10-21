require('dotenv').config({ path: require('node:path').join(__dirname, '..', '.env') });

const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const db = require('./db');

async function main() {
  if (!process.env.DATABASE_URL && !process.env.POSTGRES_URL) throw new Error('Defina DATABASE_URL ou POSTGRES_URL antes de migrar.');
  const sourcePath = process.env.SQLITE_SOURCE || path.join(__dirname, '..', 'vendas.db');
  const source = new DatabaseSync(sourcePath, { readOnly: true });
  const tables = ['products', 'customers', 'suppliers', 'sales', 'sale_items', 'supplier_items'];

  try {
    await db.ready;
    await db.transaction(async (query) => {
      for (const table of tables) {
        const columns = source.prepare(`PRAGMA table_info(${table})`).all().map((column) => column.name);
        const rows = source.prepare(`SELECT * FROM ${table}`).all();
        for (const row of rows) {
          const values = columns.map((column) => row[column]);
          const placeholders = columns.map(() => '?').join(',');
          await query(`INSERT INTO ${table} (${columns.join(',')}) VALUES (${placeholders}) ON CONFLICT (id) DO NOTHING`, values);
        }
        await query(`SELECT setval(pg_get_serial_sequence('${table}', 'id'), COALESCE(MAX(id), 1), MAX(id) IS NOT NULL) FROM ${table}`);
        console.log(`${table}: ${rows.length} registros encontrados`);
      }
    });
    console.log('Migração concluída.');
  } finally {
    source.close();
    await db.close();
  }
}

main().catch((error) => {
  console.error('Migração falhou:', error.message);
  process.exitCode = 1;
});
