'use client';

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';

type StreamEvent = {
  at: string;
  name: string;
  payload: unknown;
};

export function RealtimeEvents() {
  const [tenantId, setTenantId] = useState('');
  const [status, setStatus] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle');
  const [events, setEvents] = useState<StreamEvent[]>([]);
  const [lastError, setLastError] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);

  const wsUrl = useMemo(
    () => process.env.NEXT_PUBLIC_WS_URL || process.env.API_BASE_URL || 'http://localhost:8071',
    []
  );

  useEffect(() => {
    return () => {
      socketRef.current?.disconnect();
      socketRef.current = null;
    };
  }, []);

  function addEvent(name: string, payload: unknown) {
    setEvents((prev) => [{ at: new Date().toISOString(), name, payload }, ...prev].slice(0, 30));
  }

  function connect(e: FormEvent) {
    e.preventDefault();

    socketRef.current?.disconnect();
    socketRef.current = null;

    setStatus('connecting');
    setLastError(null);

    const socket = io(wsUrl, {
      transports: ['websocket'],
      auth: tenantId ? { tenantId } : undefined
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setStatus('connected');
      if (tenantId) socket.emit('subscribe_tenant', { tenantId });
      addEvent('socket.connect', { id: socket.id });
    });

    socket.on('disconnect', (reason: string) => {
      setStatus('idle');
      addEvent('socket.disconnect', { reason });
    });

    socket.on('connect_error', (error: Error) => {
      setStatus('error');
      setLastError(error.message || 'connection_error');
      addEvent('socket.error', { message: error.message });
    });

    socket.onAny((eventName: string, payload: unknown) => {
      addEvent(eventName, payload);
    });
  }

  return (
    <div>
      <div className="section-head">
        <h2>Monitor de eventos WebSocket</h2>
        <p>Eventos em tempo real por tenant para operacao e sync.</p>
      </div>

      <form onSubmit={connect} className="ws-form">
        <input
          value={tenantId}
          onChange={(e) => setTenantId(e.target.value)}
          placeholder="tenantId (uuid)"
          className="ws-input"
        />
        <button type="submit" className="btn-primary">
          Conectar
        </button>
        <button type="button" onClick={() => setEvents([])} className="btn-secondary">
          Limpar
        </button>
      </form>

      <p className="ws-meta">
        endpoint <code>{wsUrl}</code> - status <strong>{status}</strong>
      </p>
      {lastError && <p className="ws-error">Erro: {lastError}</p>}

      <div className="event-stream">
        {events.length === 0 && <p className="muted">Sem eventos recebidos.</p>}
        {events.map((evt, idx) => (
          <article key={`${evt.at}-${evt.name}-${idx}`} className="event-item">
            <div className="event-title">
              <span>{evt.at}</span>
              <strong>{evt.name}</strong>
            </div>
            <pre>{JSON.stringify(evt.payload, null, 2)}</pre>
          </article>
        ))}
      </div>
    </div>
  );
}
