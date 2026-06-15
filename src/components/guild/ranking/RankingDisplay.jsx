import { useState, useEffect } from 'react';
import { Trophy, Medal, Award, TrendingUp, Calendar, RefreshCw } from 'lucide-react';
import { getWeeklyRanking, getMonthlyRanking, getUserRankingPosition } from '@/lib/supabase/ranking';

/**
 * RankingDisplay component - Shows weekly and monthly mission rankings
 */

const RankingDisplay = ({ userId }) => {
  const [activeTab, setActiveTab] = useState('weekly');
  const [weeklyRanking, setWeeklyRanking] = useState([]);
  const [monthlyRanking, setMonthlyRanking] = useState([]);
  const [userPosition, setUserPosition] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRankings();
  }, [userId]);

  const loadRankings = async () => {
    setLoading(true);

    // Load rankings
    const [weeklyResult, monthlyResult, positionResult] = await Promise.all([
      getWeeklyRanking(10),
      getMonthlyRanking(10),
      userId ? getUserRankingPosition(userId) : Promise.resolve({ success: false }),
    ]);

    if (weeklyResult.success) setWeeklyRanking(weeklyResult.data);
    if (monthlyResult.success) setMonthlyRanking(monthlyResult.data);
    if (positionResult.success) setUserPosition(positionResult.data);

    setLoading(false);
  };

  const formatNumber = (value) => {
    return new Intl.NumberFormat('pt-BR').format(value || 0);
  };

  const getRankIcon = (rank) => {
    if (rank === 1) return <Trophy className="w-6 h-6 text-yellow-400" />;
    if (rank === 2) return <Medal className="w-6 h-6 text-gray-400" />;
    if (rank === 3) return <Award className="w-6 h-6 text-red-600" />;
    return <span className="w-6 h-6 flex items-center justify-center text-gray-400 font-bold">#{rank}</span>;
  };

  const getRankColor = (rank) => {
    if (rank === 1) return 'bg-yellow-500/20 border-yellow-500/30';
    if (rank === 2) return 'bg-gray-500/20 border-gray-500/30';
    if (rank === 3) return 'bg-red-600/20 border-red-600/30';
    return 'bg-slate-800/50 border-slate-700';
  };

  const currentRanking = activeTab === 'weekly' ? weeklyRanking : monthlyRanking;

  return (
    <div className="bg-slate-900 rounded-lg border border-slate-800 overflow-hidden">
      {/* Header */}
      <div className="bg-slate-800 px-6 py-4 border-b border-slate-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Trophy className="w-6 h-6 text-red-500" />
            <h2 className="text-xl font-bold text-white">Ranking de Missões</h2>
          </div>
          <button
            onClick={loadRankings}
            className="text-gray-400 hover:text-white transition-colors"
            title="Atualizar ranking"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* User Position */}
      {userPosition && (
        <div className="bg-gradient-to-r from-red-500/10 to-red-600/5 px-6 py-4 border-b border-slate-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-red-400">
                <TrendingUp className="w-5 h-5" />
                <span className="font-medium">Sua Posição</span>
              </div>
            </div>
            <div className="flex gap-6">
              <div className="text-center">
                <div className="text-xs text-gray-400 mb-1">Semanal</div>
                <div className="text-lg font-bold text-white">
                  {userPosition.weekly_rank ? `#${userPosition.weekly_rank}` : 'N/A'}
                </div>
                <div className="text-xs text-red-400">{formatNumber(userPosition.weekly_points)} pts</div>
              </div>
              <div className="text-center">
                <div className="text-xs text-gray-400 mb-1">Mensal</div>
                <div className="text-lg font-bold text-white">
                  {userPosition.monthly_rank ? `#${userPosition.monthly_rank}` : 'N/A'}
                </div>
                <div className="text-xs text-red-400">{formatNumber(userPosition.monthly_points)} pts</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-slate-800">
        <div className="flex">
          <button
            onClick={() => setActiveTab('weekly')}
            className={`flex items-center gap-2 px-6 py-3 text-sm font-medium transition-colors ${
              activeTab === 'weekly'
                ? 'bg-red-500 text-slate-950'
                : 'text-gray-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Calendar className="w-4 h-4" />
            Semanal
          </button>
          <button
            onClick={() => setActiveTab('monthly')}
            className={`flex items-center gap-2 px-6 py-3 text-sm font-medium transition-colors ${
              activeTab === 'monthly'
                ? 'bg-red-500 text-slate-950'
                : 'text-gray-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Calendar className="w-4 h-4" />
            Mensal
          </button>
        </div>
      </div>

      {/* Ranking List */}
      <div className="p-6">
        {loading ? (
          <div className="text-center py-12">
            <div className="w-12 h-12 border-4 border-red-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-400">Carregando ranking...</p>
          </div>
        ) : currentRanking.length === 0 ? (
          <div className="text-center py-12">
            <Trophy className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-400 mb-2">
              Nenhum Ranking Disponível
            </h3>
            <p className="text-gray-500">
              Complete missões para aparecer no ranking.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {currentRanking.map((user) => (
              <div
                key={user.profile_id}
                className={`flex items-center gap-4 p-4 rounded-lg border transition-all ${
                  user.profile_id === userId
                    ? 'bg-red-500/20 border-red-500/50'
                    : getRankColor(user.rank)
                }`}
              >
                {/* Rank */}
                <div className="flex items-center justify-center w-12 h-12">
                  {getRankIcon(user.rank)}
                </div>

                {/* User Info */}
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-slate-700 rounded-full flex items-center justify-center text-white font-bold">
                      {user.username?.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h4 className="font-semibold text-white">{user.username}</h4>
                      {user.full_name && (
                        <p className="text-sm text-gray-400">{user.full_name}</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Stats */}
                <div className="flex items-center gap-6">
                  <div className="text-center">
                    <div className="text-xs text-gray-400 mb-1">Pontos</div>
                    <div className="text-lg font-bold text-red-400">
                      {formatNumber(user.points_earned)}
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-gray-400 mb-1">Missões</div>
                    <div className="text-lg font-bold text-white">
                      {user.missions_completed}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="bg-slate-800/30 px-6 py-3 border-t border-slate-800">
        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>
            Ranking {activeTab === 'weekly' ? 'semanal' : 'mensal'} atualizado em tempo real
          </span>
          <span>
            Top {currentRanking.length} membros
          </span>
        </div>
      </div>
    </div>
  );
};

export default RankingDisplay;
