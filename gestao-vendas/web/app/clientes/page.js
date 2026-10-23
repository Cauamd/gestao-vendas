'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, address } from '@/lib/api';
import { PageHeader, Modal, Field, ErrorNote, Empty } from '@/components/ui';

const blank = {
  name: '',
  position: '',
  contact_person: '',
  notes: '',
  street: '',
  number: '',
  neighborhood: '',
  city: '',
  zip: '',
  cpf: '',
  cnpj: '',
  email: '',
  phone: '',
};

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
    const cep = (editing?.zip || '').replace(/\D/g, '');
    if (cep.length !== 8) return;
    try {
      const d = await (await fetch(`https://viacep.com.br/ws/${cep}/json/`)).json();
      if (!d.erro) {
        setEditing((c) => ({
          ...c,
          street: c.street || d.logradouro,
          neighborhood: c.neighborhood || d.bairro,
          city: c.city || d.localidade,
        }));
      }
    } catch {}
  }

  async function save(e) {
    e.preventDefault();
    try {
      const { id, ...body } = editing;
      await api(id ? `/customers/${id}` : '/customers', { method: id ? 'PUT' : 'POST', body });
      setEditing(null);
      setError('');
      load();
    } catch (err) { setError(err.message); }
  }

  async function remove(c) {
    if (!confirm(`Excluir "${c.name}" e todo o histórico dele?`)) return;
    await api(`/customers/${c.id}`, { method: 'DELETE' });
    load();
  }

  const shown = list.filter((c) =>
    [c.name, c.position, c.contact_person, c.cpf, c.cnpj, c.email, c.phone]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  return (
    <>
      <PageHeader
        title="Clientes"
        subtitle="Dados de contato, cargo, pessoa de contato, endereço e diálogo com o cliente."
        action={<button className="btn" onClick={() => { setError(''); setEditing(blank); }}>Novo cliente</button>}
      />

      <input
        className="input mb-4 max-w-sm"
        placeholder="Buscar por nome, cargo, contato, CPF, e-mail..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <ErrorNote message={editing ? '' : error} />

      {shown.length === 0 ? (
        <Empty>Nenhum cliente encontrado.</Empty>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="p-3">Nome / Documento</th>
                <th className="p-3">Cargo / Pessoa de Contato</th>
                <th className="p-3">Contato</th>
                <th className="p-3">Endereço</th>
                <th className="p-3">Etapa</th>
                <th className="p-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((c) => (
                <tr key={c.id} className="border-t border-slate-100 align-top">
                  <td className="p-3">
                    <Link href={`/clientes/${c.id}`} className="font-semibold text-brand hover:underline">
                      {c.name}
                    </Link>
                    <div className="text-xs text-slate-500">{c.cpf || c.cnpj || 'Sem documento'}</div>
                  </td>
                  <td className="p-3">
                    <div className="font-medium text-slate-800">{c.position || '—'}</div>
                    <div className="text-xs text-slate-500">
                      {c.contact_person ? `Contato: ${c.contact_person}` : ''}
                    </div>
                  </td>
                  <td className="p-3">
                    <div>{c.phone || '—'}</div>
                    <div className="text-xs text-slate-500">{c.email}</div>
                  </td>
                  <td className="p-3 text-slate-600">{address(c) || '—'}</td>
                  <td className="p-3">
                    <span className="inline-block rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                      {STAGE[c.stage] || c.stage}
                    </span>
                  </td>
                  <td className="space-x-3 whitespace-nowrap p-3 text-right">
                    <button className="text-sm font-medium text-brand hover:underline" onClick={() => { setError(''); setEditing(c); }}>
                      Editar
                    </button>
                    <button className="btn-danger" onClick={() => remove(c)}>
                      Excluir
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <Modal title={editing.id ? 'Editar cliente' : 'Novo cliente'} onClose={() => setEditing(null)}>
          <ErrorNote message={error} />
          <form onSubmit={save} className="grid gap-3 sm:grid-cols-6">
            <Field label="Nome do cliente" className="sm:col-span-6">
              <input className="input" required autoFocus value={editing.name} onChange={set('name')} placeholder="Nome completo ou Razão Social" />
            </Field>

            <Field label="Cargo" className="sm:col-span-3">
              <input className="input" value={editing.position || ''} onChange={set('position')} placeholder="Ex: Diretor, Comprador, Gerente" />
            </Field>

            <Field label="Pessoa de contato" className="sm:col-span-3">
              <input className="input" value={editing.contact_person || ''} onChange={set('contact_person')} placeholder="Nome da pessoa de contato" />
            </Field>

            <Field label="Observações / Diálogo com cliente" className="sm:col-span-6">
              <textarea
                className="input min-h-20 resize-y"
                value={editing.notes || ''}
                onChange={set('notes')}
                placeholder="Anotações importantes sobre negociações, preferências ou histórico do cliente"
              />
            </Field>

            <Field label="CEP" className="sm:col-span-2">
              <input className="input" value={editing.zip || ''} onChange={set('zip')} onBlur={lookupCep} placeholder="00000-000" />
            </Field>
            <Field label="Endereço" className="sm:col-span-3">
              <input className="input" value={editing.street || ''} onChange={set('street')} placeholder="Rua / Avenida" />
            </Field>
            <Field label="Número" className="sm:col-span-1">
              <input className="input" value={editing.number || ''} onChange={set('number')} placeholder="Nº" />
            </Field>

            <Field label="Bairro" className="sm:col-span-3">
              <input className="input" value={editing.neighborhood || ''} onChange={set('neighborhood')} placeholder="Bairro" />
            </Field>
            <Field label="Cidade" className="sm:col-span-3">
              <input className="input" value={editing.city || ''} onChange={set('city')} placeholder="Cidade" />
            </Field>

            <Field label="CPF" className="sm:col-span-3">
              <input className="input" value={editing.cpf || ''} onChange={set('cpf')} placeholder="000.000.000-00" />
            </Field>
            <Field label="CNPJ" className="sm:col-span-3">
              <input className="input" value={editing.cnpj || ''} onChange={set('cnpj')} placeholder="00.000.000/0000-00" />
            </Field>

            <Field label="E-mail" className="sm:col-span-3">
              <input className="input" type="email" value={editing.email || ''} onChange={set('email')} placeholder="cliente@email.com" />
            </Field>
            <Field label="Telefone" className="sm:col-span-3">
              <input className="input" value={editing.phone || ''} onChange={set('phone')} placeholder="(00) 00000-0000" />
            </Field>

            <div className="sm:col-span-6 mt-2">
              <button className="btn">Salvar cliente</button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
