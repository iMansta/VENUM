import { useState } from 'react';
import { ArrowUpDown, TrendingUp, AlertCircle } from 'lucide-react';
import ItemIcon from './ItemIcon';
import { safeTranslate as translateItem } from '@/utils/itemTranslator';

const TopOpportunities = ({ arbitrageData, limit = 10, loading, loadingProgress }) => {
  const [expanded, setExpanded] = useState(false);

  const formatSilver = (value) =>
    new Intl.NumberFormat('pt-BR').format(Math.round(value || 0));

  const loadingText = loadingProgress?.total > 0
    ? `Carregando ${Math.min(loadingProgress.loaded, loadingProgress.total)} de ${loadingProgress.total} itens...`
    : 'Carregando oportunidades...';

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="w-12 h-12 border-4 border-red-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-gray-400">{loadingText}</p>
      </div>
    );
  }

  if (!arbitrageData || arbitrageData.length === 0) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="w-16 h-16 text-gray-600 mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-gray-400 mb-2">
          Nenhuma Oportunidade
        </h3>
        <p className="text-gray-500">
          Ajuste os filtros ou aguarde novas oportunidades.
        </p>
      </div>
    );
  }

  const displayData = expanded ? arbitrageData : arbitrageData.slice(0, limit);

  return (
    <div className="space-y-2">
      {displayData.map((opportunity, index) => (
        <div
          key={`${opportunity.itemId}-${index}`}
          className="bg-slate-800/50 rounded-lg p-4 border border-slate-700 hover:border-amber-500/50 transition-all"
        >
          <div className="flex items-center gap-4">
            <ItemIcon itemId={opportunity.itemId} size={48} />

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-semibold text-white">
                  {translateItem(opportunity.itemId)}
                </h3>
                {opportunity.enchantment !== undefined && (
                  <span className="text-xs text-purple-400">.{opportunity.enchantment}</span>
                )}
              </div>
              <div className="flex items-center gap-3 text-sm text-gray-400">
                <span className="text-blue-400">{opportunity.lowestCity}</span>
                <span className="text-gray-500">→</span>
                <span className="text-amber-400">{opportunity.sellCity || 'Black Market'}</span>
              </div>
            </div>

            <div className="text-right">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="w-4 h-4 text-green-500" />
                <span className="text-lg font-bold text-green-400">
                  {formatSilver(opportunity.netProfit)}
                </span>
              </div>
              <div className="text-sm text-gray-400">
                {(Number(opportunity.margin) || 0).toFixed(1)}% margem
              </div>
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-slate-700 grid grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Compra:</span>
              <span className="ml-2 text-white">{formatSilver(opportunity.lowestPrice)}</span>
            </div>
            <div>
              <span className="text-gray-500">Venda:</span>
              <span className="ml-2 text-white">{formatSilver(opportunity.bmPrice)}</span>
            </div>
            <div>
              <span className="text-gray-500">Qtd:</span>
              <span className="ml-2 text-white">{opportunity.quantity || 1}</span>
            </div>
          </div>
        </div>
      ))}

      {arbitrageData.length > limit && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full mt-4 py-2 text-sm text-amber-400 hover:text-amber-300 transition-colors"
        >
          {expanded ? 'Mostrar menos' : `Mostrar todas (${arbitrageData.length})`}
        </button>
      )}
    </div>
  );
};

export default TopOpportunities;
