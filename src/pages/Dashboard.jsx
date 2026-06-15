import { useState, useEffect } from 'react';
import { Trophy, Target, TrendingUp, Users, Award, Activity } from 'lucide-react';
import { getProfile } from '@/lib/supabase/profiles';
import { getUserPointsStats } from '@/lib/supabase/points';
import { getActiveMissions } from '@/lib/supabase/missions';
import { getGuildMembers } from '@/lib/supabase/profiles';

/**
 * Dashboard page - Overview of guild and user statistics
 */

const Dashboard = ({ userId }) => {
  const [profile, setProfile] = useState(null);
  const [pointsStats, setPointsStats] = useState(null);
  const [missions, setMissions] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, [userId]);

  const loadDashboardData = async () => {
    setLoading(true);
    
    const [profileResult, pointsResult, missionsResult, membersResult] = await Promise.all([
      getProfile(userId),
      getUserPointsStats(userId),
      getActiveMissions(),
      getGuildMembers(),
    ]);

    if (profileResult.success) setProfile(profileResult.data);
    if (pointsResult.success) setPointsStats(pointsResult.data);
    if (missionsResult.success) setMissions(missionsResult.data);
    if (membersResult.success) setMembers(membersResult.data);

    setLoading(false);
  };

  const formatNumber = (value) => {
    return new Intl.NumberFormat('pt-BR').format(value || 0);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-12 h-12 border-4 border-red-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="bg-gradient-to-r from-red-500/10 to-red-600/5 rounded-lg p-6 border border-red-500/20">
        <h1 className="text-2xl font-bold text-white mb-2">
          Bem-vindo, {profile?.username || 'Usuário'}!
        </h1>
        <p className="text-gray-400">
          {profile?.role === 'admin' ? 'Administrador do Sistema' : profile?.role === 'officer' ? 'Oficial da Guilda' : 'Membro da Guilda'}
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900 rounded-lg p-6 border border-slate-800">
          <div className="flex items-center gap-3 mb-2">
            <Award className="w-6 h-6 text-red-500" />
            <span className="text-gray-400 text-sm">Seus Pontos</span>
          </div>
          <p className="text-3xl font-bold text-white">{formatNumber(profile?.total_points || 0)}</p>
          <p className="text-xs text-gray-500 mt-1">Total acumulado</p>
        </div>

        <div className="bg-slate-900 rounded-lg p-6 border border-slate-800">
          <div className="flex items-center gap-3 mb-2">
            <Trophy className="w-6 h-6 text-green-500" />
            <span className="text-gray-400 text-sm">Pontos Ganhos</span>
          </div>
          <p className="text-3xl font-bold text-green-400">{formatNumber(pointsStats?.totalEarned || 0)}</p>
          <p className="text-xs text-gray-500 mt-1">Este mês</p>
        </div>

        <div className="bg-slate-900 rounded-lg p-6 border border-slate-800">
          <div className="flex items-center gap-3 mb-2">
            <Target className="w-6 h-6 text-blue-500" />
            <span className="text-gray-400 text-sm">Missões Ativas</span>
          </div>
          <p className="text-3xl font-bold text-blue-400">{missions.length}</p>
          <p className="text-xs text-gray-500 mt-1">Disponíveis</p>
        </div>

        <div className="bg-slate-900 rounded-lg p-6 border border-slate-800">
          <div className="flex items-center gap-3 mb-2">
            <Users className="w-6 h-6 text-purple-500" />
            <span className="text-gray-400 text-sm">Membros</span>
          </div>
          <p className="text-3xl font-bold text-purple-400">{members.length}</p>
          <p className="text-xs text-gray-500 mt-1">Na guilda</p>
        </div>
      </div>

      {/* Active Missions */}
      <div className="bg-slate-900 rounded-lg border border-slate-800">
        <div className="p-6 border-b border-slate-800">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Target className="w-5 h-5 text-red-500" />
            Missões Ativas
          </h2>
        </div>
        <div className="p-6">
          {missions.length === 0 ? (
            <p className="text-gray-500 text-center py-8">Nenhuma missão ativa no momento</p>
          ) : (
            <div className="space-y-3">
              {missions.slice(0, 3).map((mission) => (
                <div key={mission.id} className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-medium text-white">{mission.title}</h3>
                    <span className="text-red-500 font-semibold">{mission.points_reward} pts</span>
                  </div>
                  <p className="text-sm text-gray-400 mb-2">{mission.description}</p>
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <span>Tipo: {mission.mission_type}</span>
                    <span>Progresso: {mission.current_quantity}/{mission.target_quantity}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-slate-900 rounded-lg border border-slate-800">
        <div className="p-6 border-b border-slate-800">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Activity className="w-5 h-5 text-red-500" />
            Atividade Recente
          </h2>
        </div>
        <div className="p-6">
          <div className="space-y-3">
            <div className="flex items-center gap-4 text-sm">
              <div className="w-2 h-2 bg-green-500 rounded-full" />
              <span className="text-gray-400">Você ganhou 100 pontos por completar uma missão</span>
              <span className="text-gray-500 ml-auto">Há 2 horas</span>
            </div>
            <div className="flex items-center gap-4 text-sm">
              <div className="w-2 h-2 bg-blue-500 rounded-full" />
              <span className="text-gray-400">Nova missão disponível: Coleta de Madeira T6</span>
              <span className="text-gray-500 ml-auto">Há 5 horas</span>
            </div>
            <div className="flex items-center gap-4 text-sm">
              <div className="w-2 h-2 bg-purple-500 rounded-full" />
              <span className="text-gray-400">Novo membro entrou na guilda</span>
              <span className="text-gray-500 ml-auto">Há 1 dia</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
