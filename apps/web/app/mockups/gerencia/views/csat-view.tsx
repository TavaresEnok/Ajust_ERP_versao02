'use client';
import React, { useEffect, useState, useMemo } from 'react';
import { Star, TrendingUp, MessageSquare, RefreshCw, BarChart3 } from 'lucide-react';

const cn = (...c: any[]) => c.filter(Boolean).join(' ');

const StarRating = ({ score, size = 18 }: { score: number; size?: number }) => (
  <div className="flex gap-0.5">
    {[1, 2, 3, 4, 5].map(i => (
      <Star key={i} size={size} className={i <= score ? 'text-amber-400 fill-amber-400' : 'text-slate-600'} />
    ))}
  </div>
);

export function CsatView({ dark, tenantId, onToast }: { dark: boolean; tenantId: string; onToast: (m: string) => void }) {
  const [responses, setResponses] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [respRes, sumRes] = await Promise.all([
        fetch(`/api/csat?tenantId=${encodeURIComponent(tenantId)}`, { cache: 'no-store' }),
        fetch(`/api/csat/summary?tenantId=${encodeURIComponent(tenantId)}`, { cache: 'no-store' }),
      ]);
      if (respRes.ok) setResponses(await respRes.json());
      if (sumRes.ok) setSummary(await sumRes.json());
    } catch { onToast('Falha ao carregar pesquisas de satisfação.'); }
    finally { setLoading(false); }
  };

  useEffect(() => { if (tenantId) load(); }, [tenantId]);

  const avgColor = (avg: number) => {
    if (avg >= 4.5) return 'text-emerald-400';
    if (avg >= 3.5) return 'text-amber-400';
    return 'text-rose-400';
  };

  const scoreLabel: Record<number, string> = { 5: 'Excelente', 4: 'Bom', 3: 'Regular', 2: 'Ruim', 1: 'Péssimo' };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className={cn('text-2xl font-bold', dark ? 'text-white' : 'text-slate-800')}>CSAT — Satisfação do Cliente</h2>
          <p className={cn('text-sm mt-0.5', dark ? 'text-slate-400' : 'text-slate-500')}>Acompanhe a nota de satisfação dos clientes após encerramento das O.S.</p>
        </div>
        <button onClick={load} className={cn('flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-semibold transition-colors', dark ? 'border-slate-700 text-slate-400 hover:bg-slate-800' : 'border-slate-200 text-slate-600 hover:bg-slate-50')}>
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Atualizar
        </button>
      </div>

      {/* KPI Cards */}
      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className={cn('rounded-xl border p-6 text-center', dark ? 'bg-slate-800/40 border-slate-700/50' : 'bg-white border-slate-200')}>
            <p className={cn('text-[10px] uppercase font-bold tracking-wider mb-2', dark ? 'text-slate-500' : 'text-slate-400')}>Nota Média</p>
            <p className={cn('text-5xl font-black mb-2', avgColor(summary.avg || 0))}>{summary.avg || '—'}</p>
            <StarRating score={Math.round(summary.avg || 0)} />
          </div>
          <div className={cn('rounded-xl border p-6 text-center', dark ? 'bg-slate-800/40 border-slate-700/50' : 'bg-white border-slate-200')}>
            <p className={cn('text-[10px] uppercase font-bold tracking-wider mb-2', dark ? 'text-slate-500' : 'text-slate-400')}>Respostas Totais</p>
            <p className={cn('text-5xl font-black mb-2', dark ? 'text-white' : 'text-slate-800')}>{summary.total || 0}</p>
            <p className={cn('text-xs', dark ? 'text-slate-500' : 'text-slate-400')}>pesquisas respondidas</p>
          </div>
          <div className={cn('rounded-xl border p-6', dark ? 'bg-slate-800/40 border-slate-700/50' : 'bg-white border-slate-200')}>
            <p className={cn('text-[10px] uppercase font-bold tracking-wider mb-3', dark ? 'text-slate-500' : 'text-slate-400')}>Distribuição</p>
            {[5, 4, 3, 2, 1].map(score => {
              const count = (summary.distribution || {})[score] || 0;
              const total = summary.total || 1;
              const pct = (count / total) * 100;
              const colors: Record<number, string> = { 5: 'bg-emerald-500', 4: 'bg-green-400', 3: 'bg-amber-400', 2: 'bg-orange-500', 1: 'bg-rose-500' };
              return (
                <div key={score} className="flex items-center gap-2 mb-1.5">
                  <span className={cn('text-xs w-4 font-bold', dark ? 'text-slate-400' : 'text-slate-500')}>{score}★</span>
                  <div className={cn('flex-1 rounded-full h-1.5 overflow-hidden', dark ? 'bg-slate-700' : 'bg-slate-100')}>
                    <div className={cn('h-full rounded-full transition-all', colors[score])} style={{ width: `${pct}%` }} />
                  </div>
                  <span className={cn('text-xs w-5 text-right', dark ? 'text-slate-500' : 'text-slate-400')}>{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* How CSAT works */}
      {responses.length === 0 && !loading && (
        <div className={cn('rounded-xl border p-6 flex gap-4', dark ? 'bg-slate-800/30 border-slate-700/50' : 'bg-amber-50 border-amber-200')}>
          <Star size={20} className="text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className={cn('text-sm font-semibold mb-1', dark ? 'text-slate-200' : 'text-slate-800')}>Como ativar o CSAT?</p>
            <p className={cn('text-xs leading-relaxed', dark ? 'text-slate-400' : 'text-slate-600')}>
              Ao encerrar uma O.S, clique em <strong>&quot;Enviar Pesquisa CSAT&quot;</strong>. O sistema gera um link único que pode ser enviado ao cliente por WhatsApp ou e-mail. Ele responde com uma nota de 1 a 5 e você acompanha aqui em tempo real.
            </p>
          </div>
        </div>
      )}

      {/* Responses list */}
      {responses.length > 0 && (
        <div className={cn('rounded-xl border overflow-hidden', dark ? 'bg-slate-800/40 border-slate-700/50' : 'bg-white border-slate-200')}>
          <div className={cn('px-5 py-3 border-b text-xs font-bold uppercase tracking-wider', dark ? 'border-slate-700 text-slate-500 bg-slate-800/60' : 'border-slate-100 text-slate-400 bg-slate-50')}>
            Respostas Recentes
          </div>
          <div className="divide-y divide-slate-700/30">
            {responses.map(r => (
              <div key={r.id} className={cn('px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-3 transition-colors', dark ? 'hover:bg-slate-700/20' : 'hover:bg-slate-50')}>
                <div className="flex items-center gap-3 flex-1">
                  <div className={cn('w-8 h-8 rounded-full flex items-center justify-center text-sm font-black flex-shrink-0', r.score >= 4 ? 'bg-emerald-500/20 text-emerald-400' : r.score === 3 ? 'bg-amber-500/20 text-amber-400' : 'bg-rose-500/20 text-rose-400')}>
                    {r.score}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className={cn('font-mono text-xs font-bold', dark ? 'text-blue-400' : 'text-blue-600')}>{r.order?.protocol}</span>
                      <StarRating score={r.score} size={12} />
                      <span className={cn('text-xs font-semibold', r.score >= 4 ? 'text-emerald-400' : r.score === 3 ? 'text-amber-400' : 'text-rose-400')}>{scoreLabel[r.score]}</span>
                    </div>
                    {r.comment && (
                      <div className={cn('flex items-start gap-1 text-xs', dark ? 'text-slate-400' : 'text-slate-500')}>
                        <MessageSquare size={11} className="flex-shrink-0 mt-0.5" />
                        <span className="italic">&quot;{r.comment}&quot;</span>
                      </div>
                    )}
                  </div>
                </div>
                <span className={cn('text-xs', dark ? 'text-slate-500' : 'text-slate-400')}>
                  {r.answeredAt ? new Date(r.answeredAt).toLocaleDateString('pt-BR') : '—'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
