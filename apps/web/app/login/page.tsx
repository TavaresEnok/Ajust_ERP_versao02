'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, ArrowRight, Lock, User } from 'lucide-react';
import Image from 'next/image';

type LoginResult = {
  ok?: boolean;
  error?: string;
  user?: {
    name?: string;
    role?: string;
  };
};

const EXAMPLE_ACCOUNTS = [
  { label: 'Gerente', identifier: 'gerente@ajust.local', password: 'Gerente@123', home: '/gerencia' },
  { label: 'Analista', identifier: 'analista@ajust.local', password: 'Analista@123', home: '/analista' },
  { label: 'Cliente (1o acesso CNPJ)', identifier: '00.000.000/0001-00', password: '0100', home: '/cliente' }
] as const;

function roleHome(role?: string) {
  if (!role) return '/gerencia';
  if (role === 'super_admin' || role === 'gerente') return '/gerencia';
  if (role === 'cliente') return '/cliente';
  return '/analista';
}

function NetworkPattern() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf = 0;
    let particles: Array<{ x: number; y: number; vx: number; vy: number; radius: number }> = [];

    const initParticles = (width: number, height: number) => {
      const count = Math.max(30, Math.floor((width * height) / 8000));
      particles = Array.from({ length: count }).map(() => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.25,
        vy: (Math.random() - 0.5) * 0.25,
        radius: Math.random() * 1.5 + 0.5
      }));
    };

    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const dpr = Math.max(1, window.devicePixelRatio || 1);
      const width = parent.clientWidth;
      const height = parent.clientHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      initParticles(width, height);
    };

    const draw = () => {
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      ctx.clearRect(0, 0, width, height);

      for (let i = 0; i < particles.length; i += 1) {
        const particle = particles[i];
        particle.x += particle.vx;
        particle.y += particle.vy;

        if (particle.x < 0 || particle.x > width) particle.vx *= -1;
        if (particle.y < 0 || particle.y > height) particle.vy *= -1;

        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(125, 141, 255, 0.52)';
        ctx.fill();

        for (let j = i + 1; j < particles.length; j += 1) {
          const next = particles[j];
          const dx = particle.x - next.x;
          const dy = particle.y - next.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          if (distance < 92) {
            ctx.beginPath();
            ctx.moveTo(particle.x, particle.y);
            ctx.lineTo(next.x, next.y);
            ctx.strokeStyle = `rgba(99, 102, 241, ${0.24 * (1 - distance / 92)})`;
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        }
      }

      raf = window.requestAnimationFrame(draw);
    };

    window.addEventListener('resize', resize);
    resize();
    draw();

    return () => {
      window.removeEventListener('resize', resize);
      window.cancelAnimationFrame(raf);
    };
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 h-full w-full pointer-events-none z-0" />;
}

export default function LoginPage() {
  const router = useRouter();
  const [next, setNext] = useState('');

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setNext(params.get('next') || '');
  }, []);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!identifier || !password) {
      setError('Informe e-mail ou CNPJ e senha.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          identifier: identifier.trim(),
          password
        })
      });

      const payload = (await response.json()) as LoginResult;
      if (!response.ok || !payload.ok) {
        setError(payload.error || 'Falha no login.');
        return;
      }

      const defaultHome = roleHome(payload.user?.role);
      const target = next.startsWith('/gerencia') || next.startsWith('/analista') || next.startsWith('/cliente')
        ? next
        : defaultHome;
      router.replace(target as any);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha inesperada no login.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[radial-gradient(ellipse_at_center,_#1a1235_0%,_#0d0a1b_45%,_#05040a_100%)] px-4 py-8 md:py-12">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-20 left-1/3 h-64 w-64 rounded-full bg-indigo-500/20 blur-3xl" />
        <div className="absolute -bottom-16 right-1/4 h-72 w-72 rounded-full bg-fuchsia-500/10 blur-3xl" />
      </div>

      <section className="relative z-10 mx-auto flex w-full max-w-[980px] overflow-hidden rounded-3xl border border-white/10 bg-[#0f1016]/95 shadow-[0_25px_80px_rgba(4,6,18,0.65)] backdrop-blur-sm">
        <aside className="relative hidden w-[43%] items-center justify-center border-r border-white/10 bg-[#090d1f] p-8 md:flex">
          <NetworkPattern />
          <div className="relative z-10 flex h-52 w-52 items-center justify-center overflow-hidden rounded-[2rem] bg-white p-4 shadow-[0_24px_60px_rgba(0,0,0,0.35)]">
            <Image
              src="/Ajust.png"
              alt="Ajust Consulting"
              width={184}
              height={184}
              className="h-full w-full object-contain"
              priority
            />
          </div>
        </aside>

        <div className="w-full bg-[#111219] p-7 md:w-[57%] md:p-12">
          <h1 className="text-3xl font-bold text-white">Bem-vindo</h1>
          <p className="mt-2 text-sm text-slate-400">Insira suas credenciais para acessar o portal.</p>
          <p className="mt-1 text-xs text-slate-500">Cliente no 1o acesso: use CNPJ e senha com os 4 ultimos digitos.</p>

          <form className="mt-8 space-y-5" onSubmit={onSubmit}>
            <label className="block">
              <span className="mb-2 block text-[0.68rem] font-bold uppercase tracking-widest text-slate-500">Usuario / CNPJ</span>
              <div className="relative rounded-xl border border-[#2d3142] bg-[#171923] transition-colors focus-within:border-indigo-500">
                <User size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={identifier}
                  onChange={(event) => setIdentifier(event.target.value)}
                  className="w-full rounded-xl bg-transparent py-3.5 pl-12 pr-4 text-sm text-white outline-none placeholder:text-slate-500"
                  placeholder="seu email, usuario ou CNPJ"
                  autoComplete="username"
                />
              </div>
            </label>

            <label className="block">
              <span className="mb-2 block text-[0.68rem] font-bold uppercase tracking-widest text-slate-500">Senha</span>
              <div className="relative rounded-xl border border-[#2d3142] bg-[#171923] transition-colors focus-within:border-indigo-500">
                <Lock size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="w-full rounded-xl bg-transparent py-3.5 pl-12 pr-4 text-sm tracking-wide text-white outline-none placeholder:text-slate-500"
                  placeholder="********"
                  autoComplete="current-password"
                />
              </div>
            </label>

            {error && (
              <div className="flex items-center gap-2 rounded-xl border border-rose-900/60 bg-rose-950/40 px-3 py-2.5 text-xs text-rose-300">
                <AlertCircle size={14} />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-fuchsia-600 py-3.5 text-sm font-semibold text-white shadow-[0_0_20px_rgba(99,102,241,0.45)] transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? 'Entrando...' : 'Acessar Painel'}
              {!loading && <ArrowRight size={18} />}
            </button>
          </form>

          <div className="mt-7 border-t border-white/10 pt-4">
            <p className="text-[0.68rem] font-bold uppercase tracking-widest text-slate-500">Logins de exemplo</p>
            <div className="mt-3 grid grid-cols-1 gap-2">
              {EXAMPLE_ACCOUNTS.map((account) => (
                <button
                  key={account.label}
                  type="button"
                  onClick={() => {
                    setIdentifier(account.identifier);
                    setPassword(account.password);
                    setError('');
                  }}
                  className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-left transition hover:bg-white/[0.07]"
                >
                  <p className="text-xs font-bold text-white">{account.label}</p>
                  <p className="mt-0.5 text-[11px] text-slate-400">{account.identifier}</p>
                  <p className="text-[11px] text-slate-500">{account.password}</p>
                </button>
              ))}
            </div>
            <p className="mt-2 text-[11px] text-slate-500">Clique em um exemplo para preencher automaticamente.</p>
          </div>
        </div>
      </section>

      <div className="relative z-10 mt-6 text-center text-[0.62rem] font-semibold uppercase tracking-[0.2em] text-slate-500">
        © 2026 Ajust Consulting • Secure Access
      </div>
    </main>
  );
}
