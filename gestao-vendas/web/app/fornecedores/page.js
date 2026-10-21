'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { PageHeader, Modal, Field, ErrorNote, Empty } from '@/components/ui';

const PLATFORMS = ['Mercado Livre', 'Shopee', 'Amazon', 'Site próprio', 'WhatsApp', 'Outro'];
const blank = { name: '', link: '', phone: '', notes: '' };

function SupplierCard({ s, onChange, onEdit }) {
  const [item, setItem] = useState({ item: '', platform: PLATFORMS[0], link: '' });
  const [error, setError] = useState('');

  async function add(e) {
    e.preventDefault();
    try {
      await api(`/suppliers/${s.id}/items`, { method: 'POST', body: item });
      setItem({ ...item, item: '', link: '' }); setError(''); onChange();
    } catch (err) { setError(err.message); }
  }
  async function removeItem(id) { await api(`/supplier-items/${id}`, { method: 'DELETE' }); onChange(); }
  async function removeSupplier() {
    if (!confirm(`Excluir o fornecedor "${s.name}"?`)) return;
    await api(`/suppliers/${s.id}`, { method: 'DELETE' }); onChange();
  }

  return (
    <article className="rounded-lg border border-slate-200 bg-white p-5">
      <header className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">{s.name}</h2>
          <p className="text-sm text-slate-500">{[s.phone, s.notes].filter(Boolean).join(' · ')}</p>
          {s.link && <a href={s.link} target="_blank" rel="noreferrer" className="text-sm text-brand hover:underline">Abrir link principal</a>}
        </div>
        <div className="space-x-3 whitespace-nowrap">
          <button className="text-sm font-medium text-brand hover:underline" onClick={() => onEdit(s)}>Editar</button>
          <button className="btn-danger" onClick={removeSupplier}>Excluir</button>
        </div>
      </header>
      <h3 className="mb-2 text-sm font-semibold text-slate-700">O que vende</h3>
      {s.items.length === 0 ? <p className="mb-3 text-sm text-slate-500">Nada cadastrado ainda.</p> : (
        <ul className="mb-3 divide-y divide-slate-100 text-sm">
          {s.items.map((i) => (
            <li key={i.id} className="flex items-center justify-between gap-3 py-2">
              <div><span className="font-medium">{i.item}</span>
                {i.platform && <span className="ml-2 rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{i.platform}</span>}
                {i.link && <a href={i.link} target="_blank" rel="noreferrer" className="ml-3 text-brand hover:underline">Ver anúncio</a>}</div>
              <button className="btn-danger" onClick={() => removeItem(i.id)}>Remover</button>
            </li>))}
        </ul>
      )}
      <ErrorNote message={error} />
      <form onSubmit={add} className="grid gap-2 sm:grid-cols-[1fr_9rem_1.4fr_auto]">
        <input className="input" placeholder="Item (ex.: caixa)" aria-label="Item" value={item.item} onChange={(e) => setItem({ ...item, item: e.target.value })} />
        <select className="input" aria-label="Onde vende" value={item.platform} onChange={(e) => setItem({ ...item, platform: e.target.value })}>{PLATFORMS.map((p) => <option key={p}>{p}</option>)}</select>
        <input className="input" type="url" placeholder="Link do fornecedor para este item" aria-label="Link" value={item.link} onChange={(e) => setItem({ ...item, link: e.target.value })} />
        <button className="btn-ghost">Adicionar</button>
      </form>
    </article>
  );
}

export default function FornecedoresPage() {
  const [list, setList] = useState([]);
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState('');
  const load = () => api('/suppliers').then(setList).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  async function save(e) {
    e.preventDefault();
    try {
      const { id, items, ...body } = editing;
      await api(id ? `/suppliers/${id}` : '/suppliers', { method: id ? 'PUT' : 'POST', body });
      setEditing(null); setError(''); load();
    } catch (err) { setError(err.message); }
  }

  return (
    <>
      <PageHeader title="Fornecedores" subtitle="Quem vende para você, o que cada um vende e onde encontrar (Mercado Livre, site, WhatsApp…)."
        action={<button className="btn" onClick={() => { setError(''); setEditing(blank); }}>Novo fornecedor</button>} />
      <ErrorNote message={editing ? '' : error} />
      {list.length === 0 ? <Empty>Nenhum fornecedor cadastrado ainda.</Empty> : (
        <div className="space-y-4">{list.map((s) => <SupplierCard key={s.id} s={s} onChange={load} onEdit={(x) => { setError(''); setEditing(x); }} />)}</div>
      )}
      {editing && (
        <Modal title={editing.id ? 'Editar fornecedor' : 'Novo fornecedor'} onClose={() => setEditing(null)}>
          <ErrorNote message={error} />
          <form onSubmit={save} className="grid gap-3 sm:grid-cols-2">
            <Field label="Nome" className="sm:col-span-2"><input className="input" required autoFocus value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></Field>
            <Field label="Telefone"><input className="input" value={editing.phone || ''} onChange={(e) => setEditing({ ...editing, phone: e.target.value })} /></Field>
            <Field label="Link principal"><input className="input" type="url" value={editing.link || ''} onChange={(e) => setEditing({ ...editing, link: e.target.value })} /></Field>
            <Field label="Observações" className="sm:col-span-2"><input className="input" value={editing.notes || ''} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} /></Field>
            <div className="sm:col-span-2"><button className="btn">Salvar fornecedor</button></div>
          </form>
        </Modal>
      )}
    </>
  );
}
