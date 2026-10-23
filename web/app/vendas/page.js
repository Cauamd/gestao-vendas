'use client';
import { StyledSelect } from '@/components/StyledSelect';
import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { MessageCircle, Pencil, Plus, Trash2 } from 'lucide-react';
import { api, brl, dateBR } from '@/lib/api';
import { PageHeader, Field, ErrorNote, Empty, Modal } from '@/components/ui';

const PAYMENT_METHODS = ['Pix', 'Dinheiro', 'Cartão Débito', 'Cartão Crédito'];

function Vendas() {
  const params = useSearchParams();
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [sales, setSales] = useState([]);
  const [customerId, setCustomerId] = useState(params.get('cliente') || '');
  const [paymentMethod, setPaymentMethod] = useState('Pix');
  const [installments, setInstallments] = useState(1);
  const [lines, setLines] = useState([{ product_id: '', quantity: 1, unit_price: '' }]);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');

  // Edição de venda
  const [editingSale, setEditingSale] = useState(null);
  const [editError, setEditError] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  // Orçamento por e-mail
  const [quoting, setQuoting] = useState(null);
  const [quoteTo, setQuoteTo] = useState('');
  const [quoteMessage, setQuoteMessage] = useState('');
  const [quoteSending, setQuoteSending] = useState(false);
  const [quoteError, setQuoteError] = useState('');
  const [quoteSent, setQuoteSent] = useState('');
  const [whatsappError, setWhatsappError] = useState('');

  const load = () =>
    Promise.all([api('/customers'), api('/products'), api('/sales')])
      .then(([c, p, s]) => {
        setCustomers(c);
        setProducts(p);
        setSales(s);
      })
      .catch((e) => setError(e.message));

  useEffect(() => {
    load();
  }, []);

  const setLine = (i, patch) =>
    setLines((ls) =>
      ls.map((l, idx) => {
        if (idx !== i) return l;
        const next = { ...l, ...patch };
        if (patch.product_id !== undefined) {
          next.unit_price = products.find((p) => String(p.id) === patch.product_id)?.unit_price ?? '';
        }
        return next;
      })
    );

  const total = lines.reduce(
    (s, l) => s + Number(l.unit_price || 0) * Number(l.quantity || 0),
    0
  );

  async function submit(e) {
    e.preventDefault();
    setError('');
    setOk('');
    try {
      await api('/sales', {
        method: 'POST',
        body: {
          customer_id: Number(customerId),
          payment_method: paymentMethod,
          installments: paymentMethod === 'Cartão Crédito' ? Number(installments) : 1,
          items: lines.filter((l) => l.product_id),
        },
      });
      setLines([{ product_id: '', quantity: 1, unit_price: '' }]);
      setPaymentMethod('Pix');
      setInstallments(1);
      setOk('Venda registrada com sucesso e estoque atualizado.');
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  // Abertura do modal de edição de venda
  function openEdit(sale) {
    setEditError('');
    setEditingSale({
      id: sale.id,
      customer_id: String(sale.customer_id),
      payment_method: sale.payment_method || 'Pix',
      installments: sale.installments || 1,
      items: sale.items.map((it) => ({
        product_id: it.product_id ? String(it.product_id) : '',
        quantity: it.quantity,
        unit_price: it.unit_price,
        product_name: it.product_name,
      })),
    });
  }

  const setEditLine = (i, patch) => {
    if (!editingSale) return;
    setEditingSale((prev) => {
      const updatedItems = prev.items.map((item, idx) => {
        if (idx !== i) return item;
        const next = { ...item, ...patch };
        if (patch.product_id !== undefined) {
          const found = products.find((p) => String(p.id) === patch.product_id);
          next.unit_price = found?.unit_price ?? next.unit_price;
          next.product_name = found?.name ?? next.product_name;
        }
        return next;
      });
      return { ...prev, items: updatedItems };
    });
  };

  const editTotal = editingSale?.items?.reduce(
    (acc, it) => acc + Number(it.unit_price || 0) * Number(it.quantity || 0),
    0
  ) || 0;

  async function saveEdit(e) {
    e.preventDefault();
    if (!editingSale) return;
    setEditSaving(true);
    setEditError('');
    try {
      const validItems = editingSale.items.filter((it) => it.product_id);
      if (validItems.length === 0) throw new Error('Adicione ao menos um produto à venda.');

      await api(`/sales/${editingSale.id}`, {
        method: 'PUT',
        body: {
          customer_id: Number(editingSale.customer_id),
          payment_method: editingSale.payment_method,
          installments: editingSale.payment_method === 'Cartão Crédito' ? Number(editingSale.installments) : 1,
          items: validItems,
        },
      });

      setEditingSale(null);
      setOk(`Venda #${editingSale.id} atualizada com sucesso.`);
      load();
    } catch (err) {
      setEditError(err.message);
    } finally {
      setEditSaving(false);
    }
  }

  async function deleteSale(id) {
    if (!confirm(`Tem certeza de que deseja excluir a venda #${id}? O estoque dos produtos será devolvido.`)) return;
    try {
      await api(`/sales/${id}`, { method: 'DELETE' });
      setEditingSale(null);
      setOk(`Venda #${id} excluída e estoque estornado.`);
      load();
    } catch (err) {
      alert(err.message);
    }
  }

  function openQuote(sale) {
    setQuoting(sale);
    setQuoteTo(sale.customer_email || '');
    setQuoteMessage('');
    setQuoteError('');
    setQuoteSent('');
  }

  async function sendQuote(e) {
    e.preventDefault();
    setQuoteSending(true);
    setQuoteError('');
    setQuoteSent('');
    try {
      const result = await api(`/sales/${quoting.id}/email-quote`, {
        method: 'POST',
        body: { to: quoteTo, message: quoteMessage },
      });
      setQuoteSent(`Orçamento enviado para ${result.to}.`);
    } catch (err) {
      setQuoteError(err.message);
    } finally {
      setQuoteSending(false);
    }
  }

  function sendWhatsApp(sale) {
    setWhatsappError('');
    let phone = String(sale.customer_phone || '').replace(/\D/g, '');
    if (!phone) {
      setWhatsappError(`Cadastre o telefone de ${sale.customer_name} para abrir o WhatsApp.`);
      return;
    }
    if (!phone.startsWith('55')) phone = `55${phone}`;
    const itemLines = sale.items.map(
      (item) => `• ${item.quantity} x ${item.product_name} — ${brl(item.unit_price)} cada`
    );
    const paymentText = sale.payment_method
      ? `Forma de pagamento: ${sale.payment_method}${sale.payment_method === 'Cartão Crédito' && sale.installments > 1 ? ` em ${sale.installments}x` : ''}`
      : '';

    const message = [
      `Olá, ${sale.customer_name}!`,
      '',
      `Segue o orçamento referente à venda #${sale.id}:`,
      '',
      ...itemLines,
      '',
      `Total: ${brl(sale.total)}`,
      ...(paymentText ? [paymentText] : []),
      '',
      'Fico à disposição para qualquer dúvida.',
    ].join('\n');

    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer');
  }

  return (
    <>
      <PageHeader
        title="Vendas"
        subtitle="Registre ou edite vendas: escolha o cliente, forma de pagamento e produtos; o estoque baixa sozinho."
      />

      {/* Formulário de Nova Venda */}
      <form onSubmit={submit} className="mb-8 space-y-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <ErrorNote message={error} />
        {ok && (
          <p role="status" className="rounded-md bg-brand-soft px-3 py-2 text-sm text-brand-dark font-medium">
            {ok}
          </p>
        )}

        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Cliente" className="sm:col-span-1">
            <StyledSelect
              className="input"
              required
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
            >
              <option value="">Escolha o cliente</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </StyledSelect>
          </Field>

          <Field label="Forma de pagamento">
            <StyledSelect
              className="input"
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
            >
              {PAYMENT_METHODS.map((pm) => (
                <option key={pm} value={pm}>
                  {pm}
                </option>
              ))}
            </StyledSelect>
          </Field>

          {paymentMethod === 'Cartão Crédito' ? (
            <Field label="Parcelas (até 12x)">
              <StyledSelect
                className="input"
                value={installments}
                onChange={(e) => setInstallments(Number(e.target.value))}
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>
                    {n}x {total > 0 ? `de ${brl(total / n)}` : ''}
                  </option>
                ))}
              </StyledSelect>
            </Field>
          ) : (
            <div className="hidden sm:block" />
          )}
        </div>

        {/* Linhas de Produtos */}
        <div className="space-y-2">
          {lines.map((l, i) => (
            <div key={i} className="grid items-end gap-2 sm:grid-cols-[1fr_6rem_8rem_auto]">
              <Field label={i === 0 ? 'Produto' : ''}>
                <StyledSelect
                  className="input"
                  value={l.product_id}
                  onChange={(e) => setLine(i, { product_id: e.target.value })}
                >
                  <option value="">Escolha o produto</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id} disabled={p.quantity === 0}>
                      {p.name} ({p.quantity} em estoque)
                    </option>
                  ))}
                </StyledSelect>
              </Field>
              <Field label={i === 0 ? 'Quantidade' : ''}>
                <input
                  className="input"
                  type="number"
                  min="1"
                  value={l.quantity}
                  onChange={(e) => setLine(i, { quantity: e.target.value })}
                />
              </Field>
              <Field label={i === 0 ? 'Preço unitário' : ''}>
                <input
                  className="input"
                  type="number"
                  step="0.01"
                  min="0"
                  value={l.unit_price}
                  onChange={(e) => setLine(i, { unit_price: e.target.value })}
                />
              </Field>
              <button
                type="button"
                className="btn-danger pb-2"
                onClick={() => setLines((ls) => (ls.length > 1 ? ls.filter((_, x) => x !== i) : ls))}
              >
                Remover
              </button>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
          <button
            type="button"
            className="btn-ghost"
            onClick={() => setLines([...lines, { product_id: '', quantity: 1, unit_price: '' }])}
          >
            + Adicionar produto
          </button>
          <div className="flex items-center gap-4">
            <span className="text-lg font-bold text-ink">Total: {brl(total)}</span>
            <button className="btn">Registrar venda</button>
          </div>
        </div>
      </form>

      {/* Lista de Vendas */}
      <h2 className="mb-3 text-lg font-bold text-ink">Histórico de vendas</h2>
      <ErrorNote message={whatsappError} />

      {sales.length === 0 ? (
        <Empty>Nenhuma venda registrada ainda.</Empty>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="p-3">Data</th>
                <th className="p-3">Cliente</th>
                <th className="p-3">Forma de pagamento</th>
                <th className="p-3">Itens</th>
                <th className="p-3 text-right">Total</th>
                <th className="p-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {sales.map((s) => (
                <tr key={s.id} className="border-t border-slate-100 align-top">
                  <td className="p-3 text-slate-600 whitespace-nowrap">{dateBR(s.created_at)}</td>
                  <td className="p-3 font-semibold text-ink">{s.customer_name}</td>
                  <td className="p-3">
                    <span className="inline-block rounded-md bg-rose-50 px-2 py-0.5 text-xs font-semibold text-brand">
                      {s.payment_method || 'Pix'}
                      {s.payment_method === 'Cartão Crédito' && s.installments > 1 ? ` (${s.installments}x)` : ''}
                    </span>
                  </td>
                  <td className="p-3 text-slate-600">
                    {s.items.map((i) => `${i.quantity}× ${i.product_name}`).join(', ')}
                  </td>
                  <td className="p-3 text-right font-bold text-ink">{brl(s.total)}</td>
                  <td className="p-3 text-right whitespace-nowrap">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        className="btn-ghost flex items-center gap-1 text-xs"
                        onClick={() => openEdit(s)}
                        title="Editar venda e itens"
                      >
                        <Pencil className="h-3.5 w-3.5 text-slate-600" />
                        Editar
                      </button>
                      <button
                        type="button"
                        className="btn-ghost text-xs whitespace-nowrap"
                        onClick={() => openQuote(s)}
                      >
                        Enviar orçamento
                      </button>
                      <button
                        type="button"
                        className="btn-ghost flex items-center gap-1 text-xs whitespace-nowrap"
                        onClick={() => sendWhatsApp(s)}
                      >
                        <MessageCircle className="h-3.5 w-3.5 text-brand" />
                        WhatsApp
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal de Edição da Venda */}
      {editingSale && (
        <Modal title={`Editar Venda #${editingSale.id}`} onClose={() => { if (!editSaving) setEditingSale(null); }}>
          <form onSubmit={saveEdit} className="space-y-4">
            <ErrorNote message={editError} />
            <p className="text-xs text-slate-500">
              Você pode alterar o cliente, a forma de pagamento, e adicionar, alterar quantidades ou excluir itens. O estoque dos produtos será recalculado automaticamente.
            </p>

            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Cliente" className="sm:col-span-1">
                <StyledSelect
                  className="input"
                  required
                  value={editingSale.customer_id}
                  onChange={(e) => setEditingSale({ ...editingSale, customer_id: e.target.value })}
                >
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </StyledSelect>
              </Field>

              <Field label="Forma de pagamento">
                <StyledSelect
                  className="input"
                  value={editingSale.payment_method}
                  onChange={(e) => setEditingSale({ ...editingSale, payment_method: e.target.value })}
                >
                  {PAYMENT_METHODS.map((pm) => (
                    <option key={pm} value={pm}>{pm}</option>
                  ))}
                </StyledSelect>
              </Field>

              {editingSale.payment_method === 'Cartão Crédito' ? (
                <Field label="Parcelas (até 12x)">
                  <StyledSelect
                    className="input"
                    value={editingSale.installments}
                    onChange={(e) => setEditingSale({ ...editingSale, installments: Number(e.target.value) })}
                  >
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                      <option key={n} value={n}>
                        {n}x {editTotal > 0 ? `de ${brl(editTotal / n)}` : ''}
                      </option>
                    ))}
                  </StyledSelect>
                </Field>
              ) : (
                <div className="hidden sm:block" />
              )}
            </div>

            {/* Itens da Venda */}
            <div className="space-y-2">
              <span className="block text-sm font-semibold text-slate-700">Itens da venda:</span>
              {editingSale.items.map((item, i) => (
                <div key={i} className="grid items-end gap-2 sm:grid-cols-[1fr_5rem_7rem_auto]">
                  <Field label={i === 0 ? 'Produto' : ''}>
                    <StyledSelect
                      className="input"
                      value={item.product_id}
                      onChange={(e) => setEditLine(i, { product_id: e.target.value })}
                    >
                      <option value="">Escolha o produto</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.quantity} em estoque)
                        </option>
                      ))}
                    </StyledSelect>
                  </Field>

                  <Field label={i === 0 ? 'Qtd.' : ''}>
                    <input
                      className="input"
                      type="number"
                      min="1"
                      value={item.quantity}
                      onChange={(e) => setEditLine(i, { quantity: e.target.value })}
                    />
                  </Field>

                  <Field label={i === 0 ? 'Preço unit.' : ''}>
                    <input
                      className="input"
                      type="number"
                      step="0.01"
                      min="0"
                      value={item.unit_price}
                      onChange={(e) => setEditLine(i, { unit_price: e.target.value })}
                    />
                  </Field>

                  <button
                    type="button"
                    className="btn-danger pb-2"
                    onClick={() => {
                      if (editingSale.items.length <= 1) {
                        alert('A venda precisa ter ao menos um item. Se desejar cancelar toda a venda, clique em Excluir Venda abaixo.');
                        return;
                      }
                      setEditingSale({
                        ...editingSale,
                        items: editingSale.items.filter((_, idx) => idx !== i),
                      });
                    }}
                    title="Excluir este item da venda"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
              <button
                type="button"
                className="btn-ghost text-xs"
                onClick={() =>
                  setEditingSale({
                    ...editingSale,
                    items: [...editingSale.items, { product_id: '', quantity: 1, unit_price: '' }],
                  })
                }
              >
                + Adicionar outro produto
              </button>
              <div className="text-right">
                <span className="text-sm text-slate-500">Novo Total: </span>
                <span className="text-lg font-bold text-ink">{brl(editTotal)}</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-4">
              <button
                type="button"
                className="btn-danger"
                onClick={() => deleteSale(editingSale.id)}
                disabled={editSaving}
              >
                Excluir Venda
              </button>

              <div className="flex gap-2">
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => setEditingSale(null)}
                  disabled={editSaving}
                >
                  Cancelar
                </button>
                <button className="btn" disabled={editSaving}>
                  {editSaving ? 'Salvando...' : 'Salvar alterações'}
                </button>
              </div>
            </div>
          </form>
        </Modal>
      )}

      {/* Modal Enviar Orçamento por E-mail */}
      {quoting && (
        <Modal
          title={`Enviar orçamento #${quoting.id}`}
          onClose={() => {
            if (!quoteSending) setQuoting(null);
          }}
        >
          <form onSubmit={sendQuote} className="space-y-4">
            <p className="text-sm text-slate-600">
              O e-mail incluirá os itens e o total registrados nesta venda.
            </p>
            <Field label="E-mail do destinatário">
              <input
                className="input"
                type="email"
                autoComplete="email"
                required
                value={quoteTo}
                onChange={(e) => setQuoteTo(e.target.value)}
              />
            </Field>
            <Field label="Mensagem adicional (opcional)">
              <textarea
                className="input min-h-24 resize-y"
                maxLength={2000}
                value={quoteMessage}
                onChange={(e) => setQuoteMessage(e.target.value)}
                placeholder="Escreva uma mensagem para acompanhar o orçamento"
              />
            </Field>
            {quoteError && <ErrorNote message={quoteError} />}
            {quoteSent && (
              <p role="status" className="rounded-md bg-brand-soft px-3 py-2 text-sm text-brand-dark">
                {quoteSent}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="btn-ghost"
                onClick={() => setQuoting(null)}
                disabled={quoteSending}
              >
                Fechar
              </button>
              <button className="btn" disabled={quoteSending || Boolean(quoteSent)}>
                {quoteSending ? 'Enviando...' : quoteSent ? 'Enviado' : 'Enviar e-mail'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}

export default function VendasPage() {
  return (
    <Suspense fallback={null}>
      <Vendas />
    </Suspense>
  );
}
