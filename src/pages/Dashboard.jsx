import { useState, useEffect } from 'react';
import { TrendingUp, Users, Target, Award } from 'lucide-react';

const Dashboard = ({ userId }) => {
  const [stats, setStats] = useState({
    totalPoints: 0,
    completedMissions: 0,
    rank: 0,
    totalMembers: 0,
  });

  useEffect(() => {
    // TODO: Fetch real stats from Supabase
    setStats({
      totalPoints: 12500,
      completedMissions: 42,
      rank: 5,
      totalMembers: 28,
    });
  }, [userId]);

  const statCards = [
    { label: 'Pontos Totais', value: stats.totalPoints, icon: Award, color: 'text-amber-500' },
    { label: 'Missões Completadas', value: stats.completedMissions, icon: Target, color: 'text-green-500' },
    { label: 'Ranking', value: `#${stats.rank}`, icon: TrendingUp, color: 'text-blue-500' },
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
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-4 p-3 bg-slate-800/50 rounded-lg">
                <div className="w-10 h-10 bg-slate-700 rounded-full flex items-center justify-center">
                  <Target className="w-5 h-5 text-green-500" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-white">Missão #{i}</p>
                  <p className="text-xs text-gray-400">Completada há {i * 2} horas</p>
                </div>
                <span className="text-sm text-amber-500">+{i * 100} pts</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-slate-900 rounded-lg border border-slate-800 p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Próximas Missões</h2>
          <div className="space-y-4">
            {[1, 2].map((i) => (
              <div key={i} className="flex items-center gap-4 p-3 bg-slate-800/50 rounded-lg">
                <div className="w-10 h-10 bg-slate-700 rounded-full flex items-center justify-center">
                  <Target className="w-5 h-5 text-blue-500" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-white">Missão Diária #{i}</p>
                  <p className="text-xs text-gray-400">Expira em {i * 3} horas</p>
                </div>
                <span className="text-sm text-green-500">{i * 150} pts</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
