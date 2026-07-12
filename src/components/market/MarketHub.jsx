import { useState, useCallback, useEffect, useMemo } from 'react';
import {
  TrendingUp,
  RefreshCw,
  ShoppingBag,
  ArrowRight,
  Lock,
  CheckCircle,
  Timer,
  MapPin,
} from 'lucide-react';
import { useMarketOpportunities } from '@/hooks/useMarketOpportunities';
import MarketFilters, { applyMarketFilters } from '@/components/market/MarketFilters';
import ItemIcon from '@/components/market/ItemIcon';
import { reserveTransportOpportunity } from '@/lib/supabase/transports';
import { supabase } from '@/lib/supabase/client';
import { safeTranslate as translateItem } from '@/utils/itemTranslator';
import { getCatalogItemsMeta } from '@/lib/supabase/catalog';

const formatSilver = (v) =>
  new Intl.NumberFormat('pt-BR').format(Math.round(v || 0));

const formatPct = (v) => `${Number(v || 0).toFixed(1)}%`;

const formatAge = (iso) => {
  const time = new Date(iso || 0).getTime();
  if (!Number.isFinite(time) || time <= 0) return 'agora';
  const minutes = Math.max(0, Math.floor((Date.now() - time) / 60000));
  if (minutes < 1) return 'agora';
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}min`;
};

const formatTimeLeft = (iso) => {
  const time = new Date(iso || 0).getTime();
  if (!Number.isFinite(time) || time <= Date.now()) return 'expirada';
  const minutes = Math.ceil((time - Date.now()) / 60000);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}min`;
};

const cleanupMarketLifecycle = async () => {
  const { error } = await supabase.rpc('cleanup_market_lifecycle');
  if (error && error.code !== 'PGRST202') {
    console.warn('[MARKET] Falha ao limpar lifecycle:', error.message || error);
  }
};

/**
 * Hub de mercado — comprar nas cidades reais, vender no Black Market.
 */
const MarketHub = ({ userId }) => {
  const [tab, setTab] = useState('opportunities');
  const [refreshKey, setRefreshKey] = useState(0);
  const [filters, setFilters] = useState({
    tiers: [],
    cities: [],
    minProfit: 0,
    minMargin: 0,
    sort: 'profit',
    search: '',
  });
  const [myBag, setMyBag] = useState([]);
  const [reservingId, setReservingId] = useState(null);
  const [completingId, setCompletingId] = useState(null);
  const [catalogMeta, setCatalogMeta] = useState({});
  const [reservedItemIds, setReservedItemIds] = useState(new Set());

  const {
    opportunities,
    loading,
    refresh,
    progress,
  } = useMarketOpportunities(60, refreshKey);

  // Remove oportunidades cujo item já foi reservado por qualquer membro
  // (evita duplicar a mesma "missão" de transporte).
  const filteredOpportunities = useMemo(() => {
    const base = applyMarketFilters(opportunities, filters);
    if (reservedItemIds.size === 0) return base;
    return base.filter((opp) => !reservedItemIds.has(opp.itemId));
  }, [opportunities, filters, reservedItemIds]);

  const progressText =
    progress.total > 0
      ? `Analisando ${Math.min(progress.loaded, progress.total)} / ${progress.total} itens…`
      : 'Consultando preços Albion…';

  const loadMyBag = useCallback(async () => {
    if (!userId) {
      setMyBag([]);
      return;
    }
    await cleanupMarketLifecycle();
    const { data, error } = await supabase
      .from('transport_reservations')
      .select('*')
      .eq('reserved_by', userId)
      .eq('status', 'reserved')
      .order('reserved_at', { ascending: false });

    if (!error) setMyBag(data || []);
  }, [userId]);

  const loadReservedItemIds = useCallback(async () => {
    await cleanupMarketLifecycle();
    const nowIso = new Date().toISOString();
    const { data, error } = await supabase
      .from('transport_reservations')
      .select('item_id, expires_at, status')
      .in('status', ['reserved', 'completed']);

    if (!error && Array.isArray(data)) {
      const ids = data
        .filter((r) => !r.expires_at || r.expires_at > nowIso)
        .map((r) => r.item_id)
        .filter(Boolean);
      setReservedItemIds(new Set(ids));
    }
  }, []);

  useEffect(() => {
    loadMyBag();
    loadReservedItemIds();
  }, [loadMyBag, loadReservedItemIds, refreshKey]);

  useEffect(() => {
    const loadMeta = async () => {
      const ids = opportunities.map((o) => o.itemId).filter(Boolean);
      if (ids.length === 0) {
        setCatalogMeta({});
        return;
      }
      const meta = await getCatalogItemsMeta(ids);
      setCatalogMeta(meta);
    };
    loadMeta();
  }, [opportunities]);

  const handleReserve = async (opp) => {
    if (!userId) {
      alert('Faça login para reservar uma oportunidade.');
      return;
    }

    setReservingId(opp.itemId);
    const expiresAt = opp.expiresAt || new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const itemName = translateItem(opp.itemId);

    try {
      const result = await reserveTransportOpportunity({
        opportunity: opp,
        userId,
        itemName,
        expiresAt,
      });

      if (!result.success) {
        alert(result.message || 'Não foi possível reservar.');
        return;
      }

      loadMyBag();
      loadReservedItemIds();
    } catch (e) {
      alert('Erro ao reservar. Tente novamente.');
    } finally {
      setReservingId(null);
    }
  };

  const handleComplete = async (id) => {
    setCompletingId(id);
    try {
      const { data, error } = await supabase.rpc('complete_transport_reservation', { p_id: id });
      if (error) {
        if (error.code === 'PGRST202') {
          const fallback = await supabase.from('transport_reservations').update({ status: 'completed' }).eq('id', id);
          if (fallback.error) throw fallback.error;
        } else {
          throw error;
        }
      } else if (data === false) {
        throw new Error('Reserva nao encontrada ou ja finalizada.');
      }
      loadMyBag();
      loadReservedItemIds();
    } catch {
      alert('Erro ao concluir.');
    } finally {
      setCompletingId(null);
    }
  };

  const bagTotals = useMemo(
    () =>
      myBag.reduce(
        (acc, t) => {
          const qty = Number(t.quantity) || 1;
          return {
            investment: acc.investment + (Number(t.buy_price) || 0) * qty,
            profit: acc.profit + (Number(t.profit) || 0) * qty,
          };
        },
        { investment: 0, profit: 0 }
      ),
    [myBag]
  );

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-white flex items-center gap-2">
            <TrendingUp className="w-7 h-7 text-red-500" />
            Black Market
          </h1>
          <p className="text-gray-400 mt-1 text-sm max-w-xl">
            Compre nas cidades reais e venda no Black Market (Caerleon). Reserve
            oportunidades lucrativas e acompanhe na sua sacola.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              refresh();
              setRefreshKey((k) => k + 1);
            }}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-sm"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </button>
        </div>
      </div>

      <MarketFilters
        filters={filters}
        onChange={setFilters}
        resultCount={filteredOpportunities.length}
        totalCount={opportunities.length}
      />

      <div className="grid grid-cols-3 gap-3">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <p className="text-xs text-gray-500 uppercase">Oportunidades</p>
          <p className="text-2xl font-bold text-white mt-1">{filteredOpportunities.length}</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <p className="text-xs text-gray-500 uppercase">Minha sacola</p>
          <p className="text-2xl font-bold text-amber-400 mt-1">{myBag.length}</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <p className="text-xs text-gray-500 uppercase">Lucro reservado</p>
          <p className="text-2xl font-bold text-emerald-400 mt-1">
            {formatSilver(bagTotals.profit)}
          </p>
        </div>
      </div>

      <div className="flex gap-2 border-b border-slate-800 pb-0">
        <button
          type="button"
          onClick={() => setTab('opportunities')}
          className={`px-5 py-3 text-sm font-medium rounded-t-lg border-b-2 transition-colors ${
            tab === 'opportunities'
              ? 'border-red-500 text-white bg-slate-900'
              : 'border-transparent text-gray-400 hover:text-white'
          }`}
        >
          Oportunidades BM
        </button>
        <button
          type="button"
          onClick={() => setTab('bag')}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-medium rounded-t-lg border-b-2 transition-colors ${
            tab === 'bag'
              ? 'border-amber-500 text-white bg-slate-900'
              : 'border-transparent text-gray-400 hover:text-white'
          }`}
        >
          <ShoppingBag className="w-4 h-4" />
          Minha Sacola
          {myBag.length > 0 && (
            <span className="bg-amber-500 text-black text-xs font-bold px-1.5 py-0.5 rounded-full">
              {myBag.length}
            </span>
          )}
        </button>
      </div>

      {tab === 'opportunities' && (
        <div className="space-y-3">
          {loading && (
            <p className="text-center text-sm text-gray-500 py-8">{progressText}</p>
          )}

          {!loading && filteredOpportunities.length === 0 && (
            <div className="text-center py-16 bg-slate-900 rounded-xl border border-slate-800">
              <p className="text-gray-400">Nenhuma oportunidade no momento.</p>
              <p className="text-xs text-gray-500 mt-2">
                Execute o coletor para atualizar preços ou aguarde o cache.
              </p>
            </div>
          )}

          {filteredOpportunities.map((opp) => (
            <div
              key={`${opp.itemId}-${opp.lowestCity}`}
              className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col md:flex-row md:items-center gap-4 hover:border-red-500/30 transition-colors"
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                    <ItemIcon
                      itemId={opp.itemId}
                      imageUrl={catalogMeta[opp.itemId]?.image_url || null}
                      size={56}
                    />
                <div className="min-w-0">
                  <p className="font-semibold text-white truncate">
                    {catalogMeta[opp.itemId]?.name_pt || translateItem(opp.itemId)}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {opp.enchantment > 0 && (
                      <span className="text-xs text-purple-400">.{opp.enchantment}</span>
                    )}
                    <span className="text-xs text-blue-400 font-medium">
                      Qtd: {opp.quantity || 1}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 text-sm">
                <div className="text-center">
                  <p className="text-[10px] text-gray-500 uppercase flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    Comprar
                  </p>
                  <p className="text-white font-medium">{opp.lowestCity}</p>
                  <p className="text-emerald-400">{formatSilver(opp.lowestPrice)}</p>
                </div>
                <ArrowRight className="w-5 h-5 text-red-500 flex-shrink-0" />
                <div className="text-center">
                  <p className="text-[10px] text-gray-500 uppercase">Vender</p>
                  <p className="text-amber-400 font-medium">Black Market</p>
                  <p className="text-white">{formatSilver(opp.bmPrice)}</p>
                </div>
              </div>

              <div className="text-right md:min-w-[120px]">
                <p className="text-xs text-gray-500">Lucro líquido</p>
                <p className="text-lg font-bold text-emerald-400">
                  +{formatSilver(opp.netProfit)}
                </p>
                <p className="text-xs text-gray-400">{formatPct(opp.margin)} margem</p>
                  <p className="text-[11px] text-amber-300 mt-1">
                    Cruzado há {formatAge(opp.crossedAt)} · expira em {formatTimeLeft(opp.expiresAt)}
                  </p>
              </div>

              <button
                type="button"
                disabled={reservingId === opp.itemId}
                onClick={() => handleReserve(opp)}
                className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-sm font-semibold whitespace-nowrap"
              >
                <Lock className="w-4 h-4" />
                {reservingId === opp.itemId ? 'Reservando…' : 'Reservar'}
              </button>
            </div>
          ))}
        </div>
      )}

      {tab === 'bag' && (
        <div className="space-y-4">
          {myBag.length === 0 ? (
            <div className="text-center py-16 bg-slate-900 rounded-xl border border-slate-800">
              <ShoppingBag className="w-12 h-12 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400">Sua sacola está vazia.</p>
              <p className="text-xs text-gray-500 mt-2">
                Reserve oportunidades na aba &quot;Oportunidades BM&quot;.
              </p>
            </div>
          ) : (
            <>
              {myBag.map((t) => (
                <div
                  key={t.id}
                  className="bg-slate-900 border border-amber-500/20 rounded-xl p-4 flex flex-col md:flex-row md:items-center gap-4"
                >
                  <div className="flex items-center gap-3 flex-1">
                    <ItemIcon itemId={t.item_id} size={48} />
                    <div>
                      <p className="font-medium text-white">{t.item_name || t.item_id}</p>
                      <p className="text-xs text-gray-400">
                        {t.from_city} → {t.to_city || 'Black Market'}
                      </p>
                      <p className="text-xs text-amber-400 flex items-center gap-1 mt-1">
                        <Timer className="w-3 h-3" />
                        Reserva ativa
                      </p>
                    </div>
                  </div>
                  <div className="text-sm text-right">
                    <p className="text-gray-400">Investimento</p>
                    <p className="text-white">{formatSilver(t.buy_price)}</p>
                    <p className="text-emerald-400 font-bold mt-1">
                      +{formatSilver(t.profit)}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={completingId === t.id}
                    onClick={() => handleComplete(t.id)}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Concluir
                  </button>
                </div>
              ))}

              <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 flex justify-between text-sm">
                <span className="text-gray-400">
                  Investimento total:{' '}
                  <strong className="text-white">{formatSilver(bagTotals.investment)}</strong>
                </span>
                <span className="text-gray-400">
                  Lucro bruto estimado:{' '}
                  <strong className="text-emerald-400">{formatSilver(bagTotals.profit)}</strong>
                </span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default MarketHub;
