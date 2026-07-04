import { useState } from 'react';
import { X, Save, Calendar, Target, Award } from 'lucide-react';
import { createMission } from '@/lib/supabase/missions';
import { getMissionTargetSuggestions } from '@/constants/missionTargets';

/**
 * MissionForm component - Form for creating/editing guild missions (Admin/Officer only)
 */

const MissionForm = ({ onClose, onSuccess, userId }) => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    mission_type: 'gathering',
    target_item: getMissionTargetSuggestions('gathering')[0]?.value || '',
    target_quantity: 0,
    minFameThreshold: 10000,
    points_reward: 0,
    start_date: new Date().toISOString().split('T')[0],
    end_date: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const targetSuggestions = getMissionTargetSuggestions(formData.mission_type);

  const toIsoDateTime = (dateValue, endOfDay = false) => {
    if (!dateValue) return null;
    const suffix = endOfDay ? 'T23:59:59.999Z' : 'T00:00:00.000Z';
    return `${dateValue}${suffix}`;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Validation
    if (!formData.title.trim()) {
      setError('O título é obrigatório');
      setLoading(false);
      return;
    }

    if (formData.target_quantity <= 0) {
      setError('A meta deve ser maior que zero');
      setLoading(false);
      return;
    }

    if (formData.points_reward <= 0) {
      setError('A recompensa em pontos deve ser maior que zero');
      setLoading(false);
      return;
    }

    if (formData.end_date && formData.end_date < formData.start_date) {
      setError('A data de término não pode ser anterior à data de início');
      setLoading(false);
      return;
    }

    const missionData = {
      ...formData,
      created_by: userId,
      target_quantity: parseInt(formData.target_quantity),
      min_fame_threshold:
        formData.mission_type === 'pve'
          ? Math.max(parseInt(formData.minFameThreshold || 0, 10) || 0, 0)
          : null,
      points_reward: parseInt(formData.points_reward),
      start_date: toIsoDateTime(formData.start_date, false),
      end_date: toIsoDateTime(formData.end_date, true),
      status: 'active',
    };

    console.log('Creating mission with data:', missionData);
    const result = await createMission(missionData);
    console.log('Mission creation result:', result);

    if (result.success) {
      onSuccess(result.data);
      onClose();
    } else {
      setError(result.error);
      console.error('Mission creation failed:', result.error);
    }

    setLoading(false);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleMissionTypeChange = (e) => {
    const missionType = e.target.value;
    const firstTarget = getMissionTargetSuggestions(missionType)[0]?.value || '';
    setFormData((prev) => ({
      ...prev,
      mission_type: missionType,
      target_item: firstTarget,
    }));
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-slate-900 rounded-lg border border-slate-800 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-slate-800 px-6 py-4 border-b border-slate-700 flex items-center justify-between">
          <h2 className="text-xl font-bold text-white">Nova Missão</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-900/30 border border-red-500/50 rounded-lg p-3 text-sm text-red-300">
              {error}
            </div>
          )}

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Título *
            </label>
            <input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleChange}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
              placeholder="Ex: Coletar Madeira T6"
              required
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Descrição
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
              rows={3}
              placeholder="Detalhes adicionais sobre a missão..."
            />
          </div>

          {/* Mission Type */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Tipo de Missão *
            </label>
            <select
              name="mission_type"
              value={formData.mission_type}
              onChange={handleMissionTypeChange}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              <option value="gathering">Coleta</option>
              <option value="crafting">Crafting</option>
              <option value="pve">PvE</option>
              <option value="pvp">PvP</option>
              <option value="trading">Comércio</option>
              <option value="other">Outro</option>
            </select>
          </div>

          {/* Target Objective */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Objetivo da Missão *
            </label>
            <select
              name="target_item"
              value={formData.target_item}
              onChange={handleChange}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
              required
            >
              {targetSuggestions.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
            <p className="mt-2 text-xs text-gray-500">
              Selecionável (não digitável) para evitar erro de digitação e casar com a Anaconda.
            </p>
          </div>

          {/* Target Quantity */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Meta de Quantidade *
            </label>
            <div className="relative">
              <Target className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-500" />
              <input
                type="number"
                name="target_quantity"
                value={formData.target_quantity}
                onChange={handleChange}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-10 pr-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                placeholder="500000"
                min="1"
                required
              />
            </div>
          </div>

          {formData.mission_type === 'pve' && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                minFameThreshold (PvE dinâmico)
              </label>
              <div className="relative">
                <Target className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input
                  type="number"
                  name="minFameThreshold"
                  value={formData.minFameThreshold}
                  onChange={handleChange}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-10 pr-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  placeholder="10000"
                  min="0"
                />
              </div>
              <p className="mt-2 text-xs text-gray-500">
                Delta mínimo de fama para inferir abate (ex.: 10000, 15000, 20000).
              </p>
            </div>
          )}

          {/* Points Reward */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Recompensa em Pontos *
            </label>
            <div className="relative">
              <Award className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-500" />
              <input
                type="number"
                name="points_reward"
                value={formData.points_reward}
                onChange={handleChange}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-10 pr-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                placeholder="100"
                min="1"
                required
              />
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Data de Início *
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input
                  type="date"
                  name="start_date"
                  value={formData.start_date}
                  onChange={handleChange}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-10 pr-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Data de Término
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input
                  type="date"
                  name="end_date"
                  value={formData.end_date}
                  onChange={handleChange}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-10 pr-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-medium py-2 px-4 rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-amber-500 hover:bg-amber-600 disabled:bg-slate-700 disabled:cursor-not-allowed text-slate-950 font-semibold py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors"
            >
              <Save className="w-5 h-5" />
              {loading ? 'Criando...' : 'Criar Missão'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default MissionForm;
