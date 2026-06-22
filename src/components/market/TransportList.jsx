import { useState, useEffect, useCallback } from 'react';
import {
  Package,
  Lock,
  CheckCircle,
  Shield,
  Timer,
} from 'lucide-react';
import { fetchTopOpportunities } from '@/lib/albion/api';
import { MARKET_ITEMS } from '@/constants/marketItems';
import { supabase } from '@/lib/supabase/client';
import { reserveTransportOpportunity } from '@/lib/supabase/transports';
import ItemIcon from './ItemIcon';
import { getItemName } from '@/lib/i18n/itemNames';
import { safeTranslate as translateItem } from '@/utils/itemTranslator';

/**
 * TransportList - lista as oportunidades de transporte do Black Market.
 *
 * Fluxo simplificado (Tarefa 4 do Cline):
 *   - O usuário clica em "Reservar" → reserva é criada diretamente.
 *   - Sem modal de Checklist de Segurança intermediário.
 *   - Lista mestra `MARKET_ITEMS` (~400+ itens) substitui a versão
 *     estática de 125.
 */
const TransportList = ({
  userId,
  refreshKey,
  opportunities: propOpportunities,
  loading: propLoading,
  loadingProgress = null,
}) => {
  const [opportunities, setOpportunities] = useState([]);
  const [myTransports, setMyTransports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reservingId, setReservingId] = useState(null);
  const [completingId, setCompletingId] = useState(null);

  // Sincroniza oportunidades vindas via props (Market page passa por hook)
  useEffect(() => {
    if (propOpportunities !== undefined) {
      setOpportunities(propOpportunities);
      setLoading(propLoading);
    }
  }, [propOpportunities, propLoading]);

  // Fallback local: usado só se o pai não passar opportunities via props.
  const loadOpportunities = useCallback(async () => {
    if (propOpportunities !== undefined) return;
    setLoading(true);
    try {
      const data = await fetchTopOpportunities(MARKET_ITEMS, 50, false, {
        includeAllTiers: true,
        forceRefresh: false,
      });
      setOpportunities(data);
    } catch (error) {
      console.error('Error loading opportunities:', error);
    } finally {
      setLoading(false);
    }
  }, [propOpportunities]);

  const loadMyTransports = useCallback(async () => {
    if (!userId) return;
    try {
      const { data, error } = await supabase
        .from('transport_reservations')
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
    if (propOpportunities === undefined) {
      loadOpportunities();
      const interval = setInterval(loadOpportunities, 60000);
      return () => clearInterval(interval);
    }
  }, [refreshKey, loadOpportunities, loadMyTransports, propOpportunities]);

  /**
   * Reserva direta — sem modal intermediário.
   */
  const handleReserve = async (opportunity) => {
    if (!userId) {
      alert('Você precisa estar logado para reservar um transporte');
      return;
    }

    setReservingId(opportunity.itemId);
    const expiresAt = new Date(Date.now() + 20 * 60 * 1000).toISOString();

    const previousOpportunities = opportunities;
    const itemName = translateItem(opportunity.itemId);
    const optimisticTransport = {
      id: `temp-${Date.now()}`,
      item_id: opportunity.itemId,
      item_name: itemName,
      from_city: opportunity.lowestCity,
      to_city: opportunity.sellCity || 'Caerleon',
      buy_price: opportunity.lowestPrice,
      sell_price: opportunity.bmPrice,
      profit: opportunity.netProfit,
      expected_profit: opportunity.expectedProfit,
      quantity: opportunity.quantity || 1,
      status: 'reserved',
      reserved_by: userId,
      reserved_at: new Date().toISOString(),
      expires_at: expiresAt,
    };

    setOpportunities((prev) =>
      prev.filter((opp) => opp.itemId !== opportunity.itemId)
    );
    setMyTransports((prev) => [optimisticTransport, ...prev]);

    try {
      const result = await reserveTransportOpportunity({
        opportunity,
        userId,
        itemName,
        expiresAt,
      });

      if (!result.success) {
        setOpportunities(previousOpportunities);
        setMyTransports((prev) => prev.filter((t) => t.id !== optimisticTransport.id));
        alert(result.message || 'Falha ao reservar transporte. Tente novamente.');
        return;
      }

      loadMyTransports();
    } catch (error) {
      console.error('Error reserving transport:', error);
      setOpportunities(previousOpportunities);
      setMyTransports((prev) => prev.filter((t) => t.id !== optimisticTransport.id));
      alert('Falha ao reservar transporte. Tente novamente.');
    } finally {
      setReservingId(null);
    }
  };

  const handleComplete = async (transportId) => {
    if (!window.confirm('Tem certeza que deseja concluir este transporte?')) return;

    setCompletingId(transportId);
    try {
      const { error } = await supabase
        .from('transport_reservations')
        .update({ status: 'completed' })
        .eq('id', transportId);

      if (error) throw error;
      loadMyTransports();
    } catch (error) {
      console.error('Error completing transport:', error);
      alert('Falha ao concluir transporte. Tente novamente.');
    } finally {
      setCompletingId(null);
    }
  };

  const formatSilver = (value) =>
    new Intl.NumberFormat('pt-BR').format(Math.round(value || 0));

  const loadingText = loadingProgress?.total > 0
    ? `Carregando ${Math.min(loadingProgress.loaded, loadingProgress.total)} de ${loadingProgress.total} itens...`
    : 'Carregando oportunidades...';

  return (
    <div className="space-y-6">
      {/* Available Opportunities */}
      <div className="bg-slate-900 rounded-lg border border-slate-800 overflow-hidden">
        <div className="bg-slate-800 px-6 py-4 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <Package className="w-6 h-6 text-amber-500" />
            <h2 className="text-xl font-bold text-white">Oportunidades de Transporte</h2>
            <span className="bg-amber-500/20 text-amber-400 px-3 py-1 rounded-full text-sm font-medium">
              {opportunities.length} disponíveis
            </span>
          </div>
        </div>

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
            <div className="space-y-2">
              {opportunities.map((opportunity, index) => (
                <div
                  key={`${opportunity.itemId}-${index}`}
                  className="bg-slate-800/50 rounded-lg p-3 border border-slate-700 hover:border-amber-500/50 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <ItemIcon itemId={opportunity.itemId} size={32} />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-white text-sm truncate">
                          {translateItem(opportunity.itemId)}
                        </h3>
                        {opportunity.enchantment !== undefined && (
                          <span className="text-xs text-purple-400">.{opportunity.enchantment}</span>
                        )}
                        {opportunity.quantity !== undefined && (
                          <span className="text-xs text-blue-400">x{opportunity.quantity}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs mt-1 flex-wrap">
                        <span className="text-blue-400">{opportunity.lowestCity}</span>
                        <span className="text-gray-500">→</span>
                        <span className="text-amber-400">{opportunity.sellCity || 'Black Market'}</span>
                        <span className="text-gray-500">|</span>
                        <span className="text-green-400">{formatSilver(opportunity.netProfit)}</span>
                        <span className="text-gray-500">|</span>
                        <span className="text-purple-400">{(Number(opportunity.margin) || 0).toFixed(1)}%</span>
                        <span className="text-gray-500">|</span>
                        <span className={`text-xs font-medium ${
                          opportunity.risk?.color === 'green' ? 'text-green-400' :
                          opportunity.risk?.color === 'yellow' ? 'text-yellow-400' :
                          'text-red-400'
                        }`}>
                          <Shield className="w-3 h-3 inline mr-1" />
                          {opportunity.risk?.label || '—'}
                        </span>
                        <span className="text-gray-500">|</span>
                        <span className="text-blue-400">
                          <Timer className="w-3 h-3 inline mr-1" />
                          {opportunity.travelTime ?? 0}min
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => handleReserve(opportunity)}
                      disabled={reservingId === opportunity.itemId}
                      className="bg-amber-500 hover:bg-amber-600 disabled:bg-slate-700 disabled:text-gray-500 text-slate-950 font-semibold py-1.5 px-3 rounded-lg flex items-center gap-1 transition-colors text-sm"
                    >
                      {reservingId === opportunity.itemId ? (
                        <div className="w-3 h-3 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <>
                          <Lock className="w-3 h-3" />
                          Reservar
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* My Transports */}
      {userId && myTransports.length > 0 && (
        <div className="bg-slate-900 rounded-lg border border-slate-800 overflow-hidden">
          <div className="bg-slate-800 px-6 py-4 border-b border-slate-700">
            <div className="flex items-center gap-3">
              <Package className="w-6 h-6 text-green-500" />
              <h2 className="text-xl font-bold text-white">Meus Transportes</h2>
              <span className="bg-green-500/20 text-green-400 px-3 py-1 rounded-full text-sm font-medium">
                {myTransports.length} ativos
              </span>
            </div>
          </div>

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
                        Lucro: {formatSilver(transport.profit)} | Qtd: {transport.quantity}
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



