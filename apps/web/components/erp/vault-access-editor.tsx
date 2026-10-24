'use client';
import { useEffect, useRef, useState } from 'react';
import { Eye, EyeOff, Copy, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { useErpAction } from '@/lib/erp/gateway';
import { type ErpRecord, errorMessage } from '@/lib/erp/contracts';
import { copyToClipboard } from '@/lib/erp/clipboard';
import { toast } from 'sonner';
export type VaultAccess = {
  label: string;
  method: string;
  host: string;
  port: number | null;
  context: string;
  username: string;
  secret: string;
  notes: string;
};
const blank = (): VaultAccess => ({
  label: 'Novo acesso',
  method: 'WEB',
  host: '',
  port: null,
  context: '',
  username: '',
  secret: '',
  notes: '',
});
const input =
  'w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring';
export function StructuredAccesses({ entries }: { entries: VaultAccess[] }) {
  const [visible, setVisible] = useState<number[]>([]);
  async function copy(value: string) {
    if (await copyToClipboard(value)) toast.success('Valor copiado.');
    else toast.error('Não foi possível copiar.');
  }
  return (
    <div className="space-y-4">
      {entries.map((entry, index) => (
        <section key={index} className="space-y-3 rounded-xl border border-border bg-muted/20 p-4">
          <div className="flex items-start justify-between gap-3">
            <h3 className="font-semibold">{entry.label}</h3>
            <span className="rounded bg-primary/10 px-2 py-1 text-[10px] text-primary">
              {entry.method}
            </span>
          </div>
          {[
            { label: 'Endereço', value: entry.host, color: 'text-amber-700 dark:text-amber-300' },
            {
              label: 'Porta',
              value: entry.port === null ? '' : String(entry.port),
              color: 'text-muted-foreground',
            },
            { label: 'Usuário', value: entry.username, color: 'text-cyan-700 dark:text-cyan-300' },
            { label: 'Senha', value: entry.secret, color: '', secret: true },
          ].map((field) => (
            <div key={field.label}>
              <label className="mb-1 block text-[10px] font-semibold uppercase text-muted-foreground">
                {field.label}
              </label>
              <div className="flex items-center gap-2">
                <output
                  className={`min-w-0 flex-1 break-all rounded-lg border border-border bg-card px-3 py-2 font-mono text-xs select-all ${field.color}`}
                >
                  {field.secret && !visible.includes(index)
                    ? '••••••••••'
                    : field.value || 'Não informado'}
                </output>
                {field.secret && (
                  <Button
                    size="icon"
                    variant="outline"
                    aria-label={
                      visible.includes(index)
                        ? 'Ocultar senha do acesso'
                        : 'Mostrar senha do acesso'
                    }
                    onClick={() =>
                      setVisible((current) =>
                        current.includes(index)
                          ? current.filter((i) => i !== index)
                          : [...current, index],
                      )
                    }
                  >
                    {visible.includes(index) ? (
                      <EyeOff className="size-4" />
                    ) : (
                      <Eye className="size-4" />
                    )}
                  </Button>
                )}
                <Button
                  size="icon"
                  variant="outline"
                  disabled={!field.value}
                  aria-label={`Copiar ${field.label.toLowerCase()} do acesso`}
                  onClick={() => void copy(field.value)}
                >
                  <Copy className="size-4" />
                </Button>
              </div>
            </div>
          ))}
          {entry.context && (
            <p className="text-xs text-muted-foreground">Rede / contexto: {entry.context}</p>
          )}
          {entry.notes && (
            <p className="whitespace-pre-wrap break-words text-sm leading-6">{entry.notes}</p>
          )}
        </section>
      ))}
    </div>
  );
}
export function VaultAccessEditor({
  record,
  providers,
  onSaved,
  onOpen,
}: {
  record: ErpRecord;
  providers: string[];
  onSaved: () => Promise<void>;
  onOpen: () => void;
}) {
  const action = useErpAction();
  const generation = useRef(0);
  const expectedUpdatedAt = useRef<string | undefined>(undefined);
  const [saveError, setSaveError] = useState('');
  useEffect(
    () => () => {
      generation.current++;
    },
    [],
  );
  const [open, setOpen] = useState(false),
    [loaded, setLoaded] = useState(false),
    [error, setError] = useState('');
  const [identity, setIdentity] = useState({
    provider: '',
    equipmentName: '',
    equipmentType: '',
    environment: '',
    notes: '',
  });
  const [entries, setEntries] = useState<VaultAccess[]>([]),
    [legacy, setLegacy] = useState(''),
    [totp, setTotp] = useState(''),
    [removeTotp, setRemoveTotp] = useState(false);
  async function load() {
    const version = ++generation.current;
    setLoaded(false);
    setError('');
    setSaveError('');
    try {
      const data = await action.execute<{
        accessEntries: VaultAccess[];
        protectedContent: string;
        secret: string;
        updatedAt: string;
      }>({ path: `/knowledge/credentials/${record.id}/reveal`, method: 'POST' });
      if (version !== generation.current) return;
      expectedUpdatedAt.current = data.updatedAt;
      setEntries(
        data.accessEntries.length
          ? data.accessEntries
          : record.host || record.username
            ? [
                {
                  ...blank(),
                  label: 'Acesso principal',
                  method: String(record.accessMethod || 'OUTROS'),
                  host: String(record.host || ''),
                  username: String(record.username || ''),
                  secret: data.secret,
                },
              ]
            : [],
      );
      setLegacy(data.protectedContent || '');
      setIdentity({
        provider: String(record.provider || ''),
        equipmentName: String(record.equipmentName || ''),
        equipmentType: String(record.equipmentType || 'OUTROS'),
        environment: String(record.environment || 'Não informado'),
        notes: String(record.notes || ''),
      });
      setLoaded(true);
    } catch (e) {
      if (version === generation.current) setError(errorMessage(e));
    }
  }
  function close() {
    generation.current++;
    setOpen(false);
    setEntries([]);
    setLegacy('');
    setTotp('');
    setRemoveTotp(false);
    setLoaded(false);
  }
  const update = (index: number, patch: Partial<VaultAccess>) =>
    setEntries((current) =>
      current.map((entry, i) => (i === index ? { ...entry, ...patch } : entry)),
    );
  return (
    <>
      <Button
        variant="outline"
        onClick={() => {
          onOpen();
          setOpen(true);
          void load();
        }}
      >
        Editar
      </Button>
      <Dialog
        open={open}
        onOpenChange={(value) => {
          if (!value) close();
        }}
      >
        <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Editar equipamento e acessos</DialogTitle>
            <DialogDescription>Endereços, contas e orientações deste cadastro.</DialogDescription>
          </DialogHeader>
          {error ? (
            <div role="alert" className="space-y-3 text-sm text-red-600">
              <p>{error}</p>
              <Button variant="outline" onClick={() => void load()}>
                Tentar novamente
              </Button>
            </div>
          ) : !loaded ? (
            <p role="status" className="py-8 text-center text-sm text-muted-foreground">
              Carregando dados protegidos...
            </p>
          ) : (
            <form
              className="space-y-5"
              onSubmit={async (event) => {
                event.preventDefault();
                setSaveError('');
                try {
                  await action.execute({
                    path: `/knowledge/credentials/${record.id}`,
                    method: 'PATCH',
                    body: {
                      ...identity,
                      expectedUpdatedAt: expectedUpdatedAt.current,
                      accessEntries: entries,
                      protectedContent: legacy,
                      ...(totp ? { totpSecret: totp } : {}),
                      ...(removeTotp ? { removeTotp: true } : {}),
                    },
                  });
                  await onSaved();
                  close();
                  toast.success('Cadastro atualizado.');
                } catch (e) {
                  setSaveError(errorMessage(e));
                }
              }}
            >
              {saveError && (
                <p
                  role="alert"
                  className="rounded-xl border border-red-500/20 bg-red-500/5 p-3 text-sm text-red-600"
                >
                  {saveError}
                </p>
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-1 text-xs">
                  Provedor
                  <select
                    className={input}
                    value={identity.provider}
                    onChange={(e) => setIdentity({ ...identity, provider: e.target.value })}
                    required
                  >
                    {providers
                      .filter((p) => p !== 'Todos')
                      .map((p) => (
                        <option key={p}>{p}</option>
                      ))}
                  </select>
                </label>
                {(['equipmentName', 'equipmentType', 'environment'] as const).map((key) => (
                  <label key={key} className="space-y-1 text-xs">
                    {
                      {
                        equipmentName: 'Nome do equipamento / sistema',
                        equipmentType: 'Categoria',
                        environment: 'Ambiente',
                      }[key]
                    }
                    <input
                      required
                      className={input}
                      value={identity[key]}
                      onChange={(e) => setIdentity({ ...identity, [key]: e.target.value })}
                    />
                  </label>
                ))}
              </div>
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Acessos cadastrados</h3>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={entries.length >= 50}
                  onClick={() => setEntries([...entries, blank()])}
                >
                  <Plus className="size-3.5" />
                  Adicionar acesso
                </Button>
              </div>
              {entries.map((entry, index) => (
                <fieldset key={index} className="space-y-3 rounded-xl border border-border p-4">
                  <legend className="px-2 text-xs font-semibold">
                    {index === 0 ? 'Acesso principal' : `Acesso ${index + 1}`}
                  </legend>
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      aria-label={`Remover acesso ${index + 1}`}
                      onClick={() => setEntries((current) => current.filter((_, i) => i !== index))}
                    >
                      <Trash2 className="size-3.5" />
                      Remover
                    </Button>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="space-y-1 text-xs">
                      Identificação
                      <input
                        className={input}
                        required
                        maxLength={120}
                        value={entry.label}
                        onChange={(e) => update(index, { label: e.target.value })}
                      />
                    </label>
                    <label className="space-y-1 text-xs">
                      Método
                      <select
                        className={input}
                        value={entry.method}
                        onChange={(e) => update(index, { method: e.target.value })}
                      >
                        {[
                          'WEB',
                          'SSH',
                          'WINBOX',
                          'TELNET',
                          'RDP',
                          'ANYDESK',
                          'BANCO',
                          'OUTROS',
                        ].map((method) => (
                          <option key={method}>{method}</option>
                        ))}
                      </select>
                    </label>
                    <label className="space-y-1 text-xs">
                      Endereço / host
                      <input
                        className={input}
                        value={entry.host}
                        onChange={(e) => update(index, { host: e.target.value })}
                      />
                    </label>
                    <label className="space-y-1 text-xs">
                      Porta
                      <input
                        className={input}
                        type="number"
                        min={1}
                        max={65535}
                        value={entry.port ?? ''}
                        onChange={(e) =>
                          update(index, { port: e.target.value ? Number(e.target.value) : null })
                        }
                      />
                    </label>
                    <label className="space-y-1 text-xs">
                      Usuário
                      <input
                        className={input}
                        autoComplete="off"
                        value={entry.username}
                        onChange={(e) => update(index, { username: e.target.value })}
                      />
                    </label>
                    <label className="space-y-1 text-xs">
                      Senha
                      <input
                        className={input}
                        type="password"
                        autoComplete="new-password"
                        value={entry.secret}
                        onChange={(e) => update(index, { secret: e.target.value })}
                      />
                    </label>
                    <label className="space-y-1 text-xs sm:col-span-2">
                      Rede / contexto (interno, externo, VPN...)
                      <input
                        className={input}
                        value={entry.context}
                        onChange={(e) => update(index, { context: e.target.value })}
                      />
                    </label>
                    <label className="space-y-1 text-xs sm:col-span-2">
                      Instruções deste acesso
                      <textarea
                        className={input}
                        rows={3}
                        value={entry.notes}
                        onChange={(e) => update(index, { notes: e.target.value })}
                      />
                    </label>
                  </div>
                </fieldset>
              ))}
              <label className="block space-y-1 text-xs">
                Orientações gerais
                <textarea
                  className={input}
                  rows={4}
                  maxLength={50000}
                  value={identity.notes}
                  onChange={(e) => setIdentity({ ...identity, notes: e.target.value })}
                />
              </label>
              {legacy && (
                <details className="rounded-xl border border-border p-3">
                  <summary className="cursor-pointer text-xs font-medium">
                    Dados adicionais para conferência
                  </summary>
                  <textarea
                    aria-label="Dados adicionais protegidos"
                    className={`${input} mt-3 font-mono text-xs`}
                    rows={8}
                    maxLength={100000}
                    value={legacy}
                    onChange={(e) => setLegacy(e.target.value)}
                  />
                </details>
              )}
              <label className="block space-y-1 text-xs">
                Chave 2FA / TOTP
                <input
                  className={input}
                  type="password"
                  autoComplete="new-password"
                  placeholder="Deixe vazio para manter a chave atual"
                  value={totp}
                  onChange={(e) => setTotp(e.target.value)}
                />
              </label>
              {!!record.hasTotp && (
                <label className="flex gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={removeTotp}
                    onChange={(e) => setRemoveTotp(e.target.checked)}
                  />
                  Remover a configuração 2FA
                </label>
              )}
              <div className="sticky bottom-0 flex justify-end gap-2 border-t border-border bg-card pt-4">
                <Button type="button" variant="outline" onClick={close}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={action.pending}>
                  Salvar alterações
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
