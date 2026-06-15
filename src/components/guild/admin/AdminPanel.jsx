import { useState, useEffect } from 'react';
import { Shield, Users, Key, Target, Award, RefreshCw } from 'lucide-react';
import { getGuildMembers, updateUserRole } from '@/lib/supabase/profiles';
import { createGuildCode } from '@/lib/supabase/guildCodes';
import UserManagement from './UserManagement';
import InviteCodeGenerator from './InviteCodeGenerator';
import MissionManagement from './MissionManagement';
import PointsManagement from './PointsManagement';

/**
 * AdminPanel component - Main admin dashboard for guild management
 */

const AdminPanel = ({ userId, userRole }) => {
  const [activeTab, setActiveTab] = useState('users');
  const [stats, setStats] = useState({
    totalMembers: 0,
    totalPoints: 0,
    activeMissions: 0,
    totalCodes: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    setLoading(true);
    // Load basic stats
    const { success: membersSuccess, data: members } = await getGuildMembers();
    if (membersSuccess) {
      setStats({
        totalMembers: members.length,
        totalPoints: members.reduce((sum, m) => sum + (m.total_points || 0), 0),
        activeMissions: 0, // Would load from missions
        totalCodes: 0, // Would load from guild_codes
      });
    }
    setLoading(false);
  };

  const tabs = [
    { id: 'users', label: 'Usuários', icon: Users },
    { id: 'codes', label: 'Códigos', icon: Key },
    { id: 'missions', label: 'Missões', icon: Target },
    { id: 'points', label: 'Pontos', icon: Award },
  ];

  return (
    <div className="bg-slate-900 rounded-lg border border-slate-800 overflow-hidden">
      {/* Header */}
      <div className="bg-slate-800 px-6 py-4 border-b border-slate-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="w-6 h-6 text-amber-500" />
            <h2 className="text-xl font-bold text-white">Painel Administrativo</h2>
          </div>
          <button
            onClick={loadStats}
            className="text-gray-400 hover:text-white transition-colors"
            title="Atualizar estatísticas"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="p-6 border-b border-slate-800">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-5 h-5 text-blue-400" />
              <span className="text-gray-400 text-sm">Total de Membros</span>
            </div>
            <p className="text-2xl font-bold text-white">{stats.totalMembers}</p>
          </div>
          <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="w-5 h-5 text-amber-400" />
              <span className="text-gray-400 text-sm">Pontos Totais</span>
            </div>
            <p className="text-2xl font-bold text-amber-400">{stats.totalPoints}</p>
          </div>
          <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
            <div className="flex items-center gap-2 mb-2">
              <Key className="w-5 h-5 text-green-400" />
              <span className="text-gray-400 text-sm">Códigos Ativos</span>
            </div>
            <p className="text-2xl font-bold text-green-400">{stats.totalCodes}</p>
          </div>
          <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="w-5 h-5 text-purple-400" />
              <span className="text-gray-400 text-sm">Missões Ativas</span>
            </div>
            <p className="text-2xl font-bold text-purple-400">{stats.activeMissions}</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-800">
        <div className="flex">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-6 py-3 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-amber-500 text-slate-950'
                  : 'text-gray-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="p-6">
        {activeTab === 'users' && <UserManagement userId={userId} userRole={userRole} />}
        {activeTab === 'codes' && <InviteCodeGenerator userId={userId} userRole={userRole} />}
        {activeTab === 'missions' && <MissionManagement userId={userId} userRole={userRole} />}
        {activeTab === 'points' && <PointsManagement userId={userId} userRole={userRole} />}
      </div>
    </div>
  );
};

export default AdminPanel;
