# Minhas vendas

Sistema de gestÃ£o de vendas: API em Express (SQLite embutido do Node) + frontend em Next.js.

## Como rodar

Precisa do Node.js 22.13 ou mais novo (o SQLite jÃ¡ vem embutido, nÃ£o precisa instalar compilador). Abra dois terminais.

**Terminal 1: API (porta 3333)**
```
cd api
npm install
npm run dev
```

**Terminal 2: Frontend (porta 3000)**
```
cd web
npm install
npm run dev
```

Acesse http://localhost:3000. O banco (`api/vendas.db`) Ã© criado sozinho na primeira execuÃ§Ã£o.
Se a API estiver em outro endereÃ§o, ajuste `NEXT_PUBLIC_API_URL` em `web/.env.local`.

## O que tem

- **Funil de clientes (Kanban):** Conversando, Em andamento e Finalizado. Arraste os cartÃµes ou use o seletor de cada cartÃ£o.
- **Vendas:** escolhe o cliente e os produtos; o estoque baixa sozinho e o preÃ§o fica salvo no histÃ³rico.
- **Clientes:** nome, endereÃ§o com nÃºmero, bairro, cidade, CEP (preenche rua, bairro e cidade pelo ViaCEP), CPF, CNPJ, e-mail e telefone. A pÃ¡gina de cada cliente mostra as compras com itens, quantidades e preÃ§os.
- **Produtos:** produto, valor unitÃ¡rio e quantidade, com aviso de estoque baixo.
- **Fornecedores:** cadastro com link principal e uma lista do que cada um vende (item, onde vende e link).

## Rotas da API

| Recurso | Rotas |
|---|---|
| Produtos | `GET/POST /products`, `GET/PUT/DELETE /products/:id` |
| Clientes | `GET/POST /customers`, `GET/PUT/DELETE /customers/:id`, `PATCH /customers/:id/stage`, `GET /customers/:id/sales` |
| Vendas | `GET/POST /sales` |
| Fornecedores | `GET/POST /suppliers`, `PUT/DELETE /suppliers/:id`, `POST /suppliers/:id/items`, `DELETE /supplier-items/:id` |

## Acesso

Acesse http://localhost:3000/login. O usuário inicial é dani e a senha é fdtop. Para alterar as credenciais, defina LOGIN_USER e LOGIN_PASSWORD no ambiente da API. As rotas de dados exigem uma sessão iniciada; as sessões são encerradas quando a API reinicia.

## Envio de orçamentos por e-mail

Na tela **Vendas**, use **Enviar orçamento** na linha da venda. O sistema envia os itens, quantidades, preços e total registrados, além de uma mensagem opcional. O endereço do cliente é preenchido automaticamente quando cadastrado e pode ser alterado antes do envio.

Também é possível usar **WhatsApp** na venda. O sistema abre a conversa do telefone cadastrado com os itens e o total preenchidos; confirme o envio no WhatsApp.

Configure o SMTP uma vez no arquivo `api/.env`. Copie o modelo e edite os dados:

```powershell
cd api
Copy-Item .env.example .env
notepad .env
```

Preencha `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER` e `SMTP_PASS` com os dados do seu provedor. `SMTP_FROM` é opcional e, se omitido, usa `SMTP_USER`. Depois inicie ou reinicie a API com `npm run dev`. O `.env` é carregado pela API e ignorado pelo Git; não coloque essas credenciais no frontend nem em variáveis `NEXT_PUBLIC_*`.

## Banco persistente na Vercel

Em produção, conecte um PostgreSQL pelo Marketplace da Vercel (por exemplo, Neon) e configure a variável privada `DATABASE_URL` para o serviço da API nos ambientes Production e Preview. A API cria as tabelas ao iniciar; sem essa variável, ela não usa um SQLite temporário na Vercel.

Para importar o banco SQLite local para o PostgreSQL, adicione `DATABASE_URL` ao arquivo `api/.env` local e execute:

```powershell
cd api
npm install
npm run migrate:sqlite
```

O script importa os produtos, clientes, fornecedores, vendas e itens do arquivo `api/vendas.db`; ele pode ser executado novamente sem duplicar registros já importados. Faça o redeploy depois de configurar a variável na Vercel. A rota `/api/health` informa se a API está usando `postgres` ou `sqlite-local`.

