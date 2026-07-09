import { useState, useEffect, useMemo } from 'react';
import {
  Users,
  Shield,
  Award,
  Search,
  ChevronDown,
  ChevronUp,
  UserCheck,
  UserX,
  Crown,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import { getGuildMembers, updateUserRole, deactivateUser } from '@/lib/supabase/profiles';
import { getUserPointsLedger } from '@/lib/supabase/points';

const ROLE_OPTIONS = [
  { value: 'member', label: 'Membro' },
  { value: 'officer', label: 'Oficial' },
  { value: 'staff', label: 'Staff' },
  { value: 'admin', label: 'Admin' },
];

const UserManagement = ({ userId, userRole }) => {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortField, setSortField] = useState('total_points');
  const [sortDirection, setSortDirection] = useState('desc');
  const [expandedUser, setExpandedUser] = useState(null);
  const [userActivity, setUserActivity] = useState({});

  useEffect(() => {
    loadMembers();
  }, []);

  const loadMembers = async () => {
    setLoading(true);
    const { success, data } = await getGuildMembers();
    if (success) setMembers(data);
    setLoading(false);
  };

  const loadUserActivity = async (profileId) => {
    const { success, data } = await getUserPointsLedger(profileId, 8);
    if (success) {
      setUserActivity((prev) => ({ ...prev, [profileId]: data }));
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
    if (result.success) loadMembers();
  };

  const handleDeactivate = async (profileId) => {
    if (window.confirm('Desativar este membro? Ele perde acesso ao hub.')) {
      const result = await deactivateUser(profileId);
      if (result.success) loadMembers();
    }
  };

  const toggleExpand = async (member) => {
    if (expandedUser === member.id) {
      setExpandedUser(null);
      return;
    }
    setExpandedUser(member.id);
    if (!userActivity[member.id]) await loadUserActivity(member.id);
  };

  const stats = useMemo(() => ({
    total: members.length,
    active: members.filter((m) => m.is_active).length,
    admins: members.filter((m) => m.role === 'admin').length,
    officers: members.filter((m) => m.role === 'officer').length,
    totalPoints: members.reduce((s, m) => s + (m.total_points || 0), 0),
  }), [members]);

  const filteredMembers = useMemo(() => {
    let list = members.filter((member) => {
      const q = searchTerm.toLowerCase();
      const matchesSearch =
        member.username?.toLowerCase().includes(q) ||
        member.full_name?.toLowerCase().includes(q) ||
        member.albion_character_name?.toLowerCase().includes(q);
      const matchesRole = roleFilter === 'all' || member.role === roleFilter;
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && member.is_active) ||
        (statusFilter === 'inactive' && !member.is_active);
      return matchesSearch && matchesRole && matchesStatus;
    });

    list.sort((a, b) => {
      let cmp = 0;
      if (sortField === 'joined_at') {
        cmp = new Date(a.joined_at || 0) - new Date(b.joined_at || 0);
      } else if (sortField === 'total_points') {
        cmp = (a.total_points || 0) - (b.total_points || 0);
      } else if (sortField === 'username') {
        cmp = (a.username || '').localeCompare(b.username || '');
      }
      return sortDirection === 'asc' ? cmp : -cmp;
    });

    return list;
  }, [members, searchTerm, roleFilter, statusFilter, sortField, sortDirection]);

  const getRoleBadge = (role) => {
    const styles = {
      admin: 'bg-red-500/15 text-red-400 ring-red-500/30',
      staff: 'bg-fuchsia-500/15 text-fuchsia-300 ring-fuchsia-500/30',
      officer: 'bg-amber-500/15 text-amber-400 ring-amber-500/30',
      member: 'bg-blue-500/15 text-blue-400 ring-blue-500/30',
    };
    const labels = { admin: 'Admin', staff: 'Staff', officer: 'Oficial', member: 'Membro' };
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium ring-1 ring-inset ${styles[role] || styles.member}`}>
        {(role === 'admin' || role === 'staff') && <Crown className="w-3 h-3" />}
        {labels[role] || 'Membro'}
      </span>
    );
  };

  const formatDate = (dateString) => {
    if (!dateString) return '—';
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const formatNumber = (value) => new Intl.NumberFormat('pt-BR').format(value || 0);

  const SortHeader = ({ field, children }) => (
    <button
      type="button"
      onClick={() => handleSort(field)}
      className="flex items-center gap-1 text-xs font-semibold text-gray-400 uppercase tracking-wider hover:text-white transition-colors"
    >
      {children}
      {sortField === field && (sortDirection === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
    </button>
  );

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          { label: 'Membros', value: stats.total, icon: Users, color: 'text-blue-400' },
          { label: 'Ativos', value: stats.active, icon: UserCheck, color: 'text-emerald-400' },
          { label: 'Admins', value: stats.admins, icon: Shield, color: 'text-red-400' },
          { label: 'Oficiais', value: stats.officers, icon: Crown, color: 'text-amber-400' },
          { label: 'Pontos totais', value: formatNumber(stats.totalPoints), icon: Award, color: 'text-amber-400' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-slate-950/50 border border-slate-800 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <Icon className={`w-4 h-4 ${color}`} />
              <span className="text-xs text-gray-500">{label}</span>
            </div>
            <p className="text-xl font-bold text-white">{value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
            placeholder="Buscar por nick, nome ou personagem Albion..."
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white"
        >
          <option value="all">Todos os cargos</option>
          <option value="admin">Admin</option>
          <option value="staff">Staff</option>
          <option value="officer">Oficial</option>
          <option value="member">Membro</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white"
        >
          <option value="all">Todos</option>
          <option value="active">Ativos</option>
          <option value="inactive">Inativos</option>
        </select>
        <button
          type="button"
          onClick={loadMembers}
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-sm text-white border border-slate-700"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </button>
      </div>

      <p className="text-xs text-gray-500">
        {filteredMembers.length} de {members.length} membros
      </p>

      {loading ? (
        <div className="text-center py-16">
          <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-400 text-sm">Carregando membros...</p>
        </div>
      ) : filteredMembers.length === 0 ? (
        <div className="bg-slate-950/50 border border-slate-800 rounded-xl p-12 text-center">
          <Users className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400">Nenhum membro encontrado</p>
        </div>
      ) : (
        <div className="bg-slate-950/40 border border-slate-800 rounded-xl overflow-hidden">
          <div className="hidden md:grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)_100px_100px_140px] gap-4 px-4 py-3 bg-slate-900/80 border-b border-slate-800">
            <SortHeader field="username">Membro</SortHeader>
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Cargo</span>
            <SortHeader field="total_points">Pontos</SortHeader>
            <SortHeader field="joined_at">Entrada</SortHeader>
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider text-right">Ações</span>
          </div>

          <div className="divide-y divide-slate-800/80">
            {filteredMembers.map((member) => {
              const isExpanded = expandedUser === member.id;
              const activity = userActivity[member.id] || [];

              return (
                <div key={member.id} className="hover:bg-slate-900/30 transition-colors">
                  <div className="grid grid-cols-1 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_100px_100px_140px] gap-3 md:gap-4 px-4 py-3 items-center">
                    <button
                      type="button"
                      onClick={() => toggleExpand(member)}
                      className="flex items-center gap-3 text-left min-w-0"
                    >
                      {member.avatar_url ? (
                        <img src={member.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover ring-2 ring-slate-700" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center text-white font-bold ring-2 ring-slate-700">
                          {member.username?.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-white truncate">{member.username}</span>
                          {!member.is_active && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-400">Inativo</span>
                          )}
                        </div>
                        {(member.full_name || member.albion_character_name) && (
                          <p className="text-xs text-gray-500 truncate">
                            {[member.full_name, member.albion_character_name].filter(Boolean).join(' · ')}
                          </p>
                        )}
                      </div>
                      {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-500 ml-auto md:hidden" /> : <ChevronDown className="w-4 h-4 text-gray-500 ml-auto md:hidden" />}
                    </button>

                    <div className="flex md:block pl-14 md:pl-0">{getRoleBadge(member.role)}</div>

                    <div className="flex items-center gap-1 pl-14 md:pl-0">
                      <Award className="w-3.5 h-3.5 text-amber-500 md:hidden" />
                      <span className="font-bold text-amber-400">{formatNumber(member.total_points)}</span>
                    </div>

                    <p className="text-sm text-gray-400 pl-14 md:pl-0">{formatDate(member.joined_at)}</p>

                    <div className="flex items-center gap-2 justify-end pl-14 md:pl-0 flex-wrap">
                      <select
                        value={member.role}
                        onChange={(e) => handleRoleChange(member.id, e.target.value)}
                        disabled={member.id === userId}
                        className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white disabled:opacity-40"
                      >
                        {ROLE_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                      {member.is_active && member.id !== userId && (
                        <button
                          type="button"
                          onClick={() => handleDeactivate(member.id)}
                          className="p-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20"
                          title="Desativar"
                        >
                          <UserX className="w-4 h-4" />
                        </button>
                      )}
                      <a
                        href={`/profile/${member.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1.5 rounded-lg bg-slate-800 text-gray-300 hover:text-white border border-slate-700"
                        title="Ver perfil"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="px-4 pb-4 pt-0 ml-0 md:ml-14">
                      <div className="bg-slate-900/60 rounded-lg border border-slate-800 p-3">
                        <p className="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wider">Últimos pontos</p>
                        {activity.length === 0 ? (
                          <p className="text-xs text-gray-500">Sem movimentações recentes</p>
                        ) : (
                          <ul className="space-y-1.5">
                            {activity.map((entry) => (
                              <li key={entry.id} className="flex justify-between text-xs">
                                <span className="text-gray-300 truncate mr-2">{entry.reason || entry.transaction_type}</span>
                                <span className={entry.amount >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                                  {entry.amount >= 0 ? '+' : ''}{formatNumber(entry.amount)}
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;
