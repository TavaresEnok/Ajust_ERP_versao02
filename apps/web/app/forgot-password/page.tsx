'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    setError('');

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Falha ao processar solicitação');

      setMessage(
        'Se o e-mail estiver cadastrado, você receberá um link de recuperação em instantes.',
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao processar solicitação');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0f1c] text-white p-4">
      <div className="max-w-md w-full bg-[#111b2e] p-8 rounded-2xl shadow-xl border border-slate-800">
        <div className="flex justify-center mb-6">
          <Image
            src="/Ajust.png"
            alt="Ajust ERP"
            width={72}
            height={72}
            className="opacity-90 rounded-2xl"
            priority
          />
        </div>

        <h1 className="text-2xl font-bold text-center mb-2">Recuperar Senha</h1>
        <p className="text-slate-400 text-sm text-center mb-8">
          Digite seu e-mail para receber um link de redefinição de senha.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">E-mail</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-[#0d1628] border border-slate-700 rounded-lg p-3 text-white focus:outline-none focus:border-cyan-500"
              placeholder="seu@email.com"
            />
          </div>

          {error && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg text-rose-400 text-sm">
              {error}
            </div>
          )}
          {message && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-400 text-sm">
              {message}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-3 px-4 rounded-lg transition-colors disabled:opacity-50"
          >
            {loading ? 'Enviando...' : 'Enviar Link'}
          </button>
        </form>

        <div className="mt-6 text-center text-sm">
          <Link href="/login" className="text-cyan-400 hover:text-cyan-300 transition-colors">
            Voltar para o Login
          </Link>
        </div>
      </div>
    </div>
  );
}
