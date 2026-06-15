import { useState, useEffect } from 'react';
import { Award, Search, Plus, Minus, History } from 'lucide-react';
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
  const [selectedMember, setSelectedMember] = useState(null);
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const { success: membersSuccess, data: membersData } = await getGuildMembers();
    if (membersSuccess) {
      setMembers(membersData);
    }

    const { success: ledgerSuccess, data: ledgerData } = await getAllPointsLedger(20);
    if (ledgerSuccess) {
      setRecentAdjustments(ledgerData.filter(t => t.transaction_type === 'adjusted'));
    }
    setLoading(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedMember || !amount || !reason.trim()) {
      setMessage({ type: 'error', text: 'Preencha todos os campos' });
      return;
    }

    const pointsAmount = parseInt(amount);
    if (isNaN(pointsAmount) || pointsAmount === 0) {
      setMessage({ type: 'error', text: 'A quantidade deve ser um número diferente de zero' });
      return;
    }

    setSubmitting(true);
    setMessage({ type: '', text: '' });

    const result = await adjustPoints(selectedMember.id, pointsAmount, reason, userId);

    if (result.success) {
      setMessage({ type: 'success', text: `${pointsAmount > 0 ? '+' : ''}${pointsAmount} pontos ${pointsAmount > 0 ? 'adicionados a' : 'removidos de'} ${selectedMember.username}` });
      setAmount('');
      setReason('');
      setSelectedMember(null);
      loadData();
    } else {
      setMessage({ type: 'error', text: `Erro: ${result.error}` });
    }

    setSubmitting(false);
  };

  const filteredMembers = members.filter(m =>
    m.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.full_name?.toLowerCase().includes(searchTerm.toLowerCase())
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

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-gray-400">Carregando dados...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-white flex items-center gap-2">
        <Award className="w-5 h-5 text-amber-500" />
        Gerenciar Pontos
      </h3>

      {/* Messages */}
      {message.text && (
        <div className={`rounded-lg p-3 text-sm ${
          message.type === 'success'
            ? 'bg-green-900/30 border border-green-500/50 text-green-300'
            : 'bg-red-900/30 border border-red-500/50 text-red-300'
        }`}>
          {message.text}
        </div>
      )}

      {/* Adjustment Form */}
      <form onSubmit={handleSubmit} className="bg-slate-800/50 rounded-lg p-4 border border-slate-700 space-y-4">
        <h4 className="text-md font-medium text-white">Ajustar Pontos de Membro</h4>

        {/* Member Search */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Selecionar Membro *
          </label>
          {selectedMember ? (
            <div className="flex items-center justify-between bg-slate-700 rounded-lg px-4 py-2">
              <span className="text-white">
                {selectedMember.username} ({formatNumber(selectedMember.total_points)} pts)
              </span>
              <button
                type="button"
                onClick={() => setSelectedMember(null)}
                className="text-gray-400 hover:text-white"
              >
                Trocar
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg pl-10 pr-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  placeholder="Buscar por nome de usuário..."
                />
              </div>
              {searchTerm && (
                <div className="bg-slate-700 rounded-lg border border-slate-600 max-h-40 overflow-y-auto">
                  {filteredMembers.length === 0 ? (
                    <p className="text-gray-400 text-sm p-3">Nenhum membro encontrado</p>
                  ) : (
                    filteredMembers.slice(0, 8).map((member) => (
                      <button
                        key={member.id}
                        type="button"
                        onClick={() => {
                          setSelectedMember(member);
                          setSearchTerm('');
                        }}
                        className="w-full text-left px-4 py-2 hover:bg-slate-600 text-white text-sm flex justify-between"
                      >
                        <span>{member.username}</span>
                        <span className="text-amber-400">{formatNumber(member.total_points)} pts</span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Amount */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Quantidade de Pontos * (positivo para adicionar, negativo para remover)
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setAmount(prev => String(Math.abs(parseInt(prev) || 0)))}
              className="bg-green-600 hover:bg-green-700 text-white p-2 rounded-lg"
              title="Adicionar pontos"
            >
              <Plus className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={() => setAmount(prev => String(-Math.abs(parseInt(prev) || 0)))}
              className="bg-red-600 hover:bg-red-700 text-white p-2 rounded-lg"
              title="Remover pontos"
            >
              <Minus className="w-5 h-5" />
            </button>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="flex-1 bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
              placeholder="Ex: 100 ou -50"
            />
          </div>
        </div>

        {/* Reason */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Motivo *
          </label>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
            placeholder="Ex: Bonificação por contribuição, Penalidade por inatividade..."
          />
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={submitting || !selectedMember || !amount || !reason.trim()}
          className="w-full bg-amber-500 hover:bg-amber-600 disabled:bg-slate-700 disabled:cursor-not-allowed text-slate-950 font-semibold py-2 px-4 rounded-lg transition-colors"
        >
          {submitting ? 'Processando...' : 'Aplicar Ajuste'}
        </button>
      </form>

      {/* Recent Adjustments History */}
      <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
        <h4 className="text-md font-medium text-white mb-4 flex items-center gap-2">
          <History className="w-4 h-4 text-gray-400" />
          Ajustes Recentes
        </h4>
        {recentAdjustments.length === 0 ? (
          <p className="text-gray-400 text-sm">Nenhum ajuste manual registrado.</p>
        ) : (
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {recentAdjustments.map((adjustment) => (
              <div key={adjustment.id} className="flex items-center justify-between bg-slate-700/50 rounded-lg px-3 py-2">
                <div>
                  <span className="text-white text-sm">
                    {adjustment.profiles?.username || 'Desconhecido'}
                  </span>
                  <p className="text-gray-400 text-xs">{adjustment.reason}</p>
                </div>
                <div className="text-right">
                  <span className={`text-sm font-medium ${adjustment.amount > 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {adjustment.amount > 0 ? '+' : ''}{formatNumber(adjustment.amount)} pts
                  </span>
                  <p className="text-gray-500 text-xs">{formatDate(adjustment.created_at)}</p>
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
