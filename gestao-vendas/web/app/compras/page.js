'use client';
import { useEffect, useState } from 'react';
import { api, brl, dateBR } from '@/lib/api';
import { PageHeader, Modal, Field, ErrorNote, Empty } from '@/components/ui';
import { ExternalLink, Plus } from 'lucide-react';

const PAYMENT_METHODS = ['Pix', 'Dinheiro', 'Cartão Débito', 'Cartão Crédito'];
const PAYMENT_STATUSES = ['A PAGAR', 'PAGO'];

const blank = {
  name: '',
  purchase_link: '',
  unit_price: '',
  total_price: '',
  quantity: 1,
  product_id: '',
  product_name: '',
  purchase_date: '',
  payment_date: '',
  due_date: '',
  payment_status: 'A PAGAR',
  payment_method: 'Pix',
  pix_key: '',
  card_info: '',
};

export default function ComprasPage() {
  const [list, setList] = useState([]);
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('TODOS');
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState('');

  const load = () => {
    Promise.all([api('/purchases'), api('/products')])
      .then(([purchases, prods]) => {
        setList(purchases);
        setProducts(prods);
      })
      .catch((e) => setError(e.message));
  };

  useEffect(() => {
    load();
  }, []);

  const set = (k) => (e) => {
    const val = e.target.value;
    setEditing((prev) => {
      const updated = { ...prev, [k]: val };
      // Auto-calcula o total se alterar unit_price ou quantity
      if (k === 'unit_price' || k === 'quantity') {
        const u = k === 'unit_price' ? Number(val || 0) : Number(prev.unit_price || 0);
        const q = k === 'quantity' ? Number(val || 0) : Number(prev.quantity || 0);
        updated.total_price = (u * q).toFixed(2);
      }
      return updated;
    });
  };

  function onSelectProduct(productId) {
    const prod = products.find((p) => String(p.id) === productId);
    setEditing((prev) => ({
      ...prev,
      product_id: productId,
      product_name: prod ? prod.name : prev.product_name,
      unit_price: prod?.cost_price ? prod.cost_price : prev.unit_price,
      total_price: prod?.cost_price ? (Number(prod.cost_price) * Number(prev.quantity || 1)).toFixed(2) : prev.total_price,
    }));
  }

  async function save(e) {
    e.preventDefault();
    try {
      const { id, ...body } = editing;
      await api(id ? `/purchases/${id}` : '/purchases', {
        method: id ? 'PUT' : 'POST',
        body,
      });
      setEditing(null);
      setError('');
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function remove(purchase) {
    if (!confirm(`Excluir a compra "${purchase.name}"?`)) return;
    await api(`/purchases/${purchase.id}`, { method: 'DELETE' });
    load();
  }

  const shown = list.filter((p) => {
    const matchesSearch = [p.name, p.product_name, p.payment_method, p.pix_key, p.card_info]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'TODOS' || p.payment_status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <>
      <PageHeader
        title="Compras"
        subtitle="Controle suas compras de mercadorias, insumos, fornecedores, status de pagamento e prazos."
        action={
          <button className="btn" onClick={() => { setError(''); const d = new Date(); const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; setEditing({ ...blank, purchase_date: today }); }}>
            Nova compra
          </button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          className="input max-w-sm"
          placeholder="Buscar por nome, produto, forma de pagto..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="input max-w-[10rem]"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="TODOS">Todos os status</option>
          <option value="A PAGAR">A PAGAR</option>
          <option value="PAGO">PAGO</option>
        </select>
      </div>

      <ErrorNote message={editing ? '' : error} />

      {shown.length === 0 ? (
        <Empty>Nenhuma compra encontrada. Clique em “Nova compra” para registrar.</Empty>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="p-3">Status</th>
                <th className="p-3">Nome / Descrição</th>
                <th className="p-3">Produto</th>
                <th className="p-3 text-center">Qtd.</th>
                <th className="p-3">Valor unit.</th>
                <th className="p-3">Valor total</th>
                <th className="p-3">Forma de pagamento</th>
                <th className="p-3">Prazo / Pagamento</th>
                <th className="p-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((p) => {
                const isPaid = p.payment_status === 'PAGO';
                return (
                  <tr key={p.id} className="border-t border-slate-100 hover:bg-slate-50/50">
                    <td className="p-3 whitespace-nowrap">
                      <span
                        className={`inline-block rounded-md px-2.5 py-1 text-xs font-bold ${
                          isPaid
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-900'
                        }`}
                      >
                        {p.payment_status}
                      </span>
                    </td>
                    <td className="p-3 font-semibold text-ink">
                      <div>{p.name}</div>
                      {p.purchase_date && (
                        <div className="text-xs font-normal text-slate-500">Compra: {dateBR(p.purchase_date)}</div>
                      )}
                      {p.purchase_link && (
                        <a
                          href={p.purchase_link}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-normal text-brand hover:underline"
                        >
                          Ver link <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </td>
                    <td className="p-3 text-slate-700">{p.product_name || '—'}</td>
                    <td className="p-3 text-center font-medium">{p.quantity}</td>
                    <td className="p-3 text-slate-600">{brl(p.unit_price)}</td>
                    <td className="p-3 font-bold text-ink">{brl(p.total_price)}</td>
                    <td className="p-3">
                      <div className="font-medium text-slate-800">{p.payment_method || '—'}</div>
                      {p.payment_method === 'Pix' && p.pix_key && (
                        <div className="text-[11px] text-slate-500">Chave: {p.pix_key}</div>
                      )}
                      {p.payment_method === 'Cartão Crédito' && p.card_info && (
                        <div className="text-[11px] text-slate-500">{p.card_info}</div>
                      )}
                    </td>
                    <td className="p-3 text-xs text-slate-600 whitespace-nowrap">
                      {p.due_date && <div>Prazo: <span className="font-medium text-slate-800">{p.due_date}</span></div>}
                      {p.payment_date && <div>Pago em: <span className="font-medium text-emerald-700">{p.payment_date}</span></div>}
                      {!p.due_date && !p.payment_date && '—'}
                    </td>
                    <td className="space-x-3 whitespace-nowrap p-3 text-right">
                      <button
                        className="text-sm font-medium text-brand hover:underline"
                        onClick={() => { setError(''); setEditing(p); }}
                      >
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

      {/* Modal de Criação / Edição de Compra */}
      {editing && (
        <Modal title={editing.id ? 'Editar compra' : 'Nova compra'} onClose={() => setEditing(null)}>
          <ErrorNote message={error} />
          <form onSubmit={save} className="grid gap-3 sm:grid-cols-6">
            <Field label="Nome da compra / Fornecedor" className="sm:col-span-4">
              <input
                className="input"
                required
                autoFocus
                value={editing.name}
                onChange={set('name')}
                placeholder="Ex: Compra de matéria-prima, Embalagens..."
              />
            </Field>

            <Field label="Status de pagamento" className="sm:col-span-2">
              <select
                className="input font-semibold"
                value={editing.payment_status || 'A PAGAR'}
                onChange={set('payment_status')}
              >
                {PAYMENT_STATUSES.map((st) => (
                  <option key={st} value={st}>{st}</option>
                ))}
              </select>
            </Field>

            <Field label="Produto do catálogo (opcional)" className="sm:col-span-3">
              <select
                className="input"
                value={editing.product_id || ''}
                onChange={(e) => onSelectProduct(e.target.value)}
              >
                <option value="">Selecione ou deixe em branco</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </Field>

            <Field label="Nome do produto / Item" className="sm:col-span-3">
              <input
                className="input"
                value={editing.product_name || ''}
                onChange={set('product_name')}
                placeholder="Nome do produto comprado"
              />
            </Field>

            <Field label="Quantidade" className="sm:col-span-2">
              <input
                className="input"
                type="number"
                min="1"
                required
                value={editing.quantity}
                onChange={set('quantity')}
              />
            </Field>

            <Field label="Valor unitário (R$)" className="sm:col-span-2">
              <input
                className="input"
                type="number"
                step="0.01"
                min="0"
                required
                value={editing.unit_price}
                onChange={set('unit_price')}
                placeholder="0,00"
              />
            </Field>

            <Field label="Valor total (R$)" className="sm:col-span-2">
              <input
                className="input font-semibold"
                type="number"
                step="0.01"
                min="0"
                required
                value={editing.total_price}
                onChange={set('total_price')}
                placeholder="0,00"
              />
            </Field>

            <Field label="Link de compra (URL)" className="sm:col-span-6">
              <input
                className="input"
                type="url"
                value={editing.purchase_link || ''}
                onChange={set('purchase_link')}
                placeholder="https://mercadolivre.com.br/item/..."
              />
            </Field>

            <Field label="Forma de pagamento" className="sm:col-span-3">
              <select
                className="input"
                value={editing.payment_method || 'Pix'}
                onChange={set('payment_method')}
              >
                {PAYMENT_METHODS.map((pm) => (
                  <option key={pm} value={pm}>{pm}</option>
                ))}
              </select>
            </Field>

            {editing.payment_method === 'Pix' && (
              <Field label="Chave de acesso Pix" className="sm:col-span-3">
                <input
                  className="input"
                  value={editing.pix_key || ''}
                  onChange={set('pix_key')}
                  placeholder="Chave Pix (CPF, CNPJ, e-mail, telefone ou aleatória)"
                />
              </Field>
            )}

            {editing.payment_method === 'Cartão Crédito' && (
              <Field label="Informação do cartão e banco" className="sm:col-span-3">
                <input
                  className="input"
                  value={editing.card_info || ''}
                  onChange={set('card_info')}
                  placeholder="Ex: Nubank final 4521 (1x)"
                />
              </Field>
            )}

            {editing.payment_method !== 'Pix' && editing.payment_method !== 'Cartão Crédito' && (
              <div className="hidden sm:block sm:col-span-3" />
            )}

            <Field label="Data da compra" className="sm:col-span-2">
              <input
                className="input"
                type="date"
                value={editing.purchase_date || ''}
                onChange={set('purchase_date')}
              />
            </Field>

            <Field label="Prazo Pagamento (data manual)" className="sm:col-span-2">
              <input
                className="input"
                type="text"
                value={editing.due_date || ''}
                onChange={set('due_date')}
                placeholder="Ex: 25/11/2026 ou 30 dias"
              />
            </Field>

            <Field label="Data pagamento" className="sm:col-span-2">
              <input
                className="input"
                type="text"
                value={editing.payment_date || ''}
                onChange={set('payment_date')}
                placeholder="Ex: 23/10/2026"
              />
            </Field>

            <div className="sm:col-span-6 mt-3">
              <button className="btn">Salvar compra</button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}

