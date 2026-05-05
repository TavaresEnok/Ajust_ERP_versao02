'use client';
import React, { useEffect, useState } from 'react';

// ─── Star Rating Component ────────────────────────────────────────────────────
function StarRating({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const [hovered, setHovered] = useState(0);
  return (
    <div className="flex gap-2">
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          type="button"
          onMouseEnter={() => setHovered(n)}
          onMouseLeave={() => setHovered(0)}
          onClick={() => onChange(n)}
          className="text-4xl transition-transform hover:scale-125 focus:outline-none"
          aria-label={`${n} estrela${n > 1 ? 's' : ''}`}
        >
          <span className={`transition-colors ${(hovered || value) >= n ? 'text-amber-400' : 'text-slate-600'}`}>
            ★
          </span>
        </button>
      ))}
    </div>
  );
}

const LABELS: Record<number, string> = {
  1: 'Muito ruim 😞',
  2: 'Ruim 😕',
  3: 'Regular 😐',
  4: 'Bom 🙂',
  5: 'Excelente! 🎉',
};

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function CsatSurveyPage({ params }: { params: Promise<{ token: string }> }) {
  const [resolvedToken, setResolvedToken] = useState('');

  const [survey, setSurvey]   = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [score, setScore]     = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone]       = useState(false);
  const [error, setError]     = useState('');

  useEffect(() => {
    let mounted = true;
    params.then((value) => {
      if (mounted) setResolvedToken(decodeURIComponent(value?.token || ''));
    });
    return () => {
      mounted = false;
    };
  }, [params]);

  useEffect(() => {
    if (!resolvedToken) return;
    fetch(`/api/csat/${resolvedToken}`)
      .then(r => r.ok ? r.json() : Promise.reject(r))
      .then(data => setSurvey(data))
      .catch(() => setError('Pesquisa não encontrada ou link inválido.'))
      .finally(() => setLoading(false));
  }, [resolvedToken]);

  const submit = async () => {
    if (score === 0) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/csat/${resolvedToken}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ score, comment }),
      });
      if (res.ok) setDone(true);
      else setError('Erro ao enviar. Tente novamente.');
    } finally { setSubmitting(false); }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo / Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center shadow-lg">
              <span className="text-white font-black text-lg">A</span>
            </div>
            <span className="text-white font-bold text-xl tracking-tight">Ajust ERP</span>
          </div>
          <p className="text-slate-400 text-sm">Pesquisa de Satisfação</p>
        </div>

        <div className="bg-slate-800/60 backdrop-blur-sm rounded-2xl border border-slate-700/50 p-8 shadow-2xl">
          {loading && (
            <div className="text-center py-8">
              <div className="inline-block w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full animate-spin mb-4" />
              <p className="text-slate-400 text-sm">Carregando pesquisa...</p>
            </div>
          )}

          {!loading && error && (
            <div className="text-center py-8">
              <div className="text-4xl mb-4">🔗</div>
              <p className="text-rose-400 font-semibold">{error}</p>
              <p className="text-slate-500 text-sm mt-2">Este link pode ter expirado ou já ter sido respondido.</p>
            </div>
          )}

          {!loading && !error && survey?.answered && !done && (
            <div className="text-center py-8">
              <div className="text-5xl mb-4">✅</div>
              <p className="text-white font-bold text-lg">Pesquisa já respondida!</p>
              <p className="text-slate-400 text-sm mt-2">Obrigado pelo seu feedback.</p>
            </div>
          )}

          {!loading && !error && done && (
            <div className="text-center py-8">
              <div className="text-6xl mb-4 animate-bounce">🎉</div>
              <p className="text-white font-bold text-xl">Obrigado pelo feedback!</p>
              <p className="text-slate-400 text-sm mt-2">Sua avaliação nos ajuda a melhorar continuamente.</p>
              <div className="mt-6 inline-flex items-center gap-2 text-amber-400 text-2xl">
                {Array.from({ length: score }).map((_, i) => <span key={i}>★</span>)}
              </div>
              {comment && (
                <p className="text-slate-300 text-sm mt-4 italic">&quot;{comment}&quot;</p>
              )}
            </div>
          )}

          {!loading && !error && !survey?.answered && !done && survey && (
            <div className="space-y-6">
              {/* OS Info */}
              {survey.order && (
                <div className="bg-slate-700/40 rounded-xl p-4 border border-slate-600/30">
                  <p className="text-[10px] uppercase tracking-widest font-bold text-slate-500 mb-1">Ordem de Serviço</p>
                  <p className="text-white font-bold text-lg"># {survey.order.protocol}</p>
                  {survey.order.type && (
                    <p className="text-slate-400 text-sm mt-0.5">{survey.order.type}</p>
                  )}
                </div>
              )}

              <div>
                <p className="text-white font-semibold text-lg mb-1">Como avalia nosso atendimento?</p>
                <p className="text-slate-400 text-sm">Clique nas estrelas para avaliar de 1 a 5</p>
              </div>

              <div className="flex flex-col items-center gap-3 py-2">
                <StarRating value={score} onChange={setScore} />
                {score > 0 && (
                  <span className="text-amber-400 font-semibold text-sm animate-fade-in">
                    {LABELS[score]}
                  </span>
                )}
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 block">
                  Comentário <span className="text-slate-600 font-normal normal-case">(opcional)</span>
                </label>
                <textarea
                  value={comment}
                  onChange={e => setComment(e.target.value)}
                  rows={3}
                  placeholder="Descreva sua experiência..."
                  className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600/50 rounded-xl text-white text-sm placeholder-slate-500 resize-none focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>

              <button
                onClick={submit}
                disabled={score === 0 || submitting}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700 text-white font-bold text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-lg hover:shadow-blue-500/20"
              >
                {submitting ? 'Enviando...' : 'Enviar Avaliação'}
              </button>

              {error && <p className="text-rose-400 text-sm text-center">{error}</p>}
            </div>
          )}
        </div>

        <p className="text-center text-slate-600 text-xs mt-6">
          Powered by <span className="text-slate-500 font-semibold">Ajust ERP</span>
        </p>
      </div>
    </div>
  );
}
