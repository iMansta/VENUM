import { useState, useEffect } from 'react';
import { Trophy, Medal, Award } from 'lucide-react';
import { getMissionCompletionRanking } from '@/lib/supabase/ranking';

const Ranking = ({ userId }) => {
  const [ranking, setRanking] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);

      const result = await getMissionCompletionRanking(30);

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
  }, [userId]);

  const getRankIcon = (rank) => {
    if (rank === 1) return <Trophy className="w-5 h-5 text-amber-500" />;
    if (rank === 2) return <Medal className="w-5 h-5 text-gray-400" />;
    if (rank === 3) return <Award className="w-5 h-5 text-amber-700" />;
    return <span className="text-sm font-bold text-gray-400">#{rank}</span>;
  };

  const getRankClass = (rank, isCurrentUser) => {
    if (isCurrentUser) return 'bg-red-500/10 border-red-500/40';
    if (rank === 1) return 'bg-amber-500/10 border-amber-500/50';
    if (rank === 2) return 'bg-gray-500/10 border-gray-500/50';
    if (rank === 3) return 'bg-amber-700/10 border-amber-700/50';
    return 'bg-slate-800/50 border-slate-700';
  };

  const getInitial = (name) => String(name || '?').charAt(0).toUpperCase();

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Ranking da Guilda</h1>
        <p className="text-gray-400 mt-1">
          Classificação por missões concluídas na aplicação
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-12 h-12 border-4 border-red-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : error ? (
        <div className="bg-slate-900 rounded-lg border border-slate-800 p-8 text-center">
          <p className="text-red-400">{error}</p>
          <p className="text-gray-500 text-sm mt-2">
            Execute o SQL <code className="text-gray-400">UPDATE_BUILDS_AND_RANKING.sql</code> no Supabase.
          </p>
        </div>
      ) : ranking.length === 0 ? (
        <div className="bg-slate-900 rounded-lg border border-slate-800 p-8 text-center text-gray-400">
          Nenhuma missão concluída ainda. Participe das missões da guilda!
        </div>
      ) : (
        <div className="bg-slate-900 rounded-lg border border-slate-800 overflow-hidden">
          <div className="grid grid-cols-12 gap-4 p-4 bg-slate-800 border-b border-slate-700 text-sm font-semibold text-gray-400">
            <div className="col-span-1">Rank</div>
            <div className="col-span-5">Membro</div>
            <div className="col-span-3 text-right">Missões</div>
            <div className="col-span-3 text-right">Pontos</div>
          </div>

          <div className="divide-y divide-slate-800">
            {ranking.map((member) => {
              const isCurrentUser = userId && member.profileId === userId;

              return (
                <div
                  key={member.profileId || member.rank}
                  className={`grid grid-cols-12 gap-4 p-4 items-center border ${getRankClass(member.rank, isCurrentUser)}`}
                >
                  <div className="col-span-1 flex items-center justify-center">
                    {getRankIcon(member.rank)}
                  </div>
                  <div className="col-span-5 flex items-center gap-3">
                    <div className="w-10 h-10 bg-slate-700 rounded-full flex items-center justify-center">
                      <span className="text-white font-semibold">
                        {getInitial(member.displayName)}
                      </span>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-white block">
                        {member.displayName}
                      </span>
                      {isCurrentUser && (
                        <span className="text-xs text-red-400">Você</span>
                      )}
                    </div>
                  </div>
                  <div className="col-span-3 text-right">
                    <span className="text-sm font-semibold text-white">
                      {member.completedMissions}
                    </span>
                  </div>
                  <div className="col-span-3 text-right">
                    <span className="text-sm text-gray-300">
                      {member.totalPoints.toLocaleString()}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default Ranking;
