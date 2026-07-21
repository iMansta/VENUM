import { useState } from 'react';
import { Copy, KeyRound, RefreshCw, CheckCircle2 } from 'lucide-react';
import { generateCelestePairingToken } from '@/lib/supabase/celestePairing';

const AnacondaPairingPanel = () => {
  const [loading, setLoading] = useState(false);
  const [token, setToken] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const handleGenerate = async () => {
    setLoading(true);
    setError('');
    setCopied(false);
    const result = await generateCelestePairingToken();
    if (!result.success) {
      setError(result.error || 'Falha ao gerar token');
      setToken('');
      setExpiresAt('');
    } else {
      setToken(result.token);
      setExpiresAt(result.expiresAt || '');
    }
    setLoading(false);
  };

  const handleCopy = async () => {
    if (!token) return;
    try {
      await navigator.clipboard.writeText(token);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Não foi possível copiar — selecione o token manualmente');
    }
  };

  return (
    <div className="bg-slate-900/60 border border-emerald-800/40 rounded-xl p-5 space-y-4">
      <div className="flex items-start gap-3">
        <KeyRound className="w-5 h-5 text-emerald-400 mt-0.5 flex-shrink-0" />
        <div>
          <h3 className="text-white font-semibold">Vincular Anaconda à sua conta</h3>
          <p className="text-sm text-gray-400 mt-1">
            Gere um token curto e cole no menu da bandeja da Anaconda (
            <strong className="text-gray-300">Vincular conta VENUM</strong>
            ). Isso grava seu <code className="text-emerald-300">profile_id</code> localmente e
            evita perder progresso de missões individuais por falha de nome.
          </p>
        </div>
      </div>

      <ol className="text-sm text-gray-300 space-y-1 list-decimal list-inside">
        <li>Gere o token abaixo (válido por ~15 minutos, uso único)</li>
        <li>Clique com o botão direito no ícone da Anaconda na bandeja do Windows</li>
        <li>Escolha <strong className="text-white">Vincular conta VENUM</strong> e cole o token</li>
      </ol>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={handleGenerate}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium disabled:opacity-60"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Gerando…' : 'Gerar token de pareamento'}
        </button>
        {token && (
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-gray-200 text-sm border border-slate-700"
          >
            {copied ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            {copied ? 'Copiado!' : 'Copiar token'}
          </button>
        )}
      </div>

      {token && (
        <div className="bg-slate-950 rounded-lg p-4 border border-slate-800">
          <p className="text-xs text-gray-500 mb-1">Token (uso único)</p>
          <p className="text-2xl font-mono tracking-widest text-emerald-300">{token}</p>
          {expiresAt && (
            <p className="text-xs text-gray-500 mt-2">
              Expira em {new Date(expiresAt).toLocaleString('pt-BR')}
            </p>
          )}
        </div>
      )}

      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  );
};

export default AnacondaPairingPanel;
