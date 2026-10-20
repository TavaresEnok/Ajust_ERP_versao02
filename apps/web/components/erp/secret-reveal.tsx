'use client';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { useErp, useErpAction } from '@/lib/erp/gateway';
import { errorMessage } from '@/lib/erp/contracts';
export function SecretReveal({
  recordId,
  title,
  path,
  field,
  initialValue,
  onDismiss,
}: {
  recordId: string;
  title: string;
  path?: string;
  field: string;
  initialValue?: string;
  onDismiss?: () => void;
}) {
  const { scope } = useErp();
  const action = useErpAction();
  const [open, setOpen] = useState(Boolean(initialValue));
  const [secret, setSecret] = useState(initialValue || '');
  const requestVersion = useRef(0);
  const sessionKey = scope ? `${scope.sessionKey}:${scope.tenantId}:${scope.role}` : 'disconnected';
  function dismiss() {
    requestVersion.current++;
    setSecret('');
    setOpen(false);
    onDismiss?.();
  }
  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(dismiss, 30000);
    const hide = () => {
      if (document.hidden) dismiss();
    };
    window.addEventListener('blur', dismiss);
    document.addEventListener('visibilitychange', hide);
    return () => {
      clearTimeout(timer);
      requestVersion.current++;
      window.removeEventListener('blur', dismiss);
      document.removeEventListener('visibilitychange', hide);
    };
  }, [open, sessionKey]);
  useEffect(
    () => () => {
      requestVersion.current++;
    },
    [],
  );
  async function reveal() {
    const version = ++requestVersion.current;
    try {
      const response = await action.execute<Record<string, unknown>>({
        path: path!,
        method: 'POST',
      });
      if (version !== requestVersion.current) return;
      if (typeof response[field] !== 'string')
        throw new Error('O ERP não retornou o segredo no formato esperado.');
      setSecret(response[field]);
    } catch (error) {
      if (version === requestVersion.current) toast.error(errorMessage(error));
    }
  }
  return (
    <>
      {path && (
        <Button
          variant="outline"
          size="sm"
          disabled={!action.connected}
          onClick={() => setOpen(true)}
        >
          Revelar acesso
        </Button>
      )}
      <Dialog open={open} onOpenChange={(value) => (value ? setOpen(true) : dismiss())}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>
              Segredo de {recordId}. Esta janela é limpa ao fechar, sair da aba ou após 30 segundos.
            </DialogDescription>
          </DialogHeader>
          <Alert>
            <ShieldCheck />
            <AlertTitle>Acesso sensível</AlertTitle>
            <AlertDescription>
              {path
                ? 'O ERP valida sua permissão e audita a revelação. O segredo não passa pelo cache de consultas.'
                : 'Esta chave é exibida uma única vez. Guarde-a em um gerenciador seguro antes de fechar.'}
            </AlertDescription>
          </Alert>
          {secret ? (
            <>
              <output className="select-all break-all rounded-lg border border-border bg-muted p-4 font-mono text-sm">
                {secret}
              </output>
              <Button
                variant="outline"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(secret);
                    toast.success(
                      'Copiado. O conteúdo da área de transferência não é apagado automaticamente.',
                    );
                  } catch {
                    toast.error('Não foi possível copiar. Selecione o valor manualmente.');
                  }
                }}
              >
                Copiar segredo
              </Button>
              <Button onClick={dismiss}>Ocultar e fechar</Button>
            </>
          ) : (
            <Button disabled={!action.connected || action.pending} onClick={() => void reveal()}>
              {action.pending ? 'Consultando...' : 'Confirmar revelação auditada'}
            </Button>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
