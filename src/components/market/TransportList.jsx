import { useState, useEffect } from 'react';
import { Trash2, Plus, Package, TrendingUp, X, Lock, Unlock, CheckCircle, Clock, Filter } from 'lucide-react';
import { fetchTopOpportunities, COMMON_ITEMS } from '@/lib/albion/api';
import { supabase } from '@/lib/supabase/client';
import ItemIcon from './ItemIcon';
import { getItemName } from '@/lib/i18n/itemNames';

const TransportList = ({ userId }) => {
  const [opportunities, setOpportunities] = useState([]);
  const [myTransports, setMyTransports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reservingId, setReservingId] = useState(null);
  const [completingId, setCompletingId] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [filterCity, setFilterCity] = useState('');
  const [filterMinProfit, setFilterMinProfit] = useState(0);
  const [opportunityCount, setOpportunityCount] = useState(50);

  useEffect(() => {
    loadOpportunities();
    loadMyTransports();
    
    // Auto-refresh every minute
    const interval = setInterval(() => {
      loadOpportunities();
    }, 60000);
    
    return () => clearInterval(interval);
  }, [opportunityCount]);

  const loadOpportunities = async () => {
    setLoading(true);
    try {
      const data = await fetchTopOpportunities(COMMON_ITEMS, opportunityCount);
      
      // Apply filters
      let filtered = data;
      if (filterCity) {
        filtered = filtered.filter(opp => opp.lowestCity === filterCity);
      }
      if (filterMinProfit > 0) {
        filtered = filtered.filter(opp => opp.netProfit >= filterMinProfit);
      }
      
      setOpportunities(filtered);
    } catch (error) {
      console.error('Error loading opportunities:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMyTransports = async () => {
    if (!userId) return;
    
    try {
      const { data, error } = await supabase
        .from('transports')
        .select('*')
        .eq('reserved_by', userId)
        .eq('status', 'reserved')
        .order('reserved_at', { ascending: false });
      
      if (error) throw error;
      setMyTransports(data || []);
    } catch (error) {
      console.error('Error loading my transports:', error);
    }
  };

  const handleReserve = async (opportunity) => {
    if (!userId) {
      alert('Você precisa estar logado para reservar um transporte');
      return;
    }

    setReservingId(opportunity.itemId);
    try {
      const { data, error } = await supabase
        .from('transports')
        .insert({
          item_id: opportunity.itemId,
          item_name: getItemName(opportunity.itemId),
          from_city: opportunity.lowestCity,
          to_city: 'Caerleon',
          buy_price: opportunity.lowestPrice,
          sell_price: opportunity.bmPrice,
          profit: opportunity.netProfit,
          quantity: opportunity.quantity || 1,
          status: 'reserved',
          reserved_by: userId,
          reserved_at: new Date().toISOString(),
          created_by: userId,
        })
        .select()
        .single();

      if (error) throw error;
      
      // Reload my transports
      loadMyTransports();
      alert('Transporte reservado com sucesso!');
    } catch (error) {
      console.error('Error reserving transport:', error);
      alert('Falha ao reservar transporte. Tente novamente.');
    } finally {
      setReservingId(null);
    }
  };

  const handleComplete = async (transportId) => {
    if (!window.confirm('Tem certeza que deseja concluir este transporte?')) return;

    setCompletingId(transportId);
    try {
      const { data: transport, error: fetchError } = await supabase
        .from('transports')
        .select('*')
        .eq('id', transportId)
        .single();

      if (fetchError) throw fetchError;

      // Award points for completing transport
      const pointsToAward = Math.round(transport.profit / 1000); // 1 point per 1000 silver profit
      
      await supabase.rpc('award_points', {
        p_profile_id: userId,
        p_amount: pointsToAward,
        p_reason: `Transporte concluído: ${transport.item_name} de ${transport.from_city} para ${transport.to_city}`,
        p_reference_id: transportId,
        p_reference_type: 'transport',
      });

      // Update transport status
      const { error: updateError } = await supabase
        .from('transports')
        .update({ status: 'completed' })
        .eq('id', transportId);

      if (updateError) throw updateError;
      
      // Reload transports
      loadMyTransports();
      alert(`Transporte concluído! Você ganhou ${pointsToAward} pontos.`);
    } catch (error) {
      console.error('Error completing transport:', error);
      alert('Falha ao concluir transporte. Tente novamente.');
    } finally {
      setCompletingId(null);
    }
  };

  const formatSilver = (value) => {
    return new Intl.NumberFormat('pt-BR').format(Math.round(value || 0));
  };

  const cities = [...new Set(opportunities.map(opp => opp.lowestCity))];

  return (
    <div className="space-y-6">
      {/* Available Opportunities */}
      <div className="bg-slate-900 rounded-lg border border-slate-800 overflow-hidden">
        {/* Header */}
        <div className="bg-slate-800 px-6 py-4 border-b border-slate-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Package className="w-6 h-6 text-amber-500" />
              <h2 className="text-xl font-bold text-white">Oportunidades de Transporte</h2>
              <span className="bg-amber-500/20 text-amber-400 px-3 py-1 rounded-full text-sm font-medium">
                {opportunities.length} disponíveis
              </span>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={opportunityCount}
                onChange={(e) => setOpportunityCount(parseInt(e.target.value))}
                className="bg-slate-700 border border-slate-600 rounded px-3 py-1 text-white text-sm"
              >
                <option value={10}>10 oportunidades</option>
                <option value={50}>50 oportunidades</option>
                <option value={200}>200 oportunidades</option>
              </select>
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="bg-slate-700 hover:bg-slate-600 text-white p-2 rounded-lg transition-colors"
                title="Filtros"
              >
                <Filter className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Filters */}
        {showFilters && (
          <div className="p-4 bg-slate-800/50 border-b border-slate-700">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Cidade de Origem
                </label>
                <select
                  value={filterCity}
                  onChange={(e) => setFilterCity(e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white"
                >
                  <option value="">Todas as cidades</option>
                  {cities.map(city => (
                    <option key={city} value={city}>{city}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Lucro Mínimo (prata)
                </label>
                <input
                  type="number"
                  value={filterMinProfit}
                  onChange={(e) => setFilterMinProfit(parseInt(e.target.value) || 0)}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white"
                  placeholder="0"
                />
              </div>
            </div>
          </div>
        )}

        {/* Transport Cards */}
        <div className="p-6">
          {loading ? (
            <div className="text-center py-12">
              <div className="w-12 h-12 border-4 border-red-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-gray-400">Carregando oportunidades...</p>
            </div>
          ) : opportunities.length === 0 ? (
            <div className="text-center py-12">
              <Package className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-400 mb-2">
                Nenhuma Oportunidade
              </h3>
              <p className="text-gray-500">
                Ajuste os filtros ou aguarde novas oportunidades.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {opportunities && opportunities.length > 0 ? (
                opportunities.map((opportunity, index) => (
                  <div
                    key={`${opportunity.itemId}-${index}`}
                    className="bg-slate-800/50 rounded-lg p-4 border border-slate-700 hover:border-amber-500/50 transition-all"
                  >
                    {/* Item Info */}
                    <div className="flex items-center gap-3 mb-3">
                      <ItemIcon itemId={opportunity.itemId} size={48} />
                      <div className="flex-1">
                        <h3 className="font-semibold text-white text-sm">{getItemName(opportunity.itemId)}</h3>
                        <p className="text-xs text-gray-500">{opportunity.itemId}</p>
                        {opportunity.enchantment !== undefined && (
                          <p className="text-xs text-purple-400">Encantamento: .{opportunity.enchantment}</p>
                        )}
                        {opportunity.quantity !== undefined && (
                          <p className="text-xs text-blue-400">Quantidade: {opportunity.quantity}</p>
                        )}
                      </div>
                    </div>

                    {/* Route */}
                    <div className="flex items-center gap-2 mb-3 text-sm">
                      <span className="text-blue-400 font-medium text-xs">{opportunity.lowestCity}</span>
                      <span className="text-gray-500">→</span>
                      <span className="text-amber-400 font-medium text-xs">Caerleon</span>
                    </div>

                    {/* Price Details */}
                    <div className="space-y-2 mb-3 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-400">Compra:</span>
                        <span className="text-white">{formatSilver(opportunity.lowestPrice)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Venda:</span>
                        <span className="text-white">{formatSilver(opportunity.bmPrice)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Lucro:</span>
                        <span className="text-green-400 font-medium">{formatSilver(opportunity.netProfit)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Margem:</span>
                        <span className="text-purple-400 font-medium">{opportunity.margin.toFixed(1)}%</span>
                      </div>
                    </div>

                    {/* Reserve Button */}
                    <button
                      onClick={() => handleReserve(opportunity)}
                      disabled={reservingId === opportunity.itemId}
                      className="w-full bg-amber-500 hover:bg-amber-600 disabled:bg-slate-700 disabled:text-gray-500 text-slate-950 font-semibold py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors"
                    >
                      {reservingId === opportunity.itemId ? (
                        <>
                          <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                          Reservando...
                        </>
                      ) : (
                        <>
                          <Lock className="w-4 h-4" />
                          Reservar
                        </>
                      )}
                    </button>
                  </div>
                ))
              ) : (
                <div className="col-span-full text-center py-12">
                  <Package className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-gray-400 mb-2">
                    Nenhuma Oportunidade
                  </h3>
                  <p className="text-gray-500">
                    Ajuste os filtros ou aguarde novas oportunidades.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-800/30 px-6 py-4 border-t border-slate-800">
          <div className="flex items-center justify-between text-sm text-gray-500">
            <span>
              Atualizado a cada 1 minuto
            </span>
            <span>
              {opportunityCount} oportunidades carregadas
            </span>
          </div>
        </div>
      </div>

      {/* My Transports */}
      {userId && myTransports.length > 0 && (
        <div className="bg-slate-900 rounded-lg border border-slate-800 overflow-hidden">
          {/* Header */}
          <div className="bg-slate-800 px-6 py-4 border-b border-slate-700">
            <div className="flex items-center gap-3">
              <Package className="w-6 h-6 text-green-500" />
              <h2 className="text-xl font-bold text-white">Meus Transportes</h2>
              <span className="bg-green-500/20 text-green-400 px-3 py-1 rounded-full text-sm font-medium">
                {myTransports.length} ativos
              </span>
            </div>
          </div>

          {/* Transport List */}
          <div className="p-6">
            <div className="space-y-3">
              {myTransports.map((transport) => (
                <div
                  key={transport.id}
                  className="bg-slate-800/50 rounded-lg p-4 border border-slate-700 flex items-center justify-between"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-slate-700 rounded-lg flex items-center justify-center">
                      <Package className="w-6 h-6 text-green-500" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-white">{transport.item_name}</h3>
                      <p className="text-sm text-gray-400">
                        {transport.from_city} → {transport.to_city}
                      </p>
                      <p className="text-xs text-gray-500">
                        Lucro: {formatSilver(transport.profit)} | Quantidade: {transport.quantity}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleComplete(transport.id)}
                    disabled={completingId === transport.id}
                    className="bg-green-500 hover:bg-green-600 disabled:bg-slate-700 disabled:text-gray-500 text-white font-semibold py-2 px-4 rounded-lg flex items-center gap-2 transition-colors"
                  >
                    {completingId === transport.id ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Concluindo...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-4 h-4" />
                        Concluir
                      </>
                    )}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TransportList;
