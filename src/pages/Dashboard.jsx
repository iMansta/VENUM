import { useState, useEffect } from 'react';
import { Trophy, Target, TrendingUp, Users, Award, Activity, Camera, Upload, Package } from 'lucide-react';
import { getProfile, updateProfile } from '@/lib/supabase/profiles';
import { getUserPointsStats, getUserPointsLedger } from '@/lib/supabase/points';
import { getActiveMissions } from '@/lib/supabase/missions';
import { getGuildMembers } from '@/lib/supabase/profiles';
import { supabase } from '@/lib/supabase/client';

/**
 * Dashboard page - Overview of guild and user statistics
 */

const Dashboard = ({ userId }) => {
  const [profile, setProfile] = useState(null);
  const [pointsStats, setPointsStats] = useState(null);
  const [missions, setMissions] = useState([]);
  const [members, setMembers] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);
  const [transportStats, setTransportStats] = useState({ completed: 0, active: 0 });
  const [loading, setLoading] = useState(true);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  useEffect(() => {
    loadDashboardData();
  }, [userId]);

  const loadDashboardData = async () => {
    setLoading(true);
    
    try {
      const [profileResult, pointsResult, missionsResult, membersResult, activityResult, transportResult] = await Promise.all([
        getProfile(userId),
        getUserPointsStats(userId),
        getActiveMissions(),
        getGuildMembers(),
        getUserPointsLedger(userId, 10),
        loadTransportStats(),
      ]);

      if (profileResult.success) setProfile(profileResult.data);
      if (pointsResult.success) setPointsStats(pointsResult.data);
      if (missionsResult.success) setMissions(missionsResult.data);
      if (membersResult.success) setMembers(membersResult.data);
      if (activityResult.success) setRecentActivity(activityResult.data);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadTransportStats = async () => {
    if (!userId) return { completed: 0, active: 0 };
    
    try {
      const [completedResult, activeResult] = await Promise.all([
        supabase
          .from('transports')
          .select('*', { count: 'exact', head: true })
          .eq('reserved_by', userId)
          .eq('status', 'completed'),
        supabase
          .from('transports')
          .select('*', { count: 'exact', head: true })
          .eq('reserved_by', userId)
          .eq('status', 'reserved'),
      ]);

      const completed = completedResult.count || 0;
      const active = activeResult.count || 0;
      
      setTransportStats({ completed, active });
      return { completed, active };
    } catch (error) {
      console.error('Error loading transport stats:', error);
      return { completed: 0, active: 0 };
    }
  };

  const handleAvatarUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploadingAvatar(true);
    try {
      console.log('Starting avatar upload...');
      
      const fileExt = file.name.split('.').pop();
      const fileName = `${userId}-${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      console.log('Uploading to Supabase Storage:', filePath);
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file);

      if (uploadError) {
        console.error('Upload error:', uploadError);
        throw uploadError;
      }

      console.log('Upload successful, getting public URL...');
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      console.log('Public URL:', publicUrl);

      console.log('Updating profile...');
      const { error: updateError } = await updateProfile(userId, { avatar_url: publicUrl });

      if (updateError) {
        console.error('Profile update error:', updateError);
        throw updateError;
      }

      console.log('Profile updated successfully');
      setProfile({ ...profile, avatar_url: publicUrl });
    } catch (error) {
      console.error('Avatar upload error:', error);
      alert('Erro ao fazer upload do avatar: ' + error.message);
    } finally {
      setUploadingAvatar(false);
    }
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
      {/* Welcome Section with Avatar */}
      <div className="bg-gradient-to-r from-red-500/10 to-red-600/5 rounded-lg p-6 border border-red-500/20">
        <div className="flex items-center gap-6">
          <div className="relative">
            {profile?.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt={profile.username || 'Avatar'}
                className="w-20 h-20 rounded-full object-cover border-2 border-red-500"
              />
            ) : (
              <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center border-2 border-red-500">
                <Users className="w-10 h-10 text-red-500" />
              </div>
            )}
            <label className="absolute bottom-0 right-0 bg-red-500 hover:bg-red-600 text-white p-2 rounded-full cursor-pointer transition-colors">
              <Camera className="w-4 h-4" />
              <input
                type="file"
                accept="image/*"
                onChange={handleAvatarUpload}
                className="hidden"
                disabled={uploadingAvatar}
              />
            </label>
            {uploadingAvatar && (
              <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center">
                <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white mb-2">
              Bem-vindo, {profile?.username || 'Usuário'}!
            </h1>
            <p className="text-gray-400">
              {profile?.role === 'admin' ? 'Administrador do Sistema' : profile?.role === 'officer' ? 'Oficial da Guilda' : 'Membro da Guilda'}
            </p>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
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
            <Package className="w-6 h-6 text-purple-500" />
            <span className="text-gray-400 text-sm">Transportes</span>
          </div>
          <p className="text-3xl font-bold text-purple-400">{transportStats.completed}</p>
          <p className="text-xs text-gray-500 mt-1">Concluídos</p>
        </div>

        <div className="bg-slate-900 rounded-lg p-6 border border-slate-800">
          <div className="flex items-center gap-3 mb-2">
            <Users className="w-6 h-6 text-amber-500" />
            <span className="text-gray-400 text-sm">Membros</span>
          </div>
          <p className="text-3xl font-bold text-amber-400">{members.length}</p>
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
          {recentActivity.length === 0 ? (
            <p className="text-gray-500 text-center py-8">Nenhuma atividade recente</p>
          ) : (
            <div className="space-y-3">
              {recentActivity.map((activity) => (
                <div key={activity.id} className="flex items-center gap-4 text-sm">
                  <div className={`w-2 h-2 rounded-full ${
                    activity.amount > 0 ? 'bg-green-500' : 'bg-red-500'
                  }`} />
                  <span className="text-gray-400 flex-1">
                    {activity.amount > 0 ? 'Ganhou' : 'Perdeu'} {formatNumber(Math.abs(activity.amount))} pontos
                    {activity.reason && ` - ${activity.reason}`}
                  </span>
                  <span className="text-gray-500">
                    {new Date(activity.created_at).toLocaleDateString('pt-BR', {
                      day: '2-digit',
                      month: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
