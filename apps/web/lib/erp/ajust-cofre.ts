'use client';
import { useSyncExternalStore } from 'react';

/**
 * Conversa com a extensão "Ajust Cofre" (extensions/ajust-cofre). A extensão injeta um script
 * só no domínio do ERP que marca <html data-ajust-cofre="versão"> e escuta window.postMessage.
 */
const CHANNEL = 'ajust-cofre';

/** Versão publicada em /extensao/ajust-cofre.zip (extensions/ajust-cofre/manifest.json). */
export const EXTENSION_LATEST = '1.1.2';
export const EXTENSION_DOWNLOAD = '/extensao/ajust-cofre.zip';

export function isOutdated(installed: string) {
  const a = installed.split('.').map(Number);
  const b = EXTENSION_LATEST.split('.').map(Number);
  for (let i = 0; i < 3; i++) if ((a[i] || 0) !== (b[i] || 0)) return (a[i] || 0) < (b[i] || 0);
  return false;
}

export type AutofillPayload = {
  url: string;
  origin: string;
  username: string;
  password: string;
  totp: {
    codes: { code: string; validFrom: number; validUntil: number }[];
    serverTime: number;
  } | null;
};

function readVersion() {
  return typeof document === 'undefined'
    ? null
    : document.documentElement.dataset.ajustCofre || null;
}

function subscribe(callback: () => void) {
  const onMessage = (event: MessageEvent) => {
    if (event.source === window && event.data?.channel === CHANNEL && event.data.type === 'ready')
      callback();
  };
  window.addEventListener('message', onMessage);
  // A extensão pode ter carregado depois da página: pergunta de novo.
  window.postMessage({ channel: CHANNEL, type: 'ping' }, window.location.origin);
  return () => window.removeEventListener('message', onMessage);
}

/** Versão da extensão instalada, ou null. */
export function useAjustCofre() {
  return useSyncExternalStore(subscribe, readVersion, () => null);
}

export function sendAutofill(payload: AutofillPayload, timeoutMs = 5000) {
  return new Promise<{ ok: boolean; error?: string; twoFactor?: boolean }>((resolve) => {
    const requestId = crypto.randomUUID();
    const timer = setTimeout(() => {
      window.removeEventListener('message', onMessage);
      resolve({
        ok: false,
        error:
          'A extensão Ajust Cofre não respondeu. Aperte F5 nesta página e tente de novo; se continuar, confira em chrome://extensions se ela está ativada.',
      });
    }, timeoutMs);
    function onMessage(event: MessageEvent) {
      const data = event.data;
      if (
        event.source !== window ||
        data?.channel !== CHANNEL ||
        data.type !== 'autofill-reply' ||
        data.requestId !== requestId
      )
        return;
      clearTimeout(timer);
      window.removeEventListener('message', onMessage);
      resolve({ ok: !!data.ok, error: data.error, twoFactor: data.twoFactor });
    }
    window.addEventListener('message', onMessage);
    window.postMessage(
      { channel: CHANNEL, type: 'autofill', requestId, payload },
      window.location.origin,
    );
  });
}
