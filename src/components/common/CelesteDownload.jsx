import { Download, Sparkles, CheckCircle2, Monitor } from 'lucide-react';

const STEPS = [
  'Baixe o pacote Celeste (ZIP)',
  'Extraia e execute Instalar-Celeste.bat',
  'Abra "Iniciar Celeste" — pronto, sem chaves nem Node',
];

const CelesteDownload = ({ compact = false }) => {
  if (compact) {
    return (
      <a
        href="/downloads/celeste.zip"
        download="celeste-venum.zip"
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
            Roda em segundo plano como o Albion Data Client — ícone na bandeja, console com status.
          </p>
        </div>
      </div>

      <div className="grid sm:grid-cols-3 gap-3 text-sm">
        {STEPS.map((step, i) => (
          <div key={step} className="flex gap-2 items-start text-gray-300">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
            <span>
              <strong className="text-white">{i + 1}.</strong> {step}
            </span>
          </div>
        ))}
      </div>

      <div className="bg-slate-950/60 rounded-lg p-4 border border-slate-800 flex gap-3">
        <Monitor className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
        <div className="text-xs text-gray-300 space-y-1">
          <p>
            <strong className="text-white">Nenhuma chave</strong> — só instalar. A Celeste fala com o hub VENUM
            automaticamente.
          </p>
          <p className="text-gray-500">
            Bandeja do Windows: pausar, sincronizar agora ou sair. Inicia com o Windows após instalar.
          </p>
        </div>
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
        Windows 10/11 · executável único · sem Node.js · guilda I V E N U M I
      </p>
    </div>
  );
};

export default CelesteDownload;
