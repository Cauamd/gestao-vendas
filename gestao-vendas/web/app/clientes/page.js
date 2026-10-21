'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, address } from '@/lib/api';
import { PageHeader, Modal, Field, ErrorNote, Empty } from '@/components/ui';

const blank = { name: '', street: '', number: '', neighborhood: '', city: '', zip: '', cpf: '', cnpj: '', email: '', phone: '' };
const STAGE = { conversando: 'Conversando', andamento: 'Em andamento', finalizado: 'Finalizado' };

export default function ClientesPage() {
  const [list, setList] = useState([]);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState('');
  const load = () => api('/customers').then(setList).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  const set = (k) => (e) => setEditing({ ...editing, [k]: e.target.value });

  // Preenche rua, bairro e cidade a partir do CEP (ViaCEP)
  async function lookupCep() {
    const cep = (editing.zip || '').replace(/\D/g, '');
    if (cep.length !== 8) return;
    try {
      const d = await (await fetch(`https://viacep.com.br/ws/${cep}/json/`)).json();
      if (!d.erro) setEditing((c) => ({ ...c, street: c.street || d.logradouro, neighborhood: c.neighborhood || d.bairro, city: c.city || d.localidade }));
    } catch {}
  }

  async function save(e) {
    e.preventDefault();
    try {
      const { id, ...body } = editing;
      await api(id ? `/customers/${id}` : '/customers', { method: id ? 'PUT' : 'POST', body });
      setEditing(null); setError(''); load();
    } catch (err) { setError(err.message); }
  }
  async function remove(c) {
    if (!confirm(`Excluir "${c.name}" e todo o histórico de compras dele?`)) return;
    await api(`/customers/${c.id}`, { method: 'DELETE' }); load();
  }

  const shown = list.filter((c) => [c.name, c.cpf, c.cnpj, c.email, c.phone].join(' ').toLowerCase().includes(search.toLowerCase()));

  return (
    <>
      <PageHeader title="Clientes" subtitle="Dados de contato e endereço. Abra um cliente para ver tudo o que ele já comprou."
        action={<button className="btn" onClick={() => { setError(''); setEditing(blank); }}>Novo cliente</button>} />
      <input className="input mb-4 max-w-sm" placeholder="Buscar por nome, CPF, CNPJ, e-mail ou telefone" value={search} onChange={(e) => setSearch(e.target.value)} />
      <ErrorNote message={editing ? '' : error} />
      {shown.length === 0 ? <Empty>Nenhum cliente encontrado.</Empty> : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600"><tr>
              <th className="p-3">Nome</th><th className="p-3">Contato</th><th className="p-3">Endereço</th><th className="p-3">Etapa</th><th className="p-3" />
            </tr></thead>
            <tbody>{shown.map((c) => (
              <tr key={c.id} className="border-t border-slate-100 align-top">
                <td className="p-3"><Link href={`/clientes/${c.id}`} className="font-semibold text-brand hover:underline">{c.name}</Link>
                  <div className="text-xs text-slate-500">{c.cpf || c.cnpj}</div></td>
                <td className="p-3">{c.phone}<div className="text-xs text-slate-500">{c.email}</div></td>
                <td className="p-3 text-slate-600">{address(c)}</td>
                <td className="p-3">{STAGE[c.stage]}</td>
                <td className="space-x-3 whitespace-nowrap p-3 text-right">
                  <button className="text-sm font-medium text-brand hover:underline" onClick={() => { setError(''); setEditing(c); }}>Editar</button>
                  <button className="btn-danger" onClick={() => remove(c)}>Excluir</button>
                </td>
              </tr>))}
            </tbody>
          </table>
        </div>
      )}
      {editing && (
        <Modal title={editing.id ? 'Editar cliente' : 'Novo cliente'} onClose={() => setEditing(null)}>
          <ErrorNote message={error} />
          <form onSubmit={save} className="grid gap-3 sm:grid-cols-6">
            <Field label="Nome" className="sm:col-span-6"><input className="input" required autoFocus value={editing.name} onChange={set('name')} /></Field>
            <Field label="CEP" className="sm:col-span-2"><input className="input" value={editing.zip || ''} onChange={set('zip')} onBlur={lookupCep} /></Field>
            <Field label="Endereço" className="sm:col-span-3"><input className="input" value={editing.street || ''} onChange={set('street')} /></Field>
            <Field label="Número" className="sm:col-span-1"><input className="input" value={editing.number || ''} onChange={set('number')} /></Field>
            <Field label="Bairro" className="sm:col-span-3"><input className="input" value={editing.neighborhood || ''} onChange={set('neighborhood')} /></Field>
            <Field label="Cidade" className="sm:col-span-3"><input className="input" value={editing.city || ''} onChange={set('city')} /></Field>
            <Field label="CPF" className="sm:col-span-3"><input className="input" value={editing.cpf || ''} onChange={set('cpf')} /></Field>
            <Field label="CNPJ" className="sm:col-span-3"><input className="input" value={editing.cnpj || ''} onChange={set('cnpj')} /></Field>
            <Field label="E-mail" className="sm:col-span-3"><input className="input" type="email" value={editing.email || ''} onChange={set('email')} /></Field>
            <Field label="Telefone" className="sm:col-span-3"><input className="input" value={editing.phone || ''} onChange={set('phone')} /></Field>
            <div className="sm:col-span-6"><button className="btn">Salvar cliente</button></div>
          </form>
        </Modal>
      )}
    </>
  );
}
