import { Download, Terminal, Server, Copy, Check } from 'lucide-react';
import { useState } from 'react';

const STEPS = [
  'Clone o repositório VENUM no seu PC ou VPS',
  'Copie .env.example para .env e preencha SUPABASE_URL + SERVICE_ROLE_KEY',
  'Execute: npm install && npm run setup',
  'Inicie o coletor: npm run collector (ou npm run collector:once para teste)',
];

const CollectorDownload = ({ compact = false }) => {
  const [copied, setCopied] = useState(false);

  const copyCmd = () => {
    navigator.clipboard?.writeText('npm install && npm run setup && npm run collector');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (compact) {
    return (
      <a
        href="/collector/INSTALAR-COLETOR.bat"
        download="INSTALAR-COLETOR.bat"
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-sm text-amber-400 border border-slate-700"
      >
        <Download className="w-4 h-4" />
        Coletor
      </a>
    );
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
      <div className="flex items-start gap-3">
        <Server className="w-6 h-6 text-amber-500 flex-shrink-0 mt-0.5" />
        <div>
          <h3 className="text-lg font-semibold text-white">Coletor de Dados VENUM</h3>
          <p className="text-sm text-gray-400 mt-1">
            Script em segundo plano que sincroniza preços de mercado, membros da guilda,
            fama mensal e notificações de missões.
          </p>
        </div>
      </div>

      <ol className="space-y-2 text-sm text-gray-300 list-decimal list-inside">
        {STEPS.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>

      <div className="flex flex-wrap gap-3">
        <a
          href="/collector/INSTALAR-COLETOR.bat"
          download="INSTALAR-COLETOR-VENUM.bat"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm font-semibold"
        >
          <Download className="w-4 h-4" />
          Baixar instalador (Windows)
        </a>
        <a
          href="https://github.com/iMansta/VENUM"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-sm"
        >
          Repositório GitHub
        </a>
        <button
          type="button"
          onClick={copyCmd}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-sm"
        >
          {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
          Copiar comando
        </button>
      </div>

      <div className="flex items-start gap-2 text-xs text-gray-500 bg-slate-950 rounded p-3 font-mono">
        <Terminal className="w-4 h-4 flex-shrink-0 mt-0.5" />
        <span>npm install && npm run setup && npm run collector</span>
      </div>
    </div>
  );
};

export default CollectorDownload;
