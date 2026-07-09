import { useEffect, useMemo, useState } from 'react';
import {
  Coins,
  Shield,
  Sword,
  Skull,
  Users,
  RefreshCw,
  Swords,
  Scale,
  Crown,
  Calendar,
  Flag,
  Home,
  Castle,
  Map as MapIcon,
} from 'lucide-react';
import { getLatestGuildMetrics } from '@/lib/supabase/guildMetrics';

const formatNumber = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return '-';
  return new Intl.NumberFormat('pt-BR').format(Math.round(n));
};

const formatDate = (value) => {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('pt-BR');
};

const Guild = () => {
  const [latest, setLatest] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    const latestRes = await getLatestGuildMetrics();
    if (latestRes.success) setLatest(latestRes.data);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const cards = useMemo(
    () => [
      { label: 'Prata da Guild', value: formatNumber(latest?.silver_amount), icon: Coins, color: 'text-amber-400' },
      { label: 'Pontos Temporada', value: formatNumber(latest?.season_points), icon: Shield, color: 'text-blue-400' },
      { label: 'Kill Fame', value: formatNumber(latest?.kill_fame), icon: Sword, color: 'text-green-400' },
      { label: 'Death Fame', value: formatNumber(latest?.death_fame), icon: Skull, color: 'text-red-400' },
      { label: 'Membros', value: formatNumber(latest?.member_count), icon: Users, color: 'text-purple-400' },
    ],
    [latest]
  );

  const fameAnalysis = useMemo(() => {
    const kill = Number(latest?.kill_fame) || 0;
    const death = Number(latest?.death_fame) || 0;
    const members = Number(latest?.member_count) || 0;
    const ratio = death > 0 ? kill / death : kill > 0 ? Infinity : 0;
    return {
      ratio: Number.isFinite(ratio) ? ratio.toFixed(2) : '∞',
      net: kill - death,
      avgPerMember: members > 0 ? Math.round(kill / members) : 0,
    };
  }, [latest]);

  const payload = latest?.payload || {};
  const allianceTag = latest?.alliance_tag || payload.AllianceTag || null;
  const properties = useMemo(
    () => [
      {
        label: 'Hideouts (H.O)',
        value: latest?.hideout_count != null ? formatNumber(latest.hideout_count) : '-',
        icon: Home,
        color: 'text-emerald-400',
      },
      {
        label: 'Quartel-General (QG)',
        value: latest?.headquarters || '-',
        icon: Castle,
        color: 'text-amber-400',
      },
      {
        label: 'Territórios',
        value: latest?.territory_count != null ? formatNumber(latest.territory_count) : '-',
        icon: MapIcon,
        color: 'text-blue-400',
      },
    ],
    [latest]
  );

  return (
    <div className="p-8">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Guild</h1>
          <p className="text-gray-400 mt-1">
            Monitoramento de prata, pontos de temporada e indicadores da guilda.
          </p>
          {latest?.guild_name && (
            <p className="text-sm text-slate-500 mt-2">
              Guilda: <span className="text-slate-300">{latest.guild_name}</span>
            </p>
          )}
        </div>
        <button
          onClick={loadData}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800 disabled:opacity-60"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4 mb-8">
        {cards.map((card) => (
          <div key={card.label} className="bg-slate-900 rounded-lg border border-slate-800 p-5">
            <div className="flex items-center justify-between mb-3">
              <card.icon className={`w-5 h-5 ${card.color}`} />
              <span className="text-xl font-semibold text-white">{card.value}</span>
            </div>
            <p className="text-sm text-gray-400">{card.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-slate-900 rounded-lg border border-slate-800 p-6">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Scale className="w-5 h-5 text-emerald-400" />
            Análise de Fama
          </h2>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-2xl font-bold text-emerald-400">{fameAnalysis.ratio}</p>
              <p className="text-xs text-gray-400 mt-1">K/D de fama</p>
            </div>
            <div>
              <p className={`text-2xl font-bold ${fameAnalysis.net >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {fameAnalysis.net >= 0 ? '+' : ''}{formatNumber(fameAnalysis.net)}
              </p>
              <p className="text-xs text-gray-400 mt-1">Saldo de fama</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-blue-400">{formatNumber(fameAnalysis.avgPerMember)}</p>
              <p className="text-xs text-gray-400 mt-1">Kill fame / membro</p>
            </div>
          </div>
          <div className="mt-5 pt-4 border-t border-slate-800 grid grid-cols-2 gap-4">
            <div className="flex items-center gap-2">
              <Swords className="w-4 h-4 text-green-400" />
              <div>
                <p className="text-sm text-white font-medium">{formatNumber(payload.AttacksWon)}</p>
                <p className="text-xs text-gray-500">Ataques vencidos</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-blue-400" />
              <div>
                <p className="text-sm text-white font-medium">{formatNumber(payload.DefensesWon)}</p>
                <p className="text-xs text-gray-500">Defesas vencidas</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-slate-900 rounded-lg border border-slate-800 p-6">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Flag className="w-5 h-5 text-amber-400" />
            Sobre a Guilda
          </h2>
          <ul className="space-y-3 text-sm">
            <li className="flex items-center gap-3">
              <Crown className="w-4 h-4 text-amber-400 shrink-0" />
              <span className="text-gray-400 w-28">Fundador</span>
              <span className="text-white">{payload.FounderName || '-'}</span>
            </li>
            <li className="flex items-center gap-3">
              <Calendar className="w-4 h-4 text-gray-400 shrink-0" />
              <span className="text-gray-400 w-28">Fundada em</span>
              <span className="text-white">{formatDate(payload.Founded)}</span>
            </li>
            <li className="flex items-center gap-3">
              <Users className="w-4 h-4 text-purple-400 shrink-0" />
              <span className="text-gray-400 w-28">Aliança</span>
              <span className="text-white">
                {allianceTag ? `[${allianceTag}]` : 'Sem aliança'}
                {latest?.alliance_name ? ` ${latest.alliance_name}` : ''}
              </span>
            </li>
          </ul>
          {loading ? (
            <p className="text-xs text-slate-500 mt-4">Carregando...</p>
          ) : !latest ? (
            <p className="text-xs text-slate-500 mt-4">
              Nenhum snapshot coletado ainda. Aguarde o próximo ciclo da Anaconda.
            </p>
          ) : (
            <p className="text-xs text-slate-500 mt-4">
              Última coleta: {formatDate(latest.collected_at)} · fonte {latest.source || '-'}
            </p>
          )}
        </div>
      </div>

      <div className="mt-4 bg-slate-900 rounded-lg border border-slate-800 p-6">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Home className="w-5 h-5 text-emerald-400" />
          Propriedades da Guild
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {properties.map((p) => (
            <div key={p.label} className="bg-slate-800/50 rounded-lg border border-slate-800 p-4">
              <div className="flex items-center justify-between mb-2">
                <p.icon className={`w-5 h-5 ${p.color}`} />
                <span className="text-lg font-semibold text-white truncate">{p.value}</span>
              </div>
              <p className="text-sm text-gray-400">{p.label}</p>
            </div>
          ))}
        </div>
        <p className="text-xs text-slate-500 mt-4">
          Coletado pela Anaconda a partir dos dados da guild na GameInfo. Campos indisponíveis
          aparecem como "-".
        </p>
      </div>
    </div>
  );
};

export default Guild;

