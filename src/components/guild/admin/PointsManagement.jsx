import { useState, useEffect, useMemo } from 'react';
import {
  Award,
  Plus,
  Minus,
  TrendingUp,
  Search,
  RefreshCw,
  Sparkles,
  History,
} from 'lucide-react';
import { getGuildMembers } from '@/lib/supabase/profiles';
import { adjustPoints, getAllPointsLedger } from '@/lib/supabase/points';

const PRESETS = [
  { label: '+10', value: 10 },
  { label: '+25', value: 25 },
  { label: '+50', value: 50 },
  { label: '+100', value: 100 },
  { label: '-10', value: -10 },
  { label: '-25', value: -25 },
];

const REASON_PRESETS = [
  'Bônus por missão',
  'Participação em CTG',
  'Evento da guilda',
  'Penalidade',
  'Ajuste manual',
];

const PointsManagement = ({ userId }) => {
  const [members, setMembers] = useState([]);
  const [recentAdjustments, setRecentAdjustments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [memberSearch, setMemberSearch] = useState('');

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
        getAllPointsLedger(30),
      ]);
      if (membersResult.success) setMembers(membersResult.data);
      if (ledgerResult.success) {
        setRecentAdjustments(ledgerResult.data.filter((t) => t.transaction_type === 'adjusted'));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const selectedProfile = useMemo(
    () => members.find((m) => m.id === selectedMember),
    [members, selectedMember]
  );

  const filteredMembers = useMemo(() => {
    const q = memberSearch.toLowerCase();
    return members
      .filter(
        (m) =>
          m.username?.toLowerCase().includes(q) ||
          m.full_name?.toLowerCase().includes(q)
      )
      .sort((a, b) => (b.total_points || 0) - (a.total_points || 0));
  }, [members, memberSearch]);

  const guildStats = useMemo(
    () => ({
      totalPoints: members.reduce((s, m) => s + (m.total_points || 0), 0),
      avgPoints: members.length
        ? Math.round(members.reduce((s, m) => s + (m.total_points || 0), 0) / members.length)
        : 0,
      topMember: [...members].sort((a, b) => (b.total_points || 0) - (a.total_points || 0))[0],
    }),
    [members]
  );

  const handleAdjustPoints = async (e) => {
    e.preventDefault();
    setAdjusting(true);
    setError('');
    setSuccess('');

    if (!selectedMember || !amount || !reason.trim()) {
      setError('Preencha membro, quantidade e motivo.');
      setAdjusting(false);
      return;
    }

    const pointsAmount = parseInt(amount, 10);
    if (Number.isNaN(pointsAmount) || pointsAmount === 0) {
      setError('Informe um número diferente de zero.');
      setAdjusting(false);
      return;
    }

    const result = await adjustPoints(selectedMember, pointsAmount, reason.trim(), userId);

    if (result.success) {
      setSuccess(
        `${pointsAmount > 0 ? '+' : ''}${pointsAmount} pts para ${selectedProfile?.username || 'membro'}`
      );
      setAmount('');
      setReason('');
      loadData();
    } else {
      setError(result.error);
    }
    setAdjusting(false);
  };

  const applyPreset = (value) => setAmount(String(value));

  const formatNumber = (value) => new Intl.NumberFormat('pt-BR').format(value || 0);

  const formatDate = (dateString) => {
    if (!dateString) return '—';
    return new Date(dateString).toLocaleString('pt-BR', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-gradient-to-br from-amber-950/40 to-slate-950 border border-amber-900/30 rounded-xl p-4">
          <div className="flex items-center gap-2 text-amber-400 mb-1">
            <Award className="w-4 h-4" />
            <span className="text-xs uppercase tracking-wider text-amber-400/80">Pontos na guilda</span>
          </div>
          <p className="text-2xl font-bold text-white">{formatNumber(guildStats.totalPoints)}</p>
        </div>
        <div className="bg-slate-950/50 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center gap-2 text-gray-400 mb-1">
            <TrendingUp className="w-4 h-4" />
            <span className="text-xs uppercase tracking-wider">Média por membro</span>
          </div>
          <p className="text-2xl font-bold text-white">{formatNumber(guildStats.avgPoints)}</p>
        </div>
        <div className="bg-slate-950/50 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center gap-2 text-emerald-400 mb-1">
            <Sparkles className="w-4 h-4" />
            <span className="text-xs uppercase tracking-wider text-emerald-400/80">Líder</span>
          </div>
          <p className="text-lg font-bold text-white truncate">
            {guildStats.topMember?.username || '—'}
          </p>
          <p className="text-xs text-gray-500">{formatNumber(guildStats.topMember?.total_points)} pts</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-5 gap-5">
        <div className="lg:col-span-2 bg-slate-950/50 border border-slate-800 rounded-xl p-5">
          <h4 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <Award className="w-4 h-4 text-amber-500" />
            Ajustar pontos
          </h4>

          {error && (
            <div className="mb-3 text-sm text-red-300 bg-red-950/40 border border-red-800/50 rounded-lg px-3 py-2">
              {error}
            </div>
          )}
          {success && (
            <div className="mb-3 text-sm text-emerald-300 bg-emerald-950/40 border border-emerald-800/50 rounded-lg px-3 py-2">
              {success}
            </div>
          )}

          <form onSubmit={handleAdjustPoints} className="space-y-4">
            <div>
              <label className="text-xs text-gray-500 block mb-1.5">Membro</label>
              <select
                value={selectedMember}
                onChange={(e) => setSelectedMember(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:ring-2 focus:ring-amber-500/40 focus:outline-none"
                required
              >
                <option value="">Selecione...</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.username} — {formatNumber(m.total_points)} pts
                  </option>
                ))}
              </select>
              {selectedProfile && (
                <p className="text-xs text-gray-500 mt-1">
                  Saldo atual: <span className="text-amber-400 font-medium">{formatNumber(selectedProfile.total_points)}</span>
                </p>
              )}
            </div>

            <div>
              <label className="text-xs text-gray-500 block mb-1.5">Quantidade</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:ring-2 focus:ring-amber-500/40 focus:outline-none"
                  placeholder="+ ou -"
                  required
                />
                <button type="button" onClick={() => setAmount(String(Math.abs(parseInt(amount, 10) || 0)))} className="p-2.5 rounded-xl bg-emerald-600/20 text-emerald-400 border border-emerald-700/40">
                  <Plus className="w-4 h-4" />
                </button>
                <button type="button" onClick={() => setAmount(String(-Math.abs(parseInt(amount, 10) || 0)))} className="p-2.5 rounded-xl bg-red-600/20 text-red-400 border border-red-700/40">
                  <Minus className="w-4 h-4" />
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {PRESETS.map((p) => (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => applyPreset(p.value)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
                      p.value > 0
                        ? 'bg-emerald-950/50 text-emerald-400 border-emerald-800/50 hover:bg-emerald-900/50'
                        : 'bg-red-950/50 text-red-400 border-red-800/50 hover:bg-red-900/50'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs text-gray-500 block mb-1.5">Motivo</label>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:ring-2 focus:ring-amber-500/40 focus:outline-none"
                placeholder="Descreva o ajuste"
                required
              />
              <div className="flex flex-wrap gap-1.5 mt-2">
                {REASON_PRESETS.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setReason(r)}
                    className="px-2 py-1 rounded-md text-[11px] bg-slate-800 text-gray-400 hover:text-white border border-slate-700"
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={adjusting}
              className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-semibold text-sm transition-colors"
            >
              {adjusting ? 'Processando...' : 'Confirmar ajuste'}
            </button>
          </form>
        </div>

        <div className="lg:col-span-3 space-y-5">
          <div className="bg-slate-950/50 border border-slate-800 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-900/50">
              <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-amber-500" />
                Ranking de pontos
              </h4>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
                  <input
                    type="text"
                    value={memberSearch}
                    onChange={(e) => setMemberSearch(e.target.value)}
                    className="bg-slate-900 border border-slate-700 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white w-36 sm:w-48"
                    placeholder="Filtrar..."
                  />
                </div>
                <button type="button" onClick={loadData} className="p-1.5 text-gray-400 hover:text-white">
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            {loading ? (
              <div className="py-12 text-center text-gray-500 text-sm">Carregando...</div>
            ) : (
              <div className="max-h-72 overflow-y-auto divide-y divide-slate-800/80">
                {filteredMembers.slice(0, 15).map((member, idx) => (
                  <button
                    key={member.id}
                    type="button"
                    onClick={() => setSelectedMember(member.id)}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-slate-900/40 transition-colors ${
                      selectedMember === member.id ? 'bg-amber-500/5' : ''
                    }`}
                  >
                    <span className="w-6 text-xs font-bold text-gray-500">{idx + 1}</span>
                    <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-xs font-bold text-white">
                      {member.username?.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{member.username}</p>
                    </div>
                    <span className="text-sm font-bold text-amber-400">{formatNumber(member.total_points)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="bg-slate-950/50 border border-slate-800 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-800 bg-slate-900/50">
              <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                <History className="w-4 h-4 text-amber-500" />
                Ajustes recentes
              </h4>
            </div>
            {recentAdjustments.length === 0 ? (
              <p className="py-8 text-center text-gray-500 text-sm">Nenhum ajuste registrado</p>
            ) : (
              <div className="max-h-64 overflow-y-auto divide-y divide-slate-800/80">
                {recentAdjustments.map((adj) => (
                  <div key={adj.id} className="px-4 py-3 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm text-white truncate">{adj.reason}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {adj.profiles?.username || 'Membro'} · {formatDate(adj.created_at)}
                      </p>
                    </div>
                    <span className={`text-sm font-bold shrink-0 ${adj.amount > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {adj.amount > 0 ? '+' : ''}{formatNumber(adj.amount)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PointsManagement;
