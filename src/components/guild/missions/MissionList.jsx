import { useState, useEffect } from 'react';
import { Target, Filter, History, Award, Users, User } from 'lucide-react';
import { getActiveMissions, getUserMissionHistory, joinMission } from '@/lib/supabase/missions';
import { getMissionTargetLabel } from '@/constants/missionTargets';
import MissionCard from './MissionCard';

/**
 * MissionList component - Display list of active guild missions
 */

const MissionList = ({ userId, userRole }) => {
  const [missions, setMissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all, gathering, crafting, pve, pvp, trading
  const [participatingMissions, setParticipatingMissions] = useState(new Set());
  const [tab, setTab] = useState('active'); // active | history
  const [history, setHistory] = useState([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);

  useEffect(() => {
    loadMissions();
  }, []);

  useEffect(() => {
    if (tab === 'history' && !historyLoaded) loadHistory();
  }, [tab, historyLoaded]);

  const loadHistory = async () => {
    const { success, data } = await getUserMissionHistory(userId);
    if (success) setHistory(data);
    setHistoryLoaded(true);
  };

  const autoEnrollIndividualMissions = async (missionRows) => {
    if (!userId) return missionRows;
    const pending = (missionRows || []).filter(
      (m) =>
        m.mission_scope !== 'group' &&
        !m.mission_participants?.some((p) => p.profile_id === userId)
    );
    if (pending.length === 0) return missionRows;

    await Promise.all(pending.map((m) => joinMission(m.id, userId).catch(() => null)));

    const { success, data } = await getActiveMissions();
    return success ? data || missionRows : missionRows;
  };

  const loadMissions = async () => {
    setLoading(true);
    try {
      const { success, data } = await getActiveMissions();
      if (success) {
        const enrolled = await autoEnrollIndividualMissions(data);
        // Missões INDIVIDUAIS: quando o jogador atinge a própria meta, a missão some
        // da lista DELE (mas continua para os demais). Missões de GRUPO permanecem
        // visíveis para todos até a meta coletiva ser atingida (aí são arquivadas).
        const visibleMissions = (enrolled || []).filter((m) => {
          if (m.mission_scope === 'group') return true;
          const mine = m.mission_participants?.find((p) => p.profile_id === userId);
          const target = Number(m.target_quantity) || 0;
          const myContribution = Number(mine?.contribution_quantity) || 0;
          const completedByMe = target > 0 && myContribution >= target;
          return !completedByMe;
        });

        setMissions(visibleMissions);
        // Check which missions the user is participating in
        const participatingIds = new Set(
          visibleMissions
            .filter(m => m.mission_participants?.some(p => p.profile_id === userId))
            .map(m => m.id)
        );
        setParticipatingMissions(participatingIds);
      }
    } catch (error) {
      console.error('Error loading missions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleParticipationChange = (missionId, isParticipating) => {
    setParticipatingMissions(prev => {
      const newSet = new Set(prev);
      if (isParticipating) {
        newSet.add(missionId);
      } else {
        newSet.delete(missionId);
      }
      return newSet;
    });
    // Reload missions to update participant count
    loadMissions();
  };

  const filteredMissions = filter === 'all' 
    ? missions 
    : missions.filter(m => m.mission_type === filter);

  const getMissionTypeName = (type) => {
    const names = {
      gathering: 'Coleta',
      crafting: 'Crafting',
      pve: 'PvE',
      pvp: 'PvP',
      trading: 'Comércio',
      other: 'Outro',
    };
    return names[type] || 'Outro';
  };

  return (
    <div className="bg-slate-900 rounded-lg border border-slate-800 overflow-hidden">
      {/* Header */}
      <div className="bg-slate-800 px-6 py-4 border-b border-slate-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Target className="w-6 h-6 text-amber-500" />
            <h2 className="text-xl font-bold text-white">Missões da Guilda</h2>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 px-4 pt-3 border-b border-slate-800">
        <button
          onClick={() => setTab('active')}
          className={`px-4 py-2 text-sm font-medium -mb-px border-b-2 transition-colors flex items-center gap-2 ${
            tab === 'active'
              ? 'border-amber-500 text-white'
              : 'border-transparent text-gray-400 hover:text-gray-200'
          }`}
        >
          <Target className="w-4 h-4" /> Ativas
        </button>
        <button
          onClick={() => setTab('history')}
          className={`px-4 py-2 text-sm font-medium -mb-px border-b-2 transition-colors flex items-center gap-2 ${
            tab === 'history'
              ? 'border-amber-500 text-white'
              : 'border-transparent text-gray-400 hover:text-gray-200'
          }`}
        >
          <History className="w-4 h-4" /> Histórico de Missões
        </button>
      </div>

      {tab === 'history' ? (
        <div className="p-6">
          {!historyLoaded ? (
            <div className="text-center py-12">
              <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-gray-400">Carregando histórico...</p>
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-12">
              <History className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-400 mb-2">Nenhuma missão concluída</h3>
              <p className="text-gray-500">Suas missões concluídas aparecerão aqui.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {history.map((ev) => {
                const m = ev.missions || {};
                const isGroup = m.mission_scope === 'group';
                return (
                  <div
                    key={ev.id}
                    className="flex items-center gap-4 p-4 bg-slate-800/50 rounded-lg border border-slate-700"
                  >
                    <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center shrink-0">
                      {isGroup ? (
                        <Users className="w-5 h-5 text-cyan-400" />
                      ) : (
                        <User className="w-5 h-5 text-amber-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-medium truncate">
                        {m.title || 'Missão concluída'}
                      </p>
                      <p className="text-xs text-gray-400">
                        {isGroup ? 'Grupo' : 'Individual'}
                        {m.target_item ? ` · ${getMissionTargetLabel(m.target_item)}` : ''}
                        {ev.awarded_at
                          ? ` · ${new Date(ev.awarded_at).toLocaleDateString('pt-BR')}`
                          : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 text-green-400 shrink-0">
                      <Award className="w-4 h-4" />
                      <span className="text-sm font-medium">+{ev.awarded_points || 0} pts</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <>
      {/* Filters */}
      <div className="p-4 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400" />
          <div className="flex gap-2">
            {['all', 'gathering', 'crafting', 'pve', 'pvp', 'trading'].map((type) => (
              <button
                key={type}
                onClick={() => setFilter(type)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  filter === type
                    ? 'bg-amber-500 text-slate-950'
                    : 'bg-slate-800 text-gray-400 hover:bg-slate-700 hover:text-white'
                }`}
              >
                {type === 'all' ? 'Todas' : getMissionTypeName(type)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Mission List */}
      <div className="p-6">
        {loading ? (
          <div className="text-center py-12">
            <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-400">Carregando missões...</p>
          </div>
        ) : filteredMissions.length === 0 ? (
          <div className="text-center py-12">
            <Target className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-400 mb-2">
              Nenhuma Missão Ativa
            </h3>
            <p className="text-gray-500">
              {filter === 'all' 
                ? 'Não há missões ativas no momento.' 
                : `Não há missões do tipo "${getMissionTypeName(filter)}" ativas.`}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredMissions.map((mission) => (
              <MissionCard
                key={mission.id}
                mission={mission}
                userId={userId}
                isParticipating={participatingMissions.has(mission.id)}
                onParticipationChange={handleParticipationChange}
              />
            ))}
          </div>
        )}
      </div>
        </>
      )}
    </div>
  );
};

export default MissionList;
