'use client';
import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { MessageCircle } from 'lucide-react';
import { api, brl, dateBR } from '@/lib/api';
import { PageHeader, Field, ErrorNote, Empty, Modal } from '@/components/ui';

function Vendas() {
  const params = useSearchParams();
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [sales, setSales] = useState([]);
  const [customerId, setCustomerId] = useState(params.get('cliente') || '');
  const [lines, setLines] = useState([{ product_id: '', quantity: 1, unit_price: '' }]);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [quoting, setQuoting] = useState(null);
  const [quoteTo, setQuoteTo] = useState('');
  const [quoteMessage, setQuoteMessage] = useState('');
  const [quoteSending, setQuoteSending] = useState(false);
  const [quoteError, setQuoteError] = useState('');
  const [quoteSent, setQuoteSent] = useState('');
  const [whatsappError, setWhatsappError] = useState('');

  const load = () => Promise.all([api('/customers'), api('/products'), api('/sales')])
    .then(([c, p, s]) => { setCustomers(c); setProducts(p); setSales(s); }).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  const setLine = (i, patch) => setLines((ls) => ls.map((l, idx) => {
    if (idx !== i) return l;
    const next = { ...l, ...patch };
    if (patch.product_id !== undefined) next.unit_price = products.find((p) => String(p.id) === patch.product_id)?.unit_price ?? '';
    return next;
  }));
  const total = lines.reduce((s, l) => s + Number(l.unit_price || 0) * Number(l.quantity || 0), 0);

  async function submit(e) {
    e.preventDefault(); setError(''); setOk('');
    try {
      await api('/sales', { method: 'POST', body: { customer_id: Number(customerId), items: lines.filter((l) => l.product_id) } });
      setLines([{ product_id: '', quantity: 1, unit_price: '' }]);
      setOk('Venda registrada e estoque atualizado.'); load();
    } catch (err) { setError(err.message); }
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
    const itemLines = sale.items.map((item) => `• ${item.quantity} x ${item.product_name} — ${brl(item.unit_price)} cada`);
    const message = [
      `Olá, ${sale.customer_name}!`,
      '',
      `Segue o orçamento referente à venda #${sale.id}:`,
      '',
      ...itemLines,
      '',
      `Total: ${brl(sale.total)}`,
      '',
      'Fico à disposição para qualquer dúvida.',
    ].join('\n');
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer');
  }

  return (
    <>
      <PageHeader title="Vendas" subtitle="Registre uma venda: o estoque baixa sozinho e o preço fica salvo no histórico do cliente." />
      <form onSubmit={submit} className="mb-8 space-y-4 rounded-lg border border-slate-200 bg-white p-5">
        <ErrorNote message={error} />
        {ok && <p role="status" className="rounded-md bg-brand-soft px-3 py-2 text-sm text-brand-dark">{ok}</p>}
        <Field label="Cliente" className="max-w-sm">
          <select className="input" required value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
            <option value="">Escolha o cliente</option>
            {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        <div className="space-y-2">
          {lines.map((l, i) => (
            <div key={i} className="grid items-end gap-2 sm:grid-cols-[1fr_6rem_8rem_auto]">
              <Field label={i === 0 ? 'Produto' : ''}>
                <select className="input" value={l.product_id} onChange={(e) => setLine(i, { product_id: e.target.value })}>
                  <option value="">Escolha o produto</option>
                  {products.map((p) => <option key={p.id} value={p.id} disabled={p.quantity === 0}>{p.name} ({p.quantity} em estoque)</option>)}
                </select>
              </Field>
              <Field label={i === 0 ? 'Quantidade' : ''}><input className="input" type="number" min="1" value={l.quantity} onChange={(e) => setLine(i, { quantity: e.target.value })} /></Field>
              <Field label={i === 0 ? 'Preço unitário' : ''}><input className="input" type="number" step="0.01" min="0" value={l.unit_price} onChange={(e) => setLine(i, { unit_price: e.target.value })} /></Field>
              <button type="button" className="btn-danger pb-2" onClick={() => setLines((ls) => ls.length > 1 ? ls.filter((_, x) => x !== i) : ls)}>Remover</button>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button type="button" className="btn-ghost" onClick={() => setLines([...lines, { product_id: '', quantity: 1, unit_price: '' }])}>Adicionar produto</button>
          <div className="flex items-center gap-4"><span className="text-lg font-bold">Total: {brl(total)}</span><button className="btn">Registrar venda</button></div>
        </div>
      </form>
      <h2 className="mb-3 text-lg font-bold">Últimas vendas</h2>
      <ErrorNote message={whatsappError} />
      {sales.length === 0 ? <Empty>Nenhuma venda registrada ainda.</Empty> : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600"><tr><th className="p-3">Data</th><th className="p-3">Cliente</th><th className="p-3">Itens</th><th className="p-3 text-right">Total</th><th className="p-3">Ações</th></tr></thead>
            <tbody>{sales.map((s) => (
              <tr key={s.id} className="border-t border-slate-100 align-top">
                <td className="p-3">{dateBR(s.created_at)}</td><td className="p-3 font-medium">{s.customer_name}</td>
                <td className="p-3 text-slate-600">{s.items.map((i) => `${i.quantity}× ${i.product_name}`).join(', ')}</td>
                <td className="p-3 text-right font-semibold">{brl(s.total)}</td>
                <td className="p-3"><div className="flex flex-wrap gap-2"><button type="button" className="btn-ghost whitespace-nowrap" onClick={() => openQuote(s)}>Enviar orçamento</button><button type="button" className="btn-ghost whitespace-nowrap" onClick={() => sendWhatsApp(s)}><MessageCircle className="mr-1.5 h-4 w-4 text-brand" />WhatsApp</button></div></td>
              </tr>))}
            </tbody>
          </table>
        </div>
      )}
      {quoting && <Modal title={`Enviar orçamento #${quoting.id}`} onClose={() => { if (!quoteSending) setQuoting(null); }}>
        <form onSubmit={sendQuote} className="space-y-4">
          <p className="text-sm text-slate-600">O e-mail incluirá os itens e o total registrados nesta venda.</p>
          <Field label="E-mail do destinatário">
            <input className="input" type="email" autoComplete="email" required value={quoteTo} onChange={(e) => setQuoteTo(e.target.value)} />
          </Field>
          <Field label="Mensagem adicional (opcional)">
            <textarea className="input min-h-24 resize-y" maxLength={2000} value={quoteMessage} onChange={(e) => setQuoteMessage(e.target.value)} placeholder="Escreva uma mensagem para acompanhar o orçamento" />
          </Field>
          {quoteError && <ErrorNote message={quoteError} />}
          {quoteSent && <p role="status" className="rounded-md bg-brand-soft px-3 py-2 text-sm text-brand-dark">{quoteSent}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-ghost" onClick={() => setQuoting(null)} disabled={quoteSending}>Fechar</button>
            <button className="btn" disabled={quoteSending || Boolean(quoteSent)}>{quoteSending ? 'Enviando...' : quoteSent ? 'Enviado' : 'Enviar e-mail'}</button>
          </div>
        </form>
      </Modal>}
    </>
  );
}

export default function VendasPage() { return <Suspense fallback={null}><Vendas /></Suspense>; }
