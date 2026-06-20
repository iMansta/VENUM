import { useState, useEffect, useMemo } from 'react';
import { TrendingUp, ArrowUpRight, Star, RefreshCw } from 'lucide-react';
import ItemIcon from './ItemIcon';
import { getItemName } from '@/lib/i18n/itemNames';
import { fetchTopOpportunities, COMMON_ITEMS } from '@/lib/albion/api';

/**
 * TopOpportunities component - Displays top 10 best profit opportunities
 * @param {Array} arbitrageData - Array of arbitrage opportunities (optional, will fetch if not provided)
 * @param {number} limit - Number of cards to display (default: 10)
 */

const TopOpportunities = ({ arbitrageData = null, limit = 10, refreshKey = 0 }) => {
  const [opportunities, setOpportunities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [usingMock, setUsingMock] = useState(false);

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
    setUsingMock(false);
    
    try {
      const data = await fetchTopOpportunities(COMMON_ITEMS, limit, false); // false = no premium by default
      setOpportunities(data);
      // Check if using mock data (mock data has specific structure)
      setUsingMock(data.length > 0 && data[0].lowestCity !== undefined);
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

  // Sort by net profit and get top opportunities
  const topOpportunities = useMemo(() => {
    if (!opportunities || opportunities.length === 0) return [];
    return [...opportunities]
      .sort((a, b) => b.netProfit - a.netProfit)
      .slice(0, limit);
  }, [opportunities, limit]);

  if (loading) {
    return (
      <div className="bg-slate-900 rounded-lg border border-slate-800 p-8">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-red-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400">Carregando oportunidades...</p>
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
            {usingMock && (
              <span className="bg-blue-500/20 text-blue-400 px-3 py-1 rounded-full text-xs font-medium">
                Dados de Exemplo (API Indisponível)
              </span>
            )}
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
                    {getItemName(opportunity.itemId)}
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
                    {opportunity.margin.toFixed(1)}%
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
