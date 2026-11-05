'use client';

import { useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { Activity, Radio, RefreshCw, ShieldAlert, Trash2, Wifi, WifiOff } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useErp, useErpAction } from '@/lib/erp/gateway';
import { errorMessage } from '@/lib/erp/contracts';
import { PageHeading, StatusBadge } from './primitives';

type MonitorStatus = 'idle' | 'connecting' | 'connected' | 'error';
type SocketCredentials = { token?: string; socketUrl?: string };
type StreamEvent = { id: number; at: string; name: string; payload: unknown };

const sensitiveField =
  /token|password|secret|authorization|cookie|api[_-]?key|private[_-]?key|email|phone|cpf|cnpj/i;

function redact(value: unknown, depth = 0): unknown {
  if (depth > 5) return '[conteúdo reduzido]';
  if (Array.isArray(value)) return value.slice(0, 30).map((item) => redact(item, depth + 1));
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .slice(0, 50)
        .map(([key, item]) => [
          key,
          sensitiveField.test(key) ? '[redigido]' : redact(item, depth + 1),
        ]),
    );
  }
  if (typeof value === 'string') return value.length > 2000 ? `${value.slice(0, 2000)}…` : value;
  return value;
}

function safeEndpoint(value: string) {
  const endpoint = new URL(value, window.location.origin);
  const allowedProtocol =
    ['https:', 'wss:'].includes(endpoint.protocol) ||
    (['http:', 'ws:'].includes(endpoint.protocol) &&
      ['localhost', '127.0.0.1', '::1'].includes(endpoint.hostname));
  if (!allowedProtocol) throw new Error('O BFF retornou um endpoint de eventos inseguro.');
  return endpoint.toString();
}

const statusLabel: Record<MonitorStatus, string> = {
  idle: 'Desconectado',
  connecting: 'Conectando',
  connected: 'Conectado',
  error: 'Falha na conexão',
};

export function RealtimeEventsWorkspace() {
  const { scope } = useErp();
  return <RealtimeEventsSession key={`${scope?.sessionKey}:${scope?.tenantId}:${scope?.role}`} />;
}
function RealtimeEventsSession() {
  const { scope, transport } = useErp();
  const action = useErpAction();
  const socketRef = useRef<Socket | null>(null);
  const eventSequence = useRef(0);
  const [status, setStatus] = useState<MonitorStatus>('idle');
  const [events, setEvents] = useState<StreamEvent[]>([]);
  const [lastError, setLastError] = useState('');
  const canMonitor = !!scope && ['super_admin', 'gerente'].includes(scope.role);

  useEffect(() => {
    socketRef.current?.disconnect();
    socketRef.current = null;
    return () => {
      socketRef.current?.disconnect();
      socketRef.current = null;
    };
  }, [scope?.sessionKey, scope?.tenantId, scope?.role, transport]);

  function addEvent(name: string, payload: unknown) {
    const event = {
      id: eventSequence.current++,
      at: new Date().toISOString(),
      name,
      payload: redact(payload),
    };
    setEvents((current) => [event, ...current].slice(0, 100));
  }

  async function connect() {
    if (!action.connected || !scope || !canMonitor) return;
    socketRef.current?.disconnect();
    socketRef.current = null;
    setLastError('');
    setStatus('connecting');

    try {
      const credentials = await action.execute<SocketCredentials>({ path: '/auth/socket-token' });
      if (!credentials || typeof credentials.token !== 'string' || !credentials.token)
        throw new Error('O BFF não emitiu uma credencial para o canal em tempo real.');
      const endpoint = safeEndpoint(credentials.socketUrl || window.location.origin);
      let initialToken: string | undefined = credentials.token;
      const socket = io(endpoint, {
        autoConnect: false,
        transports: ['websocket'],
        auth: async (callback) => {
          try {
            const token =
              initialToken ||
              (await action.execute<SocketCredentials>({ path: '/auth/socket-token' })).token;
            initialToken = undefined;
            callback({ token: token || '' });
          } catch {
            callback({});
          }
        },
      });
      socketRef.current = socket;
      socket.on('connect', () => {
        setStatus('connected');
        setLastError('');
        socket.emit('subscribe_tenant', { tenantId: scope.tenantId });
        addEvent('socket.connect', { id: socket.id, tenantId: scope.tenantId });
      });
      socket.on('disconnect', (reason) => {
        setStatus('idle');
        addEvent('socket.disconnect', { reason });
      });
      socket.on('connect_error', (error) => {
        setStatus('error');
        setLastError(error.message || 'Não foi possível conectar ao canal.');
        addEvent('socket.error', { message: error.message });
      });
      socket.onAny((eventName, payload) => addEvent(eventName, payload));
      socket.connect();
    } catch (cause) {
      setStatus('error');
      setLastError(errorMessage(cause));
    }
  }

  function disconnect() {
    socketRef.current?.disconnect();
    socketRef.current = null;
    setStatus('idle');
  }

  return (
    <>
      <PageHeading
        title="Monitor de eventos em tempo real"
        description="Acompanhe eventos WebSocket autorizados para a empresa da sessão atual."
      >
        <StatusBadge status={statusLabel[status]} />
      </PageHeading>
      {!action.connected && (
        <Alert className="mb-5">
          <ShieldAlert />
          <AlertTitle>Backend não conectado</AlertTitle>
          <AlertDescription>
            O monitor requer sessão autenticada, endpoint de token do BFF e canal Socket.IO. A
            prévia não abre conexões nem usa credenciais de demonstração.
          </AlertDescription>
        </Alert>
      )}
      {scope && !canMonitor && (
        <Alert variant="destructive" className="mb-5">
          <ShieldAlert />
          <AlertTitle>Acesso restrito</AlertTitle>
          <AlertDescription>
            O monitor de eventos está disponível somente para administradores e gerentes.
          </AlertDescription>
        </Alert>
      )}
      <section className="panel overflow-hidden">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border p-5">
          <div className="flex items-start gap-3">
            <span className="flex size-10 items-center justify-center rounded-lg bg-secondary text-primary">
              <Activity />
            </span>
            <div>
              <h2 className="section-title">Canal da empresa autenticada</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Assinatura restrita ao tenant recebido pela sessão; nenhum tenantId pode ser
                digitado pelo navegador.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              onClick={connect}
              disabled={
                !action.connected ||
                !canMonitor ||
                status === 'connecting' ||
                status === 'connected'
              }
            >
              {status === 'connecting' ? (
                <RefreshCw data-icon="inline-start" className="animate-spin" />
              ) : (
                <Wifi data-icon="inline-start" />
              )}
              {status === 'connecting' ? 'Conectando...' : 'Conectar'}
            </Button>
            {status === 'connected' && (
              <Button type="button" variant="outline" onClick={disconnect}>
                <WifiOff data-icon="inline-start" />
                Desconectar
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              onClick={() => setEvents([])}
              disabled={!events.length}
            >
              <Trash2 data-icon="inline-start" />
              Limpar eventos
            </Button>
          </div>
        </header>
        {lastError && (
          <Alert variant="destructive" className="m-5">
            <ShieldAlert />
            <AlertTitle>Não foi possível conectar</AlertTitle>
            <AlertDescription>{lastError}</AlertDescription>
          </Alert>
        )}
        <div className="border-b border-border bg-muted/30 px-5 py-3 text-[10px] text-muted-foreground">
          {scope
            ? `Tenant da sessão: ${scope.tenantId}`
            : 'Tenant indisponível sem sessão autenticada'}{' '}
          · Eventos recentes limitados a 100 · Campos sensíveis são redigidos na visualização
        </div>
        {events.length ? (
          <ol className="flex flex-col divide-y divide-border">
            {events.map((event) => (
              <li
                key={event.id}
                className="grid gap-3 p-5 md:grid-cols-[170px_190px_minmax(0,1fr)]"
              >
                <time className="text-[10px] text-muted-foreground" dateTime={event.at}>
                  {new Date(event.at).toLocaleString('pt-BR')}
                </time>
                <p className="flex items-center gap-2 text-xs font-medium">
                  <Radio className="size-3.5 text-primary" />
                  {event.name}
                </p>
                <pre className="max-h-64 overflow-auto rounded-md bg-muted p-3 text-[10px] leading-relaxed text-muted-foreground">
                  {JSON.stringify(event.payload, null, 2)}
                </pre>
              </li>
            ))}
          </ol>
        ) : (
          <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
            <Activity className="size-8 text-muted-foreground" />
            <p className="text-sm font-medium">Aguardando eventos</p>
            <p className="max-w-md text-xs leading-6 text-muted-foreground">
              Conecte o canal para receber eventos do servidor. A conexão só é iniciada após ação
              explícita e usa token temporário fornecido pelo BFF.
            </p>
          </div>
        )}
      </section>
    </>
  );
}
