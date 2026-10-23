'use client';
import { useEffect, useState } from 'react';
import { api, brl } from '@/lib/api';
import { PageHeader, Field, ErrorNote, Empty } from '@/components/ui';
import { Filter, Printer, X } from 'lucide-react';

const PAYMENT_METHODS = ['Pix', 'Dinheiro', 'Cartão Débito', 'Cartão Crédito'];
const PAYMENT_STATUSES = ['A PAGAR', 'PAGO'];

export default function RelatorioComprasPage() {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [status, setStatus] = useState('TODOS');
  const [paymentMethod, setPaymentMethod] = useState('TODOS');
  const [search, setSearch] = useState('');

  const [data, setData] = useState({
    items: [],
    summary: { total_amount: 0, total_paid: 0, total_pending: 0, total_quantity: 0 },
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadReport = () => {
    setLoading(true);
    const query = new URLSearchParams();
    if (startDate) query.set('start_date', startDate);
    if (endDate) query.set('end_date', endDate);
    if (status && status !== 'TODOS') query.set('payment_status', status);
    if (paymentMethod && paymentMethod !== 'TODOS') query.set('payment_method', paymentMethod);
    if (search) query.set('query', search);

    api(`/reports/purchases?${query.toString()}`)
      .then((res) => {
        setData(res);
        setError('');
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadReport();
  }, [startDate, endDate, status, paymentMethod, search]);

  function clearFilters() {
    setStartDate('');
    setEndDate('');
    setStatus('TODOS');
    setPaymentMethod('TODOS');
    setSearch('');
  }

  const { items, summary } = data;

  return (
    <>
      <div className="print:hidden">
        <PageHeader
          title="Relatório de Compras"
          subtitle="Consulte e analise os gastos com compras por produto, fornecedor, status de pagamento e forma de liquidação."
          action={
            <button
              onClick={() => window.print()}
              className="btn-ghost flex items-center gap-2 border border-slate-200 bg-white shadow-sm"
            >
              <Printer className="h-4 w-4" />
              Imprimir Relatório
            </button>
          }
        />

        {/* Filtros */}
        <div className="mb-6 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-600">
              <Filter className="h-4 w-4 text-brand" /> Filtros do Relatório
            </span>
            {(startDate || endDate || status !== 'TODOS' || paymentMethod !== 'TODOS' || search) && (
              <button
                onClick={clearFilters}
                className="flex items-center gap-1 text-xs font-semibold text-brand hover:underline"
              >
                <X className="h-3.5 w-3.5" /> Limpar filtros
              </button>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <Field label="Buscar (Nome / Produto)">
              <input
                className="input"
                placeholder="Ex: Embalagem..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </Field>

            <Field label="Status de pagamento">
              <select
                className="input"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="TODOS">Todos os status</option>
                {PAYMENT_STATUSES.map((st) => (
                  <option key={st} value={st}>{st}</option>
                ))}
              </select>
            </Field>

            <Field label="Forma de pagamento">
              <select
                className="input"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
              >
                <option value="TODOS">Todas as formas</option>
                {PAYMENT_METHODS.map((pm) => (
                  <option key={pm} value={pm}>{pm}</option>
                ))}
              </select>
            </Field>

            <Field label="Data inicial">
              <input
                className="input"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </Field>

            <Field label="Data final">
              <input
                className="input"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </Field>
          </div>
        </div>
      </div>

      <ErrorNote message={error} />

      {/* Cards de Resumo */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Geral */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <span className="text-xs font-semibold uppercase text-slate-500">Total em Compras</span>
          <div className="mt-2 text-2xl font-extrabold text-ink">{brl(summary.total_amount)}</div>
          <span className="text-xs text-slate-500">{summary.total_quantity} item(ns) comprados</span>
        </div>

        {/* Total Pago */}
        <div className="rounded-xl border border-emerald-200 bg-white p-4 shadow-sm">
          <span className="text-xs font-semibold uppercase text-emerald-700">Total Pago</span>
          <div className="mt-2 text-2xl font-extrabold text-emerald-700">{brl(summary.total_paid)}</div>
          <span className="text-xs text-slate-500">Contas já quitadas</span>
        </div>

        {/* Total A Pagar */}
        <div className="rounded-xl border border-amber-200 bg-white p-4 shadow-sm">
          <span className="text-xs font-semibold uppercase text-amber-deep">Total A Pagar</span>
          <div className="mt-2 text-2xl font-extrabold text-amber-deep">{brl(summary.total_pending)}</div>
          <span className="text-xs text-slate-500">Contas em aberto</span>
        </div>

        {/* Quantidade Total */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <span className="text-xs font-semibold uppercase text-slate-500">Volume Comprado</span>
          <div className="mt-2 text-2xl font-extrabold text-slate-700">{summary.total_quantity} un.</div>
          <span className="text-xs text-slate-500">Unidades adquiridas</span>
        </div>
      </div>

      {/* Tabela do Relatório de Compras */}
      {items.length === 0 ? (
        <Empty>Nenhuma compra encontrada com os filtros selecionados.</Empty>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="p-3">Nome / Descrição</th>
                <th className="p-3">Produto</th>
                <th className="p-3 text-center">Quantidade</th>
                <th className="p-3 text-right">Valor unit.</th>
                <th className="p-3 text-right">Valor total</th>
                <th className="p-3 text-center">Status de pagamento</th>
                <th className="p-3">Forma de pagamento</th>
                <th className="p-3">Data pagamento / Prazo</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const isPaid = item.payment_status === 'PAGO';
                return (
                  <tr key={item.id} className="border-t border-slate-100 hover:bg-slate-50/50">
                    <td className="p-3 font-semibold text-ink">{item.name}</td>
                    <td className="p-3 font-medium text-slate-700">{item.product_name || '—'}</td>
                    <td className="p-3 text-center font-bold text-slate-800">{item.quantity}</td>
                    <td className="p-3 text-right text-slate-600">{brl(item.unit_price)}</td>
                    <td className="p-3 text-right font-bold text-ink">{brl(item.total_price)}</td>
                    <td className="p-3 text-center whitespace-nowrap">
                      <span
                        className={`inline-block rounded-md px-2.5 py-0.5 text-xs font-bold ${
                          isPaid
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-900'
                        }`}
                      >
                        {item.payment_status}
                      </span>
                    </td>
                    <td className="p-3">
                      <div className="font-medium text-slate-800">{item.payment_method || '—'}</div>
                      {item.payment_method === 'Pix' && item.pix_key && (
                        <div className="text-[11px] text-slate-500">Chave: {item.pix_key}</div>
                      )}
                      {item.payment_method === 'Cartão Crédito' && item.card_info && (
                        <div className="text-[11px] text-slate-500">{item.card_info}</div>
                      )}
                    </td>
                    <td className="p-3 text-xs text-slate-600 whitespace-nowrap">
                      {item.payment_date && <div>Pago em: <span className="font-semibold text-emerald-700">{item.payment_date}</span></div>}
                      {item.due_date && <div>Prazo: <span className="font-medium text-slate-800">{item.due_date}</span></div>}
                      {!item.payment_date && !item.due_date && '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="border-t-2 border-slate-300 bg-slate-50 font-bold text-ink">
              <tr>
                <td colSpan={2} className="p-3 text-left">TOTAIS:</td>
                <td className="p-3 text-center">{summary.total_quantity} un.</td>
                <td className="p-3" />
                <td className="p-3 text-right text-ink">{brl(summary.total_amount)}</td>
                <td colSpan={3} className="p-3 text-right text-xs text-slate-500">
                  Pago: <span className="text-emerald-700 font-bold">{brl(summary.total_paid)}</span> | A Pagar: <span className="text-amber-deep font-bold">{brl(summary.total_pending)}</span>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </>
  );
}

