import { useState, useEffect } from 'react';
import { TrendingUp, Users, Target, Award } from 'lucide-react';
import { getProfile, getGuildMembers } from '@/lib/supabase/profiles';
import { getUserPointsLedger } from '@/lib/supabase/points';
import { getMissionCompletionRanking } from '@/lib/supabase/ranking';
import { supabase } from '@/lib/supabase/client';

const formatRelativeDate = (dateStr) => {
  if (!dateStr) return 'Agora';
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.max(1, Math.floor(diffMs / (1000 * 60)));
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours}h`;
  const days = Math.floor(hours / 24);
  return `há ${days}d`;
};

const Dashboard = ({ userId }) => {
  const [stats, setStats] = useState({
    totalPoints: 0,
    completedMissions: 0,
    rank: 0,
    totalMembers: 0,
  });
  const [recentActivity, setRecentActivity] = useState([]);
  const [latestCompletedMissions, setLatestCompletedMissions] = useState([]);

  useEffect(() => {
    let cancelled = false;

    const loadDashboard = async () => {
      const [profileRes, membersRes, rankingRes, ledgerRes, missionRewardsRes] =
        await Promise.all([
          getProfile(userId),
          getGuildMembers(),
          getMissionCompletionRanking(300),
          getUserPointsLedger(userId, 6),
          // Missões concluídas do PRÓPRIO perfil (registro individual da conclusão).
          supabase
            .from('mission_reward_events')
            .select('id, mission_id, awarded_points, awarded_at, missions(title, mission_type)')
            .eq('profile_id', userId)
            .order('awarded_at', { ascending: false }),
        ]);

      if (cancelled) return;

      const members = membersRes.success ? membersRes.data || [] : [];
      const activeMembers = members.filter((m) => m?.is_active !== false).length;

      const rankingRows = rankingRes.success ? rankingRes.data || [] : [];
      const rankForUser = rankingRows.find((row) => row.profileId === userId)?.rank || 0;

      const profile = profileRes.success ? profileRes.data : null;
      const rewardEvents = missionRewardsRes.data || [];
      const userMissionsCompleted = rewardEvents.length;

      setStats({
        totalPoints: Number(profile?.total_points || 0),
        completedMissions: userMissionsCompleted,
        rank: rankForUser,
        totalMembers: activeMembers,
      });

      const ledger = ledgerRes.success ? ledgerRes.data || [] : [];
      const activityRows = ledger.map((entry) => ({
        id: entry.id,
        title: entry.reason || 'Movimento de pontos',
        when: formatRelativeDate(entry.created_at),
        points: Number(entry.amount || 0),
      }));
      setRecentActivity(activityRows);

      setLatestCompletedMissions(
        rewardEvents.slice(0, 4).map((ev) => ({
          id: ev.id,
          title: ev.missions?.title || 'Missão concluída',
          points_reward: ev.awarded_points,
          updated_at: ev.awarded_at,
        }))
      );
    };

    loadDashboard();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const statCards = [
    { label: 'Pontos Totais', value: stats.totalPoints, icon: Award, color: 'text-amber-500' },
    { label: 'Missões Concluídas', value: stats.completedMissions, icon: Target, color: 'text-green-500' },
    { label: 'Ranking', value: stats.rank > 0 ? `#${stats.rank}` : '-', icon: TrendingUp, color: 'text-blue-500' },
    { label: 'Membros da Guilda', value: stats.totalMembers, icon: Users, color: 'text-purple-500' },
  ];

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-gray-400 mt-1">Visão geral da sua atividade na guilda</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {statCards.map((stat) => (
          <div key={stat.label} className="bg-slate-900 rounded-lg border border-slate-800 p-6">
            <div className="flex items-center justify-between mb-4">
              <stat.icon className={`w-6 h-6 ${stat.color}`} />
              <span className="text-2xl font-bold text-white">{stat.value}</span>
            </div>
            <p className="text-sm text-gray-400">{stat.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-slate-900 rounded-lg border border-slate-800 p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Atividade Recente</h2>
          <div className="space-y-4">
            {recentActivity.length === 0 && (
              <p className="text-sm text-slate-500">Sem movimentações recentes.</p>
            )}
            {recentActivity.map((entry) => (
              <div key={entry.id} className="flex items-center gap-4 p-3 bg-slate-800/50 rounded-lg">
                <div className="w-10 h-10 bg-slate-700 rounded-full flex items-center justify-center">
                  <Target className="w-5 h-5 text-green-500" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-white">{entry.title}</p>
                  <p className="text-xs text-gray-400">{entry.when}</p>
                </div>
                <span className={`text-sm ${entry.points >= 0 ? 'text-amber-500' : 'text-red-400'}`}>
                  {entry.points >= 0 ? '+' : ''}
                  {entry.points} pts
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-slate-900 rounded-lg border border-slate-800 p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Últimas Missões Concluídas</h2>
          <div className="space-y-4">
            {latestCompletedMissions.length === 0 && (
              <p className="text-sm text-slate-500">Nenhuma missão concluída ainda.</p>
            )}
            {latestCompletedMissions.map((mission) => (
              <div key={mission.id} className="flex items-center gap-4 p-3 bg-slate-800/50 rounded-lg">
                <div className="w-10 h-10 bg-slate-700 rounded-full flex items-center justify-center">
                  <Target className="w-5 h-5 text-blue-500" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-white">{mission.title}</p>
                  <p className="text-xs text-gray-400">
                    Concluída {formatRelativeDate(mission.updated_at)}
                  </p>
                </div>
                <span className="text-sm text-green-500">{mission.points_reward || 0} pts</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
