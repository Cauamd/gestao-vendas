'use client';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { FlowButton } from '@/components/ui/flow-button';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const videoRef = useRef(null);
  const animationPasses = useRef(0);
  const finishAnimation = useRef(null);

  function handleVideoEnd() {
    animationPasses.current += 1;
    if (animationPasses.current >= 2) {
      finishAnimation.current?.();
      return;
    }
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.play().catch(() => finishAnimation.current?.());
    }
  }

  async function submit(event) {
    event.preventDefault();
    setError('');
    setLoading(true);
    animationPasses.current = 0;
    const animationFinished = new Promise((resolve) => { finishAnimation.current = resolve; });
    try {
      const [result] = await Promise.all([
        api('/auth/login', { method: 'POST', body: { username, password } }),
        animationFinished,
      ]);
      localStorage.setItem('auth_token', result.token);
      router.replace('/kanban');
    } catch (e) {
      await animationFinished;
      setError(e.message);
    } finally {
      finishAnimation.current = null;
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#19002f] bg-cover bg-center bg-no-repeat px-4 py-10" style={{ backgroundImage: "url('/login-background.svg')" }}>
        <section role="status" aria-live="polite" className="flex flex-col items-center rounded-3xl border border-white/15 bg-[#24083c]/80 px-10 py-8 text-center text-white shadow-2xl shadow-black/20 backdrop-blur-sm">
          <video ref={videoRef} className="h-40 w-40 object-contain" src="/login-loading.webm" autoPlay muted playsInline onEnded={handleVideoEnd} onError={() => finishAnimation.current?.()} aria-hidden="true" />
          <h1 className="mt-3 text-lg font-semibold">Entrando no painel...</h1>
          <p className="mt-1 text-sm text-rose-100/75">Estamos preparando suas informações.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#19002f] bg-cover bg-center bg-no-repeat px-4 py-10" style={{ backgroundImage: "url('/login-background.svg')" }}>
      <section className="relative w-full max-w-sm rounded-3xl border border-white/80 bg-white/90 p-8 shadow-2xl shadow-rose-900/10 backdrop-blur sm:p-10">
        <div className="mb-8">
          <div className="mb-7 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-rose-500 to-rose-700 text-xl font-extrabold text-white shadow-lg shadow-rose-500/25">V</div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-rose-700">Minhas vendas</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-ink">Bem-vinda de volta</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">Entre para acessar seu painel de vendas.</p>
        </div>
        <form onSubmit={submit} className="space-y-5">
          <label className="mx-auto block max-w-xs text-sm font-semibold text-ink">Nome de usuário
            <input className="input mt-1.5" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} required />
          </label>
          <label className="mx-auto block max-w-xs text-sm font-semibold text-ink">Senha
            <input className="input mt-1.5" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </label>
          {error && <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          <FlowButton type="submit" className="mx-auto w-40 justify-center" text={loading ? 'Entrando...' : 'Entrar'} disabled={loading} />
        </form>
      </section>
    </main>
  );
}
