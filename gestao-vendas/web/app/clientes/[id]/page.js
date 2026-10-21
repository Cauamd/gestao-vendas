'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { api, brl, dateBR, address } from '@/lib/api';
import { PageHeader, Empty, ErrorNote } from '@/components/ui';

export default function ClienteDetalhe() {
  const { id } = useParams();
  const [customer, setCustomer] = useState(null);
  const [sales, setSales] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([api(`/customers/${id}`), api(`/customers/${id}/sales`)])
      .then(([c, s]) => { setCustomer(c); setSales(s); })
      .catch((e) => setError(e.message));
  }, [id]);

  if (error) return <ErrorNote message={error} />;
  if (!customer) return <p className="text-sm text-slate-500">Carregando…</p>;

  const spent = sales.reduce((sum, s) => sum + s.total, 0);
  const info = [
    ['CPF', customer.cpf], ['CNPJ', customer.cnpj], ['E-mail', customer.email],
    ['Telefone', customer.phone], ['Endereço', address(customer)],
  ].filter(([, v]) => v);

  return (
    <>
      <Link href="/clientes" className="mb-2 inline-block text-sm text-brand hover:underline">Voltar para clientes</Link>
      <PageHeader title={customer.name}
        subtitle={`${sales.length} ${sales.length === 1 ? 'compra' : 'compras'} · ${brl(spent)} no total`}
        action={<Link href={`/vendas?cliente=${customer.id}`} className="btn">Registrar venda</Link>} />
      <dl className="mb-8 grid gap-x-8 gap-y-3 rounded-lg border border-slate-200 bg-white p-5 text-sm sm:grid-cols-2">
        {info.map(([k, v]) => (<div key={k}><dt className="text-slate-500">{k}</dt><dd className="font-medium">{v}</dd></div>))}
      </dl>
      <h2 className="mb-3 text-lg font-bold">Compras realizadas</h2>
      {sales.length === 0 ? <Empty>Este cliente ainda não comprou nada.</Empty> : (
        <div className="space-y-4">
          {sales.map((s) => (
            <article key={s.id} className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
              <header className="flex justify-between border-b border-slate-100 bg-slate-50 px-4 py-2 text-sm">
                <span className="font-medium">Venda #{s.id} em {dateBR(s.created_at)}</span>
                <span className="font-bold">{brl(s.total)}</span>
              </header>
              <table className="w-full text-left text-sm">
                <thead className="text-slate-500"><tr><th className="px-4 py-2">Produto</th><th className="px-4 py-2">Quantidade</th><th className="px-4 py-2">Preço unitário</th><th className="px-4 py-2 text-right">Subtotal</th></tr></thead>
                <tbody>{s.items.map((i) => (
                  <tr key={i.id} className="border-t border-slate-100">
                    <td className="px-4 py-2">{i.product_name}</td><td className="px-4 py-2">{i.quantity}</td>
                    <td className="px-4 py-2">{brl(i.unit_price)}</td><td className="px-4 py-2 text-right">{brl(i.unit_price * i.quantity)}</td>
                  </tr>))}
                </tbody>
              </table>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
