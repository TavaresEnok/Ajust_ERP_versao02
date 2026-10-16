'use client';

import React, { useEffect, useState } from 'react';
import {
  Server,
  FileCode,
  GitCompare,
  Plus,
  RefreshCw,
  Copy,
  Check,
  Clock,
  User,
  ShieldCheck,
  ChevronRight,
  Terminal,
  X,
  FileText,
} from 'lucide-react';

export type AssetSummary = {
  id: string;
  name: string;
  category: string;
  status: string;
  vendor?: string | null;
  location?: string | null;
  _count?: { configSnapshots: number };
};

export type SnapshotSummary = {
  id: string;
  version: number;
  notes?: string | null;
  checksum: string;
  createdAt: string;
  createdBy?: { id: string; name: string } | null;
};

export type DiffResult = {
  fromVersion: number;
  toVersion: number;
  addedLinesCount: number;
  removedLinesCount: number;
  diffLines: Array<{ type: 'added' | 'removed' | 'unchanged'; text: string }>;
};

type Props = {
  dark?: boolean;
  tenantId?: string;
  onToast?: (msg: string) => void;
};

export function CmdbSnapshotsView({ dark = false, tenantId, onToast }: Props) {
  const [assets, setAssets] = useState<AssetSummary[]>([]);
  const [selectedAsset, setSelectedAsset] = useState<AssetSummary | null>(null);
  const [snapshots, setSnapshots] = useState<SnapshotSummary[]>([]);
  const [loadingAssets, setLoadingAssets] = useState(true);
  const [loadingSnapshots, setLoadingSnapshots] = useState(false);

  // Snapshot creation modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newContent, setNewContent] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [savingSnapshot, setSavingSnapshot] = useState(false);

  // Snapshot view/diff
  const [viewingSnapshot, setViewingSnapshot] = useState<{ version: number; content: string } | null>(null);
  const [fromSnapId, setFromSnapId] = useState<string>('');
  const [toSnapId, setToSnapId] = useState<string>('');
  const [diffResult, setDiffResult] = useState<DiffResult | null>(null);
  const [loadingDiff, setLoadingDiff] = useState(false);
  const [copied, setCopied] = useState(false);

  const loadAssets = async () => {
    setLoadingAssets(true);
    try {
      const res = await fetch('/api/cmdb/assets', { cache: 'no-store' });
      if (!res.ok) throw new Error('Falha ao carregar ativos de rede');
      const data = await res.json();
      const list = Array.isArray(data) ? data : [];
      setAssets(list);
      if (list.length > 0 && !selectedAsset) {
        setSelectedAsset(list[0]);
      }
    } catch (err: any) {
      onToast?.(err.message || 'Erro ao carregar ativos');
    } finally {
      setLoadingAssets(false);
    }
  };

  const loadSnapshots = async (assetId: string) => {
    setLoadingSnapshots(true);
    setDiffResult(null);
    setViewingSnapshot(null);
    try {
      const res = await fetch(`/api/cmdb/assets/${encodeURIComponent(assetId)}/snapshots`, {
        cache: 'no-store',
      });
      if (!res.ok) throw new Error('Falha ao carregar snapshots');
      const data = await res.json();
      const list: SnapshotSummary[] = Array.isArray(data) ? data : [];
      setSnapshots(list);
      if (list.length >= 2) {
        setFromSnapId(list[1].id);
        setToSnapId(list[0].id);
      } else if (list.length === 1) {
        setFromSnapId(list[0].id);
        setToSnapId(list[0].id);
      }
    } catch (err: any) {
      onToast?.(err.message || 'Erro ao carregar histórico');
    } finally {
      setLoadingSnapshots(false);
    }
  };

  useEffect(() => {
    loadAssets();
  }, [tenantId]);

  useEffect(() => {
    if (selectedAsset) {
      loadSnapshots(selectedAsset.id);
    }
  }, [selectedAsset]);

  const handleCreateSnapshot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAsset || !newContent.trim()) return;
    setSavingSnapshot(true);
    try {
      const res = await fetch(`/api/cmdb/assets/${encodeURIComponent(selectedAsset.id)}/snapshots`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          content: newContent,
          notes: newNotes.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Falha ao salvar snapshot');
      }
      onToast?.('Novo snapshot de configuração registrado com sucesso!');
      setShowCreateModal(false);
      setNewContent('');
      setNewNotes('');
      loadSnapshots(selectedAsset.id);
    } catch (err: any) {
      alert(err.message || 'Erro ao salvar');
    } finally {
      setSavingSnapshot(false);
    }
  };

  const handleRunDiff = async () => {
    if (!selectedAsset || !fromSnapId || !toSnapId) return;
    setLoadingDiff(true);
    try {
      const res = await fetch(
        `/api/cmdb/assets/${encodeURIComponent(selectedAsset.id)}/snapshots-diff?fromId=${encodeURIComponent(fromSnapId)}&toId=${encodeURIComponent(toSnapId)}`,
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Falha ao processar diff');
      }
      const data: DiffResult = await res.json();
      setDiffResult(data);
      setViewingSnapshot(null);
    } catch (err: any) {
      alert(err.message || 'Erro ao comparar versões');
    } finally {
      setLoadingDiff(false);
    }
  };

  const handleViewSnapshot = async (snapId: string, version: number) => {
    if (!selectedAsset) return;
    try {
      const res = await fetch(
        `/api/cmdb/assets/${encodeURIComponent(selectedAsset.id)}/snapshots/${encodeURIComponent(snapId)}`,
      );
      if (!res.ok) throw new Error('Falha ao carregar conteúdo');
      const data = await res.json();
      setViewingSnapshot({ version, content: data.content });
      setDiffResult(null);
    } catch (err: any) {
      alert(err.message || 'Erro ao abrir snapshot');
    }
  };

  const handleCopy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Server className="w-7 h-7 text-cyan-500" />
            <h1 className="text-2xl font-bold tracking-tight">Ativos & Histórico de Configuração (CMDB)</h1>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Versionamento de alterações em roteadores de borda BGP, OLTs e servidores dos 80 provedores com comparador de diff.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => loadAssets()}
            disabled={loadingAssets}
            className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
              dark
                ? 'border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700'
                : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            <RefreshCw className={`w-4 h-4 ${loadingAssets ? 'animate-spin' : ''}`} />
            Atualizar
          </button>

          {selectedAsset && (
            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-cyan-600 hover:bg-cyan-700 shadow-sm transition-colors"
            >
              <Plus className="w-4 h-4" />
              Novo Snapshot / Backup
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left column: Asset selector */}
        <div className="lg:col-span-1 space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Equipamentos de Rede ({assets.length})
          </h2>

          {loadingAssets ? (
            <div className="p-8 text-center text-sm text-slate-500">Carregando ativos...</div>
          ) : assets.length === 0 ? (
            <div className="p-6 rounded-xl border text-center text-sm text-slate-500">
              Nenhum ativo cadastrado no CMDB.
            </div>
          ) : (
            <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
              {assets.map((asset) => (
                <button
                  key={asset.id}
                  type="button"
                  onClick={() => setSelectedAsset(asset)}
                  className={`w-full text-left p-3 rounded-xl border transition-all flex items-center justify-between ${
                    selectedAsset?.id === asset.id
                      ? dark
                        ? 'border-cyan-500 bg-cyan-950/30 text-cyan-200'
                        : 'border-cyan-500 bg-cyan-50 text-cyan-900 shadow-sm'
                      : dark
                      ? 'border-slate-800 bg-slate-900/50 hover:border-slate-700 text-slate-300'
                      : 'border-slate-200 bg-white hover:border-slate-300 text-slate-800 shadow-xs'
                  }`}
                >
                  <div className="truncate">
                    <p className="font-semibold text-sm truncate">{asset.name}</p>
                    <p className="text-xs text-slate-500 truncate">
                      {asset.vendor || asset.category} {asset.location ? `• ${asset.location}` : ''}
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 shrink-0 text-slate-400" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Center & Right: Snapshots list and Diff viewer */}
        <div className="lg:col-span-3 space-y-6">
          {selectedAsset ? (
            <>
              {/* Asset header card */}
              <div
                className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                  dark ? 'bg-slate-900/70 border-slate-800' : 'bg-white border-slate-200 shadow-xs'
                }`}
              >
                <div>
                  <h3 className="text-lg font-bold flex items-center gap-2">
                    <Terminal className="w-5 h-5 text-cyan-500" />
                    {selectedAsset.name}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Categoria: <span className="font-semibold">{selectedAsset.category}</span> • Fabricante:{' '}
                    <span className="font-semibold">{selectedAsset.vendor || 'Não especificado'}</span>
                  </p>
                </div>

                {snapshots.length >= 2 && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <select
                      value={fromSnapId}
                      onChange={(e) => setFromSnapId(e.target.value)}
                      className={`text-xs px-2.5 py-1.5 rounded-lg border font-mono ${
                        dark ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-slate-50 border-slate-300'
                      }`}
                    >
                      {snapshots.map((s) => (
                        <option key={s.id} value={s.id}>
                          v{s.version} ({new Date(s.createdAt).toLocaleDateString('pt-BR')})
                        </option>
                      ))}
                    </select>

                    <span className="text-xs text-slate-400 font-semibold">vs</span>

                    <select
                      value={toSnapId}
                      onChange={(e) => setToSnapId(e.target.value)}
                      className={`text-xs px-2.5 py-1.5 rounded-lg border font-mono ${
                        dark ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-slate-50 border-slate-300'
                      }`}
                    >
                      {snapshots.map((s) => (
                        <option key={s.id} value={s.id}>
                          v{s.version} ({new Date(s.createdAt).toLocaleDateString('pt-BR')})
                        </option>
                      ))}
                    </select>

                    <button
                      type="button"
                      onClick={handleRunDiff}
                      disabled={loadingDiff || fromSnapId === toSnapId}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors disabled:opacity-50"
                    >
                      <GitCompare className="w-3.5 h-3.5" />
                      {loadingDiff ? 'Calculando...' : 'Comparar Diff'}
                    </button>
                  </div>
                )}
              </div>

              {/* Diff Viewer panel */}
              {diffResult && (
                <div
                  className={`rounded-xl border overflow-hidden ${
                    dark ? 'bg-slate-950 border-slate-800' : 'bg-slate-900 text-slate-100 border-slate-800'
                  }`}
                >
                  <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
                    <div className="flex items-center gap-3 text-xs font-mono">
                      <span className="font-semibold text-slate-300">
                        Diff: v{diffResult.fromVersion} → v{diffResult.toVersion}
                      </span>
                      <span className="text-emerald-400 font-bold">+{diffResult.addedLinesCount} adições</span>
                      <span className="text-rose-400 font-bold">-{diffResult.removedLinesCount} remoções</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => setDiffResult(null)}
                      className="text-slate-400 hover:text-slate-200"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="p-4 font-mono text-xs overflow-x-auto max-h-[500px] space-y-0.5 select-text">
                    {diffResult.diffLines.map((line, idx) => (
                      <div
                        key={idx}
                        className={`py-0.5 px-2 rounded flex items-start gap-2 ${
                          line.type === 'added'
                            ? 'bg-emerald-950/60 text-emerald-300 border-l-2 border-emerald-500'
                            : line.type === 'removed'
                            ? 'bg-rose-950/60 text-rose-300 border-l-2 border-rose-500 line-through opacity-80'
                            : 'text-slate-400'
                        }`}
                      >
                        <span className="w-4 shrink-0 font-bold select-none text-slate-500">
                          {line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' '}
                        </span>
                        <pre className="font-mono whitespace-pre-wrap break-all flex-1">{line.text}</pre>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Single Snapshot Content Viewer */}
              {viewingSnapshot && (
                <div
                  className={`rounded-xl border overflow-hidden ${
                    dark ? 'bg-slate-950 border-slate-800' : 'bg-slate-900 text-slate-100 border-slate-800'
                  }`}
                >
                  <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
                    <span className="text-xs font-mono font-semibold text-slate-300">
                      Visualizando Snapshot Versão v{viewingSnapshot.version}
                    </span>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleCopy(viewingSnapshot.content)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 transition-colors"
                      >
                        {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        {copied ? 'Copiado!' : 'Copiar'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setViewingSnapshot(null)}
                        className="text-slate-400 hover:text-slate-200"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <pre className="p-4 font-mono text-xs overflow-x-auto max-h-[500px] text-slate-300 whitespace-pre-wrap select-text">
                    {viewingSnapshot.content}
                  </pre>
                </div>
              )}

              {/* Snapshots Table / List */}
              <div
                className={`rounded-xl border overflow-hidden ${
                  dark ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200 shadow-xs'
                }`}
              >
                <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                  <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                    Histórico de Versões & Backups ({snapshots.length})
                  </h4>
                </div>

                {loadingSnapshots ? (
                  <div className="p-8 text-center text-sm text-slate-500">Carregando versões...</div>
                ) : snapshots.length === 0 ? (
                  <div className="p-8 text-center text-sm text-slate-500">
                    Nenhum backup registrado para este equipamento ainda. Clique em &quot;+ Novo Snapshot / Backup&quot; para salvar a primeira versão.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {snapshots.map((snap) => (
                      <div
                        key={snap.id}
                        className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors"
                      >
                        <div className="flex items-start gap-3">
                          <div className="px-2.5 py-1 rounded bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20 font-mono font-bold text-xs mt-0.5">
                            v{snap.version}
                          </div>

                          <div>
                            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                              {snap.notes || 'Backup de rotina de configuração'}
                            </p>
                            <div className="flex items-center gap-3 mt-1 text-xs text-slate-500 dark:text-slate-400">
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {new Date(snap.createdAt).toLocaleString('pt-BR')}
                              </span>
                              {snap.createdBy && (
                                <span className="flex items-center gap-1">
                                  <User className="w-3 h-3" />
                                  {snap.createdBy.name}
                                </span>
                              )}
                              <span className="font-mono text-[10px] text-slate-400 truncate max-w-[140px]" title={snap.checksum}>
                                SHA: {snap.checksum.slice(0, 10)}...
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 self-end sm:self-center">
                          <button
                            type="button"
                            onClick={() => handleViewSnapshot(snap.id, snap.version)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                          >
                            <FileCode className="w-3.5 h-3.5 text-cyan-500" />
                            Ver Script
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="p-12 text-center text-slate-500 border rounded-xl">
              Selecione um equipamento de rede na coluna ao lado para visualizar seu histórico e backups.
            </div>
          )}
        </div>
      </div>

      {/* Modal: New Snapshot */}
      {showCreateModal && selectedAsset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div
            className={`w-full max-w-3xl rounded-2xl shadow-2xl border overflow-hidden flex flex-col ${
              dark ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
            }`}
          >
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <Plus className="w-5 h-5 text-cyan-500" />
                Registrar Novo Backup / Snapshot — {selectedAsset.name}
              </h3>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSnapshot} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold mb-1 text-slate-700 dark:text-slate-300">
                  Motivo / Observações da Versão (ex: Alteração de BGP Upstream, Nova VLAN de Clientes)
                </label>
                <input
                  type="text"
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  placeholder="Ex: Atualização de filtro de rotas e política de BGP"
                  className={`w-full text-sm px-3 py-2 rounded-lg border ${
                    dark ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-slate-50 border-slate-300'
                  }`}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1 text-slate-700 dark:text-slate-300">
                  Script / Conteúdo Completo da Configuração (.rsc, VRP, IOS, CLI) *
                </label>
                <textarea
                  required
                  rows={12}
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  placeholder={`Cole aqui o export completo da configuração do equipamento...\nExemplo MikroTik:\n/ip address add address=...\n/routing bgp connection add ...`}
                  className={`w-full font-mono text-xs px-3 py-2 rounded-lg border ${
                    dark ? 'bg-slate-950 border-slate-700 text-cyan-300' : 'bg-slate-900 border-slate-800 text-cyan-200'
                  }`}
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-lg text-sm font-medium border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingSnapshot || !newContent.trim()}
                  className="px-5 py-2 rounded-lg text-sm font-semibold text-white bg-cyan-600 hover:bg-cyan-700 shadow-sm transition-colors disabled:opacity-50"
                >
                  {savingSnapshot ? 'Salvando Snapshot...' : 'Salvar Snapshot'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
