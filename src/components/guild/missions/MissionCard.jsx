import { useState } from 'react';
import { Target, Users, Calendar, Award, Check, X, User } from 'lucide-react';
import { joinMission, leaveMission } from '@/lib/supabase/missions';
import { getMissionTargetLabel } from '@/constants/missionTargets';

/**
 * MissionCard component - Individual mission card with participation controls
 */

const MissionCard = ({ mission, userId, isParticipating, onParticipationChange }) => {
  const [loading, setLoading] = useState(false);

  const handleParticipate = async () => {
    console.log('handleParticipate called with missionId:', mission.id, 'userId:', userId);
    if (!userId) {
      console.error('userId is undefined');
      alert('Você precisa estar logado para participar de missões');
      return;
    }
    setLoading(true);
    const result = await joinMission(mission.id, userId);
    console.log('joinMission result:', result);
    if (result.success) {
      onParticipationChange(mission.id, true);
    } else {
      alert(`Erro ao participar: ${result.error}`);
    }
    setLoading(false);
  };

  const handleLeave = async () => {
    console.log('handleLeave called with missionId:', mission.id, 'userId:', userId);
    if (!userId) {
      console.error('userId is undefined');
      alert('Você precisa estar logado para sair de missões');
      return;
    }
    setLoading(true);
    const result = await leaveMission(mission.id, userId);
    console.log('leaveMission result:', result);
    if (result.success) {
      onParticipationChange(mission.id, false);
    } else {
      alert(`Erro ao sair: ${result.error}`);
    }
    setLoading(false);
  };

  const getMissionTypeColor = (type) => {
    const colors = {
      gathering: 'bg-green-500/20 text-green-400 border-green-500/30',
      crafting: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      pve: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
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
      pve: 'PvE',
      pvp: 'PvP',
      trading: 'Comércio',
      other: 'Outro',
    };
    return names[type] || 'Outro';
  };

  const formatSilver = (value) => {
    return new Intl.NumberFormat('pt-BR').format(Math.round(value));
  };

  const isGroup = mission.mission_scope === 'group';

  // Progresso individual do jogador.
  const myParticipation = mission.mission_participants?.find(
    (p) => p.profile_id === userId
  );
  const myContribution = Number(myParticipation?.contribution_quantity) || 0;
  const target = Number(mission.target_quantity) || 0;
  // Progresso coletivo (missões de grupo).
  const groupContribution = Number(mission.current_quantity) || 0;
  const shown = isGroup ? groupContribution : myContribution;
  const progress = target > 0 ? (shown / target) * 100 : 0;

  return (
    <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700 hover:border-amber-500/50 transition-all">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className={`px-2 py-1 rounded text-xs font-medium border ${getMissionTypeColor(mission.mission_type)}`}>
            {getMissionTypeName(mission.mission_type)}
          </span>
          <span
            className={`px-2 py-1 rounded text-xs font-medium border flex items-center gap-1 ${
              isGroup
                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30'
                : 'bg-slate-500/20 text-slate-300 border-slate-500/30'
            }`}
          >
            {isGroup ? <Users className="w-3 h-3" /> : <User className="w-3 h-3" />}
            {isGroup ? 'Grupo' : 'Individual'}
          </span>
        </div>
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
            <span className="text-gray-400">Objetivo:</span>
            <span className="text-white">{getMissionTargetLabel(mission.target_item)}</span>
          </div>
        )}
        {mission.mission_type === 'pve' && Number(mission.min_fame_threshold) > 0 && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-gray-400">minFameThreshold:</span>
            <span className="text-white">{formatSilver(mission.min_fame_threshold)}</span>
          </div>
        )}
        <div className="flex items-center gap-2 text-sm">
          <span className="text-gray-400">{isGroup ? 'Progresso do grupo:' : 'Meu progresso:'}</span>
          <span className="text-white">
            {formatSilver(shown)} / {formatSilver(target)}
          </span>
          <span className="text-green-400">({progress.toFixed(1)}%)</span>
        </div>
        <div className="w-full bg-slate-700 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all ${isGroup ? 'bg-cyan-500' : 'bg-amber-500'}`}
            style={{ width: `${Math.min(progress, 100)}%` }}
          />
        </div>
        {isGroup && myContribution > 0 && (
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span>Minha contribuição:</span>
            <span className="text-gray-300">{formatSilver(myContribution)}</span>
          </div>
        )}
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
