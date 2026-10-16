'use client';

import React, { useEffect, useState } from 'react';
import {
  Shield,
  Smartphone,
  Laptop,
  Globe,
  Clock,
  Trash2,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Lock,
} from 'lucide-react';

export type SessionItem = {
  id: string;
  device?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  createdAt: string;
  expiresAt: string;
  isCurrent?: boolean;
};

type Props = {
  dark?: boolean;
  onToast?: (msg: string) => void;
};

export function ActiveSessionsView({ dark = false, onToast }: Props) {
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [revokingAll, setRevokingAll] = useState(false);

  const loadSessions = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/auth/sessions', { cache: 'no-store' });
      if (!res.ok) throw new Error('Falha ao carregar sessões');
      const data = await res.json();
      setSessions(Array.isArray(data) ? data : []);
    } catch (err: any) {
      onToast?.(err.message || 'Erro ao carregar sessões');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSessions();
  }, []);

  const handleRevoke = async (sessionId: string) => {
    if (!confirm('Deseja realmente desconectar e invalidar esta sessão?')) return;
    setRevokingId(sessionId);
    try {
      const res = await fetch(`/api/auth/sessions/${encodeURIComponent(sessionId)}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Falha ao encerrar sessão');
      }
      onToast?.('Sessão encerrada com sucesso!');
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    } catch (err: any) {
      alert(err.message || 'Erro ao encerrar sessão');
    } finally {
      setRevokingId(null);
    }
  };

  const handleRevokeAllOthers = async () => {
    if (!confirm('Deseja encerrar todas as outras sessões ativas? Você continuará conectado apenas neste dispositivo.')) {
      return;
    }
    setRevokingAll(true);
    try {
      const otherSessions = sessions.filter((s) => !s.isCurrent);
      for (const s of otherSessions) {
        await fetch(`/api/auth/sessions/${encodeURIComponent(s.id)}`, { method: 'DELETE' });
      }
      onToast?.('Todas as outras sessões foram encerradas!');
      loadSessions();
    } catch (err: any) {
      alert(err.message || 'Erro ao encerrar sessões');
    } finally {
      setRevokingAll(false);
    }
  };

  const getDeviceIcon = (userAgent?: string | null, device?: string | null) => {
    const text = `${device || ''} ${userAgent || ''}`.toLowerCase();
    if (text.includes('mobile') || text.includes('android') || text.includes('iphone')) {
      return <Smartphone className="w-5 h-5 text-indigo-500" />;
    }
    if (text.includes('mac') || text.includes('windows') || text.includes('linux')) {
      return <Laptop className="w-5 h-5 text-cyan-500" />;
    }
    return <Globe className="w-5 h-5 text-slate-400" />;
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto p-4 md:p-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Shield className="w-7 h-7 text-indigo-500" />
            <h1 className="text-2xl font-bold tracking-tight">Sessões Ativas & Segurança</h1>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Monitore dispositivos conectados à sua conta e revogue acessos instantaneamente em caso de suspeita de invasão.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={loadSessions}
            disabled={loading}
            className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
              dark
                ? 'border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700'
                : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </button>

          {sessions.some((s) => !s.isCurrent) && (
            <button
              type="button"
              onClick={handleRevokeAllOthers}
              disabled={revokingAll}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 shadow-sm transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Desconectar Outros Dispositivos
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="p-12 text-center">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto text-indigo-500 mb-3" />
          <p className="text-sm text-slate-500">Consultando sessões ativas no servidor...</p>
        </div>
      ) : sessions.length === 0 ? (
        <div
          className={`p-10 rounded-xl border text-center ${
            dark ? 'bg-slate-800/40 border-slate-700' : 'bg-slate-50 border-slate-200'
          }`}
        >
          <Lock className="w-10 h-10 mx-auto text-slate-400 mb-2" />
          <p className="font-semibold text-slate-700 dark:text-slate-200">Nenhuma sessão encontrada</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {sessions.map((s) => (
            <div
              key={s.id}
              className={`p-5 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                s.isCurrent
                  ? dark
                    ? 'border-indigo-500/50 bg-indigo-950/20'
                    : 'border-indigo-300 bg-indigo-50/60'
                  : dark
                  ? 'border-slate-800 bg-slate-900/60 hover:border-slate-700'
                  : 'border-slate-200 bg-white hover:border-slate-300 shadow-sm'
              }`}
            >
              <div className="flex items-start gap-4">
                <div
                  className={`p-3 rounded-lg ${
                    dark ? 'bg-slate-800' : 'bg-slate-100'
                  }`}
                >
                  {getDeviceIcon(s.userAgent, s.device)}
                </div>

                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-base">
                      {s.device || 'Navegador Web'}
                    </span>
                    {s.isCurrent && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                        <CheckCircle2 className="w-3 h-3" />
                        Dispositivo Atual
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xl truncate font-mono">
                    {s.userAgent || 'User-Agent não informado'}
                  </p>

                  <div className="flex items-center gap-4 mt-2 text-xs text-slate-500 dark:text-slate-400">
                    <span className="flex items-center gap-1 font-mono">
                      <Globe className="w-3.5 h-3.5" />
                      IP: {s.ip || '0.0.0.0'}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      Login: {new Date(s.createdAt).toLocaleString('pt-BR')}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-center">
                {!s.isCurrent && (
                  <button
                    type="button"
                    onClick={() => handleRevoke(s.id)}
                    disabled={revokingId === s.id}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    {revokingId === s.id ? 'Encerrando...' : 'Encerrar Sessão'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
