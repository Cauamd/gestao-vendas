'use client';
import { StyledSelect } from '@/components/StyledSelect';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { PageHeader, Modal, Field, ErrorNote } from '@/components/ui';

const COLUMNS = [
  { id: 'conversando', title: 'Conversando', hint: 'Primeiro contato, ainda negociando', bar: 'bg-amber-deep' },
  { id: 'andamento', title: 'Em andamento', hint: 'Pedido fechado, em produção ou entrega', bar: 'bg-brand' },
  { id: 'finalizado', title: 'Finalizado', hint: 'Tudo entregue e pago', bar: 'bg-slate-500' },
];

export default function KanbanPage() {
  const [customers, setCustomers] = useState([]);
  const [dragId, setDragId] = useState(null);
  const [overCol, setOverCol] = useState(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '' });
  const [error, setError] = useState('');

  const load = () => api('/customers').then(setCustomers).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  async function move(id, stage) {
    const prev = customers;
    setCustomers((cs) => cs.map((c) => (c.id === id ? { ...c, stage } : c)));
    try { await api(`/customers/${id}/stage`, { method: 'PATCH', body: { stage } }); }
    catch (e) { setCustomers(prev); setError(e.message); }
  }

  async function create(e) {
    e.preventDefault();
    try {
      await api('/customers', { method: 'POST', body: { ...form, stage: 'conversando' } });
      setForm({ name: '', phone: '' }); setAdding(false); setError(''); load();
    } catch (err) { setError(err.message); }
  }

  return (
    <>
      <PageHeader title="Funil de clientes" subtitle="Arraste o cartão para a coluna certa conforme a conversa avança."
        action={<button className="btn" onClick={() => setAdding(true)}>Novo cliente</button>} />
      <ErrorNote message={error} />
      <div className="grid gap-4 md:grid-cols-3">
        {COLUMNS.map((col) => {
          const items = customers.filter((c) => c.stage === col.id);
          return (
            <section key={col.id} aria-label={col.title}
              onDragOver={(e) => { e.preventDefault(); setOverCol(col.id); }}
              onDragLeave={() => setOverCol(null)}
              onDrop={() => { if (dragId) move(dragId, col.id); setDragId(null); setOverCol(null); }}
              className={`min-h-[18rem] rounded-lg border bg-white/70 p-3 ${overCol === col.id ? 'border-brand bg-brand-soft/50' : 'border-slate-200'}`}>
              <div className={`mb-3 h-1 rounded ${col.bar}`} />
              <div className="mb-3 flex items-baseline justify-between">
                <h2 className="font-bold">{col.title}</h2>
                <span className="text-sm text-slate-500">{items.length}</span>
              </div>
              <p className="mb-3 text-xs text-slate-500">{col.hint}</p>
              <ul className="space-y-2">
                {items.map((c) => (
                  <li key={c.id} draggable onDragStart={() => setDragId(c.id)} onDragEnd={() => setDragId(null)}
                    className="cursor-grab rounded-md border border-slate-200 bg-white p-3 shadow-sm active:cursor-grabbing">
                    <Link href={`/clientes/${c.id}`} className="font-semibold hover:underline">{c.name}</Link>
                    <p className="text-xs text-slate-500">{[c.phone, c.city].filter(Boolean).join(' · ') || 'Sem contato'}</p>
                    {/* alternativa ao arrastar (celular e teclado) */}
                    <StyledSelect aria-label={`Mover ${c.name}`} value={c.stage} onChange={(e) => move(c.id, e.target.value)}
                      className="mt-2 w-full rounded border border-slate-200 bg-slate-50 px-2 py-1 text-xs">
                      {COLUMNS.map((o) => <option key={o.id} value={o.id}>{o.title}</option>)}
                    </StyledSelect>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
      {adding && (
        <Modal title="Novo cliente" onClose={() => setAdding(false)}>
          <form onSubmit={create} className="space-y-3">
            <Field label="Nome"><input className="input" required autoFocus value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
            <Field label="Telefone"><input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
            <p className="text-xs text-slate-500">Você completa endereço e documentos depois, na tela de Clientes.</p>
            <button className="btn">Adicionar em Conversando</button>
          </form>
        </Modal>
      )}
    </>
  );
}
