require('dotenv').config({ path: require('node:path').join(__dirname, '..', '.env') });

const express = require('express');
const cors = require('cors');
const crypto = require('node:crypto');
const nodemailer = require('nodemailer');
const db = require('./db');

const app = express();
// Public Vercel rewrite mounts this service below /api. Strip the prefix so
// the same Express routes continue to work when running locally.
app.use((req, res, next) => {
  req.url = req.url.replace(/^\/api(?=\/|$)/, '') || '/';
  next();
});
app.use(cors());
app.use(express.json());
app.get('/health', (req, res) => {
  db.prepare('SELECT 1').get();
  res.json({ ok: true });
});

// Credenciais únicas conforme solicitado; podem ser configuradas no ambiente.
const LOGIN_USER = process.env.LOGIN_USER || 'dani';
const LOGIN_PASSWORD = process.env.LOGIN_PASSWORD || 'fdtop';
const AUTH_TOKEN_SECRET = process.env.AUTH_TOKEN_SECRET || LOGIN_PASSWORD;
const TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;
function createAuthToken(username) {
  const payload = Buffer.from(JSON.stringify({
    sub: username,
    exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS,
  })).toString('base64url');
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
  } catch {
    return false;
  }
}
app.post('/auth/login', (req, res) => {
  if (req.body?.username !== LOGIN_USER || req.body?.password !== LOGIN_PASSWORD) {
    return res.status(401).json({ error: 'Usuário ou senha inválidos' });
  }
  const token = createAuthToken(LOGIN_USER);
  res.json({ token, username: LOGIN_USER });
});
app.use((req, res, next) => {
  if (req.path === '/auth/login') return next();
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  if (!isValidAuthToken(token)) return res.status(401).json({ error: 'Faça login para continuar' });
  next();
});
app.post('/auth/logout', (req, res) => {
  res.status(204).end();
});

const STAGES = ['conversando', 'andamento', 'finalizado'];
const fail = (status, msg) => Object.assign(new Error(msg), { status });
const wrap = (fn) => (req, res) => {
  try { fn(req, res); }
  catch (e) { if (!e.status) console.error(e); res.status(e.status || 500).json({ error: e.message }); }
};
const text = (v) => (v === undefined || v === null || String(v).trim() === '' ? null : String(v).trim());

// CRUD genérico: cada recurso informa os campos e como limpar o corpo da requisição
function crud(route, table, fields, clean, order = 'id DESC') {
  const get = (id) => db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(id);
  app.get(route, wrap((req, res) => res.json(db.prepare(`SELECT * FROM ${table} ORDER BY ${order}`).all())));
  app.get(`${route}/:id`, wrap((req, res) => {
    const row = get(req.params.id);
    if (!row) throw fail(404, 'Não encontrado');
    res.json(row);
  }));
  app.post(route, wrap((req, res) => {
    const data = clean(req.body);
    const info = db.prepare(`INSERT INTO ${table} (${fields.join(',')}) VALUES (${fields.map((f) => '@' + f).join(',')})`).run(data);
    res.status(201).json(get(info.lastInsertRowid));
  }));
  app.put(`${route}/:id`, wrap((req, res) => {
    const current = get(req.params.id);
    if (!current) throw fail(404, 'Não encontrado');
    const data = clean({ ...current, ...req.body });
    db.prepare(`UPDATE ${table} SET ${fields.map((f) => `${f}=@${f}`).join(',')} WHERE id=@id`).run({ ...data, id: current.id });
    res.json(get(current.id));
  }));
  app.delete(`${route}/:id`, wrap((req, res) => {
    db.prepare(`DELETE FROM ${table} WHERE id = ?`).run(req.params.id);
    res.status(204).end();
  }));
}

// ---------- Produtos ----------
crud('/products', 'products', ['name', 'unit_price', 'quantity'], (b) => {
  const name = text(b.name);
  const unit_price = Number(b.unit_price);
  const quantity = parseInt(b.quantity, 10);
  if (!name) throw fail(400, 'Informe o nome do produto');
  if (!(unit_price >= 0)) throw fail(400, 'Valor unitário inválido');
  if (!(quantity >= 0)) throw fail(400, 'Quantidade inválida');
  return { name, unit_price, quantity };
}, 'name COLLATE NOCASE');

// ---------- Clientes ----------
const CUSTOMER_FIELDS = ['name', 'street', 'number', 'neighborhood', 'city', 'zip', 'cpf', 'cnpj', 'email', 'phone', 'stage'];
crud('/customers', 'customers', CUSTOMER_FIELDS, (b) => {
  const name = text(b.name);
  if (!name) throw fail(400, 'Informe o nome do cliente');
  const stage = STAGES.includes(b.stage) ? b.stage : 'conversando';
  const out = { stage };
  for (const f of CUSTOMER_FIELDS) if (f !== 'stage') out[f] = text(b[f]);
  return out;
}, 'name COLLATE NOCASE');

app.patch('/customers/:id/stage', wrap((req, res) => {
  if (!STAGES.includes(req.body.stage)) throw fail(400, 'Etapa inválida');
  db.prepare('UPDATE customers SET stage = ? WHERE id = ?').run(req.body.stage, req.params.id);
  res.json(db.prepare('SELECT * FROM customers WHERE id = ?').get(req.params.id));
}));

// ---------- Vendas ----------
const itemsOf = db.prepare('SELECT * FROM sale_items WHERE sale_id = ?');
const withItems = (sale) => ({ ...sale, items: itemsOf.all(sale.id) });

app.get('/customers/:id/sales', wrap((req, res) => {
  const sales = db.prepare('SELECT * FROM sales WHERE customer_id = ? ORDER BY id DESC').all(req.params.id);
  res.json(sales.map(withItems));
}));

app.get('/sales', wrap((req, res) => {
  const sales = db.prepare(`SELECT s.*, c.name AS customer_name, c.email AS customer_email, c.phone AS customer_phone FROM sales s JOIN customers c ON c.id = s.customer_id ORDER BY s.id DESC LIMIT 100`).all();
  res.json(sales.map(withItems));
}));

app.post('/sales/:id/email-quote', async (req, res) => {
  try {
    const sale = db.prepare(`SELECT s.*, c.name AS customer_name, c.email AS customer_email FROM sales s JOIN customers c ON c.id = s.customer_id WHERE s.id = ?`).get(req.params.id);
    if (!sale) return res.status(404).json({ error: 'Venda não encontrada' });

    const to = String(req.body?.to || sale.customer_email || '').trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return res.status(400).json({ error: 'Informe um e-mail válido para o destinatário' });

    const { SMTP_HOST, SMTP_PORT = '587', SMTP_USER, SMTP_PASS, SMTP_FROM } = process.env;
    if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
      return res.status(503).json({ error: 'Configure SMTP_HOST, SMTP_USER e SMTP_PASS na API para enviar e-mails' });
    }
    if (/seu-provedor|example|placeholder/i.test(SMTP_HOST)) {
      return res.status(503).json({ error: 'SMTP_HOST ainda está com o valor de exemplo. Substitua pelo servidor SMTP real do seu provedor e reinicie a API.' });
    }

    const port = Number(SMTP_PORT);
    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port,
      secure: process.env.SMTP_SECURE === 'true' || port === 465,
      connectionTimeout: 15000,
      greetingTimeout: 10000,
      socketTimeout: 20000,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });
    const items = itemsOf.all(sale.id);
    const currency = (value) => Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const lines = items.map((item) => `${item.quantity} x ${item.product_name} — ${currency(item.unit_price)} cada — ${currency(item.quantity * item.unit_price)}`);
    const note = String(req.body?.message || '').trim().slice(0, 2000);
    const textBody = [
      `Olá, ${sale.customer_name}!`,
      '',
      `Segue o orçamento referente à venda #${sale.id}:`,
      '',
      ...lines,
      '',
      `Total: ${currency(sale.total)}`,
      ...(note ? ['', note] : []),
      '',
      'Estamos à disposição para esclarecer qualquer dúvida.',
    ].join('\n');

    await transporter.sendMail({
      from: SMTP_FROM || SMTP_USER,
      to,
      subject: `Orçamento da venda #${sale.id}`,
      text: textBody,
    });
    res.json({ ok: true, to });
  } catch (error) {
    console.error('Falha ao enviar orçamento por e-mail:', error);
    res.status(502).json({ error: 'Não foi possível enviar o e-mail. Verifique as configurações SMTP da API.' });
  }
});

// Registra a venda, grava o preço praticado e baixa o estoque (tudo ou nada)
const createSale = db.transaction((customerId, items) => {
  const customer = db.prepare('SELECT id FROM customers WHERE id = ?').get(customerId);
  if (!customer) throw fail(400, 'Cliente não encontrado');
  if (!Array.isArray(items) || items.length === 0) throw fail(400, 'Adicione ao menos um produto');
  let total = 0;
  const lines = items.map((it) => {
    const p = db.prepare('SELECT * FROM products WHERE id = ?').get(it.product_id);
    const qty = parseInt(it.quantity, 10);
    if (!p) throw fail(400, 'Produto não encontrado');
    if (!(qty > 0)) throw fail(400, `Quantidade inválida para ${p.name}`);
    if (p.quantity < qty) throw fail(400, `Estoque insuficiente de ${p.name} (restam ${p.quantity})`);
    const unit_price = it.unit_price !== undefined && it.unit_price !== '' ? Number(it.unit_price) : p.unit_price;
    total += unit_price * qty;
    return { p, qty, unit_price };
  });
  const sale = db.prepare('INSERT INTO sales (customer_id, total) VALUES (?, ?)').run(customerId, total);
  for (const l of lines) {
    db.prepare('INSERT INTO sale_items (sale_id, product_id, product_name, unit_price, quantity) VALUES (?,?,?,?,?)')
      .run(sale.lastInsertRowid, l.p.id, l.p.name, l.unit_price, l.qty);
    db.prepare('UPDATE products SET quantity = quantity - ? WHERE id = ?').run(l.qty, l.p.id);
  }
  return db.prepare('SELECT * FROM sales WHERE id = ?').get(sale.lastInsertRowid);
});

app.post('/sales', wrap((req, res) => {
  res.status(201).json(withItems(createSale(req.body.customer_id, req.body.items)));
}));

// ---------- Fornecedores ----------
app.get('/suppliers', wrap((req, res) => {
  const list = db.prepare('SELECT * FROM suppliers ORDER BY name COLLATE NOCASE').all();
  const items = db.prepare('SELECT * FROM supplier_items ORDER BY item COLLATE NOCASE');
  const all = items.all();
  res.json(list.map((s) => ({ ...s, items: all.filter((i) => i.supplier_id === s.id) })));
}));

app.post('/suppliers', wrap((req, res) => {
  const name = text(req.body.name);
  if (!name) throw fail(400, 'Informe o nome do fornecedor');
  const info = db.prepare('INSERT INTO suppliers (name, link, phone, notes) VALUES (?,?,?,?)')
    .run(name, text(req.body.link), text(req.body.phone), text(req.body.notes));
  res.status(201).json({ id: info.lastInsertRowid, name, items: [] });
}));

app.put('/suppliers/:id', wrap((req, res) => {
  const name = text(req.body.name);
  if (!name) throw fail(400, 'Informe o nome do fornecedor');
  db.prepare('UPDATE suppliers SET name=?, link=?, phone=?, notes=? WHERE id=?')
    .run(name, text(req.body.link), text(req.body.phone), text(req.body.notes), req.params.id);
  res.json({ ok: true });
}));

app.delete('/suppliers/:id', wrap((req, res) => {
  db.prepare('DELETE FROM suppliers WHERE id = ?').run(req.params.id);
  res.status(204).end();
}));

app.post('/suppliers/:id/items', wrap((req, res) => {
  const item = text(req.body.item);
  if (!item) throw fail(400, 'Informe o que o fornecedor vende');
  const info = db.prepare('INSERT INTO supplier_items (supplier_id, item, platform, link) VALUES (?,?,?,?)')
    .run(req.params.id, item, text(req.body.platform), text(req.body.link));
  res.status(201).json(db.prepare('SELECT * FROM supplier_items WHERE id = ?').get(info.lastInsertRowid));
}));

app.delete('/supplier-items/:id', wrap((req, res) => {
  db.prepare('DELETE FROM supplier_items WHERE id = ?').run(req.params.id);
  res.status(204).end();
}));

const PORT = process.env.PORT || 3333;
if (!process.env.VERCEL) {
  app.listen(PORT, () => console.log(`API rodando em http://localhost:${PORT}`));
}

module.exports = app;
