'use client';
import { useEffect, useRef, useState } from 'react';
import { Download, Loader2, Save, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function downloadDiagram(xml: string, title: string) {
  const url = URL.createObjectURL(new Blob([xml], { type: 'application/vnd.jgraph.mxfile' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `${title.replace(/[^\p{L}\p{N} _.-]/gu, '_').slice(0, 150) || 'topologia'}.drawio`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function DrawioFrame({
  xml,
  title,
  editing = false,
  imported = false,
  onSave,
  onClose,
}: {
  xml: string;
  title: string;
  editing?: boolean;
  imported?: boolean;
  onSave?: (xml: string) => Promise<void>;
  onClose?: () => void;
}) {
  const frame = useRef<HTMLIFrameElement>(null);
  const loaded = useRef(false);
  const busy = useRef(false);
  const mutations = useRef(0);
  const exportTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingExport = useRef<'save' | 'download' | null>(null);
  const callbacks = useRef({ onSave, onClose });
  const [ready, setReady] = useState(false);
  const [dirty, setDirty] = useState(imported);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [confirmation, setConfirmation] = useState('');
  useEffect(() => {
    callbacks.current = { onSave, onClose };
  }, [onSave, onClose]);

  useEffect(() => {
    if (!editing || !dirty) return;
    const unload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    const click = (event: MouseEvent) => {
      const link =
        event.target instanceof Element ? event.target.closest<HTMLAnchorElement>('a[href]') : null;
      if (
        link &&
        link.href !== window.location.href &&
        !window.confirm('Existem alterações não salvas na topologia. Deseja sair e descartá-las?')
      ) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    };
    window.addEventListener('beforeunload', unload);
    document.addEventListener('click', click, true);
    return () => {
      window.removeEventListener('beforeunload', unload);
      document.removeEventListener('click', click, true);
    };
  }, [editing, dirty]);

  useEffect(() => {
    const origin = window.location.origin;
    const send = (data: object) =>
      frame.current?.contentWindow?.postMessage(JSON.stringify(data), origin);
    const timeout = window.setTimeout(() => {
      if (!loaded.current)
        setError(
          'O editor draw.io ainda não carregou. Tente novamente em instantes. Seu diagrama salvo está preservado.',
        );
    }, 45000);
    const receive = async (event: MessageEvent) => {
      if (event.origin !== origin || event.source !== frame.current?.contentWindow) return;
      let data: { event?: string; xml?: string; error?: unknown; modified?: boolean };
      try {
        data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
      } catch {
        return;
      }
      if (!data || typeof data !== 'object') return;
      if (data.event === 'init') {
        send({
          action: 'load',
          xml,
          title,
          autosave: editing ? 1 : 0,
          noSaveBtn: 1,
          noExitBtn: 1,
          saveAndExit: 0,
          fit: 1,
        });
      } else if (data.event === 'load') {
        if (data.error) {
          setError(
            'O draw.io não conseguiu abrir este arquivo. Confira se ele contém um diagrama editável.',
          );
          window.clearTimeout(timeout);
          return;
        }
        loaded.current = true;
        setReady(true);
        setError('');
        window.clearTimeout(timeout);
      } else if (data.event === 'autosave' && editing) {
        mutations.current += 1;
        setDirty(true);
        setConfirmation('');
      } else if ((data.event === 'save' || data.event === 'export') && editing) {
        if (data.event === 'save' && busy.current && !pendingExport.current) return;
        const task = pendingExport.current || (data.event === 'save' ? 'save' : null);
        pendingExport.current = null;
        if (!task) return;
        if (exportTimeout.current) clearTimeout(exportTimeout.current);
        if (data.error || typeof data.xml !== 'string') {
          busy.current = false;
          setSaving(false);
          setError('Não foi possível obter o diagrama do editor. Tente novamente.');
          return;
        }
        if (task === 'download') {
          downloadDiagram(data.xml, title);
          busy.current = false;
          return;
        }
        if (!callbacks.current.onSave) return;
        busy.current = true;
        setSaving(true);
        const generation = mutations.current;
        try {
          await callbacks.current.onSave(data.xml);
          const changedDuringSave = mutations.current !== generation;
          setDirty(changedDuringSave);
          setError('');
          setConfirmation('Topologia salva no ERP.');
          send({
            action: 'status',
            message: 'Topologia salva no ERP',
            modified: changedDuringSave,
          });
        } catch (failure) {
          setError(
            failure instanceof Error
              ? failure.message
              : 'Não foi possível salvar. Suas alterações continuam no editor.',
          );
        } finally {
          busy.current = false;
          setSaving(false);
        }
      } else if (data.event === 'exit' && editing) {
        // The ERP owns closing and its unsaved-changes confirmation.
      }
    };
    window.addEventListener('message', receive);
    return () => {
      window.clearTimeout(timeout);
      if (exportTimeout.current) clearTimeout(exportTimeout.current);
      window.removeEventListener('message', receive);
    };
  }, [xml, title, editing, attempt]);

  function requestExport(task: 'save' | 'download') {
    if (!ready || busy.current) return;
    busy.current = true;
    pendingExport.current = task;
    setError('');
    if (task === 'save') setSaving(true);
    exportTimeout.current = setTimeout(() => {
      busy.current = false;
      pendingExport.current = null;
      setSaving(false);
      setError('O editor não respondeu. Tente salvar novamente ou baixe uma cópia.');
    }, 20000);
    frame.current?.contentWindow?.postMessage(
      JSON.stringify({ action: 'export', format: 'xml' }),
      window.location.origin,
    );
  }
  const params = new URLSearchParams({
    embed: '1',
    proto: 'json',
    spin: '1',
    lang: 'pt-br',
    libraries: '1',
    libs: 'general;network;cisco',
    ui: 'min',
    dark: '0',
    noSaveBtn: '1',
    noExitBtn: '1',
    saveAndExit: '0',
    drafts: '0',
    offline: '1',
  });
  if (!editing) {
    params.set('chrome', '0');
    params.set('nav', '1');
    params.set('layers', '1');
    params.set('lightbox', '1');
  }
  return (
    <div className="flex h-full min-h-0 flex-col">
      {editing && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-card px-5 py-3">
          <div className="min-w-0">
            <p className="truncate font-semibold">{title}</p>
            <p className="text-xs text-muted-foreground">
              {saving
                ? 'Salvando…'
                : dirty
                  ? 'Alterações não salvas'
                  : confirmation || 'Editor draw.io'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={!ready || saving}
              onClick={() => requestExport('download')}
            >
              <Download className="size-4" />
              Baixar cópia
            </Button>
            <Button
              size="sm"
              disabled={!ready || saving || !dirty}
              onClick={() => requestExport('save')}
            >
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              Salvar alterações
            </Button>
            <Button
              aria-label="Fechar editor"
              variant="ghost"
              size="icon"
              disabled={saving}
              onClick={() => {
                if (!dirty || window.confirm('Descartar as alterações não salvas desta topologia?'))
                  callbacks.current.onClose?.();
              }}
            >
              <X className="size-5" />
            </Button>
          </div>
        </div>
      )}
      {error && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-2 border-b border-danger/20 bg-danger/10 p-3 text-sm text-danger"
        >
          <span>{error}</span>
          {!ready && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                loaded.current = false;
                setReady(false);
                setError('');
                setAttempt((n) => n + 1);
              }}
            >
              Tentar novamente
            </Button>
          )}
        </div>
      )}
      {confirmation && (
        <span role="status" className="sr-only">
          {confirmation}
        </span>
      )}
      <div className="relative min-h-0 flex-1 bg-white">
        {!ready && !error && (
          <div
            role="status"
            className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center gap-2 bg-white text-sm text-slate-600"
          >
            <Loader2 className="size-5 animate-spin" />
            Carregando draw.io…
          </div>
        )}
        <iframe
          key={attempt}
          ref={frame}
          title={editing ? `Editar topologia — ${title}` : `Topologia — ${title}`}
          src={`/drawio/index.html?${params}`}
          className="h-full w-full border-0"
          sandbox="allow-scripts allow-same-origin allow-forms allow-downloads allow-popups"
          referrerPolicy="no-referrer"
        />
      </div>
    </div>
  );
}
