'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useErpQuery } from '@/lib/erp/gateway';
import { useRouteBase, listRecords } from '@/lib/erp/visual-data';
import { PageHeading } from './primitives';
import { QueryState } from './contract-form';
import { ProviderOperationsPanel } from './provider-operations-panel';
import { OrderForm } from './order-form';

type Customer = {
  id: string;
  tradeName: string;
  legalName: string;
  taxId: string;
  personType: string;
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
    }[];
  }[];
};
const documentLabel = (value: string) =>
  value.length === 14
    ? value.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
    : value;
export function CustomerDirectory({ id }: { id?: string }) {
  const query = useErpQuery('/customers');
  const detailQuery = useErpQuery<Customer>(id ? `/customers/${id}` : null);
  const base = useRouteBase();
  const [search, setSearch] = useState('');
  const [view, setView] = useState<'directory' | 'analysis'>('directory');
  const customers = listRecords(query.data) as unknown as Customer[];
  const selected = detailQuery.data || customers.find((c) => c.id === id);
  const filtered = customers.filter((c) =>
    `${c.tradeName} ${c.legalName} ${c.taxId} ${documentLabel(c.taxId)}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  return (
    <>
      {id && (
        <Link href={`${base}/provedores`} className="text-link mb-4">
          ← Todos os clientes
        </Link>
      )}
      <PageHeading
        title={selected?.tradeName || 'Clientes da Ajust'}
        description="Provedores atendidos pela consultoria · cadastro independente dos ambientes de acesso."
      >
        {id && selected && <OrderForm providerId={id} />}
      </PageHeading>
      <QueryState
        loading={query.isLoading}
        error={query.error}
        onRetry={() => void query.mutate()}
      />
      {id ? (
        selected ? (
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
                      selected.address.logradouro,
                      selected.address.numero,
                      selected.address.complemento,
                    ]
                      .filter(Boolean)
                      .join(', '),
                  ],
                  ['Bairro', selected.address.bairro],
                  [
                    'Cidade / UF',
                    [selected.address.cidade, selected.address.uf].filter(Boolean).join(' / '),
                  ],
                  ['CEP', selected.address.cep],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-xs text-muted-foreground">{label}</dt>
                    <dd className="mt-1 break-words">{value || 'Não informado'}</dd>
                  </div>
                ))}
              </dl>
            </section>
            <section className="panel mt-5 overflow-x-auto p-6">
              <h2 className="section-title">Ocorrências do provedor</h2>
              <p className="my-4 text-xs text-muted-foreground">
                Abra uma ocorrência para consultar todas as ordens de serviço vinculadas a ela.
              </p>
              <QueryState loading={detailQuery.isLoading} error={detailQuery.error} />
              <table className="w-full min-w-[700px] text-left text-xs">
                <thead>
                  <tr>
                    {[
                      'Ocorrência',
                      'Demanda',
                      'Tipo',
                      'Estado',
                      'Abertura',
                      'O.S. abertas',
                      'Ordens de serviço',
                    ].map((h) => (
                      <th className="p-3" key={h}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {selected.occurrences?.map((o) => (
                    <tr className="border-t border-border" key={o.id}>
                      <td className="p-3">
                        <Link className="text-link" href={`${base}/ocorrencias/${o.id}/ordens`}>
                          {o.number}
                        </Link>
                      </td>
                      <td className="p-3">
                        <p className="line-clamp-2">{o.description}</p>
                      </td>
                      <td className="p-3">{o.type}</td>
                      <td className="p-3">{o.status}</td>
                      <td className="p-3">{new Date(o.createdAt).toLocaleDateString('pt-BR')}</td>
                      <td className="p-3">
                        {
                          o.serviceOrders.filter(
                            (order) => !['FECHADA', 'CANCELADA'].includes(order.status),
                          ).length
                        }
                      </td>
                      <td className="p-3">
                        <Link className="text-link" href={`${base}/ocorrencias/${o.id}/ordens`}>
                          {o.serviceOrders.length} O.S. · Ver ordens →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <Link className="text-link mt-5 inline-block" href={`${base}/credenciais`}>
                Consultar acessos deste provedor no cofre →
              </Link>
            </section>
            <section className="panel p-6">
              <h2 className="section-title">Contatos do cadastro</h2>
              <div className="mt-5 grid gap-5 md:grid-cols-3">
                {(
                  [
                    ['E-mails', selected.contacts.emails],
                    ['Telefones', selected.contacts.telefones],
                    ['Celulares', selected.contacts.celulares],
                  ] as const
                ).map(([label, values]) => (
                  <div key={label}>
                    <h3 className="mb-2 text-xs text-muted-foreground">{label}</h3>
                    {values?.length ? (
                      <ul className="space-y-2 text-sm">
                        {values.map((value) => (
                          <li key={value} className="break-words">
                            {value}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm">Não informado</p>
                    )}
                  </div>
                ))}
              </div>
              <p className="mt-6 text-xs text-muted-foreground">
                Responsável técnico e validade dos contatos ainda não confirmados.
              </p>
            </section>
          </>
        ) : (
          !query.isLoading && !query.error && <p>Cliente não encontrado neste workspace.</p>
        )
      ) : (
        <>
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
          {view === 'analysis' ? (
            <ProviderOperationsPanel />
          ) : (
            <>
              <input
                aria-label="Buscar cliente"
                placeholder="Buscar provedor, razão social ou CNPJ"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="native-input mb-5 w-full max-w-lg rounded-lg border border-border bg-card p-3 text-sm"
              />
              <p className="mb-4 text-xs text-muted-foreground">
                {filtered.length} clientes cadastrados
              </p>
              <div className="panel overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-xs">
                  <thead className="border-b border-border bg-secondary text-muted-foreground">
                    <tr>
                      {['Provedor', 'Razão social', 'CPF/CNPJ', 'Cidade / UF', ''].map((h) => (
                        <th key={h} className="p-4 font-medium">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((c) => (
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
                          {[c.address.cidade, c.address.uf].filter(Boolean).join(' / ') ||
                            'Localização não informada'}
                        </td>
                        <td className="p-4">
                          <Link
                            className="text-link whitespace-nowrap"
                            href={`${base}/provedores/${c.id}`}
                          >
                            Ver cadastro →
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}
    </>
  );
}
