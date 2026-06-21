import { useState, useEffect, useMemo } from 'react';
import { TrendingUp, ArrowUpRight, Star, RefreshCw } from 'lucide-react';
import ItemIcon from './ItemIcon';
import { getItemName } from '@/lib/i18n/itemNames';
import { safeTranslate as translateItem } from '@/utils/itemTranslator';
import { fetchTopOpportunities, COMMON_ITEMS } from '@/lib/albion/api';

// TODO[diag]: remove after verifying "0 profitable opportunities" issue
const DIAG_LOG = true;

/**
 * TopOpportunities component - Displays top 10 best profit opportunities.
 *
 * Part 3 of the refactor: this component MUST only render opportunities
 * whose target (sell) city is the Black Market. The backend already
 * enforces this in `fetchTopOpportunities` (`targetCity = BLACK_MARKET`),
 * but we filter again here as a defensive measure and to keep the
 * component self-contained.
 *
 * @param {Array} arbitrageData - Array of arbitrage opportunities (optional, will fetch if not provided)
 * @param {number} limit - Number of cards to display (default: 10)
 */

const TopOpportunities = ({ arbitrageData = null, limit = 10, refreshKey = 0, loading: externalLoading = null, loadingProgress = null }) => {
  const [opportunities, setOpportunities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (arbitrageData) {
      setOpportunities(arbitrageData);
      setLoading(false);
    } else {
      loadOpportunities();
    }
  }, [arbitrageData, refreshKey]);

  const loadOpportunities = async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await fetchTopOpportunities(COMMON_ITEMS, limit, false); // false = no premium by default
      setOpportunities(data);
    } catch (err) {
      setError('Failed to load opportunities');
      console.error('Error loading opportunities:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatSilver = (value) => {
    return new Intl.NumberFormat('pt-BR').format(Math.round(value || 0));
  };

  const isLoading = externalLoading ?? loading;
  const loadingText = loadingProgress?.total > 0
    ? `Carregando ${Math.min(loadingProgress.loaded, loadingProgress.total)} de ${loadingProgress.total} itens...`
    : 'Carregando oportunidades...';

  // Sort by net profit and get top opportunities
  const topOpportunities = useMemo(() => {
    if (!opportunities || opportunities.length === 0) return [];

    // Defensive: only Black-Market sell-side opportunities
    const bmOnly = opportunities.filter((opp) => {
      if (!opp) return false;
      // sellCity is the new canonical field; older payloads used bmPrice
      // together with a hardcoded "Black Market" string in the UI.
      const sellCity = opp.sellCity ?? (opp.bmPrice ? 'Black Market' : null);
      return sellCity === 'Black Market' && Number.isFinite(opp.netProfit);
    });

    if (DIAG_LOG) {
      // eslint-disable-next-line no-console
      console.log(
        '[DIAG][TopOpportunities] raw=', opportunities.length,
        'bmOnly=', bmOnly.length,
        'sample=', bmOnly[0]
      );
    }

    return [...bmOnly]
      .sort((a, b) => (b.netProfit || 0) - (a.netProfit || 0))
      .slice(0, limit);
  }, [opportunities, limit]);

  if (isLoading) {
    return (
      <div className="bg-slate-900 rounded-lg border border-slate-800 p-8">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-red-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400">{loadingText}</p>
        </div>
      </div>
    );
  }

  if (error || topOpportunities.length === 0) {
    return (
      <div className="bg-slate-900 rounded-lg border border-slate-800 p-8">
        <div className="text-center">
          <TrendingUp className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-400 mb-2">
            Nenhuma Oportunidade
          </h3>
          <p className="text-gray-500 mb-4">
            {error || 'Ajuste os filtros para encontrar oportunidades de arbitragem.'}
          </p>
          <button
            onClick={loadOpportunities}
            className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 mx-auto transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Tentar Novamente
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-900 rounded-lg border border-slate-800 overflow-hidden">
      {/* Header */}
      <div className="bg-slate-800 px-6 py-4 border-b border-slate-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Star className="w-6 h-6 text-amber-500" />
            <h2 className="text-xl font-bold text-white">Top Oportunidades</h2>
            <span className="bg-amber-500/20 text-amber-400 px-3 py-1 rounded-full text-sm font-medium">
              Maior Lucro Absoluto
            </span>
          </div>
          <button
            onClick={loadOpportunities}
            className="text-gray-400 hover:text-white transition-colors"
            title="Atualizar oportunidades"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Cards Grid */}
      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {topOpportunities.map((opportunity, index) => (
            <div
              key={`${opportunity.itemId}-${index}`}
              className="bg-slate-800/50 rounded-lg p-4 border border-slate-700 hover:border-amber-500/50 hover:bg-slate-800 transition-all cursor-pointer group relative"
            >
              {/* Rank Badge */}
              <div className="absolute -top-2 -right-2 w-8 h-8 bg-amber-500 rounded-full flex items-center justify-center text-slate-950 font-bold text-sm shadow-lg">
                {index + 1}
              </div>

              {/* Item Icon and Name */}
              <div className="flex flex-col items-center gap-2 mb-3">
                <ItemIcon itemId={opportunity.itemId} size={48} />
                <div className="text-center">
                  <h3 className="font-semibold text-white text-sm truncate">
                    {translateItem(opportunity.itemId)}
                  </h3>
                  <p className="text-xs text-gray-500 truncate">
                    {opportunity.itemId}
                  </p>
                  {opportunity.enchantment !== undefined && (
                    <p className="text-xs text-purple-400">
                      Encantamento: .{opportunity.enchantment}
                    </p>
                  )}
                  {opportunity.quantity !== undefined && (
                    <p className="text-xs text-blue-400">
                      Quantidade: {opportunity.quantity}
                    </p>
                  )}
                </div>
              </div>

              {/* Route */}
              <div className="flex items-center gap-2 mb-3 text-sm justify-center">
                <span className="text-blue-400 font-medium text-xs">{opportunity.lowestCity}</span>
                <ArrowUpRight className="w-3 h-3 text-gray-500" />
                <span className="text-amber-400 font-medium text-xs">Black Market</span>
              </div>

              {/* Price Details */}
              <div className="space-y-2 mb-3 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-400">Compra:</span>
                  <span className="text-white">{formatSilver(opportunity.lowestPrice)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Venda:</span>
                  <span className="text-white">{formatSilver(opportunity.bmPrice)}</span>
                </div>
              </div>

              {/* Profit Highlight */}
              <div className="bg-green-900/30 rounded-lg p-3 border border-green-500/30">
                <div className="flex items-center justify-between">
                  <span className="text-green-400 text-xs font-medium">Lucro Líquido</span>
                  <TrendingUp className="w-3 h-3 text-green-400" />
                </div>
                <p className="text-lg font-bold text-green-400 mt-1">
                  {formatSilver(opportunity.netProfit)}
                </p>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-green-300 text-xs">Margem:</span>
                  <span className="text-green-300 text-xs font-medium">
                    {(Number(opportunity.margin) || 0).toFixed(1)}%
                  </span>
                </div>
              </div>

              {/* Hover Action */}
              <div className="mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                <button className="w-full bg-amber-500 hover:bg-amber-600 text-slate-950 font-semibold py-2 px-3 rounded-lg text-xs transition-colors">
                  Ver Detalhes
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="bg-slate-800/30 px-6 py-3 border-t border-slate-800">
        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>
            Total de {opportunities.length} oportunidades analisadas
          </span>
          <span>
            Atualizado em tempo real
          </span>
        </div>
      </div>
    </div>
  );
};

export default TopOpportunities;


