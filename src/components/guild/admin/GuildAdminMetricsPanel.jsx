import { useState } from 'react';
import { Copy, KeyRound, RefreshCw, ShieldAlert } from 'lucide-react';
import { generateGuildAdminPairingToken } from '@/lib/supabase/guildAdmin';
import CelesteDownload from '@/components/common/CelesteDownload';

const formatExpiry = (value) => {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString('pt-BR');
};

const GuildAdminMetricsPanel = () => {
  const [loading, setLoading] = useState(false);
  const [tokenData, setTokenData] = useState(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const handleGenerate = async () => {
    setLoading(true);
    setError('');
    setCopied(false);
    const result = await generateGuildAdminPairingToken();
    if (!result.success) {
      setError(result.error || 'Não foi possível gerar o token');
      setTokenData(null);
    } else {
      setTokenData(result.data);
    }
    setLoading(false);
  };

  const handleCopy = async () => {
    if (!tokenData?.token) return;
    try {
      await navigator.clipboard.writeText(tokenData.token);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Não foi possível copiar o token automaticamente');
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-br from-amber-950/30 to-slate-900 border border-amber-700/40 rounded-xl p-6">
        <div className="flex items-start gap-3 mb-4">
          <ShieldAlert className="w-6 h-6 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <h3 className="text-lg font-bold text-white">Coleta administrativa da guilda</h3>
            <p className="text-sm text-amber-100/80 mt-1">
              Prata e pontos de temporada não vêm de forma confiável pela API pública. Use a
              Anaconda Admin para enviar um snapshot confirmado por um administrador.
            </p>
          </div>
        </div>

        <ol className="text-sm text-gray-300 space-y-2 mb-5 list-decimal list-inside">
          <li>Gere um token de pareamento abaixo.</li>
          <li>Baixe e abra a Anaconda Admin.</li>
          <li>Abra a tela da guilda no Albion e confira os valores.</li>
          <li>Cole o token no formulário local e envie o snapshot.</li>
        </ol>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleGenerate}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-slate-950 font-semibold disabled:opacity-60"
          >
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
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

        {error && <p className="text-sm text-red-400 mt-4">{error}</p>}

        {tokenData?.token && (
          <div className="mt-5 rounded-lg border border-amber-700/40 bg-slate-950/70 p-4">
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
  );
};

export default GuildAdminMetricsPanel;
