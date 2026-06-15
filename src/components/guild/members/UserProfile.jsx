import { useState, useEffect } from 'react';
import { User, Award, Calendar, Activity, Shield, Settings, Edit2, LogOut, Camera } from 'lucide-react';
import { getProfile, updateProfile } from '@/lib/supabase/profiles';
import { getUserPointsLedger, getUserPointsStats } from '@/lib/supabase/points';
import { getUserMissions } from '@/lib/supabase/missions';
import { signOut } from '@/lib/supabase/auth';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase/client';

/**
 * UserProfile component - User profile interface with stats and activity
 */

const UserProfile = ({ userId, currentUserId }) => {
  const [profile, setProfile] = useState(null);
  const [pointsStats, setPointsStats] = useState(null);
  const [recentActivity, setRecentActivity] = useState([]);
  const [userMissions, setUserMissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isOwnProfile, setIsOwnProfile] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    setIsOwnProfile(userId === currentUserId);
    loadUserData();
  }, [userId, currentUserId]);

  const loadUserData = async () => {
    setLoading(true);

    // Load profile
    const { success: profileSuccess, data: userProfile } = await getProfile(userId);
    if (profileSuccess) {
      setProfile(userProfile);
    }

    // Load points stats
    const { success: statsSuccess, data: stats } = await getUserPointsStats(userId);
    if (statsSuccess) {
      setPointsStats(stats);
    }

    // Load recent activity
    const { success: activitySuccess, data: activity } = await getUserPointsLedger(userId, 10);
    if (activitySuccess) {
      setRecentActivity(activity);
    }

    // Load user missions
    const { success: missionsSuccess, data: missions } = await getUserMissions(userId);
    if (missionsSuccess) {
      setUserMissions(missions);
    }

    setLoading(false);
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const resizeImage = (file, maxWidth = 200) => {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();
      img.onload = () => {
        const ratio = maxWidth / img.width;
        canvas.width = maxWidth;
        canvas.height = img.height * ratio;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      };
      img.src = URL.createObjectURL(file);
    });
  };

  const handleAvatarUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploadingAvatar(true);

    try {
      // Upload to Supabase Storage
      const fileName = `${userId}-${Date.now()}.jpg`;
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file, { upsert: true });

      if (uploadError) {
        // Fallback to resized base64 if storage not available
        const resizedBase64 = await resizeImage(file);
        const { success } = await updateProfile(userId, { avatar_url: resizedBase64 });
        if (success) {
          const { success: profileSuccess, data: userProfile } = await getProfile(userId);
          if (profileSuccess) setProfile(userProfile);
        }
        setUploadingAvatar(false);
        return;
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      // Update profile with avatar URL
      const { success } = await updateProfile(userId, { avatar_url: publicUrl });
      
      if (success) {
        const { success: profileSuccess, data: userProfile } = await getProfile(userId);
        if (profileSuccess) {
          setProfile(userProfile);
        }
      }
      
      setUploadingAvatar(false);
    } catch (error) {
      console.error('Error uploading avatar:', error);
      setUploadingAvatar(false);
    }
  };

  const formatNumber = (value) => {
    return new Intl.NumberFormat('pt-BR').format(value || 0);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getRoleColor = (role) => {
    const colors = {
      admin: 'bg-red-500/20 text-red-400 border-red-500/30',
      officer: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
      member: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    };
    return colors[role] || colors.member;
  };

  const getRoleName = (role) => {
    const names = {
      admin: 'Administrador',
      officer: 'Oficial',
      member: 'Membro',
    };
    return names[role] || 'Membro';
  };

  if (loading) {
    return (
      <div className="bg-slate-900 rounded-lg border border-slate-800 p-12">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400">Carregando perfil...</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="bg-slate-900 rounded-lg border border-slate-800 p-12">
        <div className="text-center">
          <User className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-400 mb-2">Perfil não encontrado</h3>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-900 rounded-lg border border-slate-800 overflow-hidden">
      {/* Header */}
      <div className="bg-slate-800 px-6 py-4 border-b border-slate-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <User className="w-6 h-6 text-amber-500" />
            <h2 className="text-xl font-bold text-white">Perfil do Usuário</h2>
          </div>
          {isOwnProfile && (
            <div className="flex items-center gap-2">
              <button className="text-gray-400 hover:text-white p-2 rounded hover:bg-slate-700 transition-colors">
                <Settings className="w-5 h-5" />
              </button>
              <button
                onClick={handleSignOut}
                className="text-red-400 hover:text-red-300 p-2 rounded hover:bg-red-500/10 transition-colors"
                title="Sair"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="p-6">
        {/* Profile Header */}
        <div className="bg-slate-800/50 rounded-lg p-6 border border-slate-700 mb-6">
          <div className="flex items-start gap-6">
            {/* Avatar */}
            <div className="relative">
              {profile.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt={profile.username}
                  className="w-24 h-24 rounded-full object-cover border-4 border-slate-700"
                />
              ) : (
                <div className="w-24 h-24 bg-gradient-to-br from-amber-500 to-amber-600 rounded-full flex items-center justify-center text-slate-950 text-3xl font-bold">
                  {profile.username?.charAt(0).toUpperCase()}
                </div>
              )}
              {isOwnProfile && (
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
              )}
              {uploadingAvatar && (
                <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center">
                  <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </div>

            {/* Info */}
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h3 className="text-2xl font-bold text-white">{profile.username}</h3>
                <span className={`px-3 py-1 rounded text-sm font-medium border ${getRoleColor(profile.role)}`}>
                  {getRoleName(profile.role)}
                </span>
              </div>
              {profile.full_name && (
                <p className="text-gray-400 mb-2">{profile.full_name}</p>
              )}
              <div className="flex items-center gap-4 text-sm text-gray-500">
                <div className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  <span>Membro desde: {formatDate(profile.joined_at)}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Activity className="w-4 h-4" />
                  <span>Última atividade: {formatDate(profile.updated_at)}</span>
                </div>
              </div>
            </div>

            {/* Points */}
            <div className="text-right">
              <div className="flex items-center gap-2 text-amber-400 mb-1">
                <Award className="w-5 h-5" />
                <span className="text-sm font-medium">Pontos Totais</span>
              </div>
              <p className="text-4xl font-bold text-white">{formatNumber(profile.total_points)}</p>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
            <div className="flex items-center gap-2 mb-2">
              <Award className="w-5 h-5 text-green-400" />
              <span className="text-gray-400 text-sm">Total Ganho</span>
            </div>
            <p className="text-2xl font-bold text-green-400">
              {pointsStats ? formatNumber(pointsStats.totalEarned) : '0'}
            </p>
          </div>
          <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
            <div className="flex items-center gap-2 mb-2">
              <Award className="w-5 h-5 text-red-400 rotate-180" />
              <span className="text-gray-400 text-sm">Total Gasto</span>
            </div>
            <p className="text-2xl font-bold text-red-400">
              {pointsStats ? formatNumber(pointsStats.totalSpent) : '0'}
            </p>
          </div>
          <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="w-5 h-5 text-blue-400" />
              <span className="text-gray-400 text-sm">Missões Ativas</span>
            </div>
            <p className="text-2xl font-bold text-blue-400">
              {userMissions.length}
            </p>
          </div>
        </div>

        {/* Activity and Missions */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Activity */}
          <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
            <h4 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Activity className="w-5 h-5 text-amber-500" />
              Atividade Recente
            </h4>
            {recentActivity.length === 0 ? (
              <p className="text-gray-500 text-sm">Nenhuma atividade recente</p>
            ) : (
              <div className="space-y-3">
                {recentActivity.map((activity) => (
                  <div key={activity.id} className="bg-slate-900/50 rounded p-3">
                    <div className="flex justify-between items-start mb-1">
                      <span className="text-sm text-white">{activity.reason}</span>
                      <span className={`text-sm font-medium ${activity.amount > 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {activity.amount > 0 ? '+' : ''}{formatNumber(activity.amount)} pts
                      </span>
                    </div>
                    <div className="text-xs text-gray-500">{formatDate(activity.created_at)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Active Missions */}
          <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
            <h4 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Shield className="w-5 h-5 text-amber-500" />
              Missões em Andamento
            </h4>
            {userMissions.length === 0 ? (
              <p className="text-gray-500 text-sm">Nenhuma missão ativa</p>
            ) : (
              <div className="space-y-3">
                {userMissions.map((participation) => (
                  <div key={participation.id} className="bg-slate-900/50 rounded p-3">
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-sm text-white font-medium">
                        {participation.missions?.title || 'Missão'}
                      </span>
                      <span className="text-xs text-amber-400">
                        {participation.missions?.points_reward || 0} pts
                      </span>
                    </div>
                    <div className="text-xs text-gray-500">
                      Contribuição: {formatNumber(participation.contribution_quantity || 0)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserProfile;
