require('dotenv').config({ path: require('node:path').join(__dirname, '..', '.env') });

const express = require('express');
const cors = require('cors');
const crypto = require('node:crypto');
const nodemailer = require('nodemailer');
const db = require('./db');

const app = express();
app.use((req, res, next) => {
  req.url = req.url.replace(/^\/api(?=\/|$)/, '') || '/';
  if (req._parsedUrl) {
    delete req._parsedUrl;
  }
  next();
});
app.use(cors());
app.use(express.json());

app.get(['/health', '/api/health'], async (req, res, next) => {
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

app.post(['/auth/login', '/api/auth/login'], (req, res) => {
  if (req.body?.username !== LOGIN_USER || req.body?.password !== LOGIN_PASSWORD) {
    return res.status(401).json({ error: 'Usuário ou senha inválidos' });
  }
  res.json({ token: createAuthToken(LOGIN_USER), username: LOGIN_USER });
});

app.use((req, res, next) => {
  const p = req.path.replace(/^\/api(?=\/|$)/, '') || '/';
  if (p === '/auth/login' || p === '/health') return next();
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  if (!isValidAuthToken(token)) return res.status(401).json({ error: 'Faça login para continuar' });
  next();
});

app.post(['/auth/logout', '/api/auth/logout'], (req, res) => res.status(204).end());

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

// ---------------- PRODUTOS ----------------
crud('/products', 'products', ['name', 'cost_price', 'unit_price', 'profit_margin', 'quantity'], (body) => {
  const name = text(body.name);
  const cost_price = Number(body.cost_price ?? 0);
  const unit_price = Number(body.unit_price ?? 0);
  const profit_margin = Number((unit_price - cost_price).toFixed(2));
  const quantity = parseInt(body.quantity, 10);
  if (!name) throw fail(400, 'Informe o nome do produto');
  if (!(cost_price >= 0)) throw fail(400, 'Valor de custo inválido');
  if (!(unit_price >= 0)) throw fail(400, 'Valor unitário de venda inválido');
  if (!(quantity >= 0)) throw fail(400, 'Quantidade inválida');
  return { name, cost_price, unit_price, profit_margin, quantity };
}, 'LOWER(name)');

// ---------------- CLIENTES ----------------
const STAGES = ['conversando', 'andamento', 'finalizado'];
const CUSTOMER_FIELDS = ['name', 'street', 'number', 'neighborhood', 'city', 'zip', 'cpf', 'cnpj', 'email', 'phone', 'stage', 'position', 'contact_person', 'notes'];
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

app.get('/customers/:id/interactions', wrap(async (req, res) => {
  const rows = await many('SELECT * FROM customer_interactions WHERE customer_id = ? ORDER BY id DESC', [req.params.id]);
  res.json(rows);
}));

app.post('/customers/:id/interactions', wrap(async (req, res) => {
  const message = text(req.body.message);
  if (!message) throw fail(400, 'Informe a mensagem ou observação');
  const customer = await one('SELECT id FROM customers WHERE id = ?', [req.params.id]);
  if (!customer) throw fail(404, 'Cliente não encontrado');
  const created = await one('INSERT INTO customer_interactions (customer_id, message) VALUES (?, ?) RETURNING *', [req.params.id, message]);
  res.status(201).json(created);
}));

app.delete('/customer-interactions/:id', wrap(async (req, res) => {
  await db.query('DELETE FROM customer_interactions WHERE id = ?', [req.params.id]);
  res.status(204).end();
}));

// ---------------- FORNECEDORES ----------------
const SUPPLIER_FIELDS = ['name', 'link', 'phone', 'notes', 'payment_method', 'street', 'city', 'zip'];
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
  const supplier = await one(
    'INSERT INTO suppliers (name, link, phone, notes, payment_method, street, city, zip) VALUES (?,?,?,?,?,?,?,?) RETURNING *',
    [
      name,
      text(req.body.link),
      text(req.body.phone),
      text(req.body.notes),
      text(req.body.payment_method),
      text(req.body.street),
      text(req.body.city),
      text(req.body.zip),
    ]
  );
  res.status(201).json({ ...supplier, items: [] });
}));

app.put('/suppliers/:id', wrap(async (req, res) => {
  const name = text(req.body.name);
  if (!name) throw fail(400, 'Informe o nome do fornecedor');
  const supplier = await one(
    'UPDATE suppliers SET name=?, link=?, phone=?, notes=?, payment_method=?, street=?, city=?, zip=? WHERE id=? RETURNING *',
    [
      name,
      text(req.body.link),
      text(req.body.phone),
      text(req.body.notes),
      text(req.body.payment_method),
      text(req.body.street),
      text(req.body.city),
      text(req.body.zip),
      req.params.id,
    ]
  );
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

// ---------------- VENDAS ----------------
const withItems = async (sale, query = db.query) => ({ ...sale, items: await many('SELECT * FROM sale_items WHERE sale_id = ?', [sale.id], query) });

app.get('/customers/:id/sales', wrap(async (req, res) => {
  const sales = await many('SELECT * FROM sales WHERE customer_id = ? ORDER BY id DESC', [req.params.id]);
  res.json(await Promise.all(sales.map((sale) => withItems(sale))));
}));

app.get('/sales', wrap(async (req, res) => {
  const sales = await many('SELECT s.*, c.name AS customer_name, c.email AS customer_email, c.phone AS customer_phone FROM sales s JOIN customers c ON c.id = s.customer_id ORDER BY s.id DESC LIMIT 100');
  res.json(await Promise.all(sales.map((sale) => withItems(sale))));
}));

app.get('/sales/:id', wrap(async (req, res) => {
  const sale = await one('SELECT s.*, c.name AS customer_name, c.email AS customer_email, c.phone AS customer_phone FROM sales s JOIN customers c ON c.id = s.customer_id WHERE s.id = ?', [req.params.id]);
  if (!sale) throw fail(404, 'Venda não encontrada');
  res.json(await withItems(sale));
}));

app.post('/sales', wrap(async (req, res) => {
  const { customer_id, items, payment_method = 'Pix', installments = 1 } = req.body;
  if (!Array.isArray(items) || items.length === 0) throw fail(400, 'Adicione ao menos um produto');

  const parsedInstallments = payment_method === 'Cartão Crédito' ? Math.max(1, Math.min(12, parseInt(installments, 10) || 1)) : 1;

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
      const costPrice = Number(product.cost_price || 0);
      total += unitPrice * quantity;
      lines.push({ product, quantity, unitPrice, costPrice });
    }

    const created = await one(
      'INSERT INTO sales (customer_id, total, payment_method, installments) VALUES (?, ?, ?, ?) RETURNING *',
      [customer_id, total, payment_method, parsedInstallments],
      query
    );

    for (const line of lines) {
      await query(
        'INSERT INTO sale_items (sale_id, product_id, product_name, cost_price, unit_price, quantity) VALUES (?,?,?,?,?,?)',
        [created.id, line.product.id, line.product.name, line.costPrice, line.unitPrice, line.quantity]
      );
      await query('UPDATE products SET quantity = quantity - ? WHERE id = ?', [line.quantity, line.product.id]);
    }
    return created;
  });

  res.status(201).json(await withItems(sale));
}));

app.put('/sales/:id', wrap(async (req, res) => {
  const { customer_id, items, payment_method = 'Pix', installments = 1 } = req.body;
  if (!Array.isArray(items) || items.length === 0) throw fail(400, 'Adicione ao menos um produto');

  const parsedInstallments = payment_method === 'Cartão Crédito' ? Math.max(1, Math.min(12, parseInt(installments, 10) || 1)) : 1;

  const sale = await db.transaction(async (query) => {
    const existing = await one('SELECT * FROM sales WHERE id = ?', [req.params.id], query);
    if (!existing) throw fail(404, 'Venda não encontrada');

    if (!(await one('SELECT id FROM customers WHERE id = ?', [customer_id], query))) throw fail(400, 'Cliente não encontrado');

    // 1. Devolve estoque dos itens anteriores
    const oldItems = await many('SELECT * FROM sale_items WHERE sale_id = ?', [req.params.id], query);
    for (const oldItem of oldItems) {
      if (oldItem.product_id) {
        await query('UPDATE products SET quantity = quantity + ? WHERE id = ?', [oldItem.quantity, oldItem.product_id]);
      }
    }

    // 2. Valida novos itens com estoque atualizado
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
      const costPrice = Number(product.cost_price || 0);
      total += unitPrice * quantity;
      lines.push({ product, quantity, unitPrice, costPrice });
    }

    // 3. Atualiza registro principal da venda
    const updated = await one(
      'UPDATE sales SET customer_id = ?, total = ?, payment_method = ?, installments = ? WHERE id = ? RETURNING *',
      [customer_id, total, payment_method, parsedInstallments, req.params.id],
      query
    );

    // 4. Remove itens antigos e insere os novos
    await query('DELETE FROM sale_items WHERE sale_id = ?', [req.params.id]);
    for (const line of lines) {
      await query(
        'INSERT INTO sale_items (sale_id, product_id, product_name, cost_price, unit_price, quantity) VALUES (?,?,?,?,?,?)',
        [updated.id, line.product.id, line.product.name, line.costPrice, line.unitPrice, line.quantity]
      );
      await query('UPDATE products SET quantity = quantity - ? WHERE id = ?', [line.quantity, line.product.id]);
    }

    return updated;
  });

  res.json(await withItems(sale));
}));

app.delete('/sales/:id', wrap(async (req, res) => {
  await db.transaction(async (query) => {
    const sale = await one('SELECT * FROM sales WHERE id = ?', [req.params.id], query);
    if (!sale) throw fail(404, 'Venda não encontrada');
    const items = await many('SELECT * FROM sale_items WHERE sale_id = ?', [req.params.id], query);
    for (const item of items) {
      if (item.product_id) {
        await query('UPDATE products SET quantity = quantity + ? WHERE id = ?', [item.quantity, item.product_id]);
      }
    }
    await query('DELETE FROM sales WHERE id = ?', [req.params.id]);
  });
  res.status(204).end();
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
    const paymentInfo = sale.payment_method ? `Forma de pagamento: ${sale.payment_method}${sale.payment_method === 'Cartão Crédito' && sale.installments > 1 ? ` em ${sale.installments}x` : ''}` : '';
    await transporter.sendMail({
      from: SMTP_FROM || SMTP_USER,
      to,
      subject: `Orçamento da venda #${sale.id}`,
      text: [
        `Olá, ${sale.customer_name}!`,
        '',
        `Segue o orçamento referente à venda #${sale.id}:`,
        '',
        ...lines,
        '',
        `Total: ${currency(sale.total)}`,
        ...(paymentInfo ? [paymentInfo] : []),
        ...(note ? ['', note] : []),
        '',
        'Estamos à disposição para esclarecer qualquer dúvida.'
      ].join('\n'),
    });
    res.json({ ok: true, to });
  } catch (error) {
    console.error('Falha ao enviar orçamento por e-mail:', error);
    res.status(502).json({ error: 'Não foi possível enviar o e-mail. Verifique as configurações SMTP da API.' });
  }
});

// ---------------- COMPRAS ----------------
const PURCHASE_FIELDS = ['name', 'purchase_link', 'unit_price', 'total_price', 'quantity', 'product_id', 'product_name', 'payment_date', 'due_date', 'payment_status', 'payment_method', 'pix_key', 'card_info'];

crud('/purchases', 'purchases', PURCHASE_FIELDS, (body) => {
  const name = text(body.name);
  if (!name) throw fail(400, 'Informe o nome da compra');
  const unit_price = Number(body.unit_price ?? 0);
  const quantity = parseInt(body.quantity, 10) || 1;
  const total_price = body.total_price !== undefined && body.total_price !== '' ? Number(body.total_price) : unit_price * quantity;
  if (!(unit_price >= 0)) throw fail(400, 'Valor unitário inválido');
  if (!(quantity > 0)) throw fail(400, 'Quantidade inválida');

  return {
    name,
    purchase_link: text(body.purchase_link),
    unit_price,
    total_price,
    quantity,
    product_id: body.product_id ? Number(body.product_id) : null,
    product_name: text(body.product_name),
    payment_date: text(body.payment_date),
    due_date: text(body.due_date),
    payment_status: ['PAGO', 'A PAGAR'].includes(body.payment_status) ? body.payment_status : 'A PAGAR',
    payment_method: text(body.payment_method),
    pix_key: text(body.pix_key),
    card_info: text(body.card_info),
  };
}, 'id DESC');

// ---------------- RELATÓRIOS ----------------
app.get('/reports/sales', wrap(async (req, res) => {
  const { start_date, end_date, customer_id, product_id } = req.query;

  let sql = `
    SELECT 
      s.id AS sale_id,
      s.created_at,
      s.payment_method,
      s.installments,
      c.id AS customer_id,
      c.name AS customer_name,
      si.id AS item_id,
      si.product_id,
      si.product_name,
      si.quantity,
      si.unit_price,
      COALESCE(si.cost_price, p.cost_price, 0) AS unit_cost,
      (si.quantity * si.unit_price) AS total_revenue,
      (si.quantity * COALESCE(si.cost_price, p.cost_price, 0)) AS total_cost,
      ((si.quantity * si.unit_price) - (si.quantity * COALESCE(si.cost_price, p.cost_price, 0))) AS total_profit
    FROM sales s
    JOIN customers c ON c.id = s.customer_id
    JOIN sale_items si ON si.sale_id = s.id
    LEFT JOIN products p ON p.id = si.product_id
    WHERE 1=1
  `;
  const params = [];

  if (start_date) {
    sql += ' AND s.created_at >= ?';
    params.push(`${start_date} 00:00:00`);
  }
  if (end_date) {
    sql += ' AND s.created_at <= ?';
    params.push(`${end_date} 23:59:59`);
  }
  if (customer_id) {
    sql += ' AND s.customer_id = ?';
    params.push(customer_id);
  }
  if (product_id) {
    sql += ' AND (si.product_id = ? OR si.product_name LIKE ?)';
    params.push(product_id, `%${product_id}%`);
  }

  sql += ' ORDER BY s.id DESC, si.id ASC';

  const items = await many(sql, params);

  const summary = items.reduce(
    (acc, cur) => {
      acc.total_revenue += Number(cur.total_revenue || 0);
      acc.total_cost += Number(cur.total_cost || 0);
      acc.total_profit += Number(cur.total_profit || 0);
      acc.total_quantity += Number(cur.quantity || 0);
      return acc;
    },
    { total_revenue: 0, total_cost: 0, total_profit: 0, total_quantity: 0, total_items: items.length }
  );

  res.json({ items, summary });
}));

app.get('/reports/purchases', wrap(async (req, res) => {
  const { start_date, end_date, payment_status, payment_method, query } = req.query;

  let sql = 'SELECT * FROM purchases WHERE 1=1';
  const params = [];

  if (start_date) {
    sql += ' AND (COALESCE(payment_date, due_date, created_at) >= ?)';
    params.push(start_date);
  }
  if (end_date) {
    sql += ' AND (COALESCE(payment_date, due_date, created_at) <= ?)';
    params.push(`${end_date} 23:59:59`);
  }
  if (payment_status && payment_status !== 'TODOS') {
    sql += ' AND payment_status = ?';
    params.push(payment_status);
  }
  if (payment_method && payment_method !== 'TODOS') {
    sql += ' AND payment_method = ?';
    params.push(payment_method);
  }
  if (query) {
    sql += ' AND (name LIKE ? OR product_name LIKE ?)';
    params.push(`%${query}%`, `%${query}%`);
  }

  sql += ' ORDER BY id DESC';

  const items = await many(sql, params);

  const summary = items.reduce(
    (acc, cur) => {
      const total = Number(cur.total_price || 0);
      acc.total_amount += total;
      if (cur.payment_status === 'PAGO') acc.total_paid += total;
      if (cur.payment_status === 'A PAGAR') acc.total_pending += total;
      acc.total_quantity += Number(cur.quantity || 0);
      return acc;
    },
    { total_amount: 0, total_paid: 0, total_pending: 0, total_quantity: 0, total_records: items.length }
  );

  res.json({ items, summary });
}));

// ---------------- DASHBOARD ----------------
app.get('/dashboard', wrap(async (req, res) => {
  const now = new Date();
  const selectedYear = parseInt(req.query.year, 10) || now.getFullYear();
  const selectedMonth = parseInt(req.query.month, 10) || now.getMonth() + 1;

  const monthPadded = String(selectedMonth).padStart(2, '0');
  const monthStart = `${selectedYear}-${monthPadded}-01 00:00:00`;
  const nextMonthDate = new Date(selectedYear, selectedMonth, 0); // último dia do mês
  const monthEnd = `${selectedYear}-${monthPadded}-${String(nextMonthDate.getDate()).padStart(2, '0')} 23:59:59`;

  const yearStart = `${selectedYear}-01-01 00:00:00`;
  const yearEnd = `${selectedYear}-12-31 23:59:59`;

  // Total do mês
  const monthRow = await one(
    'SELECT COALESCE(SUM(total), 0) AS total, COUNT(*) AS count FROM sales WHERE created_at >= ? AND created_at <= ?',
    [monthStart, monthEnd]
  );

  // Total do ano
  const yearRow = await one(
    'SELECT COALESCE(SUM(total), 0) AS total, COUNT(*) AS count FROM sales WHERE created_at >= ? AND created_at <= ?',
    [yearStart, yearEnd]
  );

  // Vendas em cada mês do ano (1 a 12)
  const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  const monthlySales = [];

  for (let m = 1; m <= 12; m++) {
    const mPadded = String(m).padStart(2, '0');
    const mStart = `${selectedYear}-${mPadded}-01 00:00:00`;
    const lastDay = new Date(selectedYear, m, 0).getDate();
    const mEnd = `${selectedYear}-${mPadded}-${String(lastDay).padStart(2, '0')} 23:59:59`;

    const row = await one(
      'SELECT COALESCE(SUM(total), 0) AS total, COUNT(*) AS count FROM sales WHERE created_at >= ? AND created_at <= ?',
      [mStart, mEnd]
    );

    monthlySales.push({
      month: m,
      name: monthNames[m - 1],
      total: Number(row.total || 0),
      count: Number(row.count || 0),
    });
  }

  // Top 5 produtos mais vendidos (por quantidade)
  const topProductsYear = await many(
    `SELECT 
      si.product_name,
      SUM(si.quantity) AS total_quantity,
      SUM(si.quantity * si.unit_price) AS total_revenue
    FROM sale_items si
    JOIN sales s ON s.id = si.sale_id
    WHERE s.created_at >= ? AND s.created_at <= ?
    GROUP BY si.product_name
    ORDER BY total_quantity DESC
    LIMIT 5`,
    [yearStart, yearEnd]
  );

  // Se não houver vendas no ano, busca top 5 geral para não ficar vazio
  let topProducts = topProductsYear;
  if (topProducts.length === 0) {
    topProducts = await many(
      `SELECT 
        si.product_name,
        SUM(si.quantity) AS total_quantity,
        SUM(si.quantity * si.unit_price) AS total_revenue
      FROM sale_items si
      JOIN sales s ON s.id = si.sale_id
      GROUP BY si.product_name
      ORDER BY total_quantity DESC
      LIMIT 5`
    );
  }

  const [customerCount, productCount, purchaseStats] = await Promise.all([
    one('SELECT COUNT(*) AS count FROM customers'),
    one('SELECT COUNT(*) AS count FROM products'),
    one("SELECT COALESCE(SUM(total_price), 0) AS pending_total, COUNT(*) AS pending_count FROM purchases WHERE payment_status = 'A PAGAR'"),
  ]);

  res.json({
    year: selectedYear,
    month: selectedMonth,
    monthly_total: Number(monthRow.total || 0),
    monthly_count: Number(monthRow.count || 0),
    yearly_total: Number(yearRow.total || 0),
    yearly_count: Number(yearRow.count || 0),
    monthly_sales: monthlySales,
    top_products: topProducts.map((p) => ({
      name: p.product_name,
      quantity: Number(p.total_quantity || 0),
      revenue: Number(p.total_revenue || 0),
    })),
    stats: {
      customers: Number(customerCount.count || 0),
      products: Number(productCount.count || 0),
      purchases_pending_total: Number(purchaseStats.pending_total || 0),
      purchases_pending_count: Number(purchaseStats.pending_count || 0),
    },
  });
}));

app.use((error, req, res, next) => {
  console.error('API request failed:', error);
  res.status(500).json({ error: 'Falha ao acessar a API ou o banco de dados.' });
});

const PORT = process.env.PORT || 3333;
if (!process.env.VERCEL) app.listen(PORT, () => console.log(`API rodando em http://localhost:${PORT}`));
module.exports = app;
