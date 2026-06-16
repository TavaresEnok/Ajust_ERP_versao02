'use client';
/* eslint-disable react-hooks/exhaustive-deps */
import React, { useEffect, useState } from 'react';
import { Activity, ShieldAlert, HeartPulse, RefreshCw, BarChart } from 'lucide-react';
import { SvgDonutChart } from '../../shared/shared-charts';
import { cn } from '../../shared/shared-ui';

type OperationalHealthRow = {
  name: string;
  score: number;
  grade: string;
  totalOrders: number;
  criticalOrders: number;
  criticalRate: number;
  resolutionRate: number;
  hoursConsumed: number;
};

export function OperationalHealthView({
  dark,
  tenantId,
  onToast,
}: {
  dark: boolean;
  tenantId: string;
  onToast: (m: string) => void;
}) {
  const [report, setReport] = useState<OperationalHealthRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch(
        `/api/reports/operational-health?tenantId=${encodeURIComponent(tenantId)}`,
        { cache: 'no-store' },
      );
      const payload = await res.json().catch(() => null);
      if (res.ok) {
        setReport(Array.isArray(payload) ? payload : []);
      } else {
        const message =
          typeof payload === 'object' &&
          payload &&
          'error' in payload &&
          typeof (payload as { error?: unknown }).error === 'string'
            ? String((payload as { error?: unknown }).error)
            : 'Falha ao carregar relatório de saúde operacional.';
        setLoadError(message);
        setReport([]);
      }
    } catch {
      const message = 'Falha ao carregar relatório de saúde operacional.';
      setLoadError(message);
      onToast(message);
      setReport([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (tenantId) load();
  }, [tenantId]);

  const gradeColor = (grade: string) => {
    switch (grade) {
      case 'A':
        return 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20';
      case 'B':
        return 'text-blue-500 bg-blue-500/10 border-blue-500/20';
      case 'C':
        return 'text-amber-500 bg-amber-500/10 border-amber-500/20';
      case 'D':
        return 'text-orange-500 bg-orange-500/10 border-orange-500/20';
      default:
        return 'text-rose-500 bg-rose-500/10 border-rose-500/20';
    }
  };

  const avgScore =
    report.length > 0 ? report.reduce((sum, r) => sum + r.score, 0) / report.length : 0;
  const criticalVolume = report.reduce((sum, r) => sum + r.criticalOrders, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2
            className={cn(
              'text-2xl font-bold flex items-center gap-2',
              dark ? 'text-white' : 'text-slate-800',
            )}
          >
            <HeartPulse size={24} className="text-rose-500" />
            Health Score da Consultoria
          </h2>
          <p className={cn('text-sm mt-0.5', dark ? 'text-slate-400' : 'text-slate-500')}>
            Visão gerencial da saúde operacional dos provedores atendidos.
          </p>
        </div>
        <button
          onClick={load}
          className={cn(
            'px-4 py-2 rounded-lg border text-sm font-semibold transition-colors flex items-center gap-2',
            dark
              ? 'border-slate-700 text-slate-400 hover:bg-slate-800'
              : 'border-slate-200 text-slate-600 hover:bg-slate-50',
          )}
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Atualizar
        </button>
      </div>
      {loadError && (
        <div
          className={cn(
            'rounded-xl border px-4 py-3 text-sm',
            dark
              ? 'bg-rose-900/20 border-rose-700/40 text-rose-300'
              : 'bg-rose-50 border-rose-200 text-rose-700',
          )}
        >
          {loadError}
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 animate-stagger">
          <div
            className={cn(
              'rounded-xl border p-5 flex flex-col items-center justify-center h-48',
              dark ? 'bg-slate-800/40 border-slate-700/50' : 'bg-white border-slate-200',
            )}
          >
            <div className="skeleton-box w-24 h-4 mb-4" />
            <div className="skeleton-box w-32 h-32 rounded-full" />
          </div>
          <div
            className={cn(
              'rounded-xl border p-5 flex flex-col justify-center h-48',
              dark ? 'bg-slate-800/40 border-slate-700/50' : 'bg-white border-slate-200',
            )}
          >
            <div className="skeleton-box w-32 h-4 mb-4" />
            <div className="skeleton-box w-16 h-12" />
          </div>
          <div
            className={cn(
              'rounded-xl border p-5 flex flex-col justify-center h-48',
              dark ? 'bg-slate-800/40 border-slate-700/50' : 'bg-white border-slate-200',
            )}
          >
            <div className="skeleton-box w-40 h-4 mb-4" />
            <div className="skeleton-box w-20 h-12" />
          </div>
        </div>
      ) : report.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div
            className={cn(
              'animate-stagger rounded-xl border p-5 flex flex-col items-center justify-center shadow-sm hover:shadow-md transition-shadow',
              dark
                ? 'bg-slate-800/40 border-slate-700/50 shadow-black/20'
                : 'bg-white border-slate-200',
            )}
            style={{ animationDelay: '0.05s' }}
          >
            <p
              className={cn(
                'text-[10px] uppercase font-bold tracking-wider mb-2',
                dark ? 'text-slate-500' : 'text-slate-400',
              )}
            >
              Média Geral da Base
            </p>
            <SvgDonutChart
              size={120}
              value={Math.round(avgScore)}
              max={100}
              color={avgScore >= 80 ? '#10b981' : avgScore >= 60 ? '#f59e0b' : '#f43f5e'}
              trackColor={dark ? '#334155' : '#f1f5f9'}
            />
          </div>
          <div
            className={cn(
              'animate-stagger rounded-xl border p-5 flex flex-col justify-center shadow-sm hover:shadow-md transition-shadow',
              dark
                ? 'bg-slate-800/40 border-slate-700/50 shadow-black/20'
                : 'bg-white border-slate-200',
            )}
            style={{ animationDelay: '0.1s' }}
          >
            <p
              className={cn(
                'text-[10px] uppercase font-bold tracking-wider mb-2',
                dark ? 'text-slate-500' : 'text-slate-400',
              )}
            >
              Provedores Monitorados
            </p>
            <p className={cn('text-4xl font-black', dark ? 'text-white' : 'text-slate-800')}>
              {report.length}
            </p>
          </div>
          <div
            className={cn(
              'animate-stagger rounded-xl border p-5 flex flex-col justify-center shadow-sm hover:shadow-md transition-shadow',
              dark
                ? 'bg-slate-800/40 border-slate-700/50 shadow-black/20'
                : 'bg-white border-slate-200',
            )}
            style={{ animationDelay: '0.15s' }}
          >
            <p
              className={cn(
                'text-[10px] uppercase font-bold tracking-wider mb-2',
                dark ? 'text-slate-500' : 'text-slate-400',
              )}
            >
              Volume Crítico Acumulado
            </p>
            <p
              className={cn(
                'text-4xl font-black flex items-center gap-2',
                dark ? 'text-rose-400' : 'text-rose-600',
              )}
            >
              {criticalVolume} <ShieldAlert size={28} className="opacity-50" />
            </p>
          </div>
        </div>
      ) : null}

      <div
        className={cn(
          'rounded-xl border overflow-hidden',
          dark ? 'bg-slate-800/40 border-slate-700/50' : 'bg-white border-slate-200',
        )}
      >
        <table className="w-full text-sm">
          <thead>
            <tr
              className={cn(
                'border-b text-[10px] uppercase font-bold tracking-wider text-left',
                dark
                  ? 'border-slate-700 text-slate-500 bg-slate-800/60'
                  : 'border-slate-100 text-slate-400 bg-slate-50',
              )}
            >
              <th className="px-5 py-3">Provedor / Cliente</th>
              <th className="px-5 py-3 text-center">Score (0-100)</th>
              <th className="px-5 py-3 text-center">Grade</th>
              <th className="px-5 py-3 text-center">Total O.S</th>
              <th className="px-5 py-3 text-center">Taxa Crítica</th>
              <th className="px-5 py-3 text-center">Taxa de Resolução</th>
              <th className="px-5 py-3 text-right">Horas Consumidas</th>
            </tr>
          </thead>
          <tbody className={cn('divide-y', dark ? 'divide-slate-700/50' : 'divide-slate-100')}>
            {loading ? (
              Array.from({ length: 5 }).map((_, idx) => (
                <tr key={idx}>
                  <td className="px-5 py-4">
                    <div className="skeleton-box w-32 h-5" />
                  </td>
                  <td className="px-5 py-4">
                    <div className="skeleton-box w-full h-3" />
                  </td>
                  <td className="px-5 py-4 text-center">
                    <div className="skeleton-box w-8 h-6 mx-auto" />
                  </td>
                  <td className="px-5 py-4">
                    <div className="skeleton-box w-10 h-5 mx-auto" />
                  </td>
                  <td className="px-5 py-4">
                    <div className="skeleton-box w-12 h-5 mx-auto" />
                  </td>
                  <td className="px-5 py-4">
                    <div className="skeleton-box w-12 h-5 mx-auto" />
                  </td>
                  <td className="px-5 py-4">
                    <div className="skeleton-box w-16 h-5 ml-auto" />
                  </td>
                </tr>
              ))
            ) : report.length === 0 ? (
              <tr className="animate-stagger">
                <td colSpan={7} className="px-5 py-14 text-center">
                  <Activity
                    size={32}
                    className={cn('mx-auto mb-2', dark ? 'text-slate-600' : 'text-slate-300')}
                  />
                  <p className={cn('text-sm', dark ? 'text-slate-500' : 'text-slate-400')}>
                    Sem dados para gerar relatório.
                  </p>
                </td>
              </tr>
            ) : (
              report.map((p, idx) => (
                <tr
                  key={p.name}
                  className={cn(
                    'animate-stagger transition-colors',
                    dark ? 'hover:bg-slate-700/20' : 'hover:bg-slate-50',
                  )}
                  style={{ animationDelay: `${0.2 + idx * 0.05}s` }}
                >
                  <td className="px-5 py-4">
                    <span className={cn('font-bold', dark ? 'text-white' : 'text-slate-800')}>
                      {p.name}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-center">
                    <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-1.5 mt-1 relative overflow-hidden">
                      <div
                        className="h-full transition-all duration-1000 ease-out"
                        style={{
                          width: `${Math.max(0, p.score)}%`,
                          backgroundColor:
                            p.score >= 80 ? '#10b981' : p.score >= 60 ? '#f59e0b' : '#ef4444',
                        }}
                      />
                    </div>
                    <span
                      className={cn(
                        'text-xs font-bold',
                        dark ? 'text-slate-400' : 'text-slate-500',
                      )}
                    >
                      {p.score}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-center">
                    <span
                      className={cn(
                        'px-3 py-1 rounded-lg border font-black text-sm',
                        gradeColor(p.grade),
                      )}
                    >
                      {p.grade}
                    </span>
                  </td>
                  <td
                    className={cn(
                      'px-5 py-4 text-center font-mono',
                      dark ? 'text-slate-300' : 'text-slate-700',
                    )}
                  >
                    {p.totalOrders}
                  </td>
                  <td
                    className={cn(
                      'px-5 py-4 text-center font-bold text-xs',
                      p.criticalRate > 20
                        ? 'text-rose-500'
                        : dark
                          ? 'text-emerald-400'
                          : 'text-emerald-600',
                    )}
                  >
                    {p.criticalRate}%
                  </td>
                  <td
                    className={cn(
                      'px-5 py-4 text-center text-xs font-semibold',
                      p.resolutionRate < 70
                        ? 'text-rose-500'
                        : dark
                          ? 'text-slate-400'
                          : 'text-slate-500',
                    )}
                  >
                    {p.resolutionRate}%
                  </td>
                  <td
                    className={cn(
                      'px-5 py-4 text-right font-mono text-xs',
                      dark ? 'text-blue-400' : 'text-blue-600',
                    )}
                  >
                    {p.hoursConsumed}h
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
