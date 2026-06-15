import { useState } from 'react';
import { Target, Users, Calendar, Award, Check, X, TrendingUp } from 'lucide-react';
import { joinMission, leaveMission } from '@/lib/supabase/missions';

/**
 * MissionCard component - Individual mission card with participation controls
 */

const MissionCard = ({ mission, userId, isParticipating, onParticipationChange }) => {
  const [loading, setLoading] = useState(false);

  const handleParticipate = async () => {
    setLoading(true);
    const result = await joinMission(mission.id, userId);
    if (result.success) {
      onParticipationChange(mission.id, true);
    }
    setLoading(false);
  };

  const handleLeave = async () => {
    setLoading(true);
    const result = await leaveMission(mission.id, userId);
    if (result.success) {
      onParticipationChange(mission.id, false);
    }
    setLoading(false);
  };

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

  const progress = (mission.current_quantity / mission.target_quantity) * 100;

  return (
    <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700 hover:border-amber-500/50 transition-all">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <span className={`px-2 py-1 rounded text-xs font-medium border ${getMissionTypeColor(mission.mission_type)}`}>
          {getMissionTypeName(mission.mission_type)}
        </span>
        <div className="flex items-center gap-1 text-amber-400">
          <Award className="w-4 h-4" />
          <span className="text-sm font-medium">{mission.points_reward} pts</span>
        </div>
      </div>

      {/* Title */}
      <h3 className="text-lg font-semibold text-white mb-2">
        {mission.title}
      </h3>

      {/* Description */}
      {mission.description && (
        <p className="text-sm text-gray-400 mb-3 line-clamp-2">
          {mission.description}
        </p>
      )}

      {/* Progress */}
      <div className="space-y-2 mb-3">
        {mission.target_item && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-gray-400">Item:</span>
            <span className="text-white">{mission.target_item}</span>
          </div>
        )}
        <div className="flex items-center gap-2 text-sm">
          <span className="text-gray-400">Progresso:</span>
          <span className="text-white">
            {formatSilver(mission.current_quantity)} / {formatSilver(mission.target_quantity)}
          </span>
          <span className="text-green-400">({progress.toFixed(1)}%)</span>
        </div>
        <div className="w-full bg-slate-700 rounded-full h-2">
          <div
            className="bg-amber-500 h-2 rounded-full transition-all"
            style={{ width: `${Math.min(progress, 100)}%` }}
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
      {isParticipating ? (
        <button
          onClick={handleLeave}
          disabled={loading}
          className="w-full bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 font-medium py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors"
        >
          <X className="w-4 h-4" />
          {loading ? 'Saindo...' : 'Sair da Missão'}
        </button>
      ) : (
        <button
          onClick={handleParticipate}
          disabled={loading}
          className="w-full bg-green-500/20 hover:bg-green-500/30 text-green-400 border border-green-500/30 font-medium py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors"
        >
          <Check className="w-4 h-4" />
          {loading ? 'Entrando...' : 'Participar'}
        </button>
      )}
    </div>
  );
};

export default MissionCard;
