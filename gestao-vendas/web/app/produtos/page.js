'use client';
import { useEffect, useState } from 'react';
import { api, brl } from '@/lib/api';
import { PageHeader, Modal, Field, ErrorNote, Empty } from '@/components/ui';

const blank = { name: '', cost_price: '', unit_price: '', quantity: '' };

export default function ProdutosPage() {
  const [list, setList] = useState([]);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState('');
  const load = () => api('/products').then(setList).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  async function save(e) {
    e.preventDefault();
    try {
      const { id, ...body } = editing;
      const cost = Number(body.cost_price || 0);
      const unit = Number(body.unit_price || 0);
      const profit_margin = Number((unit - cost).toFixed(2));
      await api(id ? `/products/${id}` : '/products', {
        method: id ? 'PUT' : 'POST',
        body: { ...body, cost_price: cost, unit_price: unit, profit_margin },
      });
      setEditing(null);
      setError('');
      load();
    } catch (err) { setError(err.message); }
  }

  async function remove(p) {
    if (!confirm(`Excluir "${p.name}"?`)) return;
    await api(`/products/${p.id}`, { method: 'DELETE' }); load();
  }

  const shown = list.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()));

  // Margem de lucro em tempo real para o modal
  const modalCost = Number(editing?.cost_price || 0);
  const modalSale = Number(editing?.unit_price || 0);
  const modalMargin = modalSale - modalCost;
  const modalMarginPct = modalCost > 0 ? ((modalMargin / modalCost) * 100).toFixed(1) : (modalSale > 0 ? '100' : '0');

  return (
    <>
      <PageHeader
        title="Produtos"
        subtitle="Cadastre o que você vende com valor de custo, valor de venda, margem de lucro e quantidade em estoque."
        action={<button className="btn" onClick={() => { setError(''); setEditing(blank); }}>Novo produto</button>}
      />

      <input
        className="input mb-4 max-w-sm"
        placeholder="Buscar produto por nome..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {shown.length === 0 ? (
        <Empty>Nenhum produto encontrado. Clique em “Novo produto” para cadastrar.</Empty>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="p-3">Produto</th>
                <th className="p-3">Valor unit. custo</th>
                <th className="p-3">Valor unit. venda</th>
                <th className="p-3">Valor margem lucro unit</th>
                <th className="p-3">Quantidade</th>
                <th className="p-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((p) => {
                const cost = Number(p.cost_price || 0);
                const sale = Number(p.unit_price || 0);
                const margin = p.profit_margin !== undefined ? Number(p.profit_margin) : sale - cost;
                const marginPct = cost > 0 ? ((margin / cost) * 100).toFixed(0) : (sale > 0 ? '100' : '0');

                return (
                  <tr key={p.id} className="border-t border-slate-100">
                    <td className="p-3 font-medium text-ink">{p.name}</td>
                    <td className="p-3 text-slate-600">{brl(cost)}</td>
                    <td className="p-3 font-medium text-slate-800">{brl(sale)}</td>
                    <td className="p-3">
                      <span className={`inline-flex items-center gap-1 font-semibold ${margin >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                        {brl(margin)}
                        <span className="text-xs font-normal text-slate-500">({marginPct}%)</span>
                      </span>
                    </td>
                    <td className="p-3">
                      <span className="font-medium">{p.quantity}</span>
                      {p.quantity <= 5 && (
                        <span className="ml-2 rounded bg-amber-soft px-2 py-0.5 text-xs font-medium text-amber-deep">
                          {p.quantity === 0 ? 'Sem estoque' : 'Estoque baixo'}
                        </span>
                      )}
                    </td>
                    <td className="space-x-3 p-3 text-right whitespace-nowrap">
                      <button className="text-sm font-medium text-brand hover:underline" onClick={() => { setError(''); setEditing(p); }}>
                        Editar
                      </button>
                      <button className="btn-danger" onClick={() => remove(p)}>
                        Excluir
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <Modal title={editing.id ? 'Editar produto' : 'Novo produto'} onClose={() => setEditing(null)}>
          <ErrorNote message={error} />
          <form onSubmit={save} className="grid gap-3 sm:grid-cols-2">
            <Field label="Produto" className="sm:col-span-2">
              <input
                className="input"
                required
                autoFocus
                value={editing.name}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                placeholder="Nome do produto"
              />
            </Field>

            <Field label="Valor unit. custo (R$)">
              <input
                className="input"
                type="number"
                step="0.01"
                min="0"
                required
                value={editing.cost_price !== undefined ? editing.cost_price : ''}
                onChange={(e) => setEditing({ ...editing, cost_price: e.target.value })}
                placeholder="0,00"
              />
            </Field>

            <Field label="Valor unit. venda (R$)">
              <input
                className="input"
                type="number"
                step="0.01"
                min="0"
                required
                value={editing.unit_price !== undefined ? editing.unit_price : ''}
                onChange={(e) => setEditing({ ...editing, unit_price: e.target.value })}
                placeholder="0,00"
              />
            </Field>

            <Field label="Valor margem lucro unit">
              <div className="flex h-10 items-center rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-semibold">
                <span className={modalMargin >= 0 ? 'text-emerald-700' : 'text-red-600'}>
                  {brl(modalMargin)}
                </span>
                <span className="ml-2 text-xs font-normal text-slate-500">
                  (Margem: {modalMarginPct}%)
                </span>
              </div>
              <p className="mt-1 text-[11px] text-slate-500">Calculado automaticamente (Venda - Custo)</p>
            </Field>

            <Field label="Quantidade em estoque">
              <input
                className="input"
                type="number"
                min="0"
                required
                value={editing.quantity}
                onChange={(e) => setEditing({ ...editing, quantity: e.target.value })}
                placeholder="0"
              />
            </Field>

            <div className="sm:col-span-2 mt-2">
              <button className="btn w-full sm:w-auto">Salvar produto</button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
