const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3333';

export async function api(path, { method = 'GET', body } = {}) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    if (res.status === 401 && typeof window !== 'undefined' && path !== '/auth/login') {
      localStorage.removeItem('auth_token');
      window.dispatchEvent(new Event('auth-expired'));
    }
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Não foi possível concluir a ação');
  }
  return res.status === 204 ? null : res.json();
}

export const brl = (n) => Number(n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
export const dateBR = (s) => (s ? new Date(s.replace(' ', 'T')).toLocaleDateString('pt-BR') : '');
export const address = (c) =>
  [[c.street, c.number].filter(Boolean).join(', '), c.neighborhood, c.city, c.zip].filter(Boolean).join(' - ');
