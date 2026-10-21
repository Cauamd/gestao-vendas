require('dotenv').config({ path: require('node:path').join(__dirname, '..', '.env') });

const express = require('express');
const cors = require('cors');
const crypto = require('node:crypto');
const nodemailer = require('nodemailer');
const db = require('./db');

const app = express();
app.use((req, res, next) => {
  req.url = req.url.replace(/^\/api(?=\/|$)/, '') || '/';
  next();
});
app.use(cors());
app.use(express.json());
app.get('/health', async (req, res, next) => {
  try {
    await db.query('SELECT 1');
    res.json({ ok: true, database: process.env.DATABASE_URL || process.env.POSTGRES_URL ? 'postgres' : 'sqlite-local' });
  } catch (error) { next(error); }
});

const LOGIN_USER = process.env.LOGIN_USER || 'dani';
const LOGIN_PASSWORD = process.env.LOGIN_PASSWORD || 'fdtop';
const AUTH_TOKEN_SECRET = process.env.AUTH_TOKEN_SECRET || LOGIN_PASSWORD;
const TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;
function createAuthToken(username) {
  const payload = Buffer.from(JSON.stringify({ sub: username, exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS })).toString('base64url');
  const signature = crypto.createHmac('sha256', AUTH_TOKEN_SECRET).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}
function isValidAuthToken(token) {
  if (!token) return false;
  const [payload, signature, extra] = token.split('.');
  if (!payload || !signature || extra) return false;
  const expected = crypto.createHmac('sha256', AUTH_TOKEN_SECRET).update(payload).digest();
  const received = Buffer.from(signature, 'base64url');
  if (received.length !== expected.length || !crypto.timingSafeEqual(received, expected)) return false;
  try {
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return claims.sub === LOGIN_USER && Number(claims.exp) > Math.floor(Date.now() / 1000);
  } catch { return false; }
}
app.post('/auth/login', (req, res) => {
  if (req.body?.username !== LOGIN_USER || req.body?.password !== LOGIN_PASSWORD) {
    return res.status(401).json({ error: 'Usuário ou senha inválidos' });
  }
  res.json({ token: createAuthToken(LOGIN_USER), username: LOGIN_USER });
});
app.use((req, res, next) => {
  if (req.path === '/auth/login') return next();
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  if (!isValidAuthToken(token)) return res.status(401).json({ error: 'Faça login para continuar' });
  next();
});
app.post('/auth/logout', (req, res) => res.status(204).end());

const fail = (status, message) => Object.assign(new Error(message), { status });
const wrap = (fn) => async (req, res) => {
  try { await fn(req, res); }
  catch (error) {
    if (!error.status) console.error(error);
    res.status(error.status || 500).json({ error: error.status ? error.message : 'Erro interno da API' });
  }
};
const text = (value) => (value === undefined || value === null || String(value).trim() === '' ? null : String(value).trim());
const one = async (sql, params = [], query = db.query) => (await query(sql, params)).rows[0];
const many = async (sql, params = [], query = db.query) => (await query(sql, params)).rows;

function crud(route, table, fields, clean, order = 'id DESC') {
  app.get(route, wrap(async (req, res) => res.json(await many(`SELECT * FROM ${table} ORDER BY ${order}`))));
  app.get(`${route}/:id`, wrap(async (req, res) => {
    const row = await one(`SELECT * FROM ${table} WHERE id = ?`, [req.params.id]);
    if (!row) throw fail(404, 'Registro não encontrado');
    res.json(row);
  }));
  app.post(route, wrap(async (req, res) => {
    const data = clean(req.body);
    const result = await db.query(`INSERT INTO ${table} (${fields.join(',')}) VALUES (${fields.map(() => '?').join(',')}) RETURNING *`, fields.map((field) => data[field]));
    res.status(201).json(result.rows[0]);
  }));
  app.put(`${route}/:id`, wrap(async (req, res) => {
    const current = await one(`SELECT * FROM ${table} WHERE id = ?`, [req.params.id]);
    if (!current) throw fail(404, 'Registro não encontrado');
    const data = clean({ ...current, ...req.body });
    const result = await db.query(`UPDATE ${table} SET ${fields.map((field) => `${field}=?`).join(',')} WHERE id=? RETURNING *`, [...fields.map((field) => data[field]), current.id]);
    res.json(result.rows[0]);
  }));
  app.delete(`${route}/:id`, wrap(async (req, res) => {
    await db.query(`DELETE FROM ${table} WHERE id = ?`, [req.params.id]);
    res.status(204).end();
  }));
}

crud('/products', 'products', ['name', 'unit_price', 'quantity'], (body) => {
  const name = text(body.name);
  const unit_price = Number(body.unit_price);
  const quantity = parseInt(body.quantity, 10);
  if (!name) throw fail(400, 'Informe o nome do produto');
  if (!(unit_price >= 0)) throw fail(400, 'Valor unitário inválido');
  if (!(quantity >= 0)) throw fail(400, 'Quantidade inválida');
  return { name, unit_price, quantity };
}, 'LOWER(name)');

const STAGES = ['conversando', 'andamento', 'finalizado'];
const CUSTOMER_FIELDS = ['name', 'street', 'number', 'neighborhood', 'city', 'zip', 'cpf', 'cnpj', 'email', 'phone', 'stage'];
crud('/customers', 'customers', CUSTOMER_FIELDS, (body) => {
  const name = text(body.name);
  if (!name) throw fail(400, 'Informe o nome do cliente');
  const result = { stage: STAGES.includes(body.stage) ? body.stage : 'conversando' };
  for (const field of CUSTOMER_FIELDS) if (field !== 'stage') result[field] = text(body[field]);
  return { name, ...result };
}, 'LOWER(name)');

app.patch('/customers/:id/stage', wrap(async (req, res) => {
  if (!STAGES.includes(req.body.stage)) throw fail(400, 'Etapa inválida');
  const row = await one('UPDATE customers SET stage = ? WHERE id = ? RETURNING *', [req.body.stage, req.params.id]);
  if (!row) throw fail(404, 'Cliente não encontrado');
  res.json(row);
}));

const withItems = async (sale, query = db.query) => ({ ...sale, items: await many('SELECT * FROM sale_items WHERE sale_id = ?', [sale.id], query) });
app.get('/customers/:id/sales', wrap(async (req, res) => {
  const sales = await many('SELECT * FROM sales WHERE customer_id = ? ORDER BY id DESC', [req.params.id]);
  res.json(await Promise.all(sales.map((sale) => withItems(sale))));
}));
app.get('/sales', wrap(async (req, res) => {
  const sales = await many('SELECT s.*, c.name AS customer_name, c.email AS customer_email, c.phone AS customer_phone FROM sales s JOIN customers c ON c.id = s.customer_id ORDER BY s.id DESC LIMIT 100');
  res.json(await Promise.all(sales.map((sale) => withItems(sale))));
}));

app.post('/sales/:id/email-quote', async (req, res) => {
  try {
    const sale = await one('SELECT s.*, c.name AS customer_name, c.email AS customer_email FROM sales s JOIN customers c ON c.id = s.customer_id WHERE s.id = ?', [req.params.id]);
    if (!sale) return res.status(404).json({ error: 'Venda não encontrada' });
    const to = String(req.body?.to || sale.customer_email || '').trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return res.status(400).json({ error: 'Informe um e-mail válido para o destinatário' });
    const { SMTP_HOST, SMTP_PORT = '587', SMTP_USER, SMTP_PASS, SMTP_FROM } = process.env;
    if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return res.status(503).json({ error: 'Configure o SMTP na API para enviar e-mails' });
    const port = Number(SMTP_PORT);
    const transporter = nodemailer.createTransport({ host: SMTP_HOST, port, secure: process.env.SMTP_SECURE === 'true' || port === 465, auth: { user: SMTP_USER, pass: SMTP_PASS } });
    const items = await many('SELECT * FROM sale_items WHERE sale_id = ?', [sale.id]);
    const currency = (value) => Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const lines = items.map((item) => `${item.quantity} x ${item.product_name} — ${currency(item.unit_price)} cada — ${currency(item.quantity * item.unit_price)}`);
    const note = String(req.body?.message || '').trim().slice(0, 2000);
    await transporter.sendMail({
      from: SMTP_FROM || SMTP_USER,
      to,
      subject: `Orçamento da venda #${sale.id}`,
      text: [`Olá, ${sale.customer_name}!`, '', `Segue o orçamento referente à venda #${sale.id}:`, '', ...lines, '', `Total: ${currency(sale.total)}`, ...(note ? ['', note] : []), '', 'Estamos à disposição para esclarecer qualquer dúvida.'].join('\n'),
    });
    res.json({ ok: true, to });
  } catch (error) {
    console.error('Falha ao enviar orçamento por e-mail:', error);
    res.status(502).json({ error: 'Não foi possível enviar o e-mail. Verifique as configurações SMTP da API.' });
  }
});

app.post('/sales', wrap(async (req, res) => {
  const { customer_id, items } = req.body;
  if (!Array.isArray(items) || items.length === 0) throw fail(400, 'Adicione ao menos um produto');
  const sale = await db.transaction(async (query) => {
    if (!(await one('SELECT id FROM customers WHERE id = ?', [customer_id], query))) throw fail(400, 'Cliente não encontrado');
    let total = 0;
    const lines = [];
    for (const item of items) {
      const product = await one('SELECT * FROM products WHERE id = ?', [item.product_id], query);
      const quantity = parseInt(item.quantity, 10);
      if (!product) throw fail(400, 'Produto não encontrado');
      if (!(quantity > 0)) throw fail(400, `Quantidade inválida para ${product.name}`);
      if (product.quantity < quantity) throw fail(400, `Estoque insuficiente de ${product.name} (restam ${product.quantity})`);
      const unitPrice = item.unit_price !== undefined && item.unit_price !== '' ? Number(item.unit_price) : product.unit_price;
      if (!(unitPrice >= 0)) throw fail(400, `Preço inválido para ${product.name}`);
      total += unitPrice * quantity;
      lines.push({ product, quantity, unitPrice });
    }
    const created = await one('INSERT INTO sales (customer_id, total) VALUES (?, ?) RETURNING *', [customer_id, total], query);
    for (const line of lines) {
      await query('INSERT INTO sale_items (sale_id, product_id, product_name, unit_price, quantity) VALUES (?,?,?,?,?)', [created.id, line.product.id, line.product.name, line.unitPrice, line.quantity]);
      await query('UPDATE products SET quantity = quantity - ? WHERE id = ?', [line.quantity, line.product.id]);
    }
    return created;
  });
  res.status(201).json(await withItems(sale));
}));

app.get('/suppliers', wrap(async (req, res) => {
  const [suppliers, items] = await Promise.all([
    many('SELECT * FROM suppliers ORDER BY LOWER(name)'),
    many('SELECT * FROM supplier_items ORDER BY LOWER(item)'),
  ]);
  res.json(suppliers.map((supplier) => ({ ...supplier, items: items.filter((item) => item.supplier_id === supplier.id) })));
}));
app.post('/suppliers', wrap(async (req, res) => {
  const name = text(req.body.name);
  if (!name) throw fail(400, 'Informe o nome do fornecedor');
  const supplier = await one('INSERT INTO suppliers (name, link, phone, notes) VALUES (?,?,?,?) RETURNING *', [name, text(req.body.link), text(req.body.phone), text(req.body.notes)]);
  res.status(201).json({ ...supplier, items: [] });
}));
app.put('/suppliers/:id', wrap(async (req, res) => {
  const name = text(req.body.name);
  if (!name) throw fail(400, 'Informe o nome do fornecedor');
  const supplier = await one('UPDATE suppliers SET name=?, link=?, phone=?, notes=? WHERE id=? RETURNING *', [name, text(req.body.link), text(req.body.phone), text(req.body.notes), req.params.id]);
  if (!supplier) throw fail(404, 'Fornecedor não encontrado');
  res.json({ ok: true });
}));
app.delete('/suppliers/:id', wrap(async (req, res) => {
  await db.query('DELETE FROM suppliers WHERE id = ?', [req.params.id]);
  res.status(204).end();
}));
app.post('/suppliers/:id/items', wrap(async (req, res) => {
  const item = text(req.body.item);
  if (!item) throw fail(400, 'Informe o que o fornecedor vende');
  const created = await one('INSERT INTO supplier_items (supplier_id, item, platform, link) VALUES (?,?,?,?) RETURNING *', [req.params.id, item, text(req.body.platform), text(req.body.link)]);
  res.status(201).json(created);
}));
app.delete('/supplier-items/:id', wrap(async (req, res) => {
  await db.query('DELETE FROM supplier_items WHERE id = ?', [req.params.id]);
  res.status(204).end();
}));

app.use((error, req, res, next) => {
  console.error('API request failed:', error);
  res.status(500).json({ error: 'Falha ao acessar a API ou o banco de dados.' });
});

const PORT = process.env.PORT || 3333;
if (!process.env.VERCEL) app.listen(PORT, () => console.log(`API rodando em http://localhost:${PORT}`));
module.exports = app;
