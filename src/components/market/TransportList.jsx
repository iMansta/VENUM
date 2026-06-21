import { useState, useEffect, useCallback } from 'react';
import { Trash2, Plus, Package, TrendingUp, X, Lock, Unlock, CheckCircle, Clock, Shield, Timer, AlertTriangle } from 'lucide-react';
import { fetchTopOpportunities, COMMON_ITEMS } from '@/lib/albion/api';
import { supabase } from '@/lib/supabase/client';
import { reserveTransportOpportunity } from '@/lib/supabase/transports';
import ItemIcon from './ItemIcon';
import { getItemName } from '@/lib/i18n/itemNames';
import SecurityChecklist from './SecurityChecklist';

const TransportList = ({ userId, filters, refreshKey, opportunities: propOpportunities, loading: propLoading, loadingProgress = null }) => {
  const [opportunities, setOpportunities] = useState([]);
  const [myTransports, setMyTransports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reservingId, setReservingId] = useState(null);
  const [completingId, setCompletingId] = useState(null);
  const [opportunityCount, setOpportunityCount] = useState(50);
  const [showSecurityChecklist, setShowSecurityChecklist] = useState(false);
  const [selectedOpportunity, setSelectedOpportunity] = useState(null);

  // Use opportunities from props if provided, otherwise use local state
  useEffect(() => {
    if (propOpportunities !== undefined) {
      setOpportunities(propOpportunities);
      setLoading(propLoading);
    }
  }, [propOpportunities, propLoading]);

  const loadOpportunities = useCallback(async () => {
    // Only load if opportunities are not provided via props
    if (propOpportunities !== undefined) return;
    
    setLoading(true);
    try {
      const count = filters?.quantity || opportunityCount;
      console.log('Loading opportunities with count:', count, 'filters:', filters);
      const data = await fetchTopOpportunities(COMMON_ITEMS, count);
      console.log('Fetched opportunities:', data.length);

      // Apply filters from props if provided
      let filtered = data;
      if (filters) {
        if (filters.cities && filters.cities.length > 0) {
          filtered = filtered.filter(opp => filters.cities.includes(opp.lowestCity));
        }
        if (filters.tiers && filters.tiers.length > 0) {
          filtered = filtered.filter(opp => {
            const tier = opp.itemId.match(/T(\d+)/)?.[1];
            return tier && filters.tiers.includes(parseInt(tier));
          });
        }
        if (filters.enchantments && filters.enchantments.length > 0) {
          filtered = filtered.filter(opp => {
            const enchantment = opp.itemId.match(/\.(\d+)$/)?.[1];
            return enchantment && filters.enchantments.includes(parseInt(enchantment));
          });
        }
        if (filters.minProfit > 0) {
          filtered = filtered.filter(opp => opp.netProfit >= filters.minProfit);
        }
        if (filters.premium && filters.premium !== 'all') {
          // Filter by premium status (this would need to be implemented in the API)
          // For now, we'll skip this as it requires backend changes
        }
        if (filters.maxInvestment && filters.maxInvestment !== Infinity) {
          filtered = filtered.filter(opp => opp.lowestPrice <= filters.maxInvestment);
        }
        if (filters.riskLevel && filters.riskLevel !== 'all') {
          filtered = filtered.filter(opp => {
            if (!opp.risk) return false;
            if (filters.riskLevel === 'low') return opp.risk.value <= 0.1;
            if (filters.riskLevel === 'medium') return opp.risk.value <= 0.2;
            if (filters.riskLevel === 'high') return opp.risk.value <= 0.4;
            return true;
          });
        }
      }

      console.log('Filtered opportunities:', filtered.length);
      setOpportunities(filtered);
    } catch (error) {
      console.error('Error loading opportunities:', error);
    } finally {
      setLoading(false);
    }
  }, [filters, opportunityCount, propOpportunities]);

  const loadMyTransports = useCallback(async () => {
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
  }, [userId]);

  useEffect(() => {
    loadMyTransports();

    // Only auto-refresh if opportunities are not provided via props
    if (propOpportunities === undefined) {
      loadOpportunities();
      const interval = setInterval(() => {
        loadOpportunities();
      }, 60000);
      return () => clearInterval(interval);
    }
  }, [refreshKey, loadOpportunities, loadMyTransports, propOpportunities]);

  const handleReserve = async (opportunity) => {
    if (!userId) {
      alert('Você precisa estar logado para reservar um transporte');
      return;
    }

    // Show security checklist before reservation
    setSelectedOpportunity(opportunity);
    setShowSecurityChecklist(true);
  };

  const handleConfirmReservation = async (checklistData) => {
    if (!selectedOpportunity) {
      console.error('Cannot reserve transport: no opportunity selected');
      alert('Falha ao reservar transporte. Nenhuma oportunidade selecionada.');
      return;
    }

    setShowSecurityChecklist(false);
    setReservingId(selectedOpportunity.itemId);
    const expiresAt = new Date(Date.now() + 20 * 60 * 1000).toISOString();
    
    // Optimistic update: remove from opportunities and add to myTransports immediately
    const newOpportunities = opportunities.filter(opp => opp.itemId !== selectedOpportunity.itemId);
    const itemName = getItemName(selectedOpportunity.itemId);
    const newTransport = {
      id: `temp-${Date.now()}`,
      item_id: selectedOpportunity.itemId,
      item_name: itemName,
      from_city: selectedOpportunity.lowestCity,
      to_city: 'Caerleon',
      buy_price: selectedOpportunity.lowestPrice,
      sell_price: selectedOpportunity.bmPrice,
      profit: selectedOpportunity.netProfit,
      expected_profit: selectedOpportunity.expectedProfit,
      quantity: selectedOpportunity.quantity || 1,
      status: 'reserved',
      reserved_by: userId,
      reserved_at: new Date().toISOString(),
      expires_at: expiresAt,
      checklist_data: checklistData,
    };
    
    setOpportunities(newOpportunities);
    setMyTransports(prev => [newTransport, ...prev]);
    
    try {
      const reservation = await reserveTransportOpportunity({
        opportunity: selectedOpportunity,
        userId,
        itemName,
        expiresAt,
        checklistData,
      });

      if (!reservation.success) {
        alert(reservation.message || 'Falha ao reservar transporte. Tente novamente.');
        // Revert optimistic update
        setOpportunities(opportunities);
        setMyTransports(prev => prev.filter(t => t.id !== newTransport.id));
        return;
      }

      // Update saturation
      const { updateSaturation } = await import('@/lib/albion/saturation');
      updateSaturation(selectedOpportunity.itemId, 10); // Add 10% saturation

      // Reload my transports to get the real data from server
      loadMyTransports();
    } catch (error) {
      console.error('Error reserving transport:', error);
      alert('Falha ao reservar transporte. Tente novamente.');
      // Revert optimistic update
      setOpportunities(opportunities);
      setMyTransports(prev => prev.filter(t => t.id !== newTransport.id));
    } finally {
      setReservingId(null);
      setSelectedOpportunity(null);
    }
  };

  const handleComplete = async (transportId) => {
    if (!window.confirm('Tem certeza que deseja concluir este transporte?')) return;

    setCompletingId(transportId);
    try {
      // Update transport status
      const { error: updateError } = await supabase
        .from('transports')
        .update({ status: 'completed' })
        .eq('id', transportId);

      if (updateError) throw updateError;

      // Reload transports
      loadMyTransports();
      alert('Transporte concluído!');
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
  const loadingText = loadingProgress?.total > 0
    ? `Carregando ${Math.min(loadingProgress.loaded, loadingProgress.total)} de ${loadingProgress.total} itens...`
    : 'Carregando oportunidades...';

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
                <option value={100}>100 oportunidades</option>
              </select>
            </div>
          </div>
        </div>

        {/* Transport Cards */}
        <div className="p-6">
          {loading ? (
            <div className="text-center py-12">
              <div className="w-12 h-12 border-4 border-red-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-gray-400">{loadingText}</p>
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
            <>
              <div className="space-y-2">
                {opportunities && opportunities.length > 0 ? (
                  opportunities.map((opportunity, index) => (
                    <div
                      key={`${opportunity.itemId}-${index}`}
                      className="bg-slate-800/50 rounded-lg p-3 border border-slate-700 hover:border-amber-500/50 transition-all"
                    >
                      <div className="flex items-center gap-3">
                        {/* Item Icon */}
                        <ItemIcon itemId={opportunity.itemId} size={32} />
                        
                        {/* Item Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-white text-sm truncate">{getItemName(opportunity.itemId)}</h3>
                            {opportunity.enchantment !== undefined && (
                              <span className="text-xs text-purple-400">.{opportunity.enchantment}</span>
                            )}
                            {opportunity.quantity !== undefined && (
                              <span className="text-xs text-blue-400">x{opportunity.quantity}</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-xs mt-1">
                            <span className="text-blue-400">{opportunity.lowestCity}</span>
                            <span className="text-gray-500">→</span>
                            <span className="text-amber-400">Caerleon</span>
                            <span className="text-gray-500">|</span>
                            <span className="text-green-400">{formatSilver(opportunity.netProfit)}</span>
                            <span className="text-gray-500">|</span>
                            <span className="text-purple-400">{opportunity.margin.toFixed(1)}%</span>
                            <span className="text-gray-500">|</span>
                            {/* Risk indicator */}
                            <span className={`text-xs font-medium ${
                              opportunity.risk?.color === 'green' ? 'text-green-400' :
                              opportunity.risk?.color === 'yellow' ? 'text-yellow-400' :
                              'text-red-400'
                            }`}>
                              <Shield className="w-3 h-3 inline mr-1" />
                              {opportunity.risk?.label}
                            </span>
                            <span className="text-gray-500">|</span>
                            <span className="text-blue-400">
                              <Timer className="w-3 h-3 inline mr-1" />
                              {opportunity.travelTime}min
                            </span>
                            <span className="text-gray-500">|</span>
                            <span className="text-amber-400">
                              {formatSilver(opportunity.efficiency)}/min
                            </span>
                          </div>
                        </div>

                        {/* Reserve Button */}
                        <button
                          onClick={() => handleReserve(opportunity)}
                          disabled={reservingId === opportunity.itemId}
                          className="bg-amber-500 hover:bg-amber-600 disabled:bg-slate-700 disabled:text-gray-500 text-slate-950 font-semibold py-1.5 px-3 rounded-lg flex items-center gap-1 transition-colors text-sm"
                        >
                          {reservingId === opportunity.itemId ? (
                            <>
                              <div className="w-3 h-3 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                            </>
                          ) : (
                            <>
                              <Lock className="w-3 h-3" />
                              Reservar
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-12">
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
            </>
          )}
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
                      <p className="text-xs text-gray-500">
                        Investimento: {formatSilver(transport.buy_price * transport.quantity)} | Lucro Total: {formatSilver(transport.profit * transport.quantity)}
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

          {/* Total Investment and Return Bar - My Transports */}
          {myTransports.length > 0 && (
            <div className="mt-4 bg-[#021526] rounded-lg p-4 border border-[#88A0BF]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div>
                    <div className="text-xs text-gray-400 mb-1">Investimento Total</div>
                    <div className="text-lg font-bold text-blue-400">{formatSilver(myTransports.reduce((sum, t) => sum + (t.buy_price * t.quantity), 0))}</div>
                  </div>
                  <div className="text-gray-500">→</div>
                  <div>
                    <div className="text-xs text-gray-400 mb-1">Retorno Total</div>
                    <div className="text-lg font-bold text-green-400">{formatSilver(myTransports.reduce((sum, t) => sum + (t.sell_price * t.quantity), 0))}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-400 mb-1">Lucro Total</div>
                    <div className="text-lg font-bold text-amber-400">{formatSilver(myTransports.reduce((sum, t) => sum + (t.profit * t.quantity), 0))}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-gray-400 mb-1">Margem Média</div>
                  <div className="text-lg font-bold text-purple-400">
                    {myTransports.length > 0 ? (
                      ((myTransports.reduce((sum, t) => sum + (t.profit * t.quantity), 0) / myTransports.reduce((sum, t) => sum + (t.buy_price * t.quantity), 0)) * 100).toFixed(1)
                    ) : 0}%
                  </div>
                </div>
              </div>
              {/* Item Icons */}
              <div className="flex items-center gap-2 mt-3 pt-3 border-t border-[#88A0BF]/30">
                <span className="text-xs text-gray-400">Itens:</span>
                <div className="flex items-center gap-1">
                  {myTransports.slice(0, 10).map((transport, index) => (
                    <ItemIcon key={`${transport.item_id}-${index}`} itemId={transport.item_id} size={24} />
                  ))}
                  {myTransports.length > 10 && (
                    <span className="text-xs text-gray-400">+{myTransports.length - 10}</span>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Security Checklist Modal */}
      {showSecurityChecklist && selectedOpportunity && (
        <SecurityChecklist
          opportunity={selectedOpportunity}
          onConfirm={handleConfirmReservation}
          onCancel={() => {
            setShowSecurityChecklist(false);
            setSelectedOpportunity(null);
          }}
        />
      )}
    </div>
  );
};

export default TransportList;
