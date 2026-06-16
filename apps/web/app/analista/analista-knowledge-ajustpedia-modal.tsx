'use client';

import { X } from 'lucide-react';

const cn = (...classes: Array<string | false | null | undefined>) =>
  classes.filter(Boolean).join(' ');

type AjustpediaModalProps = {
  dark: boolean;
  open: boolean;
  editing: boolean;
  title: string;
  tags: string;
  description: string;
  command: string;
  onClose: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onTitleChange: (value: string) => void;
  onTagsChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onCommandChange: (value: string) => void;
};

export function AnalystKnowledgeAjustpediaModal({
  dark,
  open,
  editing,
  title,
  tags,
  description,
  command,
  onClose,
  onSubmit,
  onTitleChange,
  onTagsChange,
  onDescriptionChange,
  onCommandChange,
}: AjustpediaModalProps) {
  if (!open) return null;

  const tModalBg = dark ? 'bg-[#111827]' : 'bg-bg-surface';
  const tModalBorder = dark ? 'border-slate-700/50' : 'border-[rgba(0,0,0,0.06)]';
  const tTextPrimary = dark ? 'text-slate-100' : 'text-content-primary';
  const tTextSecondary = dark ? 'text-slate-400' : 'text-content-secondary';
  const tTextTertiary = dark ? 'text-slate-500' : 'text-content-tertiary';
  const tInput = dark
    ? 'border border-slate-700/50 bg-[#0f172a] text-slate-100 focus:outline-none focus:border-blue-500'
    : 'border border-[rgba(0,0,0,0.08)] bg-bg-subtle focus:outline-none focus:border-accent-DEFAULT focus:ring-1 focus:ring-accent-DEFAULT';
  const tCodeInput = dark
    ? 'bg-[#09090b] text-[rgba(255,255,255,0.85)] focus:outline-none focus:ring-2 focus:ring-blue-500'
    : 'bg-[#09090b] text-[rgba(255,255,255,0.85)] focus:outline-none focus:ring-2 focus:ring-accent-DEFAULT';
  const tCancelBtn = dark
    ? 'border border-slate-700/50 text-slate-300 bg-[#111827] hover:bg-[#1f2937]'
    : 'border border-[rgba(0,0,0,0.08)] text-content-secondary bg-bg-surface hover:bg-bg-hover';
  const tSaveBtn = dark
    ? 'bg-blue-600 hover:bg-blue-700'
    : 'bg-accent-DEFAULT hover:bg-accent-hover';

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
      <div
        className={cn(
          'w-full max-w-3xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh]',
          tModalBg,
          tModalBorder,
        )}
      >
        {/* Header */}
        <div className={cn('flex items-center justify-between p-5 border-b', tModalBorder)}>
          <h3 className={cn('text-base font-semibold', tTextPrimary)}>
            {editing ? 'Editar dica da Ajustpedia' : 'Nova dica na Ajustpedia'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className={cn(
              'p-1.5 rounded-md transition-colors',
              dark
                ? 'text-slate-400 hover:text-slate-100 hover:bg-white/5'
                : 'text-content-tertiary hover:text-content-primary hover:bg-bg-hover',
            )}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={onSubmit} className="contents">
          <div className="p-6 overflow-y-auto flex flex-col gap-5">
            <div>
              <label className={cn('block text-sm font-medium mb-1.5', tTextPrimary)}>Título</label>
              <input
                type="text"
                value={title}
                onChange={(e) => onTitleChange(e.target.value)}
                placeholder="Ex: Ver sinal SW Huawei"
                className={cn('w-full rounded-lg px-3 py-2.5 text-sm', tInput)}
              />
            </div>

            <div>
              <label className={cn('block text-sm font-medium mb-1.5', tTextPrimary)}>
                Tags (separadas por vírgula)
              </label>
              <input
                type="text"
                value={tags}
                onChange={(e) => onTagsChange(e.target.value)}
                placeholder="Ex: huawei, ver-sinal"
                className={cn('w-full rounded-lg px-3 py-2.5 text-sm', tInput)}
              />
            </div>

            <div>
              <label className={cn('block text-sm font-medium mb-1.5', tTextPrimary)}>
                Descrição
              </label>
              <textarea
                value={description}
                onChange={(e) => onDescriptionChange(e.target.value)}
                placeholder="Contexto da dica..."
                className={cn(
                  'w-full resize-y min-h-[80px] rounded-lg px-3 py-2.5 text-sm',
                  tInput,
                )}
              />
            </div>

            <div>
              <label className={cn('block text-sm font-medium mb-1.5', tTextPrimary)}>Código</label>
              <textarea
                value={command}
                onChange={(e) => onCommandChange(e.target.value)}
                placeholder="Insira o código/comando aqui..."
                spellCheck={false}
                className={cn(
                  'w-full rounded-lg px-4 py-3 text-sm font-mono resize-y min-h-[140px]',
                  tCodeInput,
                )}
              />
            </div>
          </div>

          {/* Footer */}
          <div
            className={cn(
              'p-5 border-t flex items-center justify-between rounded-b-2xl',
              tModalBorder,
              dark ? 'bg-[#111827]' : 'bg-bg-subtle/30',
            )}
          >
            <p className={cn('text-xs', tTextTertiary)}>
              Padrão Ajustpedia: cada dica deve cobrir apenas um procedimento.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className={cn(
                  'px-4 py-2 rounded-lg text-sm font-medium transition-all active:scale-95',
                  tCancelBtn,
                )}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className={cn(
                  'px-4 py-2 rounded-lg text-sm font-medium transition-all active:scale-95 text-white',
                  tSaveBtn,
                )}
              >
                {editing ? 'Salvar alterações' : 'Salvar'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
