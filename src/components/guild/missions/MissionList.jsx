import { useState, useEffect } from 'react';
import { Target, Filter } from 'lucide-react';
import { getActiveMissions } from '@/lib/supabase/missions';
import MissionCard from './MissionCard';

/**
 * MissionList component - Display list of active guild missions
 */

const MissionList = ({ userId, userRole }) => {
  const [missions, setMissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all, gathering, crafting, pve, pvp, trading
  const [participatingMissions, setParticipatingMissions] = useState(new Set());

  useEffect(() => {
    loadMissions();
  }, []);

  const loadMissions = async () => {
    setLoading(true);
    try {
      const { success, data } = await getActiveMissions();
      if (success) {
        // Missões são individuais: quando o jogador atinge a meta individual
        // (contribution_quantity >= target_quantity) a missão some da lista DELE,
        // mas continua disponível para os demais dentro do prazo.
        const visibleMissions = (data || []).filter((m) => {
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
    </div>
  );
};

export default MissionList;
