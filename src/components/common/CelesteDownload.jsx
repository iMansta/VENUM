import { Download, CheckCircle2, Monitor, ShieldAlert } from 'lucide-react';

const MEMBER_STEPS = [
  'Baixe o instalador Anaconda-Setup.exe',
  'Siga o assistente e clique em Concluir',
  'No painel Missões, gere um token e vincule via bandeja (Vincular conta VENUM)',
  'A Anaconda inicia em segundo plano e rastreia progresso automaticamente',
];

const ADMIN_STEPS = [
  'Baixe a Anaconda Admin (mesma sincronização da versão comum)',
  'Gere um token de pareamento no painel administrativo',
  'Use o menu da bandeja para enviar métricas da guilda e ver o log ao vivo',
];

const CelesteDownload = ({ compact = false, variant = 'member' }) => {
  const isAdmin = variant === 'admin';
  const title = isAdmin ? 'Anaconda Admin' : 'Anaconda';
  const description = isAdmin
    ? 'Versão completa da Anaconda (missões, preços, telemetria) com envio manual de prata, temporada e membros para administradores.'
    : 'Instalador com assistente para usuário leigo. Após instalar, roda em segundo plano como o Albion Data Client.';
  const steps = isAdmin ? ADMIN_STEPS : MEMBER_STEPS;
  const setupHref = isAdmin ? '/downloads/anaconda-admin.exe' : '/downloads/Anaconda-Setup.exe';
  const setupName = isAdmin ? 'anaconda-admin.exe' : 'Anaconda-Setup.exe';
  const zipHref = isAdmin ? '/downloads/anaconda-admin.zip' : '/downloads/anaconda.zip';
  const zipName = isAdmin ? 'anaconda-admin-venum.zip' : 'anaconda-venum.zip';

  if (compact) {
    return (
      <a
        href={setupHref}
        download={setupName}
        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm border w-full justify-center ${
          isAdmin
            ? 'bg-amber-900/40 hover:bg-amber-800/50 text-amber-200 border-amber-700/50'
            : 'bg-emerald-900/40 hover:bg-emerald-800/50 text-emerald-300 border-emerald-700/50'
        }`}
      >
        <img
          src="/assets/anaconda-icon.png"
          alt={title}
          className="w-4 h-4 rounded-full object-cover"
        />
        {isAdmin ? 'Instalar Anaconda Admin' : 'Instalar Anaconda'}
      </a>
    );
  }

  return (
    <div
      className={`bg-gradient-to-br border rounded-xl p-6 space-y-5 ${
        isAdmin
          ? 'from-slate-900 to-amber-950/30 border-amber-800/40'
          : 'from-slate-900 to-emerald-950/30 border-emerald-800/40'
      }`}
    >
      <div className="flex items-start gap-4">
        <div
          className={`w-14 h-14 rounded-xl border flex items-center justify-center flex-shrink-0 ${
            isAdmin
              ? 'bg-amber-500/20 border-amber-500/40'
              : 'bg-emerald-500/20 border-emerald-500/40'
          }`}
        >
          {isAdmin ? (
            <ShieldAlert className="w-8 h-8 text-amber-300" />
          ) : (
            <img
              src="/assets/anaconda-icon.png"
              alt={`Ícone ${title}`}
              className="w-12 h-12 rounded-lg object-cover"
            />
          )}
        </div>
        <div>
          <h3 className="text-xl font-bold text-white">{title}</h3>
          <p className={`text-sm mt-1 ${isAdmin ? 'text-amber-100/80' : 'text-emerald-200/80'}`}>
            {description}
          </p>
        </div>
      </div>

      <div className="grid sm:grid-cols-3 gap-3 text-sm">
        {steps.map((step, i) => (
          <div key={step} className="flex gap-2 items-start text-gray-300">
            <CheckCircle2
              className={`w-4 h-4 flex-shrink-0 mt-0.5 ${isAdmin ? 'text-amber-400' : 'text-emerald-500'}`}
            />
            <span>
              <strong className="text-white">{i + 1}.</strong> {step}
            </span>
          </div>
        ))}
      </div>

      <div className="bg-slate-950/60 rounded-lg p-4 border border-slate-800 flex gap-3">
        <Monitor className={`w-5 h-5 flex-shrink-0 mt-0.5 ${isAdmin ? 'text-amber-400' : 'text-emerald-400'}`} />
        <div className="text-xs text-gray-300 space-y-1">
          {isAdmin ? (
            <>
              <p>
                <strong className="text-white">Somente admin/staff</strong> — o envio exige token
                curto gerado no painel.
              </p>
              <p className="text-gray-500">
                Inclui sync automática, missões PvE, preços e um formulário local para confirmar
                prata/temporada antes de gravar no hub.
              </p>
            </>
          ) : (
            <>
              <p>
                <strong className="text-white">Vincule uma vez</strong> — gere um token no painel
                Missões e cole na bandeja. Depois disso, o progresso individual não depende de
                adivinhar o nome do personagem.
              </p>
              <p className="text-gray-500">
                Bandeja do Windows: pausar, sincronizar agora ou sair. Inicia com o Windows após
                instalar.
              </p>
            </>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <a
          href={setupHref}
          download={setupName}
          className={`inline-flex items-center justify-center gap-2 w-full sm:w-auto px-6 py-3 rounded-xl text-white font-semibold shadow-lg transition-colors ${
            isAdmin
              ? 'bg-amber-600 hover:bg-amber-500 shadow-amber-900/40'
              : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-900/40'
          }`}
        >
          <Download className="w-5 h-5" />
          Baixar Instalador (.exe)
        </a>
        <a
          href={zipHref}
          download={zipName}
          className="inline-flex items-center justify-center gap-2 w-full sm:w-auto px-5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-gray-200 font-medium border border-slate-700 transition-colors"
        >
          <Download className="w-4 h-4" />
          Pacote ZIP (compatibilidade)
        </a>
      </div>

      <p className="text-[11px] text-gray-500">
        Windows 10/11 · sem Node.js · guilda I V E N U M I · versão 1.3.3
        {isAdmin ? ' · uso restrito a administradores' : ' · pareamento recomendado no painel Missões'}
      </p>
      <p className="text-[11px] text-amber-500/80">
        Se o instalador `.exe` não estiver disponível no deploy atual, use o pacote ZIP de
        compatibilidade.
      </p>
    </div>
  );
};

export default CelesteDownload;
