'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Download, Mic, Paperclip, Square, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useErp, useErpAction, useErpQuery } from '@/lib/erp/gateway';
import { errorMessage } from '@/lib/erp/contracts';
import { PageHeading } from './primitives';
import { QueryState } from './contract-form';
type Order = { id: string; protocol: string; title: string };
type ReportAttachment = {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  uploadedAt: string;
};
type Report = {
  id: string;
  authorUserId: string;
  authorName: string;
  shift: string;
  referenceDate: string;
  content: string;
  orderIds: string[];
  linkedOrders?: Order[];
  attachments?: ReportAttachment[];
  _count?: { attachments: number };
  version: number;
  revisions: { version: number; content: string; referenceDate: string }[];
};
const ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024;
const ATTACHMENT_MAX_COUNT = 20;
function formatFileSize(bytes: number) {
  return bytes >= 1024 * 1024
    ? `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function PendingAudio({ file }: { file: File }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  useEffect(() => {
    const url = URL.createObjectURL(file);
    const audio = audioRef.current;
    if (audio) audio.src = url;
    return () => {
      if (audio) {
        audio.pause();
        audio.removeAttribute('src');
        audio.load();
      }
      URL.revokeObjectURL(url);
    };
  }, [file]);
  return (
    <audio
      ref={audioRef}
      controls
      preload="metadata"
      aria-label={`Ouvir ${file.name} antes de salvar`}
      className="mt-3 h-9 w-full"
    />
  );
}

export function ShiftReportsPage() {
  const { scope, transport } = useErp(),
    action = useErpAction();
  const [mine, setMine] = useState(false),
    [author, setAuthor] = useState(''),
    [shift, setShift] = useState(''),
    [from, setFrom] = useState(''),
    [to, setTo] = useState(''),
    [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Report | null>(null),
    [editing, setEditing] = useState(false),
    [dirty, setDirty] = useState(false),
    [error, setError] = useState('');
  const [content, setContent] = useState(''),
    [date, setDate] = useState(''),
    [turn, setTurn] = useState('DAY'),
    [ids, setIds] = useState<string[]>([]),
    [search, setSearch] = useState(''),
    [lookup, setLookup] = useState('');
  const [known, setKnown] = useState<Record<string, Order>>({});
  const [queuedFiles, setQueuedFiles] = useState<File[]>([]);
  const [recording, setRecording] = useState(false);
  const [startingRecording, setStartingRecording] = useState(false);
  const [finishingRecording, setFinishingRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [audioSources, setAudioSources] = useState<Record<string, string>>({});
  const [audioLoading, setAudioLoading] = useState('');
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recordingSessionRef = useRef(0);
  const recordingRequestRef = useRef(false);
  const attachmentInputRef = useRef<HTMLInputElement>(null);
  const audioSourcesRef = useRef<Record<string, string>>({});
  const recordingBusy = recording || startingRecording || finishingRecording;
  const query = useErpQuery<Report[]>(
    `/shift-reports?mine=${mine}&offset=${page * 50}${author && !mine ? '&author=' + author : ''}${shift ? '&shift=' + shift : ''}${from ? '&from=' + from : ''}${to ? '&to=' + to : ''}`,
  );
  const authors =
    useErpQuery<{ authorUserId: string; authorName: string }[]>('/shift-reports/authors');
  const matches = useErpQuery<Order[]>(
    editing && lookup ? `/shift-reports/order-search?q=${encodeURIComponent(lookup)}` : null,
  );
  const leave = () =>
    (!dirty && queuedFiles.length === 0 && !recordingBusy) ||
    window.confirm('Descartar alterações ou anexos ainda não enviados?');
  useEffect(() => {
    if (!dirty && queuedFiles.length === 0 && !recordingBusy) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty, queuedFiles.length, recordingBusy]);
  useEffect(() => {
    if (!recording) return;
    const timer = window.setInterval(() => setRecordingSeconds((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [recording]);
  useEffect(
    () => () => {
      recordingSessionRef.current++;
      const recorder = recorderRef.current;
      if (recorder && recorder.state !== 'inactive') {
        recorder.onstop = null;
        recorder.stop();
      }
      streamRef.current?.getTracks().forEach((track) => track.stop());
      Object.values(audioSourcesRef.current).forEach((url) => URL.revokeObjectURL(url));
    },
    [],
  );
  useEffect(() => {
    audioSourcesRef.current = audioSources;
  }, [audioSources]);
  function clearAudioSources() {
    Object.values(audioSources).forEach((url) => URL.revokeObjectURL(url));
    setAudioSources({});
  }
  async function startRecording() {
    if (recordingRequestRef.current || recorderRef.current) return;
    setError('');
    if ((selected?.attachments?.length || 0) + queuedFiles.length >= ATTACHMENT_MAX_COUNT) {
      setError(`O relatório aceita no máximo ${ATTACHMENT_MAX_COUNT} anexos.`);
      return;
    }
    if (!window.isSecureContext) {
      setError(
        'A gravação pelo microfone exige HTTPS. Você ainda pode anexar um áudio já gravado.',
      );
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setError('Este navegador não oferece gravação de áudio. Anexe um arquivo de áudio.');
      return;
    }
    let acquiredStream: MediaStream | null = null;
    const session = ++recordingSessionRef.current;
    recordingRequestRef.current = true;
    setStartingRecording(true);
    try {
      acquiredStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const stream = acquiredStream;
      if (session !== recordingSessionRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      const mimeType = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/ogg;codecs=opus',
        'audio/mp4',
      ].find((type) => MediaRecorder.isTypeSupported(type));
      const recorder = new MediaRecorder(stream, {
        ...(mimeType ? { mimeType } : {}),
        audioBitsPerSecond: 64000,
      });
      const chunks: Blob[] = [];
      let size = 0;
      let failed = false;
      streamRef.current = stream;
      recorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
          size += event.data.size;
          if (size > ATTACHMENT_MAX_BYTES && recorder.state !== 'inactive') {
            setFinishingRecording(true);
            recorder.stop();
          }
        }
      };
      recorder.onerror = () => {
        failed = true;
        setError('A gravação foi interrompida. Confira o microfone e tente novamente.');
        if (recorder.state !== 'inactive') recorder.stop();
        stream.getTracks().forEach((track) => track.stop());
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        if (session !== recordingSessionRef.current) return;
        const type = (recorder.mimeType || mimeType || chunks[0]?.type || 'audio/webm')
          .split(';')[0]
          .toLowerCase();
        const blob = new Blob(chunks, { type });
        if (streamRef.current === stream) streamRef.current = null;
        recorderRef.current = null;
        setRecording(false);
        setFinishingRecording(false);
        setRecordingSeconds(0);
        if (failed) return;
        if (!blob.size) {
          setError('Nenhum áudio foi capturado. Confira o microfone e tente novamente.');
          return;
        }
        if (blob.size > ATTACHMENT_MAX_BYTES) {
          setError('O áudio excedeu 10 MB e não foi anexado. Grave um trecho menor.');
          return;
        }
        if ((selected?.attachments?.length || 0) + queuedFiles.length >= ATTACHMENT_MAX_COUNT) {
          setError(`O relatório aceita no máximo ${ATTACHMENT_MAX_COUNT} anexos.`);
          return;
        }
        const extension = type.includes('ogg') ? 'ogg' : type.includes('mp4') ? 'm4a' : 'webm';
        const file = new File(
          [blob],
          `audio-relatorio-${date || 'turno'}-${new Date().toISOString().replace(/[:.]/g, '-')}.${extension}`,
          { type },
        );
        setQueuedFiles((current) => [...current, file]);
        setError('');
      };
      recorder.start(1000);
      stream.getAudioTracks().forEach((track) => {
        track.onended = () => {
          if (recorder.state !== 'inactive') recorder.stop();
        };
      });
      setRecordingSeconds(0);
      setRecording(true);
    } catch (reason) {
      acquiredStream?.getTracks().forEach((track) => track.stop());
      if (session !== recordingSessionRef.current) return;
      streamRef.current = null;
      recorderRef.current = null;
      const name = reason instanceof DOMException ? reason.name : '';
      setError(
        name === 'NotAllowedError'
          ? 'Acesso ao microfone negado. Libere a permissão do navegador e tente novamente.'
          : name === 'NotReadableError'
            ? 'Não foi possível usar o microfone. Confira o dispositivo ou se outro aplicativo está usando-o.'
            : name === 'NotFoundError'
              ? 'Nenhum microfone foi encontrado neste dispositivo.'
              : 'Não foi possível iniciar a gravação. Confira a permissão do microfone.',
      );
    } finally {
      if (session === recordingSessionRef.current) {
        recordingRequestRef.current = false;
        setStartingRecording(false);
      }
    }
  }
  function stopRecording() {
    if (recorderRef.current?.state === 'recording') {
      setFinishingRecording(true);
      recorderRef.current.stop();
    }
  }
  function discardRecording() {
    recordingSessionRef.current++;
    recordingRequestRef.current = false;
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.onstop = null;
      recorder.stop();
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    recorderRef.current = null;
    setRecording(false);
    setStartingRecording(false);
    setFinishingRecording(false);
    setRecordingSeconds(0);
  }
  function queueAttachments(files: FileList | null) {
    const incoming = Array.from(files || []);
    const currentCount = (selected?.attachments?.length || 0) + queuedFiles.length;
    if (currentCount + incoming.length > ATTACHMENT_MAX_COUNT) {
      setError(`O relatório aceita no máximo ${ATTACHMENT_MAX_COUNT} anexos.`);
      return;
    }
    if (incoming.some((file) => file.size > ATTACHMENT_MAX_BYTES)) {
      setError('Cada anexo deve ter até 10 MB.');
      return;
    }
    setQueuedFiles((current) => [...current, ...incoming]);
    setError('');
  }
  async function uploadAttachments(reportId: string, files: File[]) {
    if (!files.length) return [];
    const body = new FormData();
    files.forEach((file) => body.append('files', file));
    return action.execute<ReportAttachment[]>({
      path: `/shift-reports/${reportId}/attachments`,
      method: 'POST',
      body,
    });
  }
  async function loadAudio(reportId: string, attachment: ReportAttachment) {
    if (!transport?.download || audioSources[attachment.id]) return;
    try {
      setAudioLoading(attachment.id);
      const blob = await transport.download(
        `/shift-reports/${reportId}/attachments/${attachment.id}/download`,
      );
      const url = URL.createObjectURL(blob);
      setAudioSources((current) => ({ ...current, [attachment.id]: url }));
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setAudioLoading('');
    }
  }
  async function downloadAttachment(reportId: string, attachment: ReportAttachment) {
    if (!transport?.download) return;
    try {
      const blob = await transport.download(
        `/shift-reports/${reportId}/attachments/${attachment.id}/download`,
      );
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = attachment.fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (reason) {
      setError(errorMessage(reason));
    }
  }
  function attachmentList(report: Report) {
    if (!report.attachments?.length) return null;
    return (
      <div className="space-y-3">
        {report.attachments.map((attachment) => (
          <div key={attachment.id} className="rounded-lg border border-border p-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2 text-xs">
                <Paperclip className="size-3.5 shrink-0 text-muted-foreground" />
                <span className="truncate">{attachment.fileName}</span>
                <span className="shrink-0 text-muted-foreground">
                  {formatFileSize(attachment.sizeBytes)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {attachment.mimeType.startsWith('audio/') && !audioSources[attachment.id] && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={audioLoading === attachment.id}
                    onClick={() => void loadAudio(report.id, attachment)}
                  >
                    {audioLoading === attachment.id ? 'Carregando…' : 'Ouvir áudio'}
                  </Button>
                )}
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  aria-label={`Baixar ${attachment.fileName}`}
                  onClick={() => void downloadAttachment(report.id, attachment)}
                >
                  <Download className="size-3.5" />
                  Baixar
                </Button>
              </div>
            </div>
            {audioSources[attachment.id] && (
              <audio
                className="mt-3 h-9 w-full"
                controls
                preload="none"
                src={audioSources[attachment.id]}
              >
                Seu navegador não consegue reproduzir este áudio.
              </audio>
            )}
          </div>
        ))}
      </div>
    );
  }
  async function open(id: string) {
    if (!leave()) return;
    discardRecording();
    clearAudioSources();
    try {
      const r = await action.execute<Report>({ path: '/shift-reports/' + id });
      setKnown((a) => ({
        ...a,
        ...Object.fromEntries((r.linkedOrders || []).map((o) => [o.id, o])),
      }));
      setSelected(r);
      setEditing(false);
      setDirty(false);
      setQueuedFiles([]);
      clearAudioSources();
      setError('');
    } catch (e) {
      setError(errorMessage(e));
    }
  }
  function edit(r: Report | null) {
    if (!leave()) return;
    discardRecording();
    clearAudioSources();
    setSelected(r);
    setContent(r?.content || '');
    setDate(
      r?.referenceDate ||
        new Intl.DateTimeFormat('en-CA', {
          timeZone: 'America/Fortaleza',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        }).format(new Date()),
    );
    setTurn(r?.shift || 'DAY');
    setIds(r?.orderIds || []);
    setEditing(true);
    setDirty(false);
    setLookup('');
    setSearch('');
    setQueuedFiles([]);
    setError('');
  }
  async function save() {
    if (recordingBusy || recordingRequestRef.current || recorderRef.current) return;
    try {
      setError('');
      const saved =
        selected && !dirty
          ? selected
          : await action.execute<Report>({
              path: '/shift-reports' + (selected ? '/' + selected.id : ''),
              method: selected ? 'PATCH' : 'POST',
              body: {
                referenceDate: date,
                shift: turn,
                content,
                orderIds: ids,
                expectedVersion: selected?.version,
              },
            });
      const current = { ...saved, attachments: selected?.attachments || saved.attachments || [] };
      setSelected(current);
      let uploaded: ReportAttachment[] = [];
      if (queuedFiles.length) {
        try {
          uploaded = await uploadAttachments(current.id, queuedFiles);
        } catch (reason) {
          setDirty(false);
          void query.mutate();
          void authors.mutate();
          setError(
            `Relatório salvo, mas os anexos não foram enviados. Clique em “Enviar anexos” para tentar novamente. ${errorMessage(reason)}`,
          );
          return;
        }
      }
      setSelected({ ...current, attachments: [...(current.attachments || []), ...uploaded] });
      setQueuedFiles([]);
      setDirty(false);
      setEditing(false);
      await query.mutate();
      await authors.mutate();
    } catch (e) {
      setError(errorMessage(e));
    }
  }
  const base = scope?.role === 'analista' ? '/analista' : '/gerencia';
  return (
    <>
      <PageHeading
        title="Relatórios de turno"
        description="Todo relatório salvo fica disponível à equipe da Ajust. Para rascunhar, use Minhas notas."
      >
        <Button onClick={() => edit(null)}>Novo relatório</Button>
      </PageHeading>
      <div className="mb-5 flex flex-wrap gap-3">
        <Button
          variant={!mine ? 'default' : 'outline'}
          onClick={() => {
            setMine(false);
            setPage(0);
          }}
        >
          Relatórios da equipe
        </Button>
        <Button
          variant={mine ? 'default' : 'outline'}
          onClick={() => {
            setMine(true);
            setPage(0);
          }}
        >
          Meus relatórios
        </Button>
        <label className="text-xs">
          Analista{' '}
          <select
            className="native-select"
            aria-label="Filtrar analista"
            disabled={mine}
            value={author}
            onChange={(e) => {
              setAuthor(e.target.value);
              setPage(0);
            }}
          >
            <option value="">Todos</option>
            {authors.data?.map((a) => (
              <option key={a.authorUserId} value={a.authorUserId}>
                {a.authorName}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs">
          Plantão{' '}
          <select
            className="native-select"
            aria-label="Filtrar plantão"
            value={shift}
            onChange={(e) => {
              setShift(e.target.value);
              setPage(0);
            }}
          >
            <option value="">Todos</option>
            <option value="DAY">Diurno</option>
            <option value="NIGHT">Noturno</option>
          </select>
        </label>
        <label className="text-xs">
          De{' '}
          <input
            type="date"
            className="native-select"
            value={from}
            onChange={(e) => {
              setFrom(e.target.value);
              setPage(0);
            }}
          />
        </label>
        <label className="text-xs">
          Até{' '}
          <input
            type="date"
            className="native-select"
            value={to}
            onChange={(e) => {
              setTo(e.target.value);
              setPage(0);
            }}
          />
        </label>
      </div>
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(390px,1fr)_minmax(0,1.2fr)]">
        <section className="panel min-w-0 overflow-hidden" aria-label="Tabela de relatórios">
          <QueryState loading={query.isLoading} error={query.error} />
          <div className="table-wrap relative">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Analista</th>
                  <th>Plantão</th>
                  <th>Anexos</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {query.data?.map((r) => (
                  <tr key={r.id} className={selected?.id === r.id ? 'bg-secondary' : ''}>
                    <td>{r.referenceDate.split('-').reverse().join('/')}</td>
                    <td>{r.authorName}</td>
                    <td>{r.shift === 'NIGHT' ? 'Noturno' : 'Diurno'}</td>
                    <td className="text-xs text-muted-foreground">
                      {r._count?.attachments
                        ? `${r._count.attachments} arquivo${r._count.attachments === 1 ? '' : 's'}`
                        : '—'}
                    </td>
                    <td>
                      <Button size="sm" variant="ghost" onClick={() => void open(r.id)}>
                        Abrir
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!query.isLoading && !query.error && !query.data?.length && (
            <p className="p-5 text-sm text-muted-foreground">Nenhum relatório neste recorte.</p>
          )}
          <div className="flex items-center justify-between gap-2 p-4">
            <Button variant="outline" disabled={!page} onClick={() => setPage((p) => p - 1)}>
              Anterior
            </Button>
            <span className="text-xs">Página {page + 1} · até 50 por página</span>
            <Button
              variant="outline"
              disabled={query.data?.length !== 50}
              onClick={() => setPage((p) => p + 1)}
            >
              Próxima
            </Button>
          </div>
        </section>
        <section className="panel min-w-0 space-y-5 p-5">
          {error && (
            <p role="alert" className="text-sm text-danger">
              {error} Seu texto foi mantido.
            </p>
          )}
          {editing ? (
            <>
              <h2 className="section-title">{selected ? 'Editar relatório' : 'Novo relatório'}</h2>
              <div className="flex flex-wrap gap-4">
                <label className="text-xs">
                  Data{' '}
                  <input
                    aria-label="Data do relatório"
                    type="date"
                    className="native-select"
                    value={date}
                    onChange={(e) => {
                      setDate(e.target.value);
                      setDirty(true);
                    }}
                  />
                </label>
                <label className="text-xs">
                  Plantão{' '}
                  <select
                    aria-label="Plantão do relatório"
                    className="native-select"
                    value={turn}
                    onChange={(e) => {
                      setTurn(e.target.value);
                      setDirty(true);
                    }}
                  >
                    <option value="DAY">Diurno</option>
                    <option value="NIGHT">Noturno</option>
                  </select>
                </label>
              </div>
              <textarea
                aria-label="Texto do relatório"
                maxLength={50000}
                className="min-h-[350px] w-full rounded-lg border border-border bg-card p-4 text-sm leading-7"
                value={content}
                onChange={(e) => {
                  setContent(e.target.value);
                  setDirty(true);
                }}
              />
              <p className="text-xs text-muted-foreground" aria-live="polite">
                {content.length.toLocaleString('pt-BR')} / 50.000 caracteres · Descreva o expediente
                com pelo menos 20 caracteres.
              </p>
              <div>
                <label className="mb-2 block text-xs">Vincular O.S. pelo ID ou protocolo</label>
                <div className="flex gap-2">
                  <input
                    aria-label="ID da O.S."
                    className="native-select min-w-0 flex-1"
                    placeholder="Ex.: DEMO-20261023-DNS-001 ou protocolo da O.S."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                  <Button variant="outline" onClick={() => setLookup(search.trim())}>
                    Buscar O.S.
                  </Button>
                </div>
                <QueryState loading={matches.isLoading} error={matches.error} />
                {matches.data?.map((o) => (
                  <button
                    key={o.id}
                    className="mt-2 block w-full rounded-lg border border-border p-3 text-left text-xs hover:bg-muted"
                    disabled={ids.includes(o.id)}
                    onClick={() => {
                      setIds((a) => [...a, o.id]);
                      setKnown((a) => ({ ...a, [o.id]: o }));
                      setDirty(true);
                      setLookup('');
                    }}
                  >
                    {o.protocol} · {o.title} + vincular
                  </button>
                ))}
                {lookup && matches.data?.length === 0 && (
                  <p className="text-xs py-3">Nenhuma O.S. encontrada.</p>
                )}
              </div>
              <div className="space-y-2">
                {ids.map((id) => (
                  <div key={id} className="flex items-center justify-between gap-3 text-xs">
                    <Link className="text-link" href={`${base}/ordens/${id}`}>
                      {known[id]?.protocol || id}
                    </Link>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setIds((a) => a.filter((v) => v !== id));
                        setDirty(true);
                      }}
                    >
                      Desvincular
                    </Button>
                  </div>
                ))}
              </div>
              <section className="space-y-4 rounded-lg border border-border p-4">
                <div>
                  <h3 className="text-sm font-semibold">Anexos e áudio</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Até 20 arquivos por relatório, com até 10 MB cada.
                  </p>
                </div>
                <input
                  ref={attachmentInputRef}
                  aria-label="Anexos do relatório"
                  type="file"
                  multiple
                  accept="image/*,audio/*,.pdf,.txt,.log,.csv,.json,.xml,.cfg,.conf,.sql,.doc,.docx,.xls,.xlsx,.odt,.zip"
                  className="hidden"
                  disabled={action.pending || recordingBusy}
                  onChange={(event) => {
                    queueAttachments(event.currentTarget.files);
                    event.currentTarget.value = '';
                  }}
                />
                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={action.pending || recordingBusy}
                    onClick={() => attachmentInputRef.current?.click()}
                  >
                    <Paperclip className="size-3.5" />
                    Anexo
                  </Button>
                  <Button
                    type="button"
                    variant={recording ? 'destructive' : 'outline'}
                    disabled={action.pending || startingRecording || finishingRecording}
                    onClick={() => (recording ? stopRecording() : void startRecording())}
                  >
                    {startingRecording ? (
                      'Aguardando microfone…'
                    ) : finishingRecording ? (
                      'Preparando áudio…'
                    ) : recording ? (
                      <>
                        <Square className="size-3.5 fill-current" />
                        Parar gravação
                      </>
                    ) : (
                      <>
                        <Mic className="size-3.5" />
                        Gravar áudio
                      </>
                    )}
                  </Button>
                  {recording && (
                    <span role="status" className="text-xs font-medium text-danger">
                      Gravando · {String(Math.floor(recordingSeconds / 60)).padStart(2, '0')}:
                      {String(recordingSeconds % 60).padStart(2, '0')}
                    </span>
                  )}
                  <span className="text-xs text-muted-foreground">
                    {queuedFiles.length + (selected?.attachments?.length || 0)} /{' '}
                    {ATTACHMENT_MAX_COUNT} anexos
                  </span>
                </div>
                {queuedFiles.length > 0 && (
                  <ul className="space-y-2" aria-label="Anexos aguardando envio">
                    {queuedFiles.map((file, index) => (
                      <li
                        key={`${file.name}-${file.lastModified}-${index}`}
                        className="rounded-md bg-secondary/50 px-3 py-2 text-xs"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="min-w-0 truncate">
                            {file.name} · {formatFileSize(file.size)}
                          </span>
                          <Button
                            type="button"
                            size="icon-sm"
                            variant="ghost"
                            disabled={action.pending || recordingBusy}
                            aria-label={`Remover ${file.name}`}
                            onClick={() =>
                              setQueuedFiles((current) => current.filter((_, i) => i !== index))
                            }
                          >
                            <X className="size-3.5" />
                          </Button>
                        </div>
                        {file.type.startsWith('audio/') && <PendingAudio file={file} />}
                      </li>
                    ))}
                  </ul>
                )}
                {selected && attachmentList(selected)}
              </section>
              <div className="flex gap-3">
                <Button
                  disabled={
                    action.pending ||
                    recordingBusy ||
                    !date ||
                    content.trim().length < 20 ||
                    (Boolean(selected) && !dirty && queuedFiles.length === 0)
                  }
                  onClick={() => void save()}
                >
                  {selected && !dirty && queuedFiles.length > 0
                    ? 'Enviar anexos'
                    : 'Salvar relatório'}
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    if (leave()) {
                      discardRecording();
                      setEditing(false);
                      setDirty(false);
                      setQueuedFiles([]);
                    }
                  }}
                >
                  Cancelar
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Ao salvar, toda a equipe pode consultar. Alterações preservam a revisão anterior.
              </p>
            </>
          ) : selected ? (
            <>
              <div className="flex flex-wrap justify-between gap-3">
                <div>
                  <h2 className="section-title">{selected.authorName}</h2>
                  <p className="mt-2 text-xs">
                    {selected.referenceDate.split('-').reverse().join('/')} ·{' '}
                    {selected.shift === 'NIGHT' ? 'Noturno' : 'Diurno'} · v{selected.version}
                  </p>
                </div>
                {selected.authorUserId === scope?.userId && (
                  <Button variant="outline" onClick={() => edit(selected)}>
                    Editar
                  </Button>
                )}
              </div>
              <p className="whitespace-pre-wrap text-sm leading-7">{selected.content}</p>
              <div className="space-y-2">
                {selected.orderIds.map((id) => (
                  <Link key={id} className="text-link block" href={`${base}/ordens/${id}`}>
                    O.S. {known[id]?.protocol || id} →
                  </Link>
                ))}
              </div>
              {selected.attachments?.length ? (
                <section className="space-y-3 border-t border-border pt-4">
                  <h3 className="text-sm font-semibold">
                    Anexos e áudio · {selected.attachments.length}
                  </h3>
                  {attachmentList(selected)}
                </section>
              ) : null}
              <details>
                <summary className="cursor-pointer text-sm">
                  Revisões anteriores ({selected.revisions.length})
                </summary>
                {selected.revisions.map((r) => (
                  <article key={r.version} className="mt-4 border-t border-border pt-4">
                    <p className="text-xs">
                      Versão {r.version} · {r.referenceDate}
                    </p>
                    <p className="mt-3 whitespace-pre-wrap text-sm leading-7">{r.content}</p>
                  </article>
                ))}
              </details>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Escolha um relatório na tabela ou crie um novo.
            </p>
          )}
        </section>
      </div>
    </>
  );
}
