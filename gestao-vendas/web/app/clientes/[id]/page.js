'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { MessageSquare, Send, Trash2 } from 'lucide-react';
import { api, brl, dateBR, address } from '@/lib/api';
import { PageHeader, Empty, ErrorNote } from '@/components/ui';

export default function ClienteDetalhe() {
  const { id } = useParams();
  const [customer, setCustomer] = useState(null);
  const [sales, setSales] = useState([]);
  const [interactions, setInteractions] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [dialogError, setDialogError] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const loadData = () => {
    Promise.all([
      api(`/customers/${id}`),
      api(`/customers/${id}/sales`),
      api(`/customers/${id}/interactions`),
    ])
      .then(([c, s, inter]) => {
        setCustomer(c);
        setSales(s);
        setInteractions(inter);
      })
      .catch((e) => setError(e.message));
  };

  useEffect(() => {
    loadData();
  }, [id]);

  async function addInteraction(e) {
    e.preventDefault();
    if (!newMessage.trim()) return;
    setSending(true);
    setDialogError('');
    try {
      await api(`/customers/${id}/interactions`, {
        method: 'POST',
        body: { message: newMessage.trim() },
      });
      setNewMessage('');
      const updated = await api(`/customers/${id}/interactions`);
      setInteractions(updated);
    } catch (err) {
      setDialogError(err.message);
    } finally {
      setSending(false);
    }
  }

  async function removeInteraction(interId) {
    try {
      await api(`/customer-interactions/${interId}`, { method: 'DELETE' });
      setInteractions((prev) => prev.filter((item) => item.id !== interId));
    } catch (err) {
      setDialogError(err.message);
    }
  }

  if (error) return <ErrorNote message={error} />;
  if (!customer) return <p className="text-sm text-slate-500">Carregando…</p>;

  const spent = sales.reduce((sum, s) => sum + s.total, 0);
  const info = [
    ['Cargo', customer.position],
    ['Pessoa de contato', customer.contact_person],
    ['CPF', customer.cpf],
    ['CNPJ', customer.cnpj],
    ['E-mail', customer.email],
    ['Telefone', customer.phone],
    ['Endereço', address(customer)],
  ].filter(([, v]) => v);

  return (
    <>
      <Link href="/clientes" className="mb-2 inline-block text-sm text-brand hover:underline font-medium">
        ← Voltar para clientes
      </Link>
      <PageHeader
        title={customer.name}
        subtitle={`${sales.length} ${sales.length === 1 ? 'compra' : 'compras'} · ${brl(spent)} no total`}
        action={
          <Link href={`/vendas?cliente=${customer.id}`} className="btn">
            Registrar venda
          </Link>
        }
      />

      {/* Dados do Cliente */}
      <dl className="mb-8 grid gap-x-8 gap-y-3 rounded-lg border border-slate-200 bg-white p-5 text-sm sm:grid-cols-2 lg:grid-cols-3">
        {info.map(([k, v]) => (
          <div key={k}>
            <dt className="text-xs font-semibold uppercase text-slate-500">{k}</dt>
            <dd className="mt-0.5 font-medium text-slate-800">{v}</dd>
          </div>
        ))}
      </dl>

      {/* Seção de Observações / Diálogo com Cliente */}
      <section className="mb-8 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-brand" />
            <h2 className="text-lg font-bold text-ink">Diálogo com o cliente & Observações</h2>
          </div>
          <span className="text-xs text-slate-500">{interactions.length} registro(s)</span>
        </div>

        {/* Observação fixa do cliente, se houver */}
        {customer.notes && (
          <div className="mb-5 rounded-lg border border-amber-200 bg-amber-50/60 p-4 text-sm text-slate-700">
            <span className="mb-1 block font-semibold text-amber-900">Observação geral cadastrada:</span>
            <p className="whitespace-pre-line">{customer.notes}</p>
          </div>
        )}

        {/* Formulário para registrar novo diálogo */}
        <form onSubmit={addInteraction} className="mb-6 space-y-2">
          <ErrorNote message={dialogError} />
          <div className="flex gap-2">
            <textarea
              className="input flex-1 min-h-16 resize-y"
              placeholder="Registrar conversa, acordo, ligação, proposta ou observação sobre o cliente..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              required
            />
            <button
              type="submit"
              disabled={sending}
              className="btn self-end whitespace-nowrap"
            >
              <Send className="mr-1.5 h-4 w-4" />
              {sending ? 'Salvando...' : 'Registrar'}
            </button>
          </div>
        </form>

        {/* Histórico do diálogo */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Histórico de conversas</h3>
          {interactions.length === 0 ? (
            <p className="rounded-lg border border-dashed border-slate-200 p-4 text-center text-xs text-slate-500">
              Nenhuma anotação de diálogo registrada ainda. Escreva acima para registrar um contato com este cliente.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {interactions.map((msg) => (
                <li key={msg.id} className="group flex items-start justify-between gap-3 py-3">
                  <div className="space-y-1">
                    <p className="text-sm text-slate-800 whitespace-pre-line">{msg.message}</p>
                    <span className="block text-xs text-slate-400">
                      {dateBR(msg.created_at)} às {msg.created_at?.split(' ')[1]?.slice(0, 5) || ''}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeInteraction(msg.id)}
                    className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-red-600 transition"
                    title="Excluir anotação"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* Compras Realizadas */}
      <h2 className="mb-3 text-lg font-bold">Compras realizadas</h2>
      {sales.length === 0 ? (
        <Empty>Este cliente ainda não comprou nada.</Empty>
      ) : (
        <div className="space-y-4">
          {sales.map((s) => (
            <article key={s.id} className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
              <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50 px-4 py-2.5 text-sm">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-ink">Venda #{s.id} em {dateBR(s.created_at)}</span>
                  {s.payment_method && (
                    <span className="rounded bg-rose-50 px-2 py-0.5 text-xs font-semibold text-brand">
                      {s.payment_method}
                      {s.payment_method === 'Cartão Crédito' && s.installments > 1 ? ` (${s.installments}x)` : ''}
                    </span>
                  )}
                </div>
                <span className="font-bold text-ink">{brl(s.total)}</span>
              </header>
              <table className="w-full text-left text-sm">
                <thead className="text-slate-500">
                  <tr>
                    <th className="px-4 py-2">Produto</th>
                    <th className="px-4 py-2">Quantidade</th>
                    <th className="px-4 py-2">Preço unitário</th>
                    <th className="px-4 py-2 text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {s.items.map((i) => (
                    <tr key={i.id} className="border-t border-slate-100">
                      <td className="px-4 py-2 font-medium">{i.product_name}</td>
                      <td className="px-4 py-2">{i.quantity}</td>
                      <td className="px-4 py-2">{brl(i.unit_price)}</td>
                      <td className="px-4 py-2 text-right font-medium">{brl(i.unit_price * i.quantity)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
