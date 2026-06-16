'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

import { io, Socket } from 'socket.io-client';

type WsEvent = {
  type: string;
  tenantId?: string;
  orderId?: string;
  occurrenceId?: string;
  status?: string;
  message?: string;
  data?: Record<string, unknown>;
  timestamp?: string;
};

type UseErpWebSocketOptions = {
  /** WebSocket server URL (defaults to window origin on port 8071) */
  url?: string;
  /** Tenant ID to subscribe to */
  tenantId?: string | null;
  /** Called when a real-time event is received */
  onEvent?: (event: WsEvent) => void;
  /** Whether to auto-reconnect */
  autoReconnect?: boolean;
  /** Whether to enable the connection */
  enabled?: boolean;
};

type WsStatus = 'disconnected' | 'connecting' | 'connected' | 'error';
type SocketCredentials = { token?: string; socketUrl?: string };

async function fetchSocketCredentials(): Promise<SocketCredentials> {
  const response = await fetch('/api/auth/socket-token', { cache: 'no-store' });
  if (!response.ok) throw new Error('socket_token_failed');
  return (await response.json()) as SocketCredentials;
}

export function useErpWebSocket({
  url,
  tenantId,
  onEvent,
  autoReconnect = true,
  enabled = true,
}: UseErpWebSocketOptions = {}) {
  const [status, setStatus] = useState<WsStatus>('disconnected');
  const [lastEvent, setLastEvent] = useState<WsEvent | null>(null);
  const [events, setEvents] = useState<WsEvent[]>([]);
  const socketRef = useRef<Socket | null>(null);
  const onEventRef = useRef(onEvent);
  const connectionAttemptRef = useRef(0);

  onEventRef.current = onEvent;

  const connect = useCallback(async () => {
    if (!enabled || typeof window === 'undefined') return;
    const attempt = ++connectionAttemptRef.current;

    setStatus('connecting');
    try {
      const credentials = await fetchSocketCredentials();
      if (attempt !== connectionAttemptRef.current || !credentials.token) return;
      const socketUrl = url || credentials.socketUrl || window.location.origin;
      let initialToken: string | undefined = credentials.token;

      const socket = io(socketUrl, {
        reconnection: autoReconnect,
        transports: ['websocket', 'polling'], // Fallback available
        auth: async (callback) => {
          try {
            if (initialToken) {
              callback({ token: initialToken });
              initialToken = undefined;
              return;
            }
            const freshCredentials = await fetchSocketCredentials();
            callback({ token: freshCredentials.token || '' });
          } catch {
            callback({ token: '' });
          }
        },
      });
      if (attempt !== connectionAttemptRef.current) {
        socket.close();
        return;
      }
      socketRef.current = socket;

      socket.on('connect', () => {
        setStatus('connected');

        // Subscribe to tenant room
        if (tenantId) {
          socket.emit('subscribe_tenant', { tenantId });
        }
      });

      // Handle incoming sync/domain events dynamically
      // Socket.IO "onAny" acts as a catch-all
      socket.onAny((eventName, ...args) => {
        // Ignore internal socket.io events if they bubble up
        if (eventName === 'connect' || eventName === 'disconnect' || eventName === 'connect_error')
          return;

        const rawData = args[0] || {};
        const enriched: WsEvent = {
          type: eventName,
          ...rawData,
          timestamp: rawData.timestamp || new Date().toISOString(),
        };

        setLastEvent(enriched);
        setEvents((prev) => [enriched, ...prev].slice(0, 100));
        onEventRef.current?.(enriched);
      });

      socket.on('disconnect', () => {
        setStatus('disconnected');
      });

      socket.on('connect_error', () => {
        setStatus('error');
      });
    } catch {
      setStatus('error');
    }
  }, [url, tenantId, autoReconnect, enabled]);

  const disconnect = useCallback(() => {
    connectionAttemptRef.current += 1;
    const socket = socketRef.current;
    if (socket) {
      socket.removeAllListeners();
      if (socket.connected) {
        socket.disconnect();
      } else {
        socket.close();
      }
      socketRef.current = null;
    }
    setStatus('disconnected');
  }, []);

  useEffect(() => {
    if (!enabled) {
      disconnect();
      return;
    }

    // Delay connection to avoid React StrictMode mount/unmount race in dev,
    // which can close a websocket before handshake and pollute console logs.
    const timer = window.setTimeout(() => {
      connect();
    }, 0);

    return () => {
      window.clearTimeout(timer);
      disconnect();
    };
  }, [enabled, tenantId, connect, disconnect]);

  return { status, lastEvent, events, disconnect, reconnect: connect };
}

/* ═══════════════════════════ Status Indicator ═══════════════════════════ */

/**
 * Small WebSocket connection status indicator.
 */
export function WsStatusIndicator({ status, dark = true }: { status: WsStatus; dark?: boolean }) {
  const colors: Record<WsStatus, string> = {
    connected: 'bg-emerald-400',
    connecting: 'bg-amber-400 animate-pulse',
    disconnected: 'bg-slate-500',
    error: 'bg-rose-400',
  };

  const labels: Record<WsStatus, string> = {
    connected: 'Conectado',
    connecting: 'Conectando...',
    disconnected: 'Desconectado',
    error: 'Erro de conexão',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 text-[10px] font-medium ${dark ? 'text-slate-500' : 'text-slate-400'}`}
    >
      <span className={`w-2 h-2 rounded-full ${colors[status]}`} />
      {labels[status]}
    </span>
  );
}
