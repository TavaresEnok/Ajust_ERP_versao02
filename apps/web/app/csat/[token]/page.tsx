'use client';

import Image from 'next/image';
import { useParams } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';

type Survey = {
  answered: boolean;
  order: {
    protocol: string;
    type: string;
  };
};

const labels = ['Muito ruim', 'Ruim', 'Regular', 'Bom', 'Excelente'];

export default function CsatPage() {
  const params = useParams<{ token: string }>();
  const token = params.token;
  const [survey, setSurvey] = useState<Survey | null>(null);
  const [score, setScore] = useState(0);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      try {
        const response = await fetch(`/api/csat/${encodeURIComponent(token)}`, {
          cache: 'no-store',
          signal: controller.signal,
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.message || 'Pesquisa não encontrada.');
        setSurvey(payload as Survey);
      } catch (loadError) {
        if (!controller.signal.aborted) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : 'Não foi possível carregar a pesquisa.',
          );
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };

    void load();
    return () => controller.abort();
  }, [token]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (score < 1) {
      setError('Selecione uma nota antes de enviar.');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      const response = await fetch(`/api/csat/${encodeURIComponent(token)}/answer`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ score, comment: comment.trim() || undefined }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(payload.message || 'Não foi possível enviar sua avaliação.');
      setSubmitted(true);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'Não foi possível enviar sua avaliação.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const completed = submitted || survey?.answered;

  return (
    <main className="min-h-screen bg-[#0a0f1c] text-white px-4 py-10 flex items-center justify-center">
      <section className="w-full max-w-xl rounded-2xl border border-slate-800 bg-[#111b2e] p-6 sm:p-8 shadow-2xl">
        <div className="flex justify-center mb-6">
          <Image
            src="/Ajust.png"
            alt="Ajust ERP"
            width={72}
            height={72}
            className="rounded-2xl opacity-90"
            priority
          />
        </div>

        {loading ? (
          <p className="text-center text-slate-400">Carregando pesquisa...</p>
        ) : completed ? (
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-3">Obrigado pela sua avaliação</h1>
            <p className="text-slate-400">Sua resposta foi registrada com sucesso.</p>
          </div>
        ) : survey ? (
          <form onSubmit={submit}>
            <h1 className="text-2xl font-bold text-center mb-2">Como foi seu atendimento?</h1>
            <p className="text-sm text-slate-400 text-center mb-8">
              O.S. {survey.order.protocol} · {survey.order.type.replaceAll('_', ' ')}
            </p>

            <div className="grid grid-cols-5 gap-2 mb-3" role="radiogroup" aria-label="Nota">
              {labels.map((label, index) => {
                const value = index + 1;
                const selected = score === value;
                return (
                  <button
                    key={label}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    aria-label={`${value} - ${label}`}
                    onClick={() => setScore(value)}
                    className={`rounded-xl border py-3 text-lg font-bold transition-colors ${
                      selected
                        ? 'border-cyan-400 bg-cyan-500 text-slate-950'
                        : 'border-slate-700 bg-[#0d1628] text-slate-300 hover:border-cyan-600'
                    }`}
                  >
                    {value}
                  </button>
                );
              })}
            </div>
            <p className="h-5 text-center text-xs text-cyan-300 mb-5">
              {score ? labels[score - 1] : 'Selecione uma nota de 1 a 5'}
            </p>

            <label className="block text-sm font-medium text-slate-300 mb-2" htmlFor="comment">
              Comentário opcional
            </label>
            <textarea
              id="comment"
              value={comment}
              maxLength={4000}
              onChange={(event) => setComment(event.target.value)}
              className="w-full min-h-28 resize-y rounded-lg border border-slate-700 bg-[#0d1628] p-3 text-white focus:outline-none focus:border-cyan-500"
              placeholder="Conte-nos o que podemos melhorar."
            />

            {error && (
              <div className="mt-4 rounded-lg border border-rose-500/20 bg-rose-500/10 p-3 text-sm text-rose-400">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="mt-6 w-full rounded-lg bg-cyan-600 px-4 py-3 font-bold text-white transition-colors hover:bg-cyan-500 disabled:opacity-50"
            >
              {submitting ? 'Enviando...' : 'Enviar avaliação'}
            </button>
          </form>
        ) : (
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-3">Pesquisa indisponível</h1>
            <p className="text-slate-400">{error || 'Este link não é válido.'}</p>
          </div>
        )}
      </section>
    </main>
  );
}
