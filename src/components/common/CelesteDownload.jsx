import { Download, Sparkles, CheckCircle2, Server } from 'lucide-react';

const STEPS = [
  'Baixe e extraia o arquivo celeste.zip',
  'Execute Instalar-Celeste.bat (duplo clique)',
  'Cole URL e chave service_role do Supabase',
  'Use o atalho "Iniciar Celeste" na área de trabalho',
];

const CelesteDownload = ({ compact = false }) => {
  if (compact) {
    return (
      <a
        href="/downloads/celeste.zip"
        download="celeste.zip"
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-900/40 hover:bg-emerald-800/50 text-sm text-emerald-300 border border-emerald-700/50 w-full justify-center"
      >
        <Sparkles className="w-4 h-4" />
        Baixar Celeste
      </a>
    );
  }

  return (
    <div className="bg-gradient-to-br from-slate-900 to-emerald-950/30 border border-emerald-800/40 rounded-xl p-6 space-y-5">
      <div className="flex items-start gap-4">
        <div className="w-14 h-14 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center flex-shrink-0">
          <Sparkles className="w-7 h-7 text-emerald-400" />
        </div>
        <div>
          <h3 className="text-xl font-bold text-white">Celeste</h3>
          <p className="text-sm text-emerald-200/80 mt-1">
            A cobra do castelo — serviço que alimenta mercado, rankings e missões da guilda.
          </p>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-3 text-sm">
        {STEPS.map((step, i) => (
          <div key={step} className="flex gap-2 items-start text-gray-300">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
            <span>
              <strong className="text-white">{i + 1}.</strong> {step}
            </span>
          </div>
        ))}
      </div>

      <div className="bg-slate-950/60 rounded-lg p-4 border border-slate-800">
        <p className="text-xs text-gray-400 mb-2 flex items-center gap-2">
          <Server className="w-4 h-4" />
          Você precisa informar no instalador:
        </p>
        <ul className="text-xs text-gray-300 space-y-1 ml-6 list-disc">
          <li>
            <strong className="text-white">URL do projeto</strong> — ex: https://moglqrrmqokhuzjoigbr.supabase.co
          </li>
          <li>
            <strong className="text-white">service_role key</strong> — chave secreta (não a anon!)
          </li>
        </ul>
        <p className="text-[11px] text-amber-400/90 mt-2">
          Supabase → Project Settings → API → service_role
        </p>
      </div>

      <a
        href="/downloads/celeste.zip"
        download="celeste-venum.zip"
        className="inline-flex items-center justify-center gap-2 w-full sm:w-auto px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold shadow-lg shadow-emerald-900/40 transition-colors"
      >
        <Download className="w-5 h-5" />
        Baixar Celeste (ZIP)
      </a>

      <p className="text-[11px] text-gray-500">
        Requisito: Node.js 18+ instalado no Windows. Deixe a janela aberta — Celeste roda em loop.
      </p>
    </div>
  );
};

export default CelesteDownload;
