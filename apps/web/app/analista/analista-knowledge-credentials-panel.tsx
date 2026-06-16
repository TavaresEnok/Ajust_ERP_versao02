'use client';

import React from 'react';
import { Copy, Eye, EyeOff, Plus, Search } from 'lucide-react';
import { AnalystCredentialsPagination } from './analista-credentials-pagination';

const cn = (...classes: Array<string | false | null | undefined>) =>
  classes.filter(Boolean).join(' ');

export type CredentialSortField = 'equipmentName' | 'env' | 'host' | 'user' | 'notes';

export type CredentialSortState = {
  field: CredentialSortField;
  dir: 'asc' | 'desc';
};

export type CredentialRow = {
  id: string;
  provider: string;
  env: string;
  equipmentType: string;
  equipmentName: string;
  host: string;
  user: string;
  secret: string;
  notes: string;
  createdAt: number;
  updatedAt: number;
};

export type ProviderSummaryRow = {
  provider: string;
  total: number;
  equipmentTypeCount: number;
  environmentCount: number;
};

export type CredentialGroup = {
  equipmentType: string;
  total: number;
  items: CredentialRow[];
};

type AnalystKnowledgeCredentialsPanelProps = {
  dark: boolean;
  equipmentFilter: string;
  equipmentOptions: string[];
  providerFilter: string;
  providerSearch: string;
  credentialSearch: string;
  providerSummariesVisible: ProviderSummaryRow[];
  providerSummariesTotal: number;
  providersTotalCredentials: number;
  credentialsTotal: number;
  groupedByEquipment: CredentialGroup[];
  credentialSort: CredentialSortState;
  visibleSecrets: Record<string, boolean>;
  revealedSecrets: Record<string, string>;
  credentialOffset: number;
  credentialLimit: number;
  currentPageCount: number;
  onEquipmentFilterChange: (value: string) => void;
  onProviderFilterChange: (value: string) => void;
  onProviderSearchChange: (value: string) => void;
  onCredentialSearchChange: (value: string) => void;
  onClearFilters: () => void;
  onToggleCredentialSort: (field: CredentialSortField) => void;
  onOpenCredentialDetails: (credential: CredentialRow) => void;
  onToggleCredentialSecret: (credentialId: string) => void;
  onCopyCredentialLine: (credential: CredentialRow, visible: boolean, secret: string) => void;
  onPrevPage: () => void;
  onNextPage: () => void;
  canCreateCredential: boolean;
  onOpenCreateCredential: () => void;
};

export function AnalystKnowledgeCredentialsPanel({
  dark,
  equipmentFilter,
  equipmentOptions,
  providerFilter,
  providerSearch,
  credentialSearch,
  providerSummariesVisible,
  providerSummariesTotal,
  providersTotalCredentials,
  credentialsTotal,
  groupedByEquipment,
  credentialSort,
  visibleSecrets,
  revealedSecrets,
  credentialOffset,
  credentialLimit,
  currentPageCount,
  onEquipmentFilterChange,
  onProviderFilterChange,
  onProviderSearchChange,
  onCredentialSearchChange,
  onClearFilters,
  onToggleCredentialSort,
  onOpenCredentialDetails,
  onToggleCredentialSecret,
  onCopyCredentialLine,
  onPrevPage,
  onNextPage,
  canCreateCredential,
  onOpenCreateCredential,
}: AnalystKnowledgeCredentialsPanelProps) {
  return (
    <div className="space-y-4">
      <div
        className={cn(
          'border rounded-xl p-4 space-y-3 shadow-sm',
          dark
            ? 'bg-[#1e293b]/60 backdrop-blur-md border-slate-700/50'
            : 'bg-white border-slate-200',
        )}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <select
            value={providerFilter}
            onChange={(e) => onProviderFilterChange(e.target.value)}
            className={cn(
              'px-3 py-2 border rounded-lg text-sm',
              dark
                ? 'bg-[#0f172a]/80 border-slate-700/50 text-slate-300'
                : 'bg-white border-slate-300 text-slate-700',
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
              dark
                ? 'bg-[#0f172a]/80 border-slate-700/50 text-slate-300'
                : 'bg-white border-slate-300 text-slate-700',
            )}
          >
            {equipmentOptions.map((equipmentTypeName) => (
              <option key={equipmentTypeName}>{equipmentTypeName}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span
            className={cn(
              'px-2 py-1 rounded-full border',
              dark
                ? 'border-slate-700/50 bg-[#0f172a]/80 text-slate-400'
                : 'border-slate-200 bg-slate-50 text-slate-600',
            )}
          >
            Credenciais: {providerFilter === 'Todos' ? providersTotalCredentials : credentialsTotal}
          </span>
          {providerFilter !== 'Todos' && (
            <span
              className={cn(
                'px-2 py-1 rounded-full border',
                dark
                  ? 'border-blue-700/50 bg-blue-900/30 text-blue-300'
                  : 'border-blue-200 bg-blue-50 text-blue-700',
              )}
            >
              Selecionado: {providerFilter}
            </span>
          )}
          <button
            onClick={onClearFilters}
            className={cn(
              'ml-auto px-2 py-1 rounded border transition-colors',
              dark
                ? 'border-slate-700/50 text-slate-400 hover:bg-white/5'
                : 'border-slate-300 text-slate-600 hover:bg-slate-50',
            )}
          >
            Limpar filtros
          </button>
        </div>
      </div>

      <div
        className={cn(
          'border rounded-xl overflow-hidden',
          dark
            ? 'bg-[#1e293b]/60 backdrop-blur-md border-slate-700/50'
            : 'bg-white border-slate-200',
        )}
      >
        <div
          className={cn(
            'px-4 py-3 border-b flex items-center justify-between gap-2',
            dark ? 'border-slate-700/50' : 'border-slate-100',
          )}
        >
          <div>
            <div
              className={cn(
                'text-xs uppercase font-bold',
                dark ? 'text-slate-500' : 'text-slate-500',
              )}
            >
              Painel de Credenciais
            </div>
            <div
              className={cn('text-sm font-semibold', dark ? 'text-slate-200' : 'text-slate-800')}
            >
              {providerFilter === 'Todos' ? 'Todos os provedores' : providerFilter}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {providerFilter !== 'Todos' && (
              <div className={cn('text-xs', dark ? 'text-slate-400' : 'text-slate-500')}>
                {credentialsTotal} registros
              </div>
            )}
            {canCreateCredential && (
              <button
                onClick={onOpenCreateCredential}
                className={cn(
                  'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors',
                  dark
                    ? 'border-cyan-700/50 bg-cyan-900/30 text-cyan-300 hover:bg-cyan-900/40'
                    : 'border-cyan-200 bg-cyan-50 text-cyan-700 hover:bg-cyan-100',
                )}
              >
                <Plus size={12} />
                Novo equipamento
              </button>
            )}
          </div>
        </div>
        <div className={cn('p-2 border-b', dark ? 'border-slate-700/50' : 'border-slate-100')}>
          <div className="relative">
            <Search
              size={14}
              className={cn(
                'absolute left-3 top-1/2 -translate-y-1/2',
                dark ? 'text-slate-500' : 'text-slate-400',
              )}
            />
            <input
              value={credentialSearch}
              onChange={(e) => onCredentialSearchChange(e.target.value)}
              placeholder="Buscar no painel de credenciais..."
              className={cn(
                'w-full pl-9 pr-3 py-2 border rounded-lg text-sm',
                dark
                  ? 'bg-[#0f172a]/80 border-slate-700/50 text-slate-300 placeholder:text-slate-600'
                  : 'bg-white border-slate-300 text-slate-700 placeholder:text-slate-400',
              )}
            />
          </div>
        </div>

        <div className="p-4 space-y-4 max-h-[66vh] overflow-y-auto custom-scrollbar">
          {groupedByEquipment.length === 0 && (
            <div
              className={cn(
                'border rounded-lg p-6 text-center text-sm',
                dark
                  ? 'border-slate-700/50 text-slate-400 bg-[#0f172a]/80'
                  : 'border-slate-200 text-slate-500 bg-slate-50',
              )}
            >
              Nenhuma credencial encontrada para este provedor com os filtros atuais.
            </div>
          )}

          {groupedByEquipment.map((group) => (
            <div
              key={`${providerFilter}-${group.equipmentType}`}
              className={cn(
                'border rounded-lg overflow-hidden',
                dark ? 'border-slate-700/50' : 'border-slate-200',
              )}
            >
              <div
                className={cn(
                  'px-3 py-2 text-xs uppercase font-bold',
                  dark
                    ? 'bg-cyan-900/20 text-cyan-300 border-b border-slate-700/50'
                    : 'bg-cyan-50 text-cyan-700 border-b border-cyan-100',
                )}
              >
                {group.equipmentType} ({group.total})
              </div>
              <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full text-xs">
                  <thead
                    className={cn(
                      'sticky top-0 z-[1]',
                      dark ? 'bg-[#0f172a]/95 text-slate-400' : 'bg-slate-50 text-slate-500',
                    )}
                  >
                    <tr>
                      <th className="px-3 py-2 text-left w-10">#</th>
                      {providerFilter === 'Todos' && (
                        <th className="px-3 py-2 text-left min-w-[130px]">Provedor</th>
                      )}
                      <th className="px-3 py-2 text-left min-w-[160px]">
                        <button
                          onClick={() => onToggleCredentialSort('equipmentName')}
                          className="inline-flex items-center gap-1 font-semibold hover:opacity-80"
                        >
                          Equipamento
                          {credentialSort.field === 'equipmentName'
                            ? credentialSort.dir === 'asc'
                              ? '▲'
                              : '▼'
                            : '↕'}
                        </button>
                      </th>
                      <th className="px-3 py-2 text-left min-w-[180px]">
                        <button
                          onClick={() => onToggleCredentialSort('host')}
                          className="inline-flex items-center gap-1 font-semibold hover:opacity-80"
                        >
                          Host
                          {credentialSort.field === 'host'
                            ? credentialSort.dir === 'asc'
                              ? '▲'
                              : '▼'
                            : '↕'}
                        </button>
                      </th>
                      <th className="px-3 py-2 text-left min-w-[130px]">
                        <button
                          onClick={() => onToggleCredentialSort('user')}
                          className="inline-flex items-center gap-1 font-semibold hover:opacity-80"
                        >
                          Usuario
                          {credentialSort.field === 'user'
                            ? credentialSort.dir === 'asc'
                              ? '▲'
                              : '▼'
                            : '↕'}
                        </button>
                      </th>
                      <th className="px-3 py-2 text-left min-w-[130px]">Senha</th>
                      <th className="px-3 py-2 text-left min-w-[220px]">
                        <button
                          onClick={() => onToggleCredentialSort('notes')}
                          className="inline-flex items-center gap-1 font-semibold hover:opacity-80"
                        >
                          Observacoes
                          {credentialSort.field === 'notes'
                            ? credentialSort.dir === 'asc'
                              ? '▲'
                              : '▼'
                            : '↕'}
                        </button>
                      </th>
                      <th className="px-3 py-2 text-center min-w-[120px]">Acoes</th>
                    </tr>
                  </thead>
                  <tbody className={cn('divide-y', dark ? 'divide-white/5' : 'divide-slate-100')}>
                    {group.items.map((credential, idx) => {
                      const visible = !!visibleSecrets[credential.id];
                      const secret = revealedSecrets[credential.id] || credential.secret;
                      return (
                        <tr
                          key={credential.id}
                          onClick={() => onOpenCredentialDetails(credential)}
                          className={cn(
                            'transition-colors cursor-pointer',
                            dark ? 'hover:bg-white/5' : 'hover:bg-slate-50',
                          )}
                        >
                          <td
                            className={cn(
                              'px-3 py-2 font-mono',
                              dark ? 'text-slate-500' : 'text-slate-400',
                            )}
                          >
                            {idx + 1}
                          </td>
                          {providerFilter === 'Todos' && (
                            <td
                              className={cn(
                                'px-3 py-2',
                                dark ? 'text-slate-300' : 'text-slate-700',
                              )}
                            >
                              {credential.provider}
                            </td>
                          )}
                          <td
                            className={cn(
                              'px-3 py-2 font-medium',
                              dark ? 'text-cyan-300' : 'text-cyan-700',
                            )}
                          >
                            {credential.equipmentName || '-'}
                          </td>
                          <td
                            className={cn(
                              'px-3 py-2 font-mono text-[11px]',
                              dark ? 'text-slate-300' : 'text-slate-700',
                            )}
                          >
                            {credential.host}
                          </td>
                          <td
                            className={cn(
                              'px-3 py-2 font-mono text-[11px]',
                              dark ? 'text-slate-300' : 'text-slate-700',
                            )}
                          >
                            {credential.user}
                          </td>
                          <td
                            className={cn(
                              'px-3 py-2 font-mono text-[11px]',
                              dark ? 'text-slate-300' : 'text-slate-700',
                            )}
                          >
                            {visible ? secret : credential.secret}
                          </td>
                          <td
                            className={cn(
                              'px-3 py-2 max-w-[320px] truncate',
                              dark ? 'text-slate-400' : 'text-slate-600',
                            )}
                            title={credential.notes || ''}
                          >
                            {credential.notes || '-'}
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                title={visible ? 'Ocultar senha' : 'Exibir senha'}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onToggleCredentialSecret(credential.id);
                                }}
                                className={cn(
                                  'px-2 py-1 rounded border transition-colors',
                                  dark
                                    ? 'border-slate-700/50 text-slate-400 hover:bg-white/5'
                                    : 'border-slate-300 text-slate-600 hover:bg-slate-50',
                                )}
                              >
                                {visible ? <EyeOff size={12} /> : <Eye size={12} />}
                              </button>
                              <button
                                title="Copiar linha completa"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onCopyCredentialLine(credential, visible, secret);
                                }}
                                className="px-2 py-1 rounded border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
                              >
                                <Copy size={12} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}

          {groupedByEquipment.length > 0 && (
            <AnalystCredentialsPagination
              dark={dark}
              offset={credentialOffset}
              pageCount={currentPageCount}
              total={credentialsTotal}
              onPrev={onPrevPage}
              onNext={onNextPage}
            />
          )}
        </div>
      </div>
    </div>
  );
}
