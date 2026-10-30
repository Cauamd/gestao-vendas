'use client';
import { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  BarChart3,
  Boxes,
  ChevronLeft,
  ChevronRight,
  FileText,
  Kanban,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  ShoppingBag,
  ShoppingCart,
  Users,
} from 'lucide-react';
import { api } from '@/lib/api';

const links = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/kanban', label: 'Funil de clientes', icon: Kanban },
  { href: '/vendas', label: 'Vendas', icon: ShoppingBag },
  { href: '/relatorio-vendas', label: 'Relatório de Vendas', icon: BarChart3 },
  { href: '/clientes', label: 'Clientes', icon: Users },
  { href: '/produtos', label: 'Produtos', icon: Package },
  { href: '/fornecedores', label: 'Fornecedores', icon: Boxes },
  { href: '/compras', label: 'Compras', icon: ShoppingCart },
  { href: '/relatorio-compras', label: 'Relatório de Compras', icon: FileText },
];

export default function Sidebar({ children }) {
  const path = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  function openRoute(href) {
    router.push(href);
    setMobileOpen(false);
  }

  async function logout() {
    try { await api('/auth/logout', { method: 'POST' }); } catch {}
    localStorage.removeItem('auth_token');
    router.replace('/login');
  }

  const nav = (
    <nav aria-label="Navegação principal" className="space-y-1 px-3 py-4">
      {links.map(({ href, label, icon: Icon }) => {
        const active = path === href || path.startsWith(href + '/');
        return (
          <button key={href} onClick={() => openRoute(href)} title={collapsed ? label : undefined} aria-current={active ? 'page' : undefined}
            className={`relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition ${active ? 'bg-brand text-white shadow-md shadow-rose-950/20' : 'text-rose-100/75 hover:bg-white/10 hover:text-white'} ${collapsed ? 'justify-center px-0' : ''}`}>
            <Icon className="h-5 w-5 shrink-0" />
            {!collapsed && <span className="truncate">{label}</span>}
            {active && !collapsed && <span className="absolute bottom-2 left-0 top-2 w-1 rounded-r-full bg-rose-300" />}
          </button>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-screen bg-paper md:flex">
      <aside className={`hidden shrink-0 flex-col bg-ink text-white shadow-xl shadow-rose-950/10 transition-[width] duration-200 md:fixed md:inset-y-0 md:flex ${collapsed ? 'md:w-20' : 'md:w-64'}`}>
        <div className={`flex h-16 items-center border-b border-white/10 px-4 ${collapsed ? 'justify-center' : 'justify-between'}`}>
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-rose-400 to-brand text-sm font-extrabold shadow-md shadow-rose-950/20">V</span>
            {!collapsed && <span className="truncate text-sm font-bold tracking-tight">Minhas vendas</span>}
          </div>
          {!collapsed && <button aria-label="Recolher menu" onClick={() => setCollapsed(true)} className="rounded-lg p-2 text-rose-100/70 transition hover:bg-white/10 hover:text-white"><ChevronLeft className="h-4 w-4" /></button>}
        </div>
        {collapsed && <button aria-label="Expandir menu" onClick={() => setCollapsed(false)} className="mx-auto mt-3 rounded-lg p-2 text-rose-100/70 transition hover:bg-white/10 hover:text-white"><ChevronRight className="h-4 w-4" /></button>}
        <div className="flex-1 overflow-y-auto [scrollbar-width:none]">
          {nav}
        </div>
        <div className={`mt-auto border-t border-white/10 p-3 ${collapsed ? 'flex justify-center' : ''}`}>
          <button onClick={logout} title={collapsed ? 'Sair' : undefined} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-rose-100/75 transition hover:bg-white/10 hover:text-white ${collapsed ? 'justify-center px-0' : 'w-full'}`}>
            <LogOut className="h-5 w-5" />{!collapsed && 'Sair'}
          </button>
        </div>
      </aside>

      <div className={`flex min-h-screen min-w-0 flex-1 flex-col ${collapsed ? 'md:ml-20' : 'md:ml-64'}`}>
        <div className="flex h-12 shrink-0 items-end gap-1 overflow-x-auto bg-ink px-2 pt-2 text-rose-100/75 [scrollbar-width:none]">
          <button onClick={() => setMobileOpen((open) => !open)} aria-label="Abrir navegação" className="mr-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-rose-100 transition hover:bg-white/10 md:hidden"><Menu className="h-5 w-5" /></button>
          {(() => {
            const current = links.find((link) => path === link.href || path.startsWith(link.href + '/')) || links[0];
            const CurrentIcon = current.icon;
            return <div className="flex h-9 min-w-[140px] max-w-[240px] shrink-0 items-center gap-2 rounded-t-xl bg-paper px-3 text-sm text-ink font-semibold"><CurrentIcon className="h-4 w-4 shrink-0" /><span className="truncate">{current.label}</span></div>;
          })()}
          <div className="flex-1" />
        </div>
        {mobileOpen && <div className="z-20 border-b border-rose-200 bg-ink text-white md:hidden">{nav}<div className="border-t border-white/10 p-3"><button onClick={logout} className="flex items-center gap-3 px-3 py-2 text-sm text-rose-100/75"><LogOut className="h-5 w-5" />Sair</button></div></div>}
        <main className="mx-auto w-full max-w-6xl flex-1 p-4 md:max-w-none md:p-8">{children}</main>
      </div>
    </div>
  );
}
