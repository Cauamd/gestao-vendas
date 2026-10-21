'use client';
import { useEffect, useState } from 'react';
import { api, brl } from '@/lib/api';
import { PageHeader, Modal, Field, ErrorNote, Empty } from '@/components/ui';

const blank = { name: '', unit_price: '', quantity: '' };

export default function ProdutosPage() {
  const [list, setList] = useState([]);
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState('');
  const load = () => api('/products').then(setList).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  async function save(e) {
    e.preventDefault();
    try {
      const { id, ...body } = editing;
      await api(id ? `/products/${id}` : '/products', { method: id ? 'PUT' : 'POST', body });
      setEditing(null); setError(''); load();
    } catch (err) { setError(err.message); }
  }
  async function remove(p) {
    if (!confirm(`Excluir "${p.name}"?`)) return;
    await api(`/products/${p.id}`, { method: 'DELETE' }); load();
  }

  return (
    <>
      <PageHeader title="Produtos" subtitle="Cadastre o que você vende, com valor unitário e quantidade em estoque."
        action={<button className="btn" onClick={() => { setError(''); setEditing(blank); }}>Novo produto</button>} />
      {list.length === 0 ? <Empty>Nenhum produto ainda. Clique em “Novo produto” para cadastrar o primeiro.</Empty> : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600"><tr>
              <th className="p-3">Produto</th><th className="p-3">Valor unitário</th><th className="p-3">Quantidade</th><th className="p-3" />
            </tr></thead>
            <tbody>{list.map((p) => (
              <tr key={p.id} className="border-t border-slate-100">
                <td className="p-3 font-medium">{p.name}</td>
                <td className="p-3">{brl(p.unit_price)}</td>
                <td className="p-3">
                  {p.quantity}
                  {p.quantity <= 5 && <span className="ml-2 rounded bg-amber-soft px-2 py-0.5 text-xs font-medium text-amber-deep">{p.quantity === 0 ? 'Sem estoque' : 'Estoque baixo'}</span>}
                </td>
                <td className="space-x-3 p-3 text-right">
                  <button className="text-sm font-medium text-brand hover:underline" onClick={() => { setError(''); setEditing(p); }}>Editar</button>
                  <button className="btn-danger" onClick={() => remove(p)}>Excluir</button>
                </td>
              </tr>))}
            </tbody>
          </table>
        </div>
      )}
      {editing && (
        <Modal title={editing.id ? 'Editar produto' : 'Novo produto'} onClose={() => setEditing(null)}>
          <ErrorNote message={error} />
          <form onSubmit={save} className="grid gap-3 sm:grid-cols-3">
            <Field label="Produto" className="sm:col-span-3"><input className="input" required autoFocus value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></Field>
            <Field label="Valor unitário (R$)"><input className="input" type="number" step="0.01" min="0" required value={editing.unit_price} onChange={(e) => setEditing({ ...editing, unit_price: e.target.value })} /></Field>
            <Field label="Quantidade"><input className="input" type="number" min="0" required value={editing.quantity} onChange={(e) => setEditing({ ...editing, quantity: e.target.value })} /></Field>
            <div className="sm:col-span-3"><button className="btn">Salvar produto</button></div>
          </form>
        </Modal>
      )}
    </>
  );
}
