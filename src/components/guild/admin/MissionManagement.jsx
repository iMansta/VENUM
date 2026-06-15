import { useState, useEffect } from 'react';
import { Target, Plus, Edit, Trash2, Check, X } from 'lucide-react';
import { getActiveMissions, updateMission, deleteMission } from '../../../lib/supabase/missions';
import MissionForm from '../missions/MissionForm';

/**
 * MissionManagement component - Admin panel for managing guild missions
 */

const MissionManagement = ({ userId, userRole }) => {
  const [missions, setMissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingMission, setEditingMission] = useState(null);

  useEffect(() => {
    loadMissions();
  }, []);

  const loadMissions = async () => {
    setLoading(true);
    const { success, data } = await getActiveMissions();
    if (success) {
      setMissions(data);
    }
    setLoading(false);
  };

  const handleCreateSuccess = () => {
    setShowCreateForm(false);
    loadMissions();
  };

  const handleEdit = (mission) => {
    setEditingMission(mission);
  };

  const handleEditSuccess = () => {
    setEditingMission(null);
    loadMissions();
  };

  const handleComplete = async (missionId) => {
    if (window.confirm('Tem certeza que deseja completar esta missão? Isso distribuirá pontos aos participantes.')) {
      // Implement complete mission logic
      const result = await updateMission(missionId, { status: 'completed' });
      if (result.success) {
        loadMissions();
      }
    }
  };

  const handleCancel = async (missionId) => {
    if (window.confirm('Tem certeza que deseja cancelar esta missão?')) {
      const result = await updateMission(missionId, { status: 'cancelled' });
      if (result.success) {
        loadMissions();
      }
    }
  };

  const handleDelete = async (missionId) => {
    if (window.confirm('Tem certeza que deseja excluir esta missão?')) {
      const result = await deleteMission(missionId);
      if (result.success) {
        loadMissions();
      }
    }
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

  const formatNumber = (value) => {
    return new Intl.NumberFormat('pt-BR').format(value || 0);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-white">Gerenciar Missões</h3>
        <button
          onClick={() => setShowCreateForm(true)}
          className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-semibold py-2 px-4 rounded-lg flex items-center gap-2 transition-colors"
        >
          <Plus className="w-5 h-5" />
          Nova Missão
        </button>
      </div>

      {/* Create/Edit Form Modal */}
      {(showCreateForm || editingMission) && (
        <MissionForm
          mission={editingMission}
          onSuccess={editingMission ? handleEditSuccess : handleCreateSuccess}
          onClose={() => {
            setShowCreateForm(false);
            setEditingMission(null);
          }}
        />
      )}

      {/* Missions List */}
      {loading ? (
        <div className="text-center py-12">
          <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400">Carregando missões...</p>
        </div>
      ) : missions.length === 0 ? (
        <div className="bg-slate-800/30 rounded-lg p-12 text-center">
          <Target className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-400 mb-2">
            Nenhuma Missão Ativa
          </h3>
          <p className="text-gray-500">Crie a primeira missão para começar.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {missions.map((mission) => (
            <div
              key={mission.id}
              className="bg-slate-800/50 rounded-lg p-4 border border-slate-700 hover:border-amber-500/50 transition-all"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  {/* Header */}
                  <div className="flex items-center gap-3 mb-2">
                    <span className={`px-2 py-1 rounded text-xs font-medium border ${getMissionTypeColor(mission.mission_type)}`}>
                      {getMissionTypeName(mission.mission_type)}
                    </span>
                    <h4 className="text-lg font-semibold text-white">{mission.title}</h4>
                    <div className="flex items-center gap-1 text-amber-400">
                      <span className="text-sm font-medium">{mission.points_reward} pts</span>
                    </div>
                  </div>

                  {/* Description */}
                  {mission.description && (
                    <p className="text-sm text-gray-400 mb-3">{mission.description}</p>
                  )}

                  {/* Details */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    {mission.target_item && (
                      <div>
                        <span className="text-gray-500">Item:</span>
                        <span className="text-white ml-2">{mission.target_item}</span>
                      </div>
                    )}
                    <div>
                      <span className="text-gray-500">Progresso:</span>
                      <span className="text-white ml-2">
                        {formatNumber(mission.current_quantity)} / {formatNumber(mission.target_quantity)}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500">Participantes:</span>
                      <span className="text-white ml-2">{mission.mission_participants?.length || 0}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Início:</span>
                      <span className="text-white ml-2">
                        {new Date(mission.start_date).toLocaleDateString('pt-BR')}
                      </span>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="mt-3">
                    <div className="w-full bg-slate-700 rounded-full h-2">
                      <div
                        className="bg-amber-500 h-2 rounded-full transition-all"
                        style={{
                          width: `${Math.min((mission.current_quantity / mission.target_quantity) * 100, 100)}%`
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 ml-4">
                  <button
                    onClick={() => handleEdit(mission)}
                    className="text-blue-400 hover:text-blue-300 p-2 rounded hover:bg-blue-500/10 transition-colors"
                    title="Editar"
                  >
                    <Edit className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => handleComplete(mission.id)}
                    className="text-green-400 hover:text-green-300 p-2 rounded hover:bg-green-500/10 transition-colors"
                    title="Completar"
                  >
                    <Check className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => handleCancel(mission.id)}
                    className="text-amber-400 hover:text-amber-300 p-2 rounded hover:bg-amber-500/10 transition-colors"
                    title="Cancelar"
                  >
                    <X className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => handleDelete(mission.id)}
                    className="text-red-400 hover:text-red-300 p-2 rounded hover:bg-red-500/10 transition-colors"
                    title="Excluir"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MissionManagement;
