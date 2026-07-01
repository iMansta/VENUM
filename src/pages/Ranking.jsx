import { useState, useEffect } from 'react';
import {
  Trophy,
  Medal,
  Award,
  Target,
  Swords,
  Skull,
  Axe,
  Crown,
} from 'lucide-react';
import { RANKING_TABS } from '@/lib/supabase/ranking';

const formatScore = (value, tabId) => {
  const n = Number(value || 0);
  if (tabId === 'missions') return n.toLocaleString('pt-BR');
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toLocaleString('pt-BR');
};

const TAB_ICONS = {
  missions: Target,
  pvp: Swords,
  pve: Skull,
  gathering: Axe,
};

const PODIUM_META = [
  { rank: 2, height: 'h-28', ring: 'ring-gray-400/60', bg: 'from-gray-600/30 to-gray-800/20', icon: Medal, label: '2º' },
  { rank: 1, height: 'h-36', ring: 'ring-amber-400/80', bg: 'from-amber-500/30 to-amber-900/20', icon: Trophy, label: '1º' },
  { rank: 3, height: 'h-24', ring: 'ring-amber-700/60', bg: 'from-amber-800/30 to-amber-950/20', icon: Award, label: '3º' },
];

const Podium = ({ top3, tabId, userId, scoreLabel }) => {
  const ordered = PODIUM_META.map((meta) => ({
    ...meta,
    member: top3.find((m) => m.rank === meta.rank),
  }));

  return (
    <div className="grid grid-cols-3 gap-3 items-end mb-8 px-2">
      {ordered.map(({ rank, height, ring, bg, icon: Icon, label, member }) => {
        const isUser = userId && member?.profileId === userId;
        return (
          <div key={rank} className="flex flex-col items-center">
            <div
              className={`w-full rounded-t-xl border border-slate-700/80 bg-gradient-to-b ${bg} ${height} flex flex-col items-center justify-end pb-3 px-2 ring-2 ${ring} ${
                isUser ? 'shadow-lg shadow-red-500/20' : ''
              }`}
            >
              {member ? (
                <>
                  <div className="w-12 h-12 rounded-full bg-slate-800 border-2 border-slate-600 flex items-center justify-center mb-2">
                    <span className="text-lg font-bold text-white">
                      {String(member.displayName || '?').charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-white text-center truncate w-full">
                    {member.displayName}
                  </p>
                  <p className="text-sm font-bold text-amber-400 mt-1">
                    {formatScore(member.score, tabId)}
                  </p>
                  {tabId === 'missions' && (
                    <p className="text-[10px] text-slate-400">{member.secondary} missões</p>
                  )}
                </>
              ) : (
                <p className="text-xs text-slate-500 pb-4">—</p>
              )}
            </div>
            <div className="flex items-center gap-1 mt-2 text-slate-400">
              <Icon className="w-4 h-4" />
              <span className="text-xs font-bold">{label}</span>
            </div>
            <span className="text-[10px] text-slate-500 mt-0.5">{scoreLabel}</span>
          </div>
        );
      })}
    </div>
  );
};

const RankingList = ({ rows, tabId, userId, scoreLabel }) => (
  <div className="divide-y divide-slate-800">
    {rows.map((member) => {
      const isUser = userId && member.profileId === userId;
      return (
        <div
          key={member.profileId || member.rank}
          className={`grid grid-cols-12 gap-4 p-4 items-center ${
            isUser ? 'bg-red-500/5 border-l-2 border-red-500' : 'hover:bg-slate-800/30'
          }`}
        >
          <div className="col-span-1 text-center">
            <span className="text-sm font-bold text-slate-400">#{member.rank}</span>
          </div>
          <div className="col-span-7 flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 bg-slate-700 rounded-full flex-shrink-0 flex items-center justify-center">
              <span className="text-sm font-semibold text-white">
                {String(member.displayName || '?').charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-white truncate">{member.displayName}</p>
              {isUser && <span className="text-xs text-red-400">Você</span>}
            </div>
          </div>
          <div className="col-span-4 text-right">
            <p className="text-sm font-semibold text-white">{formatScore(member.score, tabId)}</p>
            {tabId === 'missions' && member.secondary != null && (
              <p className="text-xs text-slate-500">{member.secondary} missões</p>
            )}
            {tabId !== 'missions' && (
              <p className="text-xs text-slate-500">{scoreLabel} (mês)</p>
            )}
          </div>
        </div>
      );
    })}
  </div>
);

const Ranking = ({ userId }) => {
  const [activeTab, setActiveTab] = useState('missions');
  const [ranking, setRanking] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const tabConfig = RANKING_TABS.find((t) => t.id === activeTab) || RANKING_TABS[0];
  const TabIcon = TAB_ICONS[activeTab] || Target;

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      const result = await tabConfig.load(30);
      if (cancelled) return;

      if (result.success) {
        setRanking(result.data);
      } else {
        setError(result.error || 'Não foi possível carregar o ranking');
        setRanking([]);
      }
      setLoading(false);
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [activeTab]);

  const top3 = ranking.filter((m) => m.rank <= 3);
  const rest = ranking.filter((m) => m.rank > 3);

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-white flex items-center gap-2">
          <Crown className="w-7 h-7 text-amber-500" />
          Ranking da Guilda
        </h1>
        <p className="text-gray-400 mt-1 text-sm">{tabConfig.description}</p>
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        {RANKING_TABS.map((tab) => {
          const Icon = TAB_ICONS[tab.id] || Target;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all border ${
                active
                  ? 'bg-red-600 border-red-500 text-white shadow-lg shadow-red-900/30'
                  : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-white hover:border-slate-600'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-12 h-12 border-4 border-red-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : error ? (
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-8 text-center">
          <TabIcon className="w-10 h-10 text-red-400 mx-auto mb-3" />
          <p className="text-red-400">{error}</p>
          <p className="text-gray-500 text-sm mt-2">
            Execute <code className="text-gray-400">supabase/UPDATE_BUILDS_AND_RANKING.sql</code> no Supabase SQL Editor.
          </p>
        </div>
      ) : ranking.length === 0 ? (
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-8 text-center text-gray-400">
          <TabIcon className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          {activeTab === 'missions'
            ? 'Nenhuma missão concluída ainda. Participe das missões da guilda!'
            : 'Sem dados de fama este mês. O coletor sincroniza diariamente via GameInfo.'}
        </div>
      ) : (
        <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
          <div className="p-6 pb-2 border-b border-slate-800">
            <Podium
              top3={top3}
              tabId={activeTab}
              userId={userId}
              scoreLabel={tabConfig.scoreLabel}
            />
          </div>

          {rest.length > 0 && (
            <>
              <div className="grid grid-cols-12 gap-4 px-4 py-3 bg-slate-800/50 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                <div className="col-span-1">#</div>
                <div className="col-span-7">Membro</div>
                <div className="col-span-4 text-right">{tabConfig.scoreLabel}</div>
              </div>
              <RankingList
                rows={rest}
                tabId={activeTab}
                userId={userId}
                scoreLabel={tabConfig.scoreLabel}
              />
            </>
          )}
        </div>
      )}

      {activeTab !== 'missions' && !loading && !error && (
        <p className="text-xs text-slate-500 mt-4 text-center">
          Rankings PvP, PvE e Coleta usam fama mensal sincronizada pelo coletor (
          <code className="text-slate-400">npm run collector</code>).
        </p>
      )}
    </div>
  );
};

export default Ranking;
