'use client';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';

export default function AuthShell({ children }) {
  const path = usePathname();
  const router = useRouter();
  const isLogin = path === '/login';
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const check = () => {
      const authenticated = Boolean(localStorage.getItem('auth_token'));
      if (!authenticated && !isLogin) router.replace('/login');
      if (authenticated && isLogin) router.replace('/dashboard');
      setReady(authenticated || isLogin);
    };
    check();
    const expired = () => { setReady(false); router.replace('/login'); };
    window.addEventListener('auth-expired', expired);
    return () => window.removeEventListener('auth-expired', expired);
  }, [isLogin, router]);

  if (!ready) return (
    <div className="flex min-h-screen items-center justify-center bg-paper text-sm text-ink" role="status">
      Verificando sessão…
    </div>
  );
  if (isLogin) return children;
  return <Sidebar>{children}</Sidebar>;
}
