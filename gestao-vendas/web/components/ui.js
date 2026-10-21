'use client';
import { useEffect } from 'react';

export function PageHeader({ title, subtitle, action }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 max-w-prose text-sm text-slate-600">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Modal({ title, onClose, children }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/50 p-4" onMouseDown={onClose}>
      <div role="dialog" aria-modal="true" aria-label={title}
        className="my-8 w-full max-w-2xl rounded-lg bg-white p-6 shadow-xl" onMouseDown={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">{title}</h2>
          <button onClick={onClose} aria-label="Fechar" className="rounded p-1 text-xl leading-none text-slate-500 hover:bg-slate-100">×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Field({ label, className = '', children }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      {children}
    </label>
  );
}

export function ErrorNote({ message }) {
  if (!message) return null;
  return <p role="alert" className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">{message}</p>;
}

export function Empty({ children }) {
  return <div className="rounded-lg border border-dashed border-slate-300 bg-white/60 p-8 text-center text-sm text-slate-600">{children}</div>;
}
