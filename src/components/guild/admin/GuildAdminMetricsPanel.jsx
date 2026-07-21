import { useState } from 'react';
import { CheckCircle2, Copy, KeyRound, RefreshCw, Save, ShieldAlert } from 'lucide-react';
import { generateGuildAdminPairingToken, submitGuildAdminMetrics } from '@/lib/supabase/guildAdmin';
import CelesteDownload from '@/components/common/CelesteDownload';

const formatExpiry = (value) => {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString('pt-BR');
};

const parseInputNumber = (value) => {
  const clean = String(value || '').replace(/\./g, '').replace(/,/g, '').trim();
  if (!clean) return null;
  const n = Number(clean);
  return Number.isFinite(n) && n >= 0 ? n : null;
};

const GuildAdminMetricsPanel = () => {
  const [silverAmount, setSilverAmount] = useState('');
  const [seasonPoints, setSeasonPoints] = useState('');
  const [memberCount, setMemberCount] = useState('');
  const [note, setNote] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitSuccess, setSubmitSuccess] = useState('');

  const [tokenLoading, setTokenLoading] = useState(false);
  const [tokenData, setTokenData] = useState(null);
  const [tokenError, setTokenError] = useState('');
  const [copied, setCopied] = useState(false);
  const [showAnaconda, setShowAnaconda] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setSubmitError('');
    setSubmitSuccess('');

    const result = await submitGuildAdminMetrics({
      silverAmount: parseInputNumber(silverAmount),
      seasonPoints: parseInputNumber(seasonPoints),
      memberCount: parseInputNumber(memberCount),
      note: note.trim(),
    });

    if (!result.success) {
      setSubmitError(result.error || 'Não foi possível salvar as métricas');
    } else {
      setSubmitSuccess(
        `Métricas salvas${result.data?.submittedBy ? ` por ${result.data.submittedBy}` : ''}. ` +
          'Atualize a página Guilda para ver os novos valores.'
      );
    }
    setSubmitting(false);
  };

  const handleGenerate = async () => {
    setTokenLoading(true);
    setTokenError('');
    setCopied(false);
    const result = await generateGuildAdminPairingToken();
    if (!result.success) {
      setTokenError(result.error || 'Não foi possível gerar o token');
      setTokenData(null);
    } else {
      setTokenData(result.data);
    }
    setTokenLoading(false);
  };

  const handleCopy = async () => {
    if (!tokenData?.token) return;
    try {
      await navigator.clipboard.writeText(tokenData.token);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setTokenError('Não foi possível copiar o token automaticamente');
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-br from-emerald-950/30 to-slate-900 border border-emerald-700/40 rounded-xl p-6">
        <div className="flex items-start gap-3 mb-4">
          <Save className="w-6 h-6 text-emerald-400 shrink-0 mt-0.5" />
          <div>
            <h3 className="text-lg font-bold text-white">Atualizar métricas da guilda</h3>
            <p className="text-sm text-emerald-100/80 mt-1">
              Forma recomendada: abra a tela da guilda no Albion, confira os valores e envie
              diretamente aqui. Não precisa de Anaconda Admin nem token.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid sm:grid-cols-3 gap-4">
            <div>
              <label htmlFor="silverAmount" className="text-xs text-gray-400 block mb-1">
                Prata da guilda
              </label>
              <input
                id="silverAmount"
                type="text"
                inputMode="numeric"
                placeholder="Ex: 125000000"
                value={silverAmount}
                onChange={(e) => setSilverAmount(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white"
              />
            </div>
            <div>
              <label htmlFor="seasonPoints" className="text-xs text-gray-400 block mb-1">
                Pontos de temporada
              </label>
              <input
                id="seasonPoints"
                type="text"
                inputMode="numeric"
                placeholder="Ex: 84250"
                value={seasonPoints}
                onChange={(e) => setSeasonPoints(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white"
              />
            </div>
            <div>
              <label htmlFor="memberCount" className="text-xs text-gray-400 block mb-1">
                Membros (opcional)
              </label>
              <input
                id="memberCount"
                type="text"
                inputMode="numeric"
                placeholder="Ex: 87"
                value={memberCount}
                onChange={(e) => setMemberCount(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white"
              />
            </div>
          </div>

          <div>
            <label htmlFor="adminNote" className="text-xs text-gray-400 block mb-1">
              Observação (opcional)
            </label>
            <input
              id="adminNote"
              type="text"
              placeholder="Ex: conferido na tela da guilda às 21:30"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white"
            />
          </div>

          <p className="text-xs text-gray-500">
            Preencha ao menos um campo numérico. Campos vazios mantêm o último valor conhecido no hub.
          </p>

          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold disabled:opacity-60"
          >
            {submitting ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <CheckCircle2 className="w-4 h-4" />
            )}
            Confirmar e salvar no hub
          </button>
        </form>

        {submitError && <p className="text-sm text-red-400 mt-4">{submitError}</p>}
        {submitSuccess && <p className="text-sm text-emerald-400 mt-4">{submitSuccess}</p>}
      </div>

      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
        <button
          type="button"
          onClick={() => setShowAnaconda((v) => !v)}
          className="text-sm text-gray-300 hover:text-white"
        >
          {showAnaconda ? '▼' : '▶'} Alternativa: enviar via Anaconda Admin (opcional)
        </button>

        {showAnaconda && (
          <div className="mt-4 space-y-4">
            <div className="bg-gradient-to-br from-amber-950/30 to-slate-900 border border-amber-700/40 rounded-xl p-5">
              <div className="flex items-start gap-3 mb-3">
                <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <p className="text-sm text-amber-100/80">
                  Use só se preferir enviar pelo cliente desktop. Gere um token, cole na Anaconda
                  Admin (menu da bandeja) e envie pelo formulário local.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={handleGenerate}
                  disabled={tokenLoading}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-slate-950 font-semibold disabled:opacity-60"
                >
                  {tokenLoading ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <KeyRound className="w-4 h-4" />
                  )}
                  Gerar token de pareamento
                </button>
                {tokenData?.token && (
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700"
                  >
                    <Copy className="w-4 h-4" />
                    {copied ? 'Copiado' : 'Copiar token'}
                  </button>
                )}
              </div>

              {tokenError && <p className="text-sm text-red-400 mt-3">{tokenError}</p>}

              {tokenData?.token && (
                <div className="mt-4 rounded-lg border border-amber-700/40 bg-slate-950/70 p-4">
                  <p className="text-xs text-gray-400 mb-2">Token ativo</p>
                  <p className="text-2xl font-mono tracking-[0.35em] text-amber-300">{tokenData.token}</p>
                  <p className="text-xs text-gray-500 mt-3">
                    Expira em {formatExpiry(tokenData.expiresAt)} · válido por {tokenData.ttlMinutes} min
                    {tokenData.issuedBy ? ` · emitido por ${tokenData.issuedBy}` : ''}
                  </p>
                </div>
              )}
            </div>

            <CelesteDownload variant="admin" />
          </div>
        )}
      </div>
    </div>
  );
};

export default GuildAdminMetricsPanel;
