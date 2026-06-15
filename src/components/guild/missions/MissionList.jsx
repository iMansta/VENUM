import { useState, useEffect } from 'react';
import { Target, Users, Calendar, Award, Plus, Filter } from 'lucide-react';
import { getActiveMissions } from '@/lib/supabase/missions';

/**
 * MissionList component - Display list of active guild missions
 */

const MissionList = ({ userRole }) => {
  const [missions, setMissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all, gathering, crafting, pvp, trading

  useEffect(() => {
    loadMissions();
  }, []);

  const loadMissions = async () => {
    setLoading(true);
    try {
      const { success, data } = await getActiveMissions();
      if (success) {
        setMissions(data);
      }
    } catch (error) {
      console.error('Error loading missions:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredMissions = filter === 'all' 
    ? missions 
    : missions.filter(m => m.mission_type === filter);

  const getMissionTypeColor = (type) => {
    const colors = {
      gathering: 'bg-green-500/20 text-green-400 border-green-500/30',
      crafting: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      pvp: 'bg-red-500/20 text-red-400 border-red-500/30',
      trading: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
      other: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    };
    return colors[type] || colors.other;
  };

  const getMissionTypeName = (type) => {
    const names = {
      gathering: 'Coleta',
      crafting: 'Crafting',
      pvp: 'PvP',
      trading: 'Comércio',
      other: 'Outro',
    };
    return names[type] || 'Outro';
  };

  const formatSilver = (value) => {
    return new Intl.NumberFormat('pt-BR').format(Math.round(value));
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
          {userRole === 'admin' || userRole === 'officer' ? (
            <button className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-semibold py-2 px-4 rounded-lg flex items-center gap-2 transition-colors">
              <Plus className="w-5 h-5" />
              Nova Missão
            </button>
          ) : null}
        </div>
      </div>

      {/* Filters */}
      <div className="p-4 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400" />
          <div className="flex gap-2">
            {['all', 'gathering', 'crafting', 'pvp', 'trading'].map((type) => (
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
              <div
                key={mission.id}
                className="bg-slate-800/50 rounded-lg p-4 border border-slate-700 hover:border-amber-500/50 transition-all"
              >
                {/* Mission Type Badge */}
                <div className="flex items-center justify-between mb-3">
                  <span className={`px-2 py-1 rounded text-xs font-medium border ${getMissionTypeColor(mission.mission_type)}`}>
                    {getMissionTypeName(mission.mission_type)}
                  </span>
                  <div className="flex items-center gap-1 text-amber-400">
                    <Award className="w-4 h-4" />
                    <span className="text-sm font-medium">{mission.points_reward} pts</span>
                  </div>
                </div>

                {/* Mission Title */}
                <h3 className="text-lg font-semibold text-white mb-2">
                  {mission.title}
                </h3>

                {/* Mission Description */}
                {mission.description && (
                  <p className="text-sm text-gray-400 mb-3 line-clamp-2">
                    {mission.description}
                  </p>
                )}

                {/* Mission Details */}
                <div className="space-y-2 mb-3">
                  {mission.target_item && (
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-gray-400">Item:</span>
                      <span className="text-white">{mission.target_item}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-gray-400">Meta:</span>
                    <span className="text-white">
                      {formatSilver(mission.current_quantity)} / {formatSilver(mission.target_quantity)}
                    </span>
                  </div>
                  <div className="w-full bg-slate-700 rounded-full h-2">
                    <div
                      className="bg-amber-500 h-2 rounded-full transition-all"
                      style={{
                        width: `${Math.min((mission.current_quantity / mission.target_quantity) * 100, 100)}%`
                      }}
                    />
                  </div>
                </div>

                {/* Participants */}
                <div className="flex items-center gap-2 text-sm text-gray-400 mb-3">
                  <Users className="w-4 h-4" />
                  <span>{mission.mission_participants?.length || 0} participantes</span>
                </div>

                {/* Dates */}
                <div className="flex items-center gap-2 text-xs text-gray-500 mb-4">
                  <Calendar className="w-3 h-3" />
                  <span>
                    {new Date(mission.start_date).toLocaleDateString('pt-BR')} - 
                    {mission.end_date ? new Date(mission.end_date).toLocaleDateString('pt-BR') : 'Sem prazo'}
                  </span>
                </div>

                {/* Action Button */}
                <button className="w-full bg-slate-700 hover:bg-slate-600 text-white font-medium py-2 px-4 rounded-lg transition-colors">
                  Participar
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default MissionList;
