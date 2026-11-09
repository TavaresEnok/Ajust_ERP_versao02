'use client';
import { orderTypes } from '@/lib/erp/contracts';
import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useErp, useErpQuery } from '@/lib/erp/gateway';
import { useRouteBase, listRecords } from '@/lib/erp/visual-data';
import { PageHeading, StatusBadge } from './primitives';
import { Button } from '@/components/ui/button';
import { deadlineSituation, isActiveOrder } from '@/lib/erp/analyst-workspace';
import { QueryState } from './contract-form';
import { ProviderOperationsPanel } from './provider-operations-panel';
import { OrderForm } from './order-form';

type Customer = {
  id: string;
  tradeName: string;
  legalName: string;
  taxId: string | null;
  personType: string;
  _count?: { occurrences: number };
  address: Record<string, string>;
  contacts: { emails?: string[]; telefones?: string[]; celulares?: string[] };
  occurrences?: {
    id: string;
    number: string;
    type: string;
    status: string;
    description: string;
    createdAt: string;
    serviceOrders: {
      id: string;
      protocol: string;
      title: string;
      status: string;
      analystName: string;
      createdAt: string;
      processInstanceId?: string | null;
      deadlineAt?: string;
      pausedAt?: string | null;
      slaEligible?: boolean;
      assignee?: { name: string } | null;
    }[];
  }[];
};
function ContactValue({ value, email = false }: { value: string; email?: boolean }) {
  const number = value.replace(/[^\d+]/g, '');
  const href = email
    ? /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
      ? `mailto:${encodeURIComponent(value)}`
      : undefined
    : /^\+?\d{8,15}$/.test(number)
      ? `tel:${number}`
      : undefined;
  return href ? (
    <a className="text-link break-all" href={href}>
      {value}
    </a>
  ) : (
    <span>{value}</span>
  );
}
const documentLabel = (value: string | null) =>
  value?.length === 14
    ? value.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
    : value || '';
export function CustomerDirectory({ id }: { id?: string }) {
  const { scope } = useErp();
  const analyst = scope?.role === 'analista';
  const query = useErpQuery(id ? null : '/customers');
  const detailQuery = useErpQuery<Customer>(id ? `/customers/${id}` : null);
  const base = useRouteBase();
  const searchParams = useSearchParams();
  const search = searchParams.get('search') || '';
  const setSearch = (value: string) => {
    const next = new URLSearchParams(window.location.search);
    if (value) next.set('search', value);
    else next.delete('search');
    window.history.replaceState(
      null,
      '',
      `${window.location.pathname}${next.size ? `?${next}` : ''}`,
    );
  };
  const [view, setView] = useState<'directory' | 'analysis'>('directory');
  const [detailTab, setDetailTab] = useState<'attendance' | 'registration'>('attendance');
  const [occurrenceSearch, setOccurrenceSearch] = useState('');
  const [occurrenceFilter, setOccurrenceFilter] = useState('active');
  const [page, setPage] = useState(0);
  const [occurrencePage, setOccurrencePage] = useState(0);
  const customers = listRecords(query.data) as unknown as Customer[];
  const selected = detailQuery.data;
  const normalize = (value: string) =>
    value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLocaleLowerCase('pt-BR');
  const filtered = customers.filter((c) =>
    normalize(
      `${c.tradeName} ${c.legalName} ${c.taxId || ''} ${documentLabel(c.taxId)} ${Object.values(c.address || {}).join(' ')} ${Object.values(
        c.contacts || {},
      )
        .flat()
        .join(' ')}`,
    ).includes(normalize(search.trim())),
  );
  const occurrences = selected?.occurrences || [];
  const allOrders = occurrences.flatMap((item) => item.serviceOrders);
  const pendingOrders = allOrders.filter(isActiveOrder);
  const overdueOrders = pendingOrders.filter(
    (order) => deadlineSituation(order, new Date()) === 'Atrasada',
  );
  const email = selected?.contacts?.emails?.find(Boolean);
  const phone =
    selected?.contacts?.celulares?.find(Boolean) || selected?.contacts?.telefones?.find(Boolean);
  const filteredOccurrences = occurrences.filter(
    (item) =>
      (occurrenceFilter === 'all' ||
        (occurrenceFilter === 'active'
          ? item.status !== 'ENCERRADA'
          : item.status === 'ENCERRADA')) &&
      normalize(
        `${item.number} ${item.type} ${item.description} ${item.serviceOrders.map((order) => `${order.protocol} ${order.title} ${order.assignee?.name || order.analystName}`).join(' ')}`,
      ).includes(normalize(occurrenceSearch)),
  );
  const occurrencePages = Math.max(1, Math.ceil(filteredOccurrences.length / 10));
  const currentOccurrencePage = Math.min(occurrencePage, occurrencePages - 1);
  const currentPage = Math.min(page, Math.max(0, Math.ceil(filtered.length / 20) - 1));
  return (
    <>
      {id && (
        <Link href={`${base}/provedores`} className="text-link mb-4">
          ← Todos os provedores
        </Link>
      )}
      <PageHeading
        title={selected?.tradeName || (id ? 'Provedor' : 'Provedores')}
        description={
          id
            ? 'Ocorrências, ordens de serviço e contatos deste provedor.'
            : 'Encontre o provedor e abra seus atendimentos.'
        }
      >
        {id && selected && <OrderForm providerId={id} />}
        {id && selected && (
          <Link
            className="text-link"
            href={`${base}/ordens?scope=operation&customerId=${encodeURIComponent(id!)}&provider=${encodeURIComponent(selected.tradeName || selected.legalName)}`}
          >
            Todas as O.S. do provedor
          </Link>
        )}
        {id && selected && (
          <Link className="text-link" href={`${base}/ativos/${id}`}>
            Topologia de rede
          </Link>
        )}
        {id && selected && (
          <Link
            className="text-link"
            href={`${base}/credenciais?provider=${encodeURIComponent(selected.tradeName || selected.legalName)}`}
          >
            Acessos e orientações técnicas
          </Link>
        )}
      </PageHeading>
      <QueryState
        loading={id ? detailQuery.isLoading : query.isLoading}
        error={id ? detailQuery.error : query.error}
        onRetry={() => void (id ? detailQuery.mutate() : query.mutate())}
      />
      {id ? (
        selected ? (
          <>
            <section className="panel mb-5 p-5" aria-label="Resumo do provedor">
              <div className="grid gap-4 sm:grid-cols-3">
                {[
                  [
                    'Ocorrências em aberto',
                    occurrences.filter((item) => item.status !== 'ENCERRADA').length,
                  ],
                  ['O.S. pendentes', pendingOrders.length],
                  ['O.S. atrasadas', overdueOrders.length],
                ].map(([label, value]) => (
                  <div key={String(label)}>
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className="mt-1 text-xl font-semibold">{value}</p>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-4 border-t border-border pt-4 text-sm">
                <span className="text-xs text-muted-foreground">Contato rápido</span>
                {email && <ContactValue value={email} email />}
                {phone && <ContactValue value={phone} />}
                {!email && !phone && (
                  <span className="text-xs text-muted-foreground">
                    Nenhum contato informado no cadastro.
                  </span>
                )}
              </div>
            </section>
            <div className="mb-5 flex flex-wrap gap-2" aria-label="Informações do provedor">
              <Button
                variant={detailTab === 'attendance' ? 'default' : 'outline'}
                onClick={() => setDetailTab('attendance')}
              >
                Atendimentos · {occurrences.filter((item) => item.status !== 'ENCERRADA').length} em
                aberto
              </Button>
              <Button
                variant={detailTab === 'registration' ? 'default' : 'outline'}
                onClick={() => setDetailTab('registration')}
              >
                Cadastro e contatos
              </Button>
            </div>
            {detailTab === 'registration' && (
              <>
                <section className="panel mb-5 p-6">
                  <h2 className="section-title">Dados cadastrais</h2>
                  <dl className="mt-5 grid gap-5 text-sm md:grid-cols-2">
                    {[
                      ['Razão social', selected.legalName],
                      ['CPF/CNPJ', documentLabel(selected.taxId)],
                      [
                        'Endereço',
                        [
                          selected.address?.logradouro,
                          selected.address?.numero,
                          selected.address?.complemento,
                        ]
                          .filter(Boolean)
                          .join(', '),
                      ],
                      ['Bairro', selected.address?.bairro],
                      [
                        'Cidade / UF',
                        [selected.address?.cidade, selected.address?.uf]
                          .filter(Boolean)
                          .join(' / '),
                      ],
                      ['CEP', selected.address?.cep],
                    ].map(([label, value]) => (
                      <div key={label}>
                        <dt className="text-xs text-muted-foreground">{label}</dt>
                        <dd className="mt-1 break-words">{value || 'Não informado'}</dd>
                      </div>
                    ))}
                  </dl>
                </section>
              </>
            )}
            {detailTab === 'attendance' && (
              <section className="panel overflow-hidden p-5">
                <h2 className="section-title">Ocorrências do provedor</h2>
                <p className="my-4 text-xs text-muted-foreground">
                  Abra uma ocorrência para consultar todas as ordens de serviço vinculadas a ela.
                </p>
                <div className="mb-4 flex flex-wrap gap-3">
                  <input
                    className="native-select min-w-0"
                    type="search"
                    aria-label="Buscar atendimentos do provedor"
                    placeholder="Ocorrência, O.S. ou analista…"
                    value={occurrenceSearch}
                    onChange={(event) => {
                      setOccurrenceSearch(event.target.value);
                      setOccurrencePage(0);
                    }}
                  />
                  <select
                    className="native-select"
                    aria-label="Situação das ocorrências"
                    value={occurrenceFilter}
                    onChange={(event) => {
                      setOccurrenceFilter(event.target.value);
                      setOccurrencePage(0);
                    }}
                  >
                    <option value="active">Em aberto</option>
                    <option value="closed">Encerradas</option>
                    <option value="all">Todas</option>
                  </select>
                </div>
                <QueryState loading={detailQuery.isLoading} error={detailQuery.error} />
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[700px] text-left text-xs">
                    <thead>
                      <tr>
                        {[
                          'Ocorrência',
                          'Demanda',
                          'Tipo',
                          'Estado',
                          'Abertura',
                          'O.S. pendentes',
                          'Ordens de serviço',
                        ].map((h) => (
                          <th className="p-3" key={h}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredOccurrences
                        .slice(currentOccurrencePage * 10, currentOccurrencePage * 10 + 10)
                        .map((o) => (
                          <tr className="border-t border-border" key={o.id}>
                            <td className="p-3">
                              <Link
                                className="text-link"
                                href={`${base}/ocorrencias/${o.id}/ordens`}
                              >
                                {o.number}
                              </Link>
                            </td>
                            <td className="p-3">
                              <p className="line-clamp-2">{o.description}</p>
                            </td>
                            <td className="p-3">
                              {orderTypes[o.type as keyof typeof orderTypes] || o.type}
                            </td>
                            <td className="p-3">
                              <StatusBadge
                                status={
                                  {
                                    ABERTA: 'Aberta',
                                    EM_EXECUCAO: 'Em execução',
                                    PENDENTE: 'Pendente',
                                    ENCERRADA: 'Encerrada',
                                  }[o.status] || o.status
                                }
                              />
                            </td>
                            <td className="p-3">
                              {new Date(o.createdAt).toLocaleDateString('pt-BR', {
                                timeZone: 'America/Fortaleza',
                              })}
                            </td>
                            <td className="p-3">
                              {o.serviceOrders.filter((order) => isActiveOrder(order)).length}
                            </td>
                            <td className="p-3">
                              <Link
                                className="text-link"
                                href={`${base}/ocorrencias/${o.id}/ordens`}
                              >
                                {o.serviceOrders.length} O.S. · Ver ordens →
                              </Link>
                              <div className="mt-2 space-y-2">
                                {o.serviceOrders
                                  .filter(isActiveOrder)
                                  .slice(0, 3)
                                  .map((order) => (
                                    <Link
                                      key={order.id}
                                      className="text-link block max-w-60"
                                      href={`${base}/ordens/${order.id}`}
                                    >
                                      <span className="line-clamp-2">
                                        #{order.protocol} · {order.title}
                                      </span>
                                      <span className="text-[10px] text-muted-foreground">
                                        {deadlineSituation(order, new Date())}
                                      </span>
                                    </Link>
                                  ))}
                              </div>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
                {!filteredOccurrences.length && (
                  <p role="status" className="py-8 text-center text-sm text-muted-foreground">
                    {occurrenceFilter === 'active'
                      ? 'Nenhuma ocorrência em aberto para este filtro.'
                      : 'Nenhuma ocorrência encontrada para este filtro.'}
                  </p>
                )}
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
                  <span>
                    {filteredOccurrences.length} ocorrências · página {currentOccurrencePage + 1} de{' '}
                    {occurrencePages}
                  </span>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={currentOccurrencePage === 0}
                      onClick={() => setOccurrencePage(currentOccurrencePage - 1)}
                    >
                      Anterior
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={currentOccurrencePage + 1 >= occurrencePages}
                      onClick={() => setOccurrencePage(currentOccurrencePage + 1)}
                    >
                      Próxima
                    </Button>
                  </div>
                </div>
                <Link
                  className="text-link mt-5 inline-block"
                  href={`${base}/credenciais?provider=${encodeURIComponent(selected.tradeName || selected.legalName)}`}
                >
                  Abrir cofre de credenciais →
                </Link>
              </section>
            )}
            {detailTab === 'registration' && (
              <section className="panel p-6">
                <h2 className="section-title">Contatos do cadastro</h2>
                <div className="mt-5 grid gap-5 md:grid-cols-3">
                  {(
                    [
                      ['E-mails', selected.contacts?.emails],
                      ['Telefones', selected.contacts?.telefones],
                      ['Celulares', selected.contacts?.celulares],
                    ] as const
                  ).map(([label, values]) => (
                    <div key={label}>
                      <h3 className="mb-2 text-xs text-muted-foreground">{label}</h3>
                      {values?.length ? (
                        <ul className="space-y-2 text-sm">
                          {Array.from(new Set(values)).map((value) => (
                            <li key={value} className="break-words">
                              <ContactValue value={value} email={label === 'E-mails'} />
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-sm">Não informado</p>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
        ) : (
          !detailQuery.isLoading && !detailQuery.error && <p>Provedor não encontrado.</p>
        )
      ) : (
        <>
          {!analyst && (
            <div className="mb-5 flex gap-5 border-b border-border">
              <button
                className={`pb-3 text-xs ${view === 'directory' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground'}`}
                onClick={() => setView('directory')}
              >
                Cadastros dos provedores
              </button>
              <button
                className={`pb-3 text-xs ${view === 'analysis' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground'}`}
                onClick={() => setView('analysis')}
              >
                Análise das O.S.
              </button>
            </div>
          )}
          {view === 'analysis' && !analyst ? (
            <ProviderOperationsPanel />
          ) : (
            <>
              <input
                aria-label="Buscar cliente"
                placeholder="Provedor, documento, cidade ou contato"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(0);
                }}
                className="native-input mb-5 w-full max-w-lg rounded-lg border border-border bg-card p-3 text-sm"
              />
              <p className="mb-4 text-xs text-muted-foreground">
                {filtered.length} provedores encontrados
              </p>
              <div className="panel overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-xs">
                  <thead className="border-b border-border bg-secondary text-muted-foreground">
                    <tr>
                      {['Provedor', 'Razão social', 'CPF/CNPJ', 'Cidade / UF', 'Em aberto', ''].map(
                        (h) => (
                          <th key={h} className="p-4 font-medium">
                            {h}
                          </th>
                        ),
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.slice(currentPage * 20, currentPage * 20 + 20).map((c) => (
                      <tr
                        key={c.id}
                        className="border-b border-border last:border-0 hover:bg-secondary/40"
                      >
                        <td className="p-4 font-semibold">
                          <Link href={`${base}/provedores/${c.id}`}>{c.tradeName}</Link>
                        </td>
                        <td className="max-w-xs p-4 leading-5">{c.legalName}</td>
                        <td className="whitespace-nowrap p-4 font-mono">
                          {documentLabel(c.taxId)}
                        </td>
                        <td className="p-4">
                          {[c.address?.cidade, c.address?.uf].filter(Boolean).join(' / ') ||
                            'Localização não informada'}
                        </td>
                        <td className="p-4">{c._count?.occurrences ?? '—'}</td>
                        <td className="p-4">
                          <Link
                            className="text-link whitespace-nowrap"
                            href={`${base}/provedores/${c.id}`}
                          >
                            Abrir atendimentos →
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!query.isLoading && !query.error && !filtered.length && (
                <p role="status" className="py-8 text-sm text-muted-foreground">
                  Nenhum provedor encontrado para esta busca.
                </p>
              )}
              <div className="mt-4 flex items-center justify-between gap-3 text-xs text-muted-foreground">
                <span>
                  Página {currentPage + 1} de {Math.max(1, Math.ceil(filtered.length / 20))}
                </span>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={currentPage === 0}
                    onClick={() => setPage(currentPage - 1)}
                  >
                    Anterior
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={(currentPage + 1) * 20 >= filtered.length}
                    onClick={() => setPage(currentPage + 1)}
                  >
                    Próxima
                  </Button>
                </div>
              </div>
            </>
          )}
        </>
      )}
    </>
  );
}
