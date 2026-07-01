import { useState, useEffect } from 'react';
import { User, Save } from 'lucide-react';
import { getProfile, updateProfile } from '@/lib/supabase/profiles';

const UserProfile = ({ userId }) => {
  const [profile, setProfile] = useState(null);
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    loadProfile();
  }, [userId]);

  const loadProfile = async () => {
    if (!userId) return;
    setLoading(true);
    const { success, data } = await getProfile(userId);
    if (success && data) {
      setProfile(data);
      setUsername(data.username || '');
      setFullName(data.full_name || '');
    }
    setLoading(false);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage('');
    const { success, error } = await updateProfile(userId, {
      username: username.trim(),
      full_name: fullName.trim(),
    });
    if (success) {
      setMessage('Perfil atualizado com sucesso!');
      loadProfile();
    } else {
      setMessage(error || 'Erro ao salvar perfil');
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="w-8 h-8 border-4 border-red-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="bg-slate-900 rounded-lg border border-slate-800 p-6 max-w-lg">
      <div className="flex items-center gap-3 mb-6">
        <User className="w-6 h-6 text-red-500" />
        <h2 className="text-lg font-semibold text-white">Meu Perfil</h2>
      </div>

      <form onSubmit={handleSave} className="space-y-4">
        <div>
          <label className="block text-sm text-gray-400 mb-1">Usuário</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-red-500"
            required
          />
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1">Nome completo</label>
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-red-500"
          />
        </div>
        <div className="text-sm text-gray-500">
          <p>Função: <span className="text-white capitalize">{profile?.role || 'member'}</span></p>
          <p>Pontos: <span className="text-amber-400">{profile?.total_points ?? 0}</span></p>
        </div>
        {message && (
          <p className={`text-sm ${message.includes('sucesso') ? 'text-green-400' : 'text-red-400'}`}>
            {message}
          </p>
        )}
        <button
          type="submit"
          disabled={saving}
          className="flex items-center gap-2 bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <Save className="w-4 h-4" />
          {saving ? 'Salvando...' : 'Salvar'}
        </button>
      </form>
    </div>
  );
};

export default UserProfile;
