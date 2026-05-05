'use client';
import React, { useEffect, useState } from 'react';
import { FileText, Download, Printer, BarChart3, Clock, CheckCircle, AlertTriangle, TrendingUp } from 'lucide-react';
import { SvgDonutChart, SvgBarChart } from '../../shared-charts';

const cn = (...c: any[]) => c.filter(Boolean).join(' ');

const fmtDate = (d: string) => new Date(d).toLocaleDateString('pt-BR');

export function PdfReportView({ dark, tenantId, tenantName, onToast }: { dark: boolean; tenantId: string; tenantName?: string; onToast: (m: string) => void }) {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState({ from: new Date(Date.now() - 30 * 86400000).toISOString().substring(0, 10), to: new Date().toISOString().substring(0, 10) });
  const [printing, setPrinting] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ tenantId, from: range.from, to: range.to });
      const res = await fetch(`/api/orders?${params.toString()}`, { cache: 'no-store' });
      if (res.ok) setOrders(await res.json());
    } catch { onToast('Falha ao carregar dados para relatório.'); }
    finally { setLoading(false); }
  };

  useEffect(() => { if (tenantId) load(); }, [tenantId, range]);

  const metrics = {
    total: orders.length,
    closed: orders.filter(o => ['Fechada', 'Resolvida', 'FECHADA', 'RESOLVIDA'].includes(o.status)).length,
    critical: orders.filter(o => ['Critica', 'CRITICA'].includes(o.priority)).length,
    avgResolutionH: (() => {
      const resolved = orders.filter(o => o.closedAt && o.createdAt);
      if (!resolved.length) return 0;
      const avg = resolved.reduce((s, o) => s + (new Date(o.closedAt).getTime() - new Date(o.createdAt).getTime()), 0) / resolved.length;
      return Math.round(avg / 3600000 * 10) / 10;
    })(),
    byType: orders.reduce((acc, o) => { acc[o.type] = (acc[o.type] || 0) + 1; return acc; }, {} as Record<string, number>),
    byStatus: orders.reduce((acc, o) => { acc[o.status] = (acc[o.status] || 0) + 1; return acc; }, {} as Record<string, number>),
  };

  const slaCompliance = metrics.total > 0 ? Math.round((metrics.closed / metrics.total) * 100) : 0;

  const handlePrint = () => {
    setPrinting(true);
    setTimeout(() => { window.print(); setPrinting(false); }, 300);
  };

  const inputCls = cn('px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40', dark ? 'bg-slate-900 border-slate-700 text-slate-200' : 'bg-white border-slate-300 text-slate-800');

  return (
    <>
      {/* Print styles */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body * { visibility: hidden; }
          #pdf-report-content, #pdf-report-content * { visibility: visible; }
          #pdf-report-content { position: absolute; left: 0; top: 0; width: 100%; padding: 24px; }
          .no-print { display: none !important; }
          .page-break { page-break-before: always; }
        }
      ` }} />

      <div className="space-y-6">
        {/* Header — no print */}
        <div className="no-print flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className={cn('text-2xl font-bold', dark ? 'text-white' : 'text-slate-800')}>Relatórios — Exportação PDF</h2>
            <p className={cn('text-sm mt-0.5', dark ? 'text-slate-400' : 'text-slate-500')}>Gere relatórios detalhados de SLA e performance para apresentar à diretoria.</p>
          </div>
          <button onClick={handlePrint} disabled={loading || printing} className="no-print flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold shadow-lg shadow-blue-500/20 transition-colors disabled:opacity-60">
            <Printer size={16} /> {printing ? 'Abrindo impressão...' : 'Imprimir / Salvar PDF'}
          </button>
        </div>

        {/* Date range filter */}
        <div className={cn('no-print flex flex-col sm:flex-row items-center gap-3 p-4 rounded-xl border', dark ? 'bg-slate-800/40 border-slate-700/50' : 'bg-white border-slate-200')}>
          <span className={cn('text-sm font-semibold', dark ? 'text-slate-400' : 'text-slate-600')}>Período:</span>
          <input type="date" value={range.from} onChange={e => setRange(r => ({ ...r, from: e.target.value }))} className={inputCls} />
          <span className={cn('text-sm', dark ? 'text-slate-500' : 'text-slate-400')}>até</span>
          <input type="date" value={range.to} onChange={e => setRange(r => ({ ...r, to: e.target.value }))} className={inputCls} />
          <button onClick={load} disabled={loading} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold disabled:opacity-50">
            {loading ? 'Carregando...' : 'Aplicar'}
          </button>
        </div>

        {/* PDF Report Content */}
        <div id="pdf-report-content" className={cn('rounded-xl border overflow-hidden', dark ? 'bg-slate-800/40 border-slate-700/50 print:bg-white print:text-slate-900' : 'bg-white border-slate-200')}>
          {/* Report Header */}
          <div className="p-8 bg-gradient-to-r from-slate-900 to-slate-800 print:from-slate-700 print:to-slate-600 text-white">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-1">Relatório Operacional NOC</p>
                <h1 className="text-3xl font-black">{tenantName || 'Ajust ERP'}</h1>
                <p className="text-slate-300 text-sm mt-1">{fmtDate(range.from)} — {fmtDate(range.to)}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-500">Gerado em</p>
                <p className="text-sm font-bold">{new Date().toLocaleDateString('pt-BR')}</p>
              </div>
            </div>
          </div>

          {/* KPI Grid */}
          <div className="p-8 grid grid-cols-2 sm:grid-cols-4 gap-6 border-b border-slate-200">
            {[
              { label: 'Total de O.S', value: String(metrics.total), icon: FileText, color: 'text-blue-600' },
              { label: 'Encerradas', value: String(metrics.closed), icon: CheckCircle, color: 'text-emerald-600' },
              { label: 'Críticas', value: String(metrics.critical), icon: AlertTriangle, color: 'text-rose-600' },
              { label: 'Tempo Médio', value: metrics.avgResolutionH ? `${metrics.avgResolutionH}h` : 'N/A', icon: Clock, color: 'text-purple-600' },
            ].map(kpi => (
              <div key={kpi.label} className="text-center">
                <kpi.icon size={24} className={cn('mx-auto mb-2', kpi.color)} />
                <p className={cn('text-3xl font-black', kpi.color)}>{kpi.value}</p>
                <p className="text-xs text-slate-500 mt-1 font-medium">{kpi.label}</p>
              </div>
            ))}
          </div>

          {/* SLA Compliance & Activity donut */}
          <div className="px-8 py-8 border-b border-slate-200 flex flex-col sm:flex-row items-center justify-around gap-8">
            <div className="flex flex-col items-center">
              <p className={cn('text-sm font-bold mb-4', dark ? 'text-slate-300' : 'text-slate-700')}>Taxa de Conclusão Global</p>
              <SvgDonutChart size={160} value={slaCompliance} max={100} color={slaCompliance >= 80 ? '#10b981' : slaCompliance >= 60 ? '#f59e0b' : '#f43f5e'} trackColor={dark ? '#334155' : '#f1f5f9'} label="%" />
            </div>
            <div className="flex flex-col items-center">
              <p className={cn('text-sm font-bold mb-4', dark ? 'text-slate-300' : 'text-slate-700')}>O.S Críticas vs Total</p>
              <SvgDonutChart size={160} value={metrics.critical} max={metrics.total || 1} color="#f43f5e" trackColor={dark ? '#334155' : '#f1f5f9'} label="Críticas" />
            </div>
          </div>

          {/* By Type breakdown */}
          <div className="px-8 py-8 grid grid-cols-1 sm:grid-cols-2 gap-8 border-b border-slate-200">
            <div>
              <p className={cn('text-xs font-bold uppercase tracking-wider mb-2', dark ? 'text-slate-500' : 'text-slate-400')}>Distribuição por Tipo</p>
              <SvgBarChart data={Object.entries(metrics.byType).sort((a: [string, any], b: [string, any]) => (b[1] as number) - (a[1] as number)).slice(0, 6).map(([l, v]) => ({ label: l.substring(0, 8) + '.', value: v as number }))} color="#3b82f6" height={160} />
            </div>
            <div>
              <p className={cn('text-xs font-bold uppercase tracking-wider mb-4', dark ? 'text-slate-500' : 'text-slate-400')}>Distribuição por Status</p>
              <div className="space-y-2">
                {Object.entries(metrics.byStatus).map(([status, count]) => {
                  const colors: Record<string, string> = { Aberta: 'bg-blue-500', Fechada: 'bg-emerald-500', ABERTA: 'bg-blue-500', FECHADA: 'bg-emerald-500', Resolvida: 'bg-emerald-500', Pendente: 'bg-amber-500', CRITICA: 'bg-rose-500' };
                  return (
                    <div key={status} className="flex items-center gap-3">
                      <span className={cn('text-xs font-medium w-40 truncate', dark ? 'text-slate-300' : 'text-slate-700')}>{status}</span>
                      <div className={cn('flex-1 h-1.5 rounded-full overflow-hidden', dark ? 'bg-slate-700' : 'bg-slate-100')}>
                        <div className={cn('h-full rounded-full', colors[status] || 'bg-slate-400')} style={{ width: `${((count as number) / metrics.total) * 100}%` }} />
                      </div>
                      <span className={cn('text-xs font-bold w-8 text-right', dark ? 'text-slate-400' : 'text-slate-500')}>{count as number}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* O.S Table */}
          <div className="px-8 py-6">
            <p className={cn('text-xs font-bold uppercase tracking-wider mb-4', dark ? 'text-slate-500' : 'text-slate-400')}>Últimas Ordens de Serviço ({orders.length})</p>
            <table className="w-full text-xs">
              <thead>
                <tr className={cn('border-b text-[10px] uppercase font-bold tracking-wider', dark ? 'border-slate-700 text-slate-500' : 'border-slate-200 text-slate-400')}>
                  <th className="py-2 text-left">Protocolo</th>
                  <th className="py-2 text-left">Tipo</th>
                  <th className="py-2 text-left">Status</th>
                  <th className="py-2 text-left">Prioridade</th>
                  <th className="py-2 text-left">Abertura</th>
                </tr>
              </thead>
              <tbody className={cn('divide-y', dark ? 'divide-slate-700/30' : 'divide-slate-100')}>
                {orders.slice(0, 20).map(o => (
                  <tr key={o.id}>
                    <td className={cn('py-2 font-mono font-bold', dark ? 'text-blue-400' : 'text-blue-600')}>{o.protocol}</td>
                    <td className={cn('py-2', dark ? 'text-slate-300' : 'text-slate-700')}>{o.type}</td>
                    <td className={cn('py-2', dark ? 'text-slate-400' : 'text-slate-500')}>{o.status}</td>
                    <td className={cn('py-2 font-semibold', ['Critica', 'CRITICA'].includes(o.priority) ? 'text-rose-500' : dark ? 'text-slate-400' : 'text-slate-500')}>{o.priority}</td>
                    <td className={cn('py-2', dark ? 'text-slate-500' : 'text-slate-400')}>{fmtDate(o.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Footer */}
          <div className={cn('px-8 py-4 border-t text-xs text-center', dark ? 'border-slate-700 text-slate-600' : 'border-slate-100 text-slate-400')}>
            Relatório gerado por Ajust ERP — Sistema de Gestão NOC · {new Date().toLocaleString('pt-BR')}
          </div>
        </div>
      </div>
    </>
  );
}
