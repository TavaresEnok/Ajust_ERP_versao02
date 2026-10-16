'use client';

import React from 'react';
import {
  Printer,
  Copy,
  Check,
  Building2,
  Clock,
  AlertTriangle,
  User,
  Shield,
  FileText,
  Calendar,
  Layers,
  Share2,
  X,
} from 'lucide-react';

export type ServiceOrderDetail = {
  id: string;
  protocol: string;
  externalProtocol?: string | null;
  provider?: string | null;
  requester?: string | null;
  title?: string;
  description: string;
  type: string;
  priority: string;
  status: string;
  analystName?: string | null;
  ownerName?: string | null;
  sector?: string | null;
  origin?: string | null;
  deadlineAt?: string | null;
  createdAt?: string | null;
  resolvedAt?: string | null;
  closedAt?: string | null;
  internalNotes?: string | null;
  tags?: string[];
  occurrences?: Array<{
    id: string;
    message: string;
    createdAt: string;
    actorUser?: { name: string } | null;
  }>;
  attachments?: Array<{
    id: string;
    fileName: string;
    sizeBytes: number;
    uploadedAt: string;
  }>;
};

type Props = {
  order: ServiceOrderDetail;
  onClose: () => void;
  dark?: boolean;
};

export function OrderPdfExportModal({ order, onClose, dark = false }: Props) {
  const [copied, setCopied] = React.useState(false);
  const [showWaPrompt, setShowWaPrompt] = React.useState(false);
  const [waTarget, setWaTarget] = React.useState('');
  const [isSendingWa, setIsSendingWa] = React.useState(false);
  const [waSentSuccess, setWaSentSuccess] = React.useState(false);

  const formatDateTime = (val?: string | null) => {
    if (!val) return '—';
    try {
      const d = new Date(val);
      return d.toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return val;
    }
  };

  const generateWhatsAppSummary = () => {
    const providerName = order.requester || order.provider || 'Provedor';
    const lines = [
      `*NOVA ORDEM DE SERVIÇO — AJUST CONSULTORIA*`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `*Protocolo:* #${order.protocol}`,
      `*Provedor:* ${providerName}`,
      `*Tipo:* ${order.type}`,
      `*Prioridade:* ${order.priority}`,
      `*Prazo Limite:* ${formatDateTime(order.deadlineAt)}`,
      `*Analista Responsável:* ${order.analystName || 'Não atribuído'}`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `*Descrição da Demanda:*`,
      `${order.description || 'Sem descrição.'}`,
      order.internalNotes ? `\n*Anotações Internas:* ${order.internalNotes}` : '',
      `━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `*Status:* ${order.status}`,
    ].filter(Boolean);

    return lines.join('\n');
  };

  const handleCopyWhatsApp = async () => {
    const text = generateWhatsAppSummary();
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      console.error('Falha ao copiar:', err);
    }
  };

  const handleSendAutomaticWhatsApp = async () => {
    setIsSendingWa(true);
    try {
      const res = await fetch('/api/notifications/whatsapp', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          orderId: order.id,
          target: waTarget.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Erro ao enviar notificação WhatsApp.');
      }

      setWaSentSuccess(true);
      setTimeout(() => {
        setWaSentSuccess(false);
        setShowWaPrompt(false);
      }, 3000);
    } catch (err: any) {
      alert(`Falha no envio via WhatsApp: ${err.message || 'Erro inesperado'}`);
    } finally {
      setIsSendingWa(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm overflow-y-auto">
      <div
        className={`relative w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden flex flex-col my-8 ${
          dark ? 'bg-slate-900 border border-slate-700 text-slate-100' : 'bg-white text-slate-900'
        }`}
      >
        {/* Top Action Bar (hidden on print) */}
        <div className="print:hidden flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60">
          <div className="flex items-center gap-2">
            <FileText className="text-indigo-600 dark:text-indigo-400" size={20} />
            <h3 className="font-bold text-base">Ficha Técnica da O.S. #{order.protocol}</h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowWaPrompt(!showWaPrompt)}
              type="button"
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-all"
              title="Disparar PDF e resumo diretamente para grupo ou contato"
            >
              <Share2 size={15} />
              Enviar para Grupo WhatsApp
            </button>
            <button
              onClick={handleCopyWhatsApp}
              type="button"
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                copied
                  ? 'bg-slate-700 text-white'
                  : 'bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200'
              }`}
            >
              {copied ? <Check size={15} /> : <Share2 size={15} />}
              {copied ? 'Copiado!' : 'Copiar Resumo'}
            </button>
            <button
              onClick={handlePrint}
              type="button"
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm hover:shadow transition-all"
            >
              <Printer size={15} />
              Imprimir / Salvar PDF
            </button>
            <button
              onClick={onClose}
              type="button"
              className="p-2 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-700 transition"
              title="Fechar"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Prompt de Envio Automático WhatsApp */}
        {showWaPrompt && (
          <div className="print:hidden px-6 py-3 bg-emerald-50 dark:bg-emerald-950/40 border-b border-emerald-200 dark:border-emerald-800 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-emerald-900 dark:text-emerald-200">
              <span className="font-semibold">Disparo Automático com Link do PDF:</span>
              <input
                type="text"
                value={waTarget}
                onChange={(e) => setWaTarget(e.target.value)}
                placeholder="ID do Grupo WhatsApp ou Telefone (ex: 5511999999999)..."
                className="px-3 py-1.5 rounded-lg border border-emerald-300 dark:border-emerald-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 w-80 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={isSendingWa}
                onClick={handleSendAutomaticWhatsApp}
                className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold transition disabled:opacity-50"
              >
                {isSendingWa
                  ? 'Disparando...'
                  : waSentSuccess
                    ? '✓ Enviado com Sucesso!'
                    : 'Confirmar Disparo'}
              </button>
              <button
                type="button"
                onClick={() => setShowWaPrompt(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 px-2 py-1"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* Printable Document Container */}
        <div
          id="printable-service-order"
          className="p-8 sm:p-12 overflow-y-auto max-h-[75vh] print:max-h-none print:overflow-visible print:p-0 print:m-0 bg-white text-slate-900"
        >
          {/* Header */}
          <div className="border-b-2 border-indigo-600 pb-6 mb-6 flex justify-between items-start">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-black tracking-tight text-indigo-700">AJUST</span>
                <span className="text-sm font-semibold uppercase px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                  Consultoria & NOC
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Gestão e Suporte Especializado para Provedores de Internet
              </p>
            </div>
            <div className="text-right">
              <div className="text-xl font-bold font-mono text-slate-900">
                O.S. #{order.protocol}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                Abertura: {formatDateTime(order.createdAt)}
              </div>
              {order.externalProtocol && (
                <div className="text-[11px] text-slate-400 font-mono">
                  Ref. Externa: {order.externalProtocol}
                </div>
              )}
            </div>
          </div>

          {/* Grid de Metadados Principais */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200 mb-6">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                Provedor / Cliente
              </span>
              <span className="text-sm font-semibold text-slate-900">
                {order.requester || order.provider || 'Não informado'}
              </span>
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                Tipo de Atendimento
              </span>
              <span className="text-sm font-semibold text-slate-900">{order.type}</span>
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                Prioridade
              </span>
              <span
                className={`inline-block px-2 py-0.5 mt-0.5 rounded text-xs font-bold ${
                  order.priority === 'CRITICA'
                    ? 'bg-red-100 text-red-800'
                    : order.priority === 'ALTA'
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-blue-100 text-blue-800'
                }`}
              >
                {order.priority}
              </span>
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                Prazo Limite (SLA)
              </span>
              <span className="text-sm font-bold text-red-600">
                {formatDateTime(order.deadlineAt)}
              </span>
            </div>
          </div>

          {/* Responsabilidade e Status */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6 pb-6 border-b border-slate-200 text-xs">
            <div>
              <span className="text-slate-500 block font-medium">Analista Responsável:</span>
              <span className="font-semibold text-slate-800">
                {order.analystName || 'Aguardando atribuição'}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block font-medium">Atendente Triador:</span>
              <span className="font-semibold text-slate-800">
                {order.ownerName || 'Equipe NOC'}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block font-medium">Setor / Origem:</span>
              <span className="font-semibold text-slate-800">
                {order.sector || 'NOC'} / {order.origin || 'Chat'}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block font-medium">Status Atual:</span>
              <span className="font-bold text-indigo-700">{order.status}</span>
            </div>
          </div>

          {/* Descrição Detalhada da Atividade */}
          <div className="mb-6">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2 flex items-center gap-1.5">
              <FileText size={14} className="text-indigo-600" />
              Descrição da Solicitação / Problema
            </h4>
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 text-sm leading-relaxed whitespace-pre-wrap text-slate-800 font-sans">
              {order.description || 'Nenhuma descrição fornecida.'}
            </div>
          </div>

          {/* Observações Internas */}
          {order.internalNotes && (
            <div className="mb-6">
              <h4 className="text-xs font-bold uppercase tracking-wider text-amber-700 mb-2 flex items-center gap-1.5">
                <AlertTriangle size={14} />
                Observações Técnicas Internas
              </h4>
              <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/50 text-xs leading-relaxed whitespace-pre-wrap text-amber-950">
                {order.internalNotes}
              </div>
            </div>
          )}

          {/* Tags */}
          {order.tags && order.tags.length > 0 && (
            <div className="mb-6 flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500">Etiquetas:</span>
              <div className="flex flex-wrap gap-1.5">
                {order.tags.map((tag, i) => (
                  <span
                    key={i}
                    className="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Histórico de Apontamentos Técnicos */}
          {order.occurrences && order.occurrences.length > 0 && (
            <div className="mb-6">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                Histórico de Execução & Registros Técnicos
              </h4>
              <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 overflow-hidden">
                {order.occurrences.map((item) => (
                  <div key={item.id} className="p-3 text-xs bg-slate-50/30">
                    <div className="flex justify-between items-center mb-1 text-slate-500">
                      <span className="font-semibold text-slate-700">
                        {item.actorUser?.name || 'Técnico'}
                      </span>
                      <span className="font-mono text-[11px]">
                        {formatDateTime(item.createdAt)}
                      </span>
                    </div>
                    <div className="text-slate-800 whitespace-pre-wrap">{item.message}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Rodapé / Assinatura */}
          <div className="mt-12 pt-6 border-t border-slate-200 grid grid-cols-2 gap-8 text-center text-xs text-slate-500">
            <div>
              <div className="border-t border-slate-300 w-3/4 mx-auto pt-2 mt-8">
                Técnico / Analista Responsável
              </div>
            </div>
            <div>
              <div className="border-t border-slate-300 w-3/4 mx-auto pt-2 mt-8">
                Validação / Supervisão NOC
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
