'use client';
import { useState } from 'react';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { orderTypes, priorities, type WorkflowNode } from '@/lib/erp/contracts';
import type { FieldSpec } from '@/lib/erp/fields';
import { ContractForm } from './contract-form';

export function WorkflowNodeForm({
  type,
  subtype,
  initial,
  onApply,
}: {
  type: WorkflowNode['type'];
  subtype: string;
  initial?: WorkflowNode;
  onApply: (node: WorkflowNode) => void;
}) {
  const [advanced, setAdvanced] = useState(false);
  const condition =
    type === 'condition' &&
    !['cond_no_analyst', 'gateway_parallel', 'gateway_parallel_join'].includes(subtype);
  const fields: Record<string, FieldSpec[]> = {
    action_assign: [
      { name: 'analystId', label: 'Analista responsável', type: 'uuid', required: true },
    ],
    action_escalate: [
      {
        name: 'to',
        label: 'Destino da escalação',
        required: true,
        hint: 'O motor eleva a prioridade para CRITICA e notifica o destino.',
      },
    ],
    action_notify_slack: [
      { name: 'webhookUrl', label: 'URL do webhook Slack', type: 'url', required: true },
      { name: 'message', label: 'Mensagem', type: 'textarea', required: true },
    ],
    action_webhook: [
      { name: 'url', label: 'URL do webhook', type: 'url', required: true },
      {
        name: 'method',
        label: 'Método HTTP',
        options: { POST: 'POST', PUT: 'PUT', PATCH: 'PATCH', GET: 'GET', DELETE: 'DELETE' },
        required: true,
        defaultValue: 'POST',
      },
    ],
    task_service: [
      { name: 'taskName', label: 'Título da ordem filha', required: true },
      { name: 'team', label: 'Equipe de referência', required: true },
      {
        name: 'serviceOrderType',
        label: 'Tipo de serviço',
        options: orderTypes,
        defaultValue: 'AUDITORIA',
      },
      { name: 'priority', label: 'Prioridade', options: priorities, defaultValue: 'NORMAL' },
    ],
  };
  const conditionFields: FieldSpec[] = [
    {
      name: 'field',
      label: 'Campo da ordem',
      required: true,
      hint: 'Nome exato do campo do contrato: status, priority, type, sector, entre outros.',
    },
    {
      name: 'operator',
      label: 'Operador',
      options: { eq: 'Igual a', neq: 'Diferente de', contains: 'Contém' },
      required: true,
    },
    {
      name: 'valueType',
      label: 'Tipo do valor',
      options: { text: 'Texto', number: 'Número', boolean: 'Booleano' },
      defaultValue:
        typeof initial?.config.value === 'number'
          ? 'number'
          : typeof initial?.config.value === 'boolean'
            ? 'boolean'
            : 'text',
      required: true,
    },
    {
      name: 'value',
      label: 'Valor de comparação',
      required: true,
      hint: 'Booleanos: true ou false. Comparações eq/neq do motor são estritas.',
    },
  ];
  const configFields = condition ? conditionFields : fields[subtype] || [];
  const known = [
    'start_implantacao',
    'start_os_criada',
    'os_criada',
    'os_fechada',
    'os_atualizada',
    'sla_breach',
    'os_critica',
    'condition',
    'cond_no_analyst',
    'gateway_parallel',
    'gateway_parallel_join',
    'action_assign',
    'action_escalate',
    'action_notify_slack',
    'action_webhook',
    'action_csat',
    'task_service',
    'action_close_order',
  ].includes(subtype);
  const raw = advanced || !known;
  const positions: FieldSpec[] = [
    { name: 'x', label: 'Posição X', type: 'number', required: true, defaultValue: 0 },
    { name: 'y', label: 'Posição Y', type: 'number', required: true, defaultValue: 0 },
  ];
  return (
    <div className="flex flex-col gap-4">
      {!known && (
        <Alert>
          <AlertTitle>Subtipo não reconhecido</AlertTitle>
          <AlertDescription>
            A configuração existente é preservada em JSON. O motor original pode ignorar este nó;
            valide o contrato antes de ativar.
          </AlertDescription>
        </Alert>
      )}
      {subtype === 'cond_no_analyst' && (
        <Alert>
          <AlertTitle>Condição legada</AlertTitle>
          <AlertDescription>
            O motor do ZIP não implementa uma verificação específica para cond_no_analyst. Sem
            campo, retorna true. Use uma comparação explícita compatível e valide com o backend.
          </AlertDescription>
        </Alert>
      )}
      {subtype === 'gateway_parallel_join' && (
        <Alert>
          <AlertTitle>Junção do motor original</AlertTitle>
          <AlertDescription>
            Após reunir as entradas, o motor do ZIP avalia uma condição e segue a saída true. Rotule
            a conexão de saída como true; valide o fluxo completo com o backend.
          </AlertDescription>
        </Alert>
      )}
      {subtype === 'action_close_order' && (
        <p className="text-xs text-muted-foreground">
          Fecha a ordem no contexto do evento, registrando histórico pelo motor original. Não exige
          parâmetros.
        </p>
      )}
      {subtype === 'action_csat' && (
        <p className="text-xs text-muted-foreground">
          Solicita uma pesquisa para a ordem do evento. O servidor controla elegibilidade e
          duplicação.
        </p>
      )}
      {known && (
        <label className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={advanced}
            onChange={(event) => setAdvanced(event.target.checked)}
          />
          Editar configuração JSON avançada
        </label>
      )}
      <ContractForm
        key={`${raw}-${subtype}`}
        draft
        connected={false}
        fields={[
          ...(raw
            ? [
                {
                  name: 'config',
                  label: 'Configuração JSON',
                  type: 'json' as const,
                  required: true,
                },
              ]
            : configFields),
          ...positions,
        ]}
        values={{
          ...initial?.config,
          config: initial?.config || {},
          x: initial?.position.x || 0,
          y: initial?.position.y || 0,
        }}
        onSubmit={async (values) => {
          const { x, y, valueType, config: json, ...parameters } = values;
          if (condition && !raw) {
            if (valueType === 'number') {
              const value = Number(parameters.value);
              if (!Number.isFinite(value))
                throw new Error('Informe um número válido para a comparação.');
              parameters.value = value;
            }
            if (valueType === 'boolean') {
              if (!['true', 'false'].includes(String(parameters.value)))
                throw new Error('Informe true ou false para o valor booleano.');
              parameters.value = parameters.value === 'true';
            }
          }
          const config = raw
            ? (json as Record<string, unknown>)
            : { ...initial?.config, ...parameters };
          onApply({
            id: initial?.id || crypto.randomUUID(),
            type,
            subtype,
            config,
            position: { x: Number(x), y: Number(y) },
          });
        }}
      />
      <p className="text-[10px] leading-5 text-muted-foreground">
        Campos avançados existentes são preservados. Nenhum webhook é chamado por esta prévia; URLs
        e autorização são verificadas pelo servidor antes da execução.
      </p>
    </div>
  );
}
