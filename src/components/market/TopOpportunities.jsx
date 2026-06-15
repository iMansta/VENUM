import { useMemo } from 'react';
import { TrendingUp, ArrowUpRight, Star } from 'lucide-react';
import ItemIcon from './ItemIcon';
import { getItemName } from '@/lib/i18n/itemNames';

/**
 * TopOpportunities component - Displays top 4-5 best profit opportunities
 * @param {Array} arbitrageData - Array of arbitrage opportunities
 * @param {number} limit - Number of cards to display (default: 4)
 */

const TopOpportunities = ({ arbitrageData = [], limit = 4 }) => {
  const formatSilver = (value) => {
    return new Intl.NumberFormat('pt-BR').format(Math.round(value));
  };

  // Sort by net profit and get top opportunities
  const topOpportunities = useMemo(() => {
    return [...arbitrageData]
      .sort((a, b) => b.netProfit - a.netProfit)
      .slice(0, limit);
  }, [arbitrageData, limit]);

  if (topOpportunities.length === 0) {
    return (
      <div className="bg-slate-900 rounded-lg border border-slate-800 p-8">
        <div className="text-center">
          <TrendingUp className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-400 mb-2">
            Nenhuma Oportunidade
          </h3>
          <p className="text-gray-500">
            Ajuste os filtros para encontrar oportunidades de arbitragem.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-900 rounded-lg border border-slate-800 overflow-hidden">
      {/* Header */}
      <div className="bg-slate-800 px-6 py-4 border-b border-slate-700">
        <div className="flex items-center gap-3">
          <Star className="w-6 h-6 text-amber-500" />
          <h2 className="text-xl font-bold text-white">Top Oportunidades</h2>
          <span className="bg-amber-500/20 text-amber-400 px-3 py-1 rounded-full text-sm font-medium">
            Maior Lucro Absoluto
          </span>
        </div>
      </div>

      {/* Cards Grid */}
      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {topOpportunities.map((opportunity, index) => (
            <div
              key={`${opportunity.itemId}-${index}`}
              className="bg-slate-800/50 rounded-lg p-4 border border-slate-700 hover:border-amber-500/50 hover:bg-slate-800 transition-all cursor-pointer group"
            >
              {/* Rank Badge */}
              <div className="absolute -top-2 -right-2 w-8 h-8 bg-amber-500 rounded-full flex items-center justify-center text-slate-950 font-bold text-sm shadow-lg">
                {index + 1}
              </div>

              {/* Item Icon and Name */}
              <div className="flex items-center gap-3 mb-3">
                <ItemIcon itemId={opportunity.itemId} size={48} />
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-white text-sm truncate">
                    {getItemName(opportunity.itemId)}
                  </h3>
                  <p className="text-xs text-gray-500 truncate">
                    {opportunity.itemId}
                  </p>
                </div>
              </div>

              {/* Route */}
              <div className="flex items-center gap-2 mb-3 text-sm">
                <span className="text-blue-400 font-medium">{opportunity.lowestCity}</span>
                <ArrowUpRight className="w-4 h-4 text-gray-500" />
                <span className="text-amber-400 font-medium">Caerleon</span>
              </div>

              {/* Price Details */}
              <div className="space-y-2 mb-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Compra:</span>
                  <span className="text-white">{formatSilver(opportunity.lowestPrice)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Venda:</span>
                  <span className="text-white">{formatSilver(opportunity.bmPrice)}</span>
                </div>
              </div>

              {/* Profit Highlight */}
              <div className="bg-green-900/30 rounded-lg p-3 border border-green-500/30">
                <div className="flex items-center justify-between">
                  <span className="text-green-400 text-sm font-medium">Lucro Líquido</span>
                  <TrendingUp className="w-4 h-4 text-green-400" />
                </div>
                <p className="text-xl font-bold text-green-400 mt-1">
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
                <button className="w-full bg-amber-500 hover:bg-amber-600 text-slate-950 font-semibold py-2 px-4 rounded-lg text-sm transition-colors">
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
            Total de {arbitrageData.length} oportunidades analisadas
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
