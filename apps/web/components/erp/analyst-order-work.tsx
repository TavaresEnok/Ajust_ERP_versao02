'use client';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import Link from 'next/link';
import { useErp, useErpAction, useErpQuery } from '@/lib/erp/gateway';
import { errorMessage, type ErpRecord } from '@/lib/erp/contracts';
import type { FlowInstance } from '@/lib/erp/operational-flow';
import { useRouteBase } from '@/lib/erp/visual-data';
import { useOrderDraft } from '@/lib/erp/order-draft';
import { Button } from '@/components/ui/button';
import { QueryState } from './contract-form';

const format = (v: unknown) =>
  v
    ? new Date(String(v)).toLocaleString('pt-BR', { timeZone: 'America/Fortaleza' })
    : 'Não agendada';
export function AnalystOrderWork({
  order,
  refresh,
  compact = false,
}: {
  order: ErpRecord;
  refresh: () => Promise<unknown>;
  compact?: boolean;
}) {
  const base = useRouteBase();
  const { scope } = useErp();
  const action = useErpAction();
  const process = useErpQuery<FlowInstance>(
    order.processInstanceId ? `/service-processes/operational/${order.processInstanceId}` : null,
  );
  const { draft, setDraft, clearDraft } = useOrderDraft(
    scope ? `${scope.tenantId}:${scope.userId}:${scope.sessionKey}:${order.id}` : null,
  );
  const text = draft.text;
  const setText = (text: string) => setDraft({ text });
  const [error, setError] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [working, setWorking] = useState(false);
  const inFlight = useRef(false);
  const actionMenu = useRef<HTMLDetailsElement>(null);
  const mode =
    draft.mode || (order.pausedAt ? 'resume' : order.status === 'ABERTA' ? 'start' : 'finish');
  const setMode = (mode: string) => setDraft({ mode });
  const people = useErpQuery<{ id: string; name: string; accessBlocked: boolean }[]>(
    mode === 'assign' ? '/service-processes/operational/assignees' : null,
  );
  const schedule = draft.schedule;
  const setSchedule = (schedule: string) => setDraft({ schedule });
  const maintenance = draft.maintenance;
  const setMaintenance = (maintenance: boolean) => setDraft({ maintenance });
  const impact = draft.impact;
  const setImpact = (impact: string) => setDraft({ impact });
  const rollback = draft.rollback;
  const setRollback = (rollback: string) => setDraft({ rollback });
  const assignee = draft.assignee;
  const setAssignee = (assignee: string) => setDraft({ assignee });
  const storedOutcome = draft.outcome;
  const setOutcome = (outcome: string) => setDraft({ outcome });
  const evidenceByStep = draft.evidenceByStep;
  const setEvidenceByStep = (update: (current: typeof evidenceByStep) => typeof evidenceByStep) =>
    setDraft((current) => ({ evidenceByStep: update(current.evidenceByStep) }));
  const step = process.data?.steps.find((s) => s.orderId === order.id && s.status === 'ACTIVE');
  const node = process.data?.definition.nodes.find((n) => n.id === step?.nodeId);
  const evidence = evidenceByStep[step?.id || ''] || {};
  const hasRequirements = mode === 'finish' && !!node?.requiredFields.length;
  const missingEvidence =
    hasRequirements &&
    node!.requiredFields.some((field) => (evidence[field] || '').trim().length < 1);
  const recordText = hasRequirements
    ? text.trim() ||
      node!.requiredFields
        .map((field) => `${field}: ${evidence[field] || ''}`)
        .join('\n\n')
        .slice(0, 20000)
    : text;
  const dirty =
    !!(text || schedule || impact || rollback || assignee || storedOutcome) ||
    Object.values(evidenceByStep).some((fields) => Object.values(fields).some(Boolean));
  const outcomes = Object.keys(node?.routes || {});
  const outcome = outcomes.includes(storedOutcome) ? storedOutcome : '';
  const selectedOutcome = outcome || (outcomes.length === 1 ? outcomes[0] : '');
  const nextNode = process.data?.definition.nodes.find(
    (candidate) => candidate.id === node?.routes[selectedOutcome],
  );
  const closesOrder = !!selectedOutcome && !!node?.closeOn.includes(selectedOutcome);
  const waitingForStep = !!process.data && !process.error && !step;
  const workflowBlocked =
    !!process.data &&
    (!['ACTIVE', 'WAITING'].includes(process.data.status) ||
      ['HISTORICAL', 'REFERENCE'].includes(String(process.data.state?.mode)));
  const roleBlocked = !!node && !!scope && !node.roles.includes(scope.role);
  const finishUnavailable =
    !!order.processInstanceId &&
    (!process.data ||
      !!process.error ||
      process.isLoading ||
      !node ||
      !step ||
      workflowBlocked ||
      roleBlocked);
  const closed = ['FECHADA', 'CANCELADA'].includes(String(order.status));
  const paused = !!order.pausedAt;
  const primaryAction = paused ? 'resume' : order.status === 'ABERTA' ? 'start' : 'finish';
  const finishAssignedElsewhere =
    scope?.role === 'analista' &&
    !!order.processInstanceId &&
    !!order.assigneeUserId &&
    order.assigneeUserId !== scope.userId;
  const lateSchedule =
    !!order.scheduledAt &&
    !order.scheduleStartedAt &&
    !closed &&
    new Date(String(order.scheduledAt)) < new Date();
  const labels: Record<string, string> = {
    finish: order.processInstanceId
      ? closesOrder
        ? 'Encerrar O.S.'
        : node && (selectedOutcome || !node.closeOn.length)
          ? 'Concluir etapa'
          : 'Registrar resultado'
      : 'Encerrar O.S.',
    start: 'Iniciar execução',
    pause: 'Pausar atendimento',
    resume: 'Retomar atendimento',
    schedule: 'Agendar execução',
    unschedule: 'Remover agendamento',
    assign: 'Encaminhar O.S.',
  };
  async function submit(operation = mode) {
    if (inFlight.current) return;
    inFlight.current = true;
    setWorking(true);
    try {
      setError('');
      setConfirmation('');
      const updated = await action.execute<ErpRecord>({
        path: `/service-orders/${order.id}/operations`,
        method: 'POST',
        body: {
          action: operation,
          expectedVersion: order.version,
          ...(operation !== 'start' ? { reason: operation === 'finish' ? recordText : text } : {}),
          ...(operation === 'finish' && node ? { evidence } : {}),
          ...(operation === 'assign' ? { assigneeUserId: assignee } : {}),
          ...(operation === 'schedule'
            ? { scheduledAt: new Date(`${schedule}:00-03:00`).toISOString() }
            : {}),
          ...(operation === 'schedule' && maintenance
            ? { change: { impact, rollbackPlan: rollback } }
            : {}),
          ...(operation === 'finish' && outcome ? { outcome } : {}),
        },
      });
      setText('');
      setOutcome('');
      if (operation === 'finish' || operation === 'reopen') clearDraft();
      if (operation === 'assign') setAssignee('');
      if (['schedule', 'unschedule'].includes(operation)) {
        setSchedule('');
        setMaintenance(false);
        setImpact('');
        setRollback('');
      }
      if (operation === 'finish' && step) {
        setEvidenceByStep((current) => {
          const next = { ...current };
          delete next[step.id];
          return next;
        });
      }
      if (['start', 'resume', 'reopen'].includes(operation)) setMode('finish');
      if (operation === 'pause') setMode('resume');
      if (['assign', 'schedule', 'unschedule'].includes(operation)) setMode(primaryAction);
      const message =
        operation === 'start'
          ? 'Execução iniciada. A O.S. está em andamento.'
          : operation === 'finish'
            ? updated.status === 'FECHADA'
              ? order.processInstanceId
                ? 'O.S. encerrada. O fluxo seguirá as próximas etapas configuradas.'
                : 'O.S. encerrada. Resultado registrado no atendimento.'
              : 'Etapa registrada. A O.S. continua no fluxo de atendimento.'
            : 'Alteração registrada com sucesso.';
      setConfirmation(message);
      toast.success(message);
      try {
        await Promise.all([refresh(), process.mutate()]);
      } catch {
        setError(
          'A ação foi registrada, mas não foi possível atualizar a tela. Recarregue para consultar a situação atual.',
        );
      }
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      inFlight.current = false;
      setWorking(false);
    }
  }
  return (
    <section className={compact ? 'space-y-4' : 'panel p-5 space-y-4'}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="section-title">
          {closed
            ? 'Atendimento encerrado'
            : paused
              ? 'Atendimento pausado'
              : 'Seu trabalho nesta O.S.'}
        </h2>
        {!!order.occurrenceId && (
          <Link className="text-link text-sm" href={`${base}/ocorrencias/${order.occurrenceId}`}>
            Ver atendimento completo →
          </Link>
        )}
      </div>
      {!!order.processInstanceId && !closed && (
        <div className="space-y-3 rounded-lg border border-border bg-secondary/40 p-4 text-sm">
          <h3 className="font-semibold">Etapa do fluxo de atendimento</h3>
          <QueryState
            loading={process.isLoading}
            error={process.error}
            onRetry={() => void process.mutate()}
          />
          {process.data && !process.error && (
            <>
              <p className="text-xs text-muted-foreground">
                {process.data.definition.name} · versão {process.data.templateVersion}
              </p>
              {node ? (
                <>
                  <p className="font-medium">{node.name}</p>
                  {(workflowBlocked || roleBlocked) && (
                    <p role="status">
                      {workflowBlocked
                        ? 'O fluxo não está liberado para execução. Solicite a revisão da gestão.'
                        : 'Esta etapa exige outro perfil de acesso definido pela gestão.'}
                    </p>
                  )}
                  {!!node.requiredFields.length && (
                    <div>
                      <p className="text-xs text-muted-foreground">
                        Preencha as evidências exigidas abaixo para concluir esta etapa.
                      </p>
                    </div>
                  )}
                </>
              ) : waitingForStep ? (
                <p role="status">
                  Nenhuma etapa está liberada para esta O.S. Consulte as pendências do fluxo com a
                  gestão antes de registrar a conclusão.
                </p>
              ) : null}
            </>
          )}
        </div>
      )}
      {!compact && (
        <div className="grid gap-3 sm:grid-cols-3 text-sm">
          <div className="rounded-lg bg-secondary p-3">
            <span className="block text-xs text-muted-foreground">Situação atual</span>
            <p className="mt-1 font-medium">
              {closed
                ? order.status === 'CANCELADA'
                  ? 'Cancelada'
                  : 'Concluída'
                : paused
                  ? 'Pausada com justificativa'
                  : order.status === 'ABERTA'
                    ? 'Aberta · aguardando início'
                    : 'Em andamento'}
            </p>
            {!closed && !paused && node?.name && (
              <p className="mt-1 text-xs text-muted-foreground">{node.name}</p>
            )}
          </div>
          <div className="rounded-lg bg-secondary p-3">
            <span className="block text-xs text-muted-foreground">
              Prazo de SLA {paused ? '· contagem pausada' : ''}
            </span>
            {format(order.deadlineAt)}
            {((order.sourceMetadata as Record<string, unknown> | undefined)?.slaPolicyConfirmed ===
              false ||
              String(
                (order.sourceMetadata as Record<string, unknown> | undefined)?.slaBasis || '',
              ).includes('validar política')) && (
              <p className="mt-1 text-xs text-amber-600">
                Prazo padrão provisório; política do serviço pendente.
              </p>
            )}
          </div>
          <div className="rounded-lg bg-secondary p-3">
            <span className="block text-xs text-muted-foreground">
              Execução agendada · Fortaleza
            </span>
            {format(order.scheduledAt)}
            {lateSchedule && <p className="text-amber-600">Horário passou sem início registrado</p>}
          </div>
        </div>
      )}
      {compact && lateSchedule && (
        <p className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300">
          O horário agendado passou sem início registrado.
        </p>
      )}
      {paused && (
        <p className="rounded-lg border border-amber-300 p-3 text-sm">
          Pausada desde {format(order.pausedAt)}: {String(order.pauseReason)}
        </p>
      )}
      {!!order.handoffNotes && (
        <p className="rounded-lg border border-border p-3 text-sm whitespace-pre-wrap">
          <strong>Passagem de atendimento: </strong>
          {String(order.handoffNotes)}
        </p>
      )}
      {dirty && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>Rascunho salvo nesta aba. O registro será enviado ao confirmar a ação.</span>
          <Button type="button" size="sm" variant="ghost" disabled={working} onClick={clearDraft}>
            Descartar rascunho
          </Button>
        </div>
      )}
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      {confirmation && (
        <p
          role="status"
          className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 text-sm text-emerald-700 dark:text-emerald-300"
        >
          {confirmation}
        </p>
      )}
      {!closed && finishAssignedElsewhere && (
        <div
          role="note"
          className="space-y-3 rounded-lg border border-border bg-secondary/40 p-3 text-sm"
        >
          <p>
            Responsável atual: {String(order.analystName || 'outro analista')}. O encerramento deve
            ser feito pelo responsável ou pela gestão. Você pode editar e anotar normalmente.
          </p>
          <Button
            variant="outline"
            disabled={working || action.pending}
            onClick={() => {
              setMode('assign');
              setAssignee(scope!.userId);
              setError('');
            }}
          >
            Assumir atendimento
          </Button>
        </div>
      )}
      {!closed && (
        <>
          <div className="flex flex-wrap gap-2">
            {primaryAction === 'start' ? (
              <Button disabled={working || action.pending} onClick={() => void submit('start')}>
                {working && primaryAction === 'start' ? 'Iniciando…' : labels[primaryAction]}
              </Button>
            ) : mode !== primaryAction ? (
              <Button
                variant="outline"
                disabled={working || action.pending}
                onClick={() => {
                  setMode(primaryAction);
                  setError('');
                  setConfirmation('');
                }}
              >
                {primaryAction === 'finish' ? 'Voltar ao registro da etapa' : 'Voltar à retomada'}
              </Button>
            ) : null}
            <details ref={actionMenu} className="relative">
              <summary className="cursor-pointer rounded-lg border border-border px-4 py-2 text-sm">
                Outras ações
              </summary>
              <div className="mt-2 flex flex-wrap gap-2">
                {Object.entries(labels)
                  .filter(([k]) => k !== primaryAction)
                  .filter(([k]) => k !== 'start')
                  .filter(([k]) =>
                    paused
                      ? ['resume', 'assign', 'schedule', 'unschedule'].includes(k)
                      : k !== 'resume',
                  )
                  .filter(([k]) => k !== 'unschedule' || !!order.scheduledAt)
                  .map(([k, label]) => (
                    <Button
                      key={k}
                      disabled={working || action.pending}
                      variant={mode === k ? 'default' : 'outline'}
                      onClick={() => {
                        setMode(k);
                        setError('');
                        setConfirmation('');
                        if (actionMenu.current) actionMenu.current.open = false;
                      }}
                    >
                      {label}
                    </Button>
                  ))}
              </div>
            </details>
          </div>
          {mode !== 'start' && !(mode === 'finish' && finishAssignedElsewhere) && (
            <h3 className="text-sm font-semibold">{labels[mode]}</h3>
          )}
          {mode === 'schedule' && (
            <label className="block text-sm">
              Data e horário de execução · Fortaleza
              <input
                aria-label="Execução agendada"
                type="datetime-local"
                className="native-select mt-2 w-full"
                value={schedule}
                onChange={(e) => setSchedule(e.target.value)}
              />
              <span className="block mt-1 text-xs text-muted-foreground">
                Disponível todos os dias, inclusive sábados e domingos. Agendar não pausa o SLA.
              </span>
            </label>
          )}
          {mode === 'schedule' && (
            <div className="space-y-3">
              <label className="flex gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={maintenance}
                  onChange={(e) => setMaintenance(e.target.checked)}
                />
                Manutenção com impacto na rede
              </label>
              {maintenance && (
                <>
                  <label className="block text-sm">
                    Impacto previsto
                    <textarea
                      className="native-select mt-2 w-full"
                      maxLength={4000}
                      value={impact}
                      onChange={(e) => setImpact(e.target.value)}
                    />
                  </label>
                  <label className="block text-sm">
                    Plano de reversão
                    <textarea
                      className="native-select mt-2 w-full"
                      maxLength={4000}
                      value={rollback}
                      onChange={(e) => setRollback(e.target.value)}
                    />
                  </label>
                </>
              )}
            </div>
          )}
          {!!order.changeRequestId && (
            <Link className="text-link text-sm" href={`${base}/mudancas/${order.changeRequestId}`}>
              Consultar planejamento da mudança →
            </Link>
          )}
          {mode === 'assign' && (
            <div className="space-y-3">
              <QueryState
                loading={people.isLoading}
                error={people.error}
                onRetry={() => void people.mutate()}
              />
              <label className="block text-sm">
                Novo responsável
                <select
                  aria-label="Novo responsável"
                  className="native-select mt-2 w-full"
                  value={assignee}
                  onChange={(e) => setAssignee(e.target.value)}
                >
                  <option value="">Selecione o analista</option>
                  {people.data
                    ?.filter((p) => !p.accessBlocked)
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                </select>
              </label>
            </div>
          )}
          {mode === 'finish' && !finishAssignedElsewhere && outcomes.length > 1 && (
            <select
              aria-label="Resultado do atendimento"
              className="native-select w-full"
              value={outcome}
              onChange={(e) => setOutcome(e.target.value)}
            >
              <option value="">Selecione o resultado</option>
              {outcomes.map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>
          )}
          {mode === 'finish' && !finishAssignedElsewhere && node && (
            <p className="rounded-lg bg-secondary/40 p-3 text-sm" role="note">
              {selectedOutcome ? (
                <>
                  Resultado: <strong>{selectedOutcome}</strong>.{' '}
                  {closesOrder
                    ? 'Este resultado encerra esta O.S.'
                    : 'Este resultado conclui a etapa e mantém esta O.S. aberta.'}
                  {nextNode && ` Próxima etapa do fluxo: ${nextNode.name}.`}
                </>
              ) : (
                'Selecione o resultado para consultar a próxima etapa definida no fluxo.'
              )}
            </p>
          )}
          {mode !== 'start' && !(mode === 'finish' && finishAssignedElsewhere) && (
            <>
              {hasRequirements &&
                node!.requiredFields.map((field) => (
                  <label key={`${step?.id}-${field}`} className="block text-sm">
                    {field} *
                    <textarea
                      aria-label={`Evidência: ${field}`}
                      className="mt-2 min-h-24 w-full rounded-lg border border-border bg-card p-3 text-sm"
                      maxLength={20000}
                      value={evidence[field] || ''}
                      onChange={(event) =>
                        setEvidenceByStep((current) => ({
                          ...current,
                          [step!.id]: { ...current[step!.id], [field]: event.target.value },
                        }))
                      }
                    />
                  </label>
                ))}
              <label className="block text-sm">
                {hasRequirements
                  ? 'Observações adicionais (opcional)'
                  : mode === 'finish'
                    ? node && !closesOrder
                      ? 'Registro e evidências da etapa'
                      : 'Solução e resultado do atendimento'
                    : mode === 'assign'
                      ? 'O que foi feito e o que falta para o próximo analista'
                      : 'Justificativa e orientações'}
                <textarea
                  aria-label="Registro do atendimento"
                  maxLength={20000}
                  className="mt-2 min-h-28 w-full rounded-lg border border-border bg-card p-3 text-sm"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                />
              </label>
              <p className="text-xs text-muted-foreground">
                {text.length.toLocaleString('pt-BR')} / 20.000 caracteres · Para backups extensos,
                use Anexos.{' '}
                {hasRequirements
                  ? 'Preencha cada evidência obrigatória.'
                  : 'Mínimo de 3 caracteres para confirmar.'}
              </p>
              <Button
                disabled={
                  working ||
                  action.pending ||
                  recordText.trim().length < 3 ||
                  missingEvidence ||
                  (paused && !['resume', 'assign', 'schedule', 'unschedule'].includes(mode)) ||
                  (mode === 'schedule' && !schedule) ||
                  (mode === 'schedule' &&
                    maintenance &&
                    (impact.trim().length < 3 || rollback.trim().length < 3)) ||
                  (mode === 'assign' && (!assignee || people.isLoading || !!people.error)) ||
                  (mode === 'finish' && outcomes.length > 1 && !outcome) ||
                  (mode === 'finish' && (finishUnavailable || finishAssignedElsewhere))
                }
                onClick={() => void submit()}
              >
                {working ? 'Salvando…' : labels[mode]}
              </Button>
            </>
          )}
        </>
      )}
      {closed && (
        <p className="text-sm text-muted-foreground">
          Resultado, anotações e passagem entre analistas preservados no histórico.
        </p>
      )}
      {order.status === 'FECHADA' && (
        <details className="rounded-lg border border-border p-4">
          <summary className="cursor-pointer text-sm font-medium">Reabrir O.S.</summary>
          <div className="mt-4 space-y-3">
            <label className="block text-sm">
              Motivo da reabertura
              <textarea
                className="native-select mt-2 w-full"
                maxLength={20000}
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
            </label>
            <Button
              variant="outline"
              disabled={working || action.pending || text.trim().length < 3}
              onClick={() => void submit('reopen')}
            >
              {working ? 'Reabrindo…' : 'Reabrir esta O.S.'}
            </Button>
          </div>
        </details>
      )}
    </section>
  );
}
