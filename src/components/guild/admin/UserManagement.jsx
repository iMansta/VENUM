import { useState, useEffect } from 'react';
import { Users, Shield, Award, Clock, Activity, Search, ChevronDown, ChevronUp } from 'lucide-react';
import { getGuildMembers, updateUserRole, deactivateUser } from '../../../lib/supabase/profiles';
import { getUserPointsLedger } from '../../../lib/supabase/points';

/**
 * UserManagement component - Admin panel for managing guild members
 */

const UserManagement = ({ userId, userRole }) => {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState('joined_at');
  const [sortDirection, setSortDirection] = useState('desc');
  const [expandedUser, setExpandedUser] = useState(null);
  const [userActivity, setUserActivity] = useState({});

  useEffect(() => {
    loadMembers();
  }, []);

  const loadMembers = async () => {
    setLoading(true);
    const { success, data } = await getGuildMembers();
    if (success) {
      setMembers(data);
    }
    setLoading(false);
  };

  const loadUserActivity = async (profileId) => {
    const { success, data } = await getUserPointsLedger(profileId, 5);
    if (success) {
      setUserActivity(prev => ({
        ...prev,
        [profileId]: data,
      }));
    }
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const handleRoleChange = async (profileId, newRole) => {
    const result = await updateUserRole(profileId, newRole);
    if (result.success) {
      loadMembers();
    }
  };

  const handleDeactivate = async (profileId) => {
    if (window.confirm('Tem certeza que deseja desativar este usuário?')) {
      const result = await deactivateUser(profileId);
      if (result.success) {
        loadMembers();
      }
    }
  };

  const handleExpandUser = async (member) => {
    if (expandedUser === member.id) {
      setExpandedUser(null);
    } else {
      setExpandedUser(member.id);
      if (!userActivity[member.id]) {
        await loadUserActivity(member.id);
      }
    }
  };

  const filteredMembers = members.filter(member =>
    member.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    member.full_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const sortedMembers = [...filteredMembers].sort((a, b) => {
    let comparison = 0;
    if (sortField === 'joined_at') {
      comparison = new Date(a.joined_at) - new Date(b.joined_at);
    } else if (sortField === 'total_points') {
      comparison = (a.total_points || 0) - (b.total_points || 0);
    } else if (sortField === 'username') {
      comparison = a.username?.localeCompare(b.username) || 0;
    }
    return sortDirection === 'asc' ? comparison : -comparison;
  });

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
      admin: 'Admin',
      officer: 'Oficial',
      member: 'Membro',
    };
    return names[role] || 'Membro';
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

  const formatNumber = (value) => {
    return new Intl.NumberFormat('pt-BR').format(value || 0);
  };

  return (
    <div className="space-y-6">
      {/* Search and Filter */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-500" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-10 pr-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
            placeholder="Buscar usuário..."
          />
        </div>
        <div className="text-sm text-gray-400">
          {sortedMembers.length} de {members.length} membros
        </div>
      </div>

      {/* Members Table */}
      {loading ? (
        <div className="text-center py-12">
          <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400">Carregando membros...</p>
        </div>
      ) : sortedMembers.length === 0 ? (
        <div className="bg-slate-800/30 rounded-lg p-12 text-center">
          <Users className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-400 mb-2">
            Nenhum membro encontrado
          </h3>
          <p className="text-gray-500">
            {searchTerm ? 'Tente outro termo de busca.' : 'Nenhum membro cadastrado ainda.'}
          </p>
        </div>
      ) : (
        <div className="bg-slate-800/50 rounded-lg border border-slate-700 overflow-hidden">
          {/* Table Header */}
          <div className="grid grid-cols-12 gap-4 px-6 py-3 bg-slate-800 border-b border-slate-700 text-xs font-semibold text-gray-400 uppercase tracking-wider">
            <div className="col-span-3 cursor-pointer hover:text-white" onClick={() => handleSort('username')}>
              Usuário {sortField === 'username' && (sortDirection === 'asc' ? <ChevronUp className="inline w-4 h-4" /> : <ChevronDown className="inline w-4 h-4" />)}
            </div>
            <div className="col-span-2">Função</div>
            <div className="col-span-2 cursor-pointer hover:text-white" onClick={() => handleSort('total_points')}>
              Pontos {sortField === 'total_points' && (sortDirection === 'asc' ? <ChevronUp className="inline w-4 h-4" /> : <ChevronDown className="inline w-4 h-4" />)}
            </div>
            <div className="col-span-2 cursor-pointer hover:text-white" onClick={() => handleSort('joined_at')}>
              Entrou {sortField === 'joined_at' && (sortDirection === 'asc' ? <ChevronUp className="inline w-4 h-4" /> : <ChevronDown className="inline w-4 h-4" />)}
            </div>
            <div className="col-span-2">Status</div>
            <div className="col-span-1">Ações</div>
          </div>

          {/* Table Body */}
          <div className="divide-y divide-slate-700">
            {sortedMembers.map((member) => (
              <div key={member.id}>
                {/* Main Row */}
                <div className="grid grid-cols-12 gap-4 px-6 py-4 hover:bg-slate-800/50 transition-colors items-center">
                  <div className="col-span-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-slate-700 rounded-full flex items-center justify-center text-white font-bold">
                        {member.username?.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium text-white">{member.username}</p>
                        {member.full_name && (
                          <p className="text-xs text-gray-500">{member.full_name}</p>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="col-span-2">
                    <select
                      value={member.role}
                      onChange={(e) => handleRoleChange(member.id, e.target.value)}
                      disabled={member.id === userId}
                      className={`px-2 py-1 rounded text-xs font-medium border ${getRoleColor(member.role)} ${member.id === userId ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                    >
                      <option value="member">Membro</option>
                      <option value="officer">Oficial</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                  <div className="col-span-2">
                    <div className="flex items-center gap-1 text-amber-400">
                      <Award className="w-4 h-4" />
                      <span className="font-medium">{formatNumber(member.total_points)}</span>
                    </div>
                  </div>
                  <div className="col-span-2">
                    <div className="flex items-center gap-1 text-gray-400 text-sm">
                      <Clock className="w-4 h-4" />
                      <span>{formatDate(member.joined_at)}</span>
                    </div>
                  </div>
                  <div className="col-span-2">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${member.is_active ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                      {member.is_active ? 'Ativo' : 'Inativo'}
                    </span>
                  </div>
                  <div className="col-span-1">
                    <button
                      onClick={() => handleExpandUser(member)}
                      className="text-gray-400 hover:text-white p-1 rounded hover:bg-slate-700 transition-colors"
                    >
                      {expandedUser === member.id ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                {/* Expanded Details */}
                {expandedUser === member.id && (
                  <div className="px-6 py-4 bg-slate-900/50 border-t border-slate-700">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Activity */}
                      <div>
                        <h4 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                          <Activity className="w-4 h-4 text-amber-500" />
                          Atividade Recente
                        </h4>
                        {userActivity[member.id] ? (
                          <div className="space-y-2">
                            {userActivity[member.id].map((activity) => (
                              <div key={activity.id} className="text-sm">
                                <div className="flex justify-between">
                                  <span className="text-gray-400">{activity.reason}</span>
                                  <span className={`font-medium ${activity.amount > 0 ? 'text-green-400' : 'text-red-400'}`}>
                                    {activity.amount > 0 ? '+' : ''}{formatNumber(activity.amount)} pts
                                  </span>
                                </div>
                                <div className="text-xs text-gray-500">{formatDate(activity.created_at)}</div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-gray-500">Nenhuma atividade recente</p>
                        )}
                      </div>

                      {/* Actions */}
                      <div>
                        <h4 className="text-sm font-semibold text-white mb-3">Ações</h4>
                        <div className="space-y-2">
                          {member.is_active && member.id !== userId && (
                            <button
                              onClick={() => handleDeactivate(member.id)}
                              className="w-full bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 font-medium py-2 px-4 rounded-lg transition-colors text-sm"
                            >
                              Desativar Usuário
                            </button>
                          )}
                          <button
                            onClick={() => window.open(`/profile/${member.id}`, '_blank')}
                            className="w-full bg-slate-700 hover:bg-slate-600 text-white font-medium py-2 px-4 rounded-lg transition-colors text-sm"
                          >
                            Ver Perfil Completo
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;
