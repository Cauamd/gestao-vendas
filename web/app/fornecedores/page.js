'use client';
import { StyledSelect } from '@/components/StyledSelect';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { PageHeader, Modal, Field, ErrorNote, Empty } from '@/components/ui';

const PLATFORMS = ['Mercado Livre', 'Shopee', 'Amazon', 'Site próprio', 'WhatsApp', 'Outro'];
const PAYMENT_METHODS = ['Pix', 'Boleto', 'Cartão Crédito', 'Cartão Débito', 'Transferência bancária', 'Dinheiro'];
const blank = {
  name: '',
  link: '',
  phone: '',
  notes: '',
  payment_method: 'Pix',
  street: '',
  city: '',
  zip: '',
};

function SupplierCard({ s, onChange, onEdit }) {
  const [item, setItem] = useState({ item: '', platform: PLATFORMS[0], link: '' });
  const [error, setError] = useState('');

  async function add(e) {
    e.preventDefault();
    try {
      await api(`/suppliers/${s.id}/items`, { method: 'POST', body: item });
      setItem({ ...item, item: '', link: '' });
      setError('');
      onChange();
    } catch (err) { setError(err.message); }
  }

  async function removeItem(id) {
    await api(`/supplier-items/${id}`, { method: 'DELETE' });
    onChange();
  }

  async function removeSupplier() {
    if (!confirm(`Excluir o fornecedor "${s.name}"?`)) return;
    await api(`/suppliers/${s.id}`, { method: 'DELETE' });
    onChange();
  }

  const locationInfo = [s.street, s.city, s.zip ? `CEP: ${s.zip}` : null].filter(Boolean).join(' · ');

  return (
    <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <header className="mb-3 flex items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-bold text-ink">{s.name}</h2>
            {s.payment_method && (
              <span className="rounded-md bg-rose-50 px-2 py-0.5 text-xs font-semibold text-brand">
                Forma de pagamento: {s.payment_method}
              </span>
            )}
          </div>

          {locationInfo && (
            <p className="mt-1 text-xs text-slate-600 font-medium">
              ðŸ“ {locationInfo}
            </p>
          )}

          <p className="mt-1 text-sm text-slate-500">
            {[s.phone, s.notes].filter(Boolean).join(' · ')}
          </p>

          {s.link && (
            <a
              href={s.link}
              target="_blank"
              rel="noreferrer"
              className="mt-1 inline-block text-sm text-brand hover:underline font-medium"
            >
              Abrir link principal ↗
            </a>
          )}
        </div>

        <div className="space-x-3 whitespace-nowrap">
          <button className="text-sm font-medium text-brand hover:underline" onClick={() => onEdit(s)}>
            Editar
          </button>
          <button className="btn-danger" onClick={removeSupplier}>
            Excluir
          </button>
        </div>
      </header>

      <h3 className="mb-2 text-sm font-semibold text-slate-700">O que vende</h3>
      {s.items.length === 0 ? (
        <p className="mb-3 text-sm text-slate-500">Nada cadastrado ainda.</p>
      ) : (
        <ul className="mb-3 divide-y divide-slate-100 text-sm">
          {s.items.map((i) => (
            <li key={i.id} className="flex items-center justify-between gap-3 py-2">
              <div>
                <span className="font-medium text-slate-800">{i.item}</span>
                {i.platform && (
                  <span className="ml-2 rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                    {i.platform}
                  </span>
                )}
                {i.link && (
                  <a href={i.link} target="_blank" rel="noreferrer" className="ml-3 text-brand hover:underline text-xs">
                    Ver anúncio ↗
                  </a>
                )}
              </div>
              <button className="btn-danger" onClick={() => removeItem(i.id)}>
                Remover
              </button>
            </li>
          ))}
        </ul>
      )}

      <ErrorNote message={error} />
      <form onSubmit={add} className="grid gap-2 sm:grid-cols-[1fr_9rem_1.4fr_auto]">
        <input
          className="input"
          placeholder="Item (ex.: caixa, etiqueta...)"
          aria-label="Item"
          value={item.item}
          onChange={(e) => setItem({ ...item, item: e.target.value })}
        />
        <StyledSelect
          className="input"
          aria-label="Onde vende"
          value={item.platform}
          onChange={(e) => setItem({ ...item, platform: e.target.value })}
        >
          {PLATFORMS.map((p) => (
            <option key={p}>{p}</option>
          ))}
        </StyledSelect>
        <input
          className="input"
          type="url"
          placeholder="Link do fornecedor para este item"
          aria-label="Link"
          value={item.link}
          onChange={(e) => setItem({ ...item, link: e.target.value })}
        />
        <button className="btn-ghost">Adicionar item</button>
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

  const set = (k) => (e) => setEditing({ ...editing, [k]: e.target.value });

  async function lookupCep() {
    const cep = (editing?.zip || '').replace(/\D/g, '');
    if (cep.length !== 8) return;
    try {
      const d = await (await fetch(`https://viacep.com.br/ws/${cep}/json/`)).json();
      if (!d.erro) {
        setEditing((prev) => ({
          ...prev,
          street: prev.street || d.logradouro,
          city: prev.city || d.localidade,
        }));
      }
    } catch {}
  }

  async function save(e) {
    e.preventDefault();
    try {
      const { id, items, ...body } = editing;
      await api(id ? `/suppliers/${id}` : '/suppliers', { method: id ? 'PUT' : 'POST', body });
      setEditing(null);
      setError('');
      load();
    } catch (err) { setError(err.message); }
  }

  return (
    <>
      <PageHeader
        title="Fornecedores"
        subtitle="Quem vende para você, forma de pagamento, endereço, cidade, CEP e itens fornecidos."
        action={<button className="btn" onClick={() => { setError(''); setEditing(blank); }}>Novo fornecedor</button>}
      />

      <ErrorNote message={editing ? '' : error} />

      {list.length === 0 ? (
        <Empty>Nenhum fornecedor cadastrado ainda. Clique em “Novo fornecedor” para cadastrar.</Empty>
      ) : (
        <div className="space-y-4">
          {list.map((s) => (
            <SupplierCard
              key={s.id}
              s={s}
              onChange={load}
              onEdit={(x) => { setError(''); setEditing(x); }}
            />
          ))}
        </div>
      )}

      {editing && (
        <Modal title={editing.id ? 'Editar fornecedor' : 'Novo fornecedor'} onClose={() => setEditing(null)}>
          <ErrorNote message={error} />
          <form onSubmit={save} className="grid gap-3 sm:grid-cols-6">
            <Field label="Nome" className="sm:col-span-4">
              <input
                className="input"
                required
                autoFocus
                value={editing.name}
                onChange={set('name')}
                placeholder="Nome da empresa ou fornecedor"
              />
            </Field>

            <Field label="Forma de pagamento" className="sm:col-span-2">
              <StyledSelect
                className="input"
                value={editing.payment_method || 'Pix'}
                onChange={set('payment_method')}
              >
                {PAYMENT_METHODS.map((pm) => (
                  <option key={pm} value={pm}>{pm}</option>
                ))}
              </StyledSelect>
            </Field>

            <Field label="CEP" className="sm:col-span-2">
              <input
                className="input"
                value={editing.zip || ''}
                onChange={set('zip')}
                onBlur={lookupCep}
                placeholder="00000-000"
              />
            </Field>

            <Field label="Endereço" className="sm:col-span-4">
              <input
                className="input"
                value={editing.street || ''}
                onChange={set('street')}
                placeholder="Rua, número, complemento"
              />
            </Field>

            <Field label="Cidade" className="sm:col-span-3">
              <input
                className="input"
                value={editing.city || ''}
                onChange={set('city')}
                placeholder="Cidade - UF"
              />
            </Field>

            <Field label="Telefone" className="sm:col-span-3">
              <input
                className="input"
                value={editing.phone || ''}
                onChange={set('phone')}
                placeholder="(00) 00000-0000"
              />
            </Field>

            <Field label="Link principal" className="sm:col-span-6">
              <input
                className="input"
                type="url"
                value={editing.link || ''}
                onChange={set('link')}
                placeholder="https://exemplo.com.br"
              />
            </Field>

            <Field label="Observações" className="sm:col-span-6">
              <textarea
                className="input min-h-20 resize-y"
                value={editing.notes || ''}
                onChange={set('notes')}
                placeholder="Observações sobre o fornecedor, prazos, condições especiais..."
              />
            </Field>

            <div className="sm:col-span-6 mt-2">
              <button className="btn">Salvar fornecedor</button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
