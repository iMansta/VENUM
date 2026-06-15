import { useState, useEffect } from 'react';
import { Award, Plus, Minus, TrendingUp, Activity, Search } from 'lucide-react';
import { getGuildMembers } from '@/lib/supabase/profiles';
import { adjustPoints, getAllPointsLedger } from '@/lib/supabase/points';

/**
 * PointsManagement component - Admin panel for managing user points
 */

const PointsManagement = ({ userId, userRole }) => {
  const [members, setMembers] = useState([]);
  const [recentAdjustments, setRecentAdjustments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Form state
  const [selectedMember, setSelectedMember] = useState('');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [adjusting, setAdjusting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [membersResult, ledgerResult] = await Promise.all([
        getGuildMembers(),
        getAllPointsLedger(20),
      ]);

      if (membersResult.success) {
        setMembers(membersResult.data);
      }

      if (ledgerResult.success) {
        setRecentAdjustments(ledgerResult.data.filter(t => t.transaction_type === 'adjusted'));
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAdjustPoints = async (e) => {
    e.preventDefault();
    setAdjusting(true);
    setError('');
    setSuccess('');

    if (!selectedMember || !amount || !reason) {
      setError('Todos os campos são obrigatórios');
      setAdjusting(false);
      return;
    }

    const pointsAmount = parseInt(amount);
    if (isNaN(pointsAmount) || pointsAmount === 0) {
      setError('A quantidade de pontos deve ser um número diferente de zero');
      setAdjusting(false);
      return;
    }

    const result = await adjustPoints(selectedMember, pointsAmount, reason, userId);

    if (result.success) {
      setSuccess(`Pontos ${pointsAmount > 0 ? 'adicionados' : 'removidos'} com sucesso!`);
      setSelectedMember('');
      setAmount('');
      setReason('');
      loadData(); // Reload data
    } else {
      setError(result.error);
    }

    setAdjusting(false);
  };

  const filteredMembers = members.filter(member =>
    member.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    member.full_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatNumber = (value) => {
    return new Intl.NumberFormat('pt-BR').format(value || 0);
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-white">Gerenciar Pontos</h3>
        <button
          onClick={loadData}
          className="text-gray-400 hover:text-white p-2 rounded hover:bg-slate-700 transition-colors"
          title="Recarregar"
        >
          <Activity className="w-5 h-5" />
        </button>
      </div>

      {/* Points Adjustment Form */}
      <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
        <h4 className="text-md font-semibold text-white mb-4 flex items-center gap-2">
          <Award className="w-4 h-4 text-amber-500" />
          Ajustar Pontos
        </h4>

        {error && (
          <div className="mb-4 bg-red-900/30 border border-red-500/50 rounded-lg p-3 text-sm text-red-300">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 bg-green-900/30 border border-green-500/50 rounded-lg p-3 text-sm text-green-300">
            {success}
          </div>
        )}

        <form onSubmit={handleAdjustPoints} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Membro
            </label>
            <select
              value={selectedMember}
              onChange={(e) => setSelectedMember(e.target.value)}
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
              required
            >
              <option value="">Selecione um membro</option>
              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.username} {member.full_name ? `(${member.full_name})` : ''} - {formatNumber(member.total_points)} pts
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Quantidade de Pontos
            </label>
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  placeholder="Digite a quantidade"
                  required
                />
              </div>
              <button
                type="button"
                onClick={() => setAmount(Math.abs(parseInt(amount) || 0).toString())}
                className="bg-green-600 hover:bg-green-700 text-white p-2 rounded-lg transition-colors"
                title="Definir como positivo"
              >
                <Plus className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={() => setAmount((-Math.abs(parseInt(amount) || 0)).toString())}
                className="bg-red-600 hover:bg-red-700 text-white p-2 rounded-lg transition-colors"
                title="Definir como negativo"
              >
                <Minus className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Positivo para adicionar, negativo para remover
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Motivo
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
              placeholder="Ex: Bônus por missão, Penalidade, etc."
              required
            />
          </div>

          <button
            type="submit"
            disabled={adjusting}
            className="w-full bg-amber-500 hover:bg-amber-600 disabled:bg-slate-700 disabled:cursor-not-allowed text-slate-950 font-semibold py-2 px-4 rounded-lg transition-colors"
          >
            {adjusting ? 'Processando...' : 'Ajustar Pontos'}
          </button>
        </form>
      </div>

      {/* Members List */}
      <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-md font-semibold text-white flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-amber-500" />
            Membros da Guilda
          </h4>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-slate-700 border border-slate-600 rounded-lg pl-10 pr-4 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
              placeholder="Buscar..."
            />
          </div>
        </div>

        {loading ? (
          <div className="text-center py-8">
            <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
            <p className="text-gray-400">Carregando...</p>
          </div>
        ) : filteredMembers.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-400">Nenhum membro encontrado</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {filteredMembers.map((member) => (
              <div
                key={member.id}
                className="bg-slate-900/50 rounded-lg p-3 border border-slate-700 flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-amber-600 rounded-full flex items-center justify-center text-slate-950 text-lg font-bold">
                    {member.username?.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-white font-medium">{member.username}</p>
                    {member.full_name && (
                      <p className="text-xs text-gray-400">{member.full_name}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Award className="w-4 h-4 text-amber-400" />
                  <span className="text-white font-semibold">{formatNumber(member.total_points)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent Adjustments */}
      <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
        <h4 className="text-md font-semibold text-white mb-4 flex items-center gap-2">
          <Activity className="w-4 h-4 text-amber-500" />
          Ajustes Recentes
        </h4>

        {recentAdjustments.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-400">Nenhum ajuste recente</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {recentAdjustments.map((adjustment) => (
              <div
                key={adjustment.id}
                className="bg-slate-900/50 rounded-lg p-3 border border-slate-700"
              >
                <div className="flex justify-between items-start mb-1">
                  <span className="text-sm text-white">{adjustment.reason}</span>
                  <span className={`text-sm font-medium ${adjustment.amount > 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {adjustment.amount > 0 ? '+' : ''}{formatNumber(adjustment.amount)} pts
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs text-gray-500">
                  <span>{adjustment.profiles?.username || 'Usuário desconhecido'}</span>
                  <span>{formatDate(adjustment.created_at)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default PointsManagement;
