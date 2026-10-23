'use client';
import { useEffect, useState } from 'react';
import { api, brl, dateBR } from '@/lib/api';
import { PageHeader, Field, ErrorNote, Empty } from '@/components/ui';
import { DollarSign, Filter, Printer, TrendingUp, X } from 'lucide-react';

export default function RelatorioVendasPage() {
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [productId, setProductId] = useState('');

  const [data, setData] = useState({ items: [], summary: { total_revenue: 0, total_cost: 0, total_profit: 0, total_quantity: 0 } });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([api('/customers'), api('/products')])
      .then(([c, p]) => {
        setCustomers(c);
        setProducts(p);
      })
      .catch((e) => setError(e.message));
  }, []);

  const loadReport = () => {
    setLoading(true);
    const query = new URLSearchParams();
    if (startDate) query.set('start_date', startDate);
    if (endDate) query.set('end_date', endDate);
    if (customerId) query.set('customer_id', customerId);
    if (productId) query.set('product_id', productId);

    api(`/reports/sales?${query.toString()}`)
      .then((res) => {
        setData(res);
        setError('');
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadReport();
  }, [startDate, endDate, customerId, productId]);

  function clearFilters() {
    setStartDate('');
    setEndDate('');
    setCustomerId('');
    setProductId('');
  }

  const { items, summary } = data;
  const marginPercentage = summary.total_revenue > 0
    ? ((summary.total_profit / summary.total_revenue) * 100).toFixed(1)
    : '0';

  return (
    <>
      <div className="print:hidden">
        <PageHeader
          title="Relatório de Vendas"
          subtitle="Filtre e visualize detalhadamente produtos vendidos, valores de custo, valores de venda e margens de lucro."
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

        {/* Barra de Filtros */}
        <div className="mb-6 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-600">
              <Filter className="h-4 w-4 text-brand" /> Filtros do Relatório
            </span>
            {(startDate || endDate || customerId || productId) && (
              <button
                onClick={clearFilters}
                className="flex items-center gap-1 text-xs font-semibold text-brand hover:underline"
              >
                <X className="h-3.5 w-3.5" /> Limpar filtros
              </button>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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

            <Field label="Cliente">
              <select
                className="input"
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
              >
                <option value="">Todos os clientes</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Produto">
              <select
                className="input"
                value={productId}
                onChange={(e) => setProductId(e.target.value)}
              >
                <option value="">Todos os produtos</option>
                {products.map((p) => (
                  <option key={p.id} value={p.name}>
                    {p.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </div>
      </div>

      <ErrorNote message={error} />

      {/* Cards de Totais */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Vendas */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <span className="text-xs font-semibold uppercase text-slate-500">Valor Total Venda</span>
          <div className="mt-2 text-2xl font-extrabold text-ink">{brl(summary.total_revenue)}</div>
          <span className="text-xs text-slate-500">{summary.total_quantity} item(ns) vendido(s)</span>
        </div>

        {/* Total Custo */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <span className="text-xs font-semibold uppercase text-slate-500">Valor Total Custo</span>
          <div className="mt-2 text-2xl font-extrabold text-slate-700">{brl(summary.total_cost)}</div>
          <span className="text-xs text-slate-500">Custo base dos produtos</span>
        </div>

        {/* Lucro Total */}
        <div className="rounded-xl border border-rose-200 bg-white p-4 shadow-sm">
          <span className="text-xs font-semibold uppercase text-rose-600">Lucro Total</span>
          <div className={`mt-2 text-2xl font-extrabold ${summary.total_profit >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
            {brl(summary.total_profit)}
          </div>
          <span className="text-xs text-slate-500">Venda subtraído do Custo</span>
        </div>

        {/* Margem Percentual */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <span className="text-xs font-semibold uppercase text-slate-500">Margem Média</span>
          <div className="mt-2 text-2xl font-extrabold text-brand">{marginPercentage}%</div>
          <span className="text-xs text-slate-500">Rentabilidade sobre as vendas</span>
        </div>
      </div>

      {/* Tabela de Resultados do Relatório */}
      {items.length === 0 ? (
        <Empty>Nenhuma venda encontrada com os filtros selecionados.</Empty>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="p-3">Data Venda</th>
                <th className="p-3">Cliente</th>
                <th className="p-3">Produto</th>
                <th className="p-3 text-center">Qtd. Venda</th>
                <th className="p-3 text-right">Valor Unit. Custo</th>
                <th className="p-3 text-right">Valor Unit. Venda</th>
                <th className="p-3 text-right">Valor Total Custo</th>
                <th className="p-3 text-right">Valor Total Venda</th>
                <th className="p-3 text-right">Margem Lucro</th>
                <th className="p-3 text-center">Forma Pagto</th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => {
                const profit = Number(row.total_profit || 0);
                return (
                  <tr key={`${row.sale_id}-${row.item_id}`} className="border-t border-slate-100 hover:bg-slate-50/50">
                    <td className="p-3 text-slate-600 whitespace-nowrap">{dateBR(row.created_at)}</td>
                    <td className="p-3 font-semibold text-ink">{row.customer_name}</td>
                    <td className="p-3 font-medium text-slate-800">{row.product_name}</td>
                    <td className="p-3 text-center font-bold">{row.quantity}</td>
                    <td className="p-3 text-right text-slate-600">{brl(row.unit_cost)}</td>
                    <td className="p-3 text-right font-medium">{brl(row.unit_price)}</td>
                    <td className="p-3 text-right text-slate-600">{brl(row.total_cost)}</td>
                    <td className="p-3 text-right font-semibold text-ink">{brl(row.total_revenue)}</td>
                    <td className="p-3 text-right font-bold whitespace-nowrap">
                      <span className={profit >= 0 ? 'text-emerald-700' : 'text-red-600'}>
                        {brl(profit)}
                      </span>
                    </td>
                    <td className="p-3 text-center whitespace-nowrap">
                      <span className="rounded bg-rose-50 px-2 py-0.5 text-xs font-semibold text-brand">
                        {row.payment_method || 'Pix'}
                        {row.payment_method === 'Cartão Crédito' && row.installments > 1 ? ` (${row.installments}x)` : ''}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {/* Linha de Totais Gerais */}
            <tfoot className="border-t-2 border-slate-300 bg-slate-50 font-bold text-ink">
              <tr>
                <td colSpan={3} className="p-3 text-left">TOTAIS GERAIS:</td>
                <td className="p-3 text-center">{summary.total_quantity} un.</td>
                <td className="p-3" />
                <td className="p-3" />
                <td className="p-3 text-right text-slate-700">{brl(summary.total_cost)}</td>
                <td className="p-3 text-right text-ink">{brl(summary.total_revenue)}</td>
                <td className="p-3 text-right text-emerald-700">{brl(summary.total_profit)}</td>
                <td className="p-3" />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </>
  );
}

