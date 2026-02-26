'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Copy, Eye, EyeOff, Plus, Search } from 'lucide-react';
import { AnalystCredentialsPagination } from './analista-credentials-pagination';
import type {
  CredentialGroup,
  CredentialRow,
  CredentialSortField,
  CredentialSortState,
  ProviderSummaryRow,
} from './analista-knowledge-credentials-panel';

const cn = (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' ');

type Props = {
  dark: boolean;
  equipmentFilter: string;
  equipmentOptions: string[];
  providerFilter: string;
  credentialSearch: string;
  providerSummariesVisible: ProviderSummaryRow[];
  providersTotalCredentials: number;
  credentialsTotal: number;
  groupedByEquipment: CredentialGroup[];
  credentialSort: CredentialSortState;
  visibleSecrets: Record<string, boolean>;
  revealedSecrets: Record<string, string>;
  credentialOffset: number;
  currentPageCount: number;
  credentialLimit: number;
  onEquipmentFilterChange: (value: string) => void;
  onProviderFilterChange: (value: string) => void;
  onCredentialSearchChange: (value: string) => void;
  onClearFilters: () => void;
  onToggleCredentialSort: (field: CredentialSortField) => void;
  onToggleCredentialSecret: (credentialId: string) => void;
  onCopyCredentialLine: (credential: CredentialRow, visible: boolean, secret: string) => void;
  onPrevPage: () => void;
  onNextPage: () => void;
  canCreateCredential: boolean;
  onOpenCreateCredential: () => void;
};

export function AnalystKnowledgeCredentialsLabPanel({
  dark,
  equipmentFilter,
  equipmentOptions,
  providerFilter,
  credentialSearch,
  providerSummariesVisible,
  providersTotalCredentials,
  credentialsTotal,
  groupedByEquipment,
  credentialSort,
  visibleSecrets,
  revealedSecrets,
  credentialOffset,
  currentPageCount,
  credentialLimit,
  onEquipmentFilterChange,
  onProviderFilterChange,
  onCredentialSearchChange,
  onClearFilters,
  onToggleCredentialSort,
  onToggleCredentialSecret,
  onCopyCredentialLine,
  onPrevPage,
  onNextPage,
  canCreateCredential,
  onOpenCreateCredential,
}: Props) {
  const flatCredentials = useMemo(
    () => groupedByEquipment.flatMap((group) => group.items),
    [groupedByEquipment]
  );

  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (!flatCredentials.length) {
      setSelectedId(null);
      return;
    }
    if (!selectedId || !flatCredentials.some((item) => item.id === selectedId)) {
      setSelectedId(flatCredentials[0].id);
    }
  }, [flatCredentials, selectedId]);

  const selected = flatCredentials.find((item) => item.id === selectedId) || null;
  const selectedVisible = selected ? !!visibleSecrets[selected.id] : false;
  const selectedSecret = selected ? (revealedSecrets[selected.id] || selected.secret) : '';
  const recordsTotal = providerFilter === 'Todos' ? providersTotalCredentials : credentialsTotal;

  return (
    <div className="space-y-4">
      <div
        className={cn(
          'border rounded-xl p-4 shadow-sm space-y-3',
          dark ? 'bg-[#1e293b]/60 backdrop-blur-md border-slate-700/50' : 'bg-white border-slate-200'
        )}
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <select
            value={providerFilter}
            onChange={(e) => onProviderFilterChange(e.target.value)}
            className={cn(
              'px-3 py-2 border rounded-lg text-sm',
              dark ? 'bg-[#0f172a]/80 border-slate-700/50 text-slate-300' : 'bg-white border-slate-300 text-slate-700'
            )}
          >
            <option value="Todos">Todos os provedores</option>
            {providerSummariesVisible.map((summary) => (
              <option key={summary.provider} value={summary.provider}>
                {summary.provider} ({summary.total})
              </option>
            ))}
          </select>

          <select
            value={equipmentFilter}
            onChange={(e) => onEquipmentFilterChange(e.target.value)}
            className={cn(
              'px-3 py-2 border rounded-lg text-sm',
              dark ? 'bg-[#0f172a]/80 border-slate-700/50 text-slate-300' : 'bg-white border-slate-300 text-slate-700'
            )}
          >
            {equipmentOptions.map((equipmentTypeName) => (
              <option key={equipmentTypeName}>{equipmentTypeName}</option>
            ))}
          </select>

          <div className="relative">
            <Search
              size={14}
              className={cn(
                'absolute left-3 top-1/2 -translate-y-1/2',
                dark ? 'text-slate-500' : 'text-slate-400'
              )}
            />
            <input
              value={credentialSearch}
              onChange={(e) => onCredentialSearchChange(e.target.value)}
              placeholder="Buscar equipamento, host ou usuario..."
              className={cn(
                'w-full pl-9 pr-3 py-2 border rounded-lg text-sm',
                dark
                  ? 'bg-[#0f172a]/80 border-slate-700/50 text-slate-300 placeholder:text-slate-600'
                  : 'bg-white border-slate-300 text-slate-700 placeholder:text-slate-400'
              )}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span
            className={cn(
              'px-2 py-1 rounded-full border',
              dark
                ? 'border-slate-700/50 bg-[#0f172a]/80 text-slate-400'
                : 'border-slate-200 bg-slate-50 text-slate-600'
            )}
          >
            Registros: {recordsTotal}
          </span>
          <button
            onClick={() => onToggleCredentialSort('equipmentName')}
            className={cn(
              'px-2 py-1 rounded border transition-colors',
              dark
                ? 'border-slate-700/50 text-slate-400 hover:bg-white/5'
                : 'border-slate-300 text-slate-600 hover:bg-slate-50'
            )}
          >
            Equipamento {credentialSort.field === 'equipmentName' ? (credentialSort.dir === 'asc' ? '▲' : '▼') : '↕'}
          </button>
          <button
            onClick={onClearFilters}
            className={cn(
              'px-2 py-1 rounded border transition-colors',
              dark
                ? 'border-slate-700/50 text-slate-400 hover:bg-white/5'
                : 'border-slate-300 text-slate-600 hover:bg-slate-50'
            )}
          >
            Limpar filtros
          </button>
          {canCreateCredential && (
            <button
              onClick={onOpenCreateCredential}
              className={cn(
                'ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors',
                dark
                  ? 'border-cyan-700/50 bg-cyan-900/30 text-cyan-300 hover:bg-cyan-900/40'
                  : 'border-cyan-200 bg-cyan-50 text-cyan-700 hover:bg-cyan-100'
              )}
            >
              <Plus size={12} />
              Novo equipamento
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_460px] gap-4">
        <div
          className={cn(
            'border rounded-xl overflow-hidden',
            dark ? 'bg-[#1e293b]/60 backdrop-blur-md border-slate-700/50' : 'bg-white border-slate-200'
          )}
        >
          <div className={cn('px-4 py-3 border-b text-sm font-semibold', dark ? 'border-slate-700/50 text-slate-200' : 'border-slate-100 text-slate-800')}>
            Lista de credenciais ({flatCredentials.length})
          </div>
          <div className="max-h-[62vh] overflow-y-auto custom-scrollbar divide-y divide-slate-100">
            {flatCredentials.map((credential) => (
              <button
                key={credential.id}
                onClick={() => {
                  setSelectedId(credential.id);
                }}
                className={cn(
                  'w-full text-left px-4 py-3 transition-colors',
                  selectedId === credential.id
                    ? (dark ? 'bg-cyan-900/20' : 'bg-cyan-50')
                    : (dark ? 'hover:bg-white/5' : 'hover:bg-slate-50')
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className={cn('font-semibold text-sm', dark ? 'text-cyan-300' : 'text-cyan-700')}>
                    {credential.equipmentName || '-'}
                  </div>
                  <div className={cn('text-[11px]', dark ? 'text-slate-500' : 'text-slate-500')}>
                    {credential.equipmentType}
                  </div>
                </div>
                <div className={cn('font-mono text-xs mt-1', dark ? 'text-slate-300' : 'text-slate-700')}>
                  {credential.host}
                </div>
                <div className={cn('text-xs mt-1', dark ? 'text-slate-400' : 'text-slate-600')}>
                  {credential.provider} • {credential.user}
                </div>
              </button>
            ))}
            {flatCredentials.length === 0 && (
              <div className={cn('p-8 text-center text-sm', dark ? 'text-slate-400' : 'text-slate-500')}>
                Nenhuma credencial encontrada.
              </div>
            )}
          </div>
          {flatCredentials.length > 0 && (
            <div className="p-3 border-t border-slate-100">
              <AnalystCredentialsPagination
                dark={dark}
                offset={credentialOffset}
                pageCount={currentPageCount}
                total={credentialsTotal}
                onPrev={onPrevPage}
                onNext={onNextPage}
              />
            </div>
          )}
        </div>

        <div
          className={cn(
            'border rounded-xl p-4',
            dark ? 'bg-[#1e293b]/60 backdrop-blur-md border-slate-700/50' : 'bg-white border-slate-200'
          )}
        >
          {!selected && (
            <div className={cn('h-full flex items-center justify-center text-sm', dark ? 'text-slate-400' : 'text-slate-500')}>
              Selecione uma credencial na lista.
            </div>
          )}

          {selected && (
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className={cn('text-xs uppercase', dark ? 'text-slate-500' : 'text-slate-500')}>Detalhes</div>
                  <div className={cn('font-semibold', dark ? 'text-slate-100' : 'text-slate-900')}>
                    {selected.equipmentName || '-'}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    title={selectedVisible ? 'Ocultar senha' : 'Exibir senha'}
                    onClick={() => onToggleCredentialSecret(selected.id)}
                    className={cn('px-2 py-1 rounded border transition-colors', dark ? 'border-slate-700/50 text-slate-400 hover:bg-white/5' : 'border-slate-300 text-slate-600 hover:bg-slate-100')}
                  >
                    {selectedVisible ? <EyeOff size={12} /> : <Eye size={12} />}
                  </button>
                  <button
                    title="Copiar linha completa"
                    onClick={() => onCopyCredentialLine(selected, selectedVisible, selectedSecret)}
                    className="px-2 py-1 rounded border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
                  >
                    <Copy size={12} />
                  </button>
                </div>
              </div>

              <div className={cn('border rounded-lg p-3 text-sm', dark ? 'border-slate-700/50 bg-[#0f172a]/80' : 'border-slate-200 bg-slate-50')}>
                <div className="grid grid-cols-[90px_1fr] gap-2 py-1">
                  <span className={cn(dark ? 'text-slate-500' : 'text-slate-500')}>Provedor:</span>
                  <span className={cn('font-medium', dark ? 'text-slate-200' : 'text-slate-800')}>{selected.provider}</span>
                </div>
                <div className="grid grid-cols-[90px_1fr] gap-2 py-1">
                  <span className={cn(dark ? 'text-slate-500' : 'text-slate-500')}>Tipo:</span>
                  <span className={cn('font-medium', dark ? 'text-slate-200' : 'text-slate-800')}>{selected.equipmentType || '-'}</span>
                </div>
                <div className="grid grid-cols-[90px_1fr] gap-2 py-1">
                  <span className={cn(dark ? 'text-slate-500' : 'text-slate-500')}>Host:</span>
                  <span className={cn('font-mono text-xs break-all', dark ? 'text-slate-300' : 'text-slate-700')}>{selected.host || '-'}</span>
                </div>
                <div className="grid grid-cols-[90px_1fr] gap-2 py-1">
                  <span className={cn(dark ? 'text-slate-500' : 'text-slate-500')}>Usuario:</span>
                  <span className={cn('font-mono text-xs break-all', dark ? 'text-slate-300' : 'text-slate-700')}>{selected.user || '-'}</span>
                </div>
                <div className="grid grid-cols-[90px_1fr] gap-2 py-1">
                  <span className={cn(dark ? 'text-slate-500' : 'text-slate-500')}>Senha:</span>
                  <span className={cn('font-mono text-xs break-all', dark ? 'text-slate-300' : 'text-slate-700')}>
                    {selectedVisible ? selectedSecret : selected.secret}
                  </span>
                </div>
              </div>

              <div className={cn('border rounded-lg p-3', dark ? 'border-slate-700/50 bg-[#0f172a]/80' : 'border-slate-200 bg-slate-50')}>
                <div className={cn('text-xs uppercase mb-2', dark ? 'text-slate-500' : 'text-slate-500')}>
                  Observacoes
                </div>
                <div className={cn('text-sm whitespace-pre-wrap break-words max-h-[36vh] overflow-y-auto custom-scrollbar pr-1', dark ? 'text-slate-300' : 'text-slate-700')}>
                  {selected.notes || 'Sem observacoes.'}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
