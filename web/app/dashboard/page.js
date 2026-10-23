'use client';
import { StyledSelect } from '@/components/StyledSelect';
import { useEffect, useState } from 'react';
import { api, brl } from '@/lib/api';
import { PageHeader, ErrorNote, Empty } from '@/components/ui';
import {
  Calendar,
  DollarSign,
  TrendingUp,
  Package,
  Users,
  ShoppingCart,
  Award,
} from 'lucide-react';

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

export default function DashboardPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = () => {
    setLoading(true);
    api(`/dashboard?year=${year}&month=${month}`)
      .then((res) => {
        setData(res);
        setError('');
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [year, month]);

  const maxMonthValue = data?.monthly_sales
    ? Math.max(...data.monthly_sales.map((m) => m.total), 1)
    : 1;

  const maxTopProdQty = data?.top_products?.length
    ? Math.max(...data.top_products.map((p) => p.quantity), 1)
    : 1;

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle="Acompanhe o faturamento mensal e anual, evolução de vendas e produtos mais vendidos."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm shadow-sm">
              <Calendar className="h-4 w-4 text-slate-500" />
              <StyledSelect
                aria-label="Mês"
                value={month}
                onChange={(e) => setMonth(Number(e.target.value))}
                className="bg-transparent font-medium text-slate-700 outline-none cursor-pointer"
              >
                {MONTHS.map((m, idx) => (
                  <option key={idx + 1} value={idx + 1}>
                    {m}
                  </option>
                ))}
              </StyledSelect>
            </div>
            <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm shadow-sm">
              <StyledSelect
                aria-label="Ano"
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className="bg-transparent font-medium text-slate-700 outline-none cursor-pointer"
              >
                {[year + 1, year, year - 1, year - 2].map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </StyledSelect>
            </div>
          </div>
        }
      />

      <ErrorNote message={error} />

      {/* Cards de Métricas */}
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Arrecadado no Mês */}
        <div className="relative overflow-hidden rounded-xl border border-rose-200 bg-white p-5 shadow-sm transition hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-rose-600">
              Arrecadado em {MONTHS[month - 1]}
            </span>
            <span className="rounded-lg bg-rose-50 p-2 text-brand">
              <DollarSign className="h-5 w-5" />
            </span>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-extrabold text-ink">
              {data ? brl(data.monthly_total) : '...'}
            </div>
            <p className="mt-1 text-xs text-slate-500">
              {data ? `${data.monthly_count} ${data.monthly_count === 1 ? 'venda realizada' : 'vendas realizadas'}` : 'Carregando...'}
            </p>
          </div>
          <div className="absolute -bottom-1 left-0 right-0 h-1 bg-gradient-to-r from-rose-400 to-brand" />
        </div>

        {/* Arrecadado no Ano */}
        <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Arrecadado no Ano ({year})
            </span>
            <span className="rounded-lg bg-slate-50 p-2 text-ink">
              <TrendingUp className="h-5 w-5" />
            </span>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-extrabold text-ink">
              {data ? brl(data.yearly_total) : '...'}
            </div>
            <p className="mt-1 text-xs text-slate-500">
              {data ? `${data.yearly_count} ${data.yearly_count === 1 ? 'venda acumulada' : 'vendas acumuladas'}` : 'Carregando...'}
            </p>
          </div>
          <div className="absolute -bottom-1 left-0 right-0 h-1 bg-ink" />
        </div>

        {/* Clientes e Produtos */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Base de Cadastros
            </span>
            <span className="rounded-lg bg-amber-50 p-2 text-amber-deep">
              <Users className="h-5 w-5" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <div>
              <div className="text-2xl font-extrabold text-ink">
                {data?.stats?.customers ?? '0'}
              </div>
              <p className="text-xs text-slate-500">Clientes ativos</p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-extrabold text-ink">
                {data?.stats?.products ?? '0'}
              </div>
              <p className="text-xs text-slate-500">Produtos</p>
            </div>
          </div>
        </div>

        {/* Compras a Pagar */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Contas a Pagar (Compras)
            </span>
            <span className="rounded-lg bg-red-50 p-2 text-red-600">
              <ShoppingCart className="h-5 w-5" />
            </span>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-extrabold text-red-600">
              {data ? brl(data.stats.purchases_pending_total) : '...'}
            </div>
            <p className="mt-1 text-xs text-slate-500">
              {data?.stats?.purchases_pending_count ?? 0} compra(s) pendente(s)
            </p>
          </div>
        </div>
      </div>

      {/* Gráficos em Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Gráfico 1: Vendas em Cada Mês */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-2">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-bold text-ink">Vendas em Cada Mês ({year})</h2>
              <p className="text-xs text-slate-500">Faturamento arrecadado ao longo de cada mês do ano</p>
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-600">
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-sm bg-brand" /> Mês selecionado
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-sm bg-rose-200" /> Demais meses
              </span>
            </div>
          </div>

          {/* Gráfico de Barras Mensais */}
          <div className="flex h-64 items-end gap-2 pt-6 sm:gap-3">
            {data?.monthly_sales?.map((item) => {
              const heightPercent = maxMonthValue > 0 ? (item.total / maxMonthValue) * 100 : 0;
              const isSelected = item.month === month;
              return (
                <div
                  key={item.month}
                  className="group relative flex flex-1 flex-col items-center h-full justify-end"
                >
                  {/* Tooltip no hover */}
                  <div className="pointer-events-none absolute -top-10 z-10 hidden whitespace-nowrap rounded-md bg-ink px-2 py-1 text-center text-xs font-semibold text-white shadow-lg group-hover:block">
                    <div>{item.name}: {brl(item.total)}</div>
                    <div className="text-[10px] text-rose-200">{item.count} {item.count === 1 ? 'venda' : 'vendas'}</div>
                  </div>

                  {/* Valor acima da barra se houver venda */}
                  {item.total > 0 && (
                    <span className="mb-1 text-[10px] font-semibold text-slate-600 hidden sm:block truncate max-w-full">
                      {item.total >= 1000 ? `${(item.total / 1000).toFixed(1)}k` : item.total.toFixed(0)}
                    </span>
                  )}

                  {/* A barra */}
                  <div
                    style={{ height: `${Math.max(heightPercent, 4)}%` }}
                    className={`w-full rounded-t-md transition-all duration-300 ${
                      isSelected
                        ? 'bg-gradient-to-t from-rose-600 to-brand shadow-sm'
                        : item.total > 0
                        ? 'bg-rose-200 hover:bg-rose-300'
                        : 'bg-slate-100 hover:bg-slate-200'
                    }`}
                  />

                  {/* Nome do Mês */}
                  <span
                    className={`mt-2 text-[11px] font-medium ${
                      isSelected ? 'font-bold text-brand' : 'text-slate-500'
                    }`}
                  >
                    {item.name}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Gráfico 2: Top 5 Produtos Mais Vendidos */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4">
            <h2 className="flex items-center gap-2 text-base font-bold text-ink">
              <Award className="h-5 w-5 text-brand" /> Top 5 Produtos Mais Vendidos
            </h2>
            <p className="text-xs text-slate-500">Ranking por volume de unidades vendidas</p>
          </div>

          {(!data?.top_products || data.top_products.length === 0) ? (
            <div className="py-12 text-center text-sm text-slate-500">
              Nenhuma venda registrada ainda para calcular o ranking.
            </div>
          ) : (
            <div className="space-y-4 pt-2">
              {data.top_products.map((p, index) => {
                const percent = (p.quantity / maxTopProdQty) * 100;
                return (
                  <div key={index} className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2 truncate pr-2">
                        <span
                          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                            index === 0
                              ? 'bg-amber-100 text-amber-deep'
                              : index === 1
                              ? 'bg-slate-200 text-slate-700'
                              : index === 2
                              ? 'bg-rose-100 text-brand'
                              : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {index + 1}
                        </span>
                        <span className="truncate font-medium text-slate-800" title={p.name}>
                          {p.name}
                        </span>
                      </div>
                      <div className="shrink-0 text-right">
                        <span className="font-bold text-ink">{p.quantity} un.</span>
                        <div className="text-[11px] text-slate-500">{brl(p.revenue)}</div>
                      </div>
                    </div>
                    {/* Barra de Progresso do Top */}
                    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                      <div
                        style={{ width: `${percent}%` }}
                        className={`h-full rounded-full transition-all duration-500 ${
                          index === 0
                            ? 'bg-gradient-to-r from-amber-400 to-amber-500'
                            : index === 1
                            ? 'bg-gradient-to-r from-rose-300 to-brand'
                            : 'bg-brand/80'
                        }`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

