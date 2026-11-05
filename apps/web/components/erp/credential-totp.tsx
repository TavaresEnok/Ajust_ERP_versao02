'use client';
import { useVaultConfirmation } from './vault-confirmation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Copy, ShieldCheck } from 'lucide-react';
import { useErp } from '@/lib/erp/gateway';
import { Button } from '@/components/ui/button';
import { copyToClipboard } from '@/lib/erp/clipboard';
import { errorMessage } from '@/lib/erp/contracts';
import { toast } from 'sonner';
type Code = { code: string; validUntil: number; serverTime: number; period: number };
export function CredentialTotp({ id, configured }: { id: string; configured: boolean }) {
  const confirmation = useVaultConfirmation();
  const { transport } = useErp();
  const [pending, setPending] = useState(false);
  const [value, setValue] = useState<Code | null>(null),
    [seconds, setSeconds] = useState(0),
    version = useRef(0),
    offset = useRef(0);
  const hide = useCallback(() => {
    version.current++;
    setValue(null);
  }, []);
  const load = async () => {
    if (!transport) return;
    const body = await confirmation.request();
    if (!body) return;
    setPending(true);
    const generation = ++version.current;
    try {
      const response = await transport.request<Code>({
        path: `/knowledge/credentials/${id}/totp`,
        method: 'POST',
        body,
      });
      if (generation !== version.current) return;
      offset.current = response.serverTime - Date.now();
      setSeconds(Math.ceil((response.validUntil - response.serverTime) / 1000));
      setValue(response);
    } catch (e) {
      if (generation === version.current) {
        setValue(null);
        toast.error(errorMessage(e));
      }
    } finally {
      setPending(false);
    }
  };
  useEffect(() => {
    if (!value) return;
    const tick = setInterval(
      () =>
        setSeconds(Math.max(0, Math.ceil((value.validUntil - Date.now() - offset.current) / 1000))),
      1000,
    );
    const refresh = setTimeout(
      hide,
      Math.max(100, value.validUntil - Date.now() - offset.current + 100),
    );
    return () => {
      clearInterval(tick);
      clearTimeout(refresh);
    };
  }, [value, hide]);
  const active = !!value;
  useEffect(() => {
    if (!active) return;
    const timeout = setTimeout(hide, 120000);
    const visibility = () => {
      if (document.hidden) hide();
    };
    window.addEventListener('blur', hide);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      clearTimeout(timeout);
      window.removeEventListener('blur', hide);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, [active, hide]);
  useEffect(
    () => () => {
      version.current++;
    },
    [],
  );
  return (
    <div className="border-t border-border pt-4">
      {confirmation.dialog}
      <div className="mb-2 flex items-center justify-between gap-2 text-[10px] font-semibold uppercase text-muted-foreground">
        <span className="flex items-center gap-1">
          <ShieldCheck className="size-3" />
          Token 2FA / TOTP {configured ? 'ativo' : ''}
        </span>
        {value && <span className="font-mono text-primary">Expira em {seconds}s</span>}
      </div>
      {configured ? (
        <div className="flex gap-2">
          {value ? (
            <>
              <output
                aria-label="Código TOTP"
                className="flex-1 rounded-xl border border-primary/20 bg-primary/5 px-3 py-3 font-mono text-lg font-semibold tracking-[.2em] text-primary"
              >
                {value.code.replace(/(.{3})(?=.)/g, '$1 ')}
              </output>
              <Button
                variant="outline"
                aria-label="Copiar código TOTP"
                onClick={async () => {
                  if (Date.now() + offset.current >= value.validUntil) {
                    hide();
                    return;
                  }
                  if (await copyToClipboard(value.code)) toast.success('Código copiado.');
                }}
              >
                <Copy className="size-4" />
              </Button>
              <Button variant="ghost" onClick={hide}>
                Ocultar
              </Button>
            </>
          ) : (
            <Button variant="outline" disabled={pending} onClick={() => void load()}>
              Mostrar código 2FA
            </Button>
          )}
        </div>
      ) : (
        <p className="text-xs leading-5 text-muted-foreground">
          Cadastre a chave do autenticador em Editar para gerar os códigos aqui.
        </p>
      )}
    </div>
  );
}
