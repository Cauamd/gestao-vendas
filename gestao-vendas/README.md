# Minhas vendas

Sistema de gestão de vendas: API em Express (SQLite embutido do Node ou PostgreSQL) + frontend em Next.js.

## Como rodar

Precisa do Node.js 22.13 ou mais novo (o SQLite já vem embutido, não precisa instalar compilador). Abra dois terminais.

**Terminal 1: API (porta 3333)**
```powershell
cd api
npm install
npm run dev
```

**Terminal 2: Frontend (porta 3000)**
```powershell
cd web
npm install
npm run dev
```

Acesse http://localhost:3000. O banco (`api/vendas.db`) é criado e atualizado sozinho na primeira execução.
Se a API estiver em outro endereço, ajuste `NEXT_PUBLIC_API_URL` em `web/.env.local`.

## Recursos do Sistema

- **Dashboard inicial:** visualização do valor arrecadado no mês e no ano todo, gráfico interativo de vendas em cada mês (Jan a Dez), gráfico dos Top 5 produtos mais vendidos, e indicadores gerais.
- **Funil de clientes (Kanban):** Conversando, Em andamento e Finalizado. Arraste os cartões ou use o seletor de cada cartão.
- **Vendas:** registro de venda com cliente, forma de pagamento (Pix, Dinheiro, Cartão Débito e Cartão Crédito em até 12x), produtos, quantidades e preços unitários; controle de estoque automático; envio de orçamentos por e-mail e WhatsApp; e **edição completa de vendas** (alteração/exclusão/adição de itens com estorno e recálculo de estoque).
- **Relatório de Vendas:** filtros por período de data de venda, produto e cliente; exibição de quantidade vendida, valor unitário de custo, valor unitário de venda, valor total de custo, valor total de venda, margem de lucro e forma de pagamento, com somatórios gerais e opção de impressão.
- **Clientes:** nome, cargo, pessoa de contato, endereço com número, bairro, cidade, CEP (preenche via ViaCEP), CPF, CNPJ, e-mail, telefone e **espaço de diálogo com o cliente e observações** com histórico de contatos.
- **Produtos:** produto, valor unitário de custo, valor unitário de venda, **margem de lucro unitária calculada automaticamente** e quantidade em estoque com aviso de estoque baixo.
- **Fornecedores:** cadastro com link principal, telefone, forma de pagamento, endereço, cidade, CEP (com busca ViaCEP), observações e lista de itens que o fornecedor vende.
- **Compras:** gerenciamento de pedidos e compras com nome, link de compra, valor unitário, valor total, quantidade, produto vinculado, status de pagamento (**PAGO** ou **A PAGAR**), prazo de pagamento manual, data de pagamento e forma de pagamento (Pix com chave de acesso, Cartão de Crédito com dados do cartão/banco, Débito e Dinheiro).
- **Relatório de Compras:** relatório com filtros por data, status (Todos, PAGO, A PAGAR), forma de pagamento e produto/nome, com indicadores de total de compras, total pago e total a pagar.

## Rotas da API

| Recurso | Rotas |
|---|---|
| Dashboard | `GET /dashboard` (parâmetros `year` e `month`) |
| Produtos | `GET/POST /products`, `GET/PUT/DELETE /products/:id` |
| Clientes | `GET/POST /customers`, `GET/PUT/DELETE /customers/:id`, `PATCH /customers/:id/stage`, `GET /customers/:id/sales` |
| Diálogo com Cliente | `GET/POST /customers/:id/interactions`, `DELETE /customer-interactions/:id` |
| Vendas | `GET/POST /sales`, `GET/PUT/DELETE /sales/:id`, `POST /sales/:id/email-quote` |
| Relatório de Vendas | `GET /reports/sales` (filtros por `start_date`, `end_date`, `customer_id`, `product_id`) |
| Fornecedores | `GET/POST /suppliers`, `PUT/DELETE /suppliers/:id`, `POST /suppliers/:id/items`, `DELETE /supplier-items/:id` |
| Compras | `GET/POST /purchases`, `GET/PUT/DELETE /purchases/:id` |
| Relatório de Compras | `GET /reports/purchases` (filtros por `start_date`, `end_date`, `payment_status`, `payment_method`, `query`) |

## Acesso

Acesse http://localhost:3000/login. O usuário inicial é `dani` e a senha é `fdtop`. Para alterar as credenciais, defina `LOGIN_USER` e `LOGIN_PASSWORD` no ambiente da API. As rotas de dados exigem uma sessão iniciada; as sessões são encerradas quando a API reinicia.
