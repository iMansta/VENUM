import { useState, useMemo } from 'react';
import { TrendingUp, ArrowRight, AlertCircle, Info } from 'lucide-react';

const RESOURCE_TYPES = [
  { id: 'wood', name: 'Madeira', raw: 'T_WOOD', refined: 'T_PLANKS' },
  { id: 'ore', name: 'Minério', raw: 'T_ORE', refined: 'T_METALBAR' },
  { id: 'fiber', name: 'Fibra', raw: 'T_FIBER', refined: 'T_CLOTH' },
  { id: 'hide', name: 'Couro', raw: 'T_HIDE', refined: 'T_LEATHER' },
  { id: 'stone', name: 'Pedra', raw: 'T_ROCK', refined: 'T_STONEBLOCK' },
];

const TIERS = [2, 3, 4, 5, 6, 7, 8];

const RETURN_RATES = {
  2: { min: 15.2, max: 36.7 },
  3: { min: 25.3, max: 47.8 },
  4: { min: 35.4, max: 53.6 },
  5: { min: 43.1, max: 58.5 },
  6: { min: 47.8, max: 61.2 },
  7: { min: 52.3, max: 64.7 },
  8: { min: 54.7, max: 67.1 },
};

/**
 * RefiningCalculator component - Calculate refining profits with return rates
 */

const RefiningCalculator = () => {
  const [resourceType, setResourceType] = useState('wood');
  const [tier, setTier] = useState(4);
  const [rawPrice, setRawPrice] = useState(100);
  const [refinedPrice, setRefinedPrice] = useState(250);
  const [returnRate, setReturnRate] = useState(47.8);
  const [quantity, setQuantity] = useState(100);

  const formatSilver = (value) => {
    return new Intl.NumberFormat('pt-BR').format(Math.round(value));
  };

  const calculations = useMemo(() => {
    const rawCost = rawPrice * quantity;
    const refinedValue = refinedPrice * quantity;
    const returnedMaterial = (quantity * returnRate) / 100;
    const returnedValue = returnedMaterial * rawPrice;
    const totalCost = rawCost - returnedValue;
    const profit = refinedValue - totalCost;
    const profitMargin = totalCost > 0 ? (profit / totalCost) * 100 : 0;
    const profitPerUnit = profit / quantity;

    return {
      rawCost,
      refinedValue,
      returnedMaterial,
      returnedValue,
      totalCost,
      profit,
      profitMargin,
      profitPerUnit,
    };
  }, [rawPrice, refinedPrice, returnRate, quantity]);

  const handleReturnRateChange = (value) => {
    const rate = parseFloat(value);
    const tierRates = RETURN_RATES[tier];
    if (rate < tierRates.min || rate > tierRates.max) {
      // Allow manual override but show warning
    }
    setReturnRate(rate);
  };

  const handleTierChange = (newTier) => {
    setTier(newTier);
    // Auto-adjust return rate to tier's max
    setReturnRate(RETURN_RATES[newTier].max);
  };

  return (
    <div className="bg-slate-900 rounded-lg border border-slate-800 overflow-hidden">
      {/* Header */}
      <div className="bg-slate-800 px-6 py-4 border-b border-slate-700">
        <div className="flex items-center gap-3">
          <TrendingUp className="w-6 h-6 text-amber-500" />
          <h2 className="text-xl font-bold text-white">Calculadora de Refino</h2>
        </div>
      </div>

      <div className="p-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Input Section */}
          <div className="space-y-6">
            {/* Resource Type */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Tipo de Recurso
              </label>
              <div className="grid grid-cols-5 gap-2">
                {RESOURCE_TYPES.map((type) => (
                  <button
                    key={type.id}
                    onClick={() => setResourceType(type.id)}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                      resourceType === type.id
                        ? 'bg-amber-500 text-slate-950'
                        : 'bg-slate-800 text-gray-400 hover:bg-slate-700 hover:text-white'
                    }`}
                  >
                    {type.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Tier */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Tier
              </label>
              <div className="grid grid-cols-7 gap-2">
                {TIERS.map((t) => (
                  <button
                    key={t}
                    onClick={() => handleTierChange(t)}
                    className={`w-10 h-10 rounded-lg text-sm font-bold transition-all ${
                      tier === t
                        ? 'bg-amber-500 text-slate-950'
                        : 'bg-slate-800 text-gray-400 hover:bg-slate-700 hover:text-white'
                    }`}
                  >
                    T{t}
                  </button>
                ))}
              </div>
            </div>

            {/* Prices */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Preço do Material Bruto (Prata)
                </label>
                <input
                  type="number"
                  value={rawPrice}
                  onChange={(e) => setRawPrice(parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  min="0"
                  step="1"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Preço do Refinado (Prata)
                </label>
                <input
                  type="number"
                  value={refinedPrice}
                  onChange={(e) => setRefinedPrice(parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  min="0"
                  step="1"
                />
              </div>
            </div>

            {/* Return Rate */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-300">
                  Taxa de Retorno (%)
                </label>
                <span className="text-xs text-gray-500">
                  Faixa T{tier}: {RETURN_RATES[tier].min}% - {RETURN_RATES[tier].max}%
                </span>
              </div>
              <div className="flex items-center gap-4">
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="0.1"
                  value={returnRate}
                  onChange={(e) => handleReturnRateChange(e.target.value)}
                  className="flex-1 h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
                />
                <input
                  type="number"
                  value={returnRate}
                  onChange={(e) => handleReturnRateChange(e.target.value)}
                  className="w-20 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-center focus:outline-none focus:ring-2 focus:ring-amber-500"
                  min="0"
                  max="100"
                  step="0.1"
                />
              </div>
              {returnRate < RETURN_RATES[tier].min || returnRate > RETURN_RATES[tier].max ? (
                <div className="mt-2 flex items-center gap-2 text-xs text-amber-400">
                  <AlertCircle className="w-4 h-4" />
                  <span>Taxa fora da faixa normal para T{tier}</span>
                </div>
              ) : null}
            </div>

            {/* Quantity */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Quantidade
              </label>
              <input
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                min="1"
                step="1"
              />
            </div>
          </div>

          {/* Results Section */}
          <div className="space-y-4">
            <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Info className="w-5 h-5 text-amber-500" />
                Resultados
              </h3>

              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Custo Bruto:</span>
                  <span className="text-white font-medium">{formatSilver(calculations.rawCost)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Valor Retornado:</span>
                  <span className="text-green-400 font-medium">
                    {formatSilver(calculations.returnedValue)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Custo Real:</span>
                  <span className="text-white font-medium">{formatSilver(calculations.totalCost)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Valor de Venda:</span>
                  <span className="text-white font-medium">{formatSilver(calculations.refinedValue)}</span>
                </div>
                <div className="border-t border-slate-700 pt-3">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-300 font-medium">Lucro:</span>
                    <span
                      className={`font-bold text-lg ${
                        calculations.profit > 0 ? 'text-green-400' : 'text-red-400'
                      }`}
                    >
                      {formatSilver(calculations.profit)}
                    </span>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Margem:</span>
                  <span
                    className={`font-medium ${
                      calculations.profitMargin > 0 ? 'text-green-400' : 'text-red-400'
                    }`}
                  >
                    {calculations.profitMargin.toFixed(2)}%
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Lucro por Unidade:</span>
                  <span
                    className={`font-medium ${
                      calculations.profitPerUnit > 0 ? 'text-green-400' : 'text-red-400'
                    }`}
                  >
                    {formatSilver(calculations.profitPerUnit)}
                  </span>
                </div>
              </div>
            </div>

            {/* Recommendation */}
            <div
              className={`rounded-lg p-4 border ${
                calculations.profit > 0
                  ? 'bg-green-900/20 border-green-500/30'
                  : 'bg-red-900/20 border-red-500/30'
              }`}
            >
              <div className="flex items-start gap-3">
                {calculations.profit > 0 ? (
                  <TrendingUp className="w-5 h-5 text-green-400 mt-0.5" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-red-400 mt-0.5" />
                )}
                <div>
                  <h4 className="font-semibold text-white mb-1">
                    {calculations.profit > 0 ? 'Recomendado' : 'Não Recomendado'}
                  </h4>
                  <p className="text-sm text-gray-300">
                    {calculations.profit > 0
                      ? `Refinar é lucrativo com margem de ${calculations.profitMargin.toFixed(1)}%`
                      : `Refinar resulta em prejuízo de ${formatSilver(Math.abs(calculations.profit))}`}
                  </p>
                </div>
              </div>
            </div>

            {/* Comparison */}
            <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
              <h4 className="font-semibold text-white mb-3 flex items-center gap-2">
                <ArrowRight className="w-4 h-4 text-amber-500" />
                Comparação: Venda Direta
              </h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Vender Bruto:</span>
                  <span className="text-white">{formatSilver(calculations.rawCost)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Refinar e Vender:</span>
                  <span className="text-white">{formatSilver(calculations.refinedValue)}</span>
                </div>
                <div className="flex justify-between font-medium pt-2 border-t border-slate-700">
                  <span className="text-gray-300">Diferença:</span>
                  <span
                    className={
                      calculations.profit > 0 ? 'text-green-400' : 'text-red-400'
                    }
                  >
                    {calculations.profit > 0 ? '+' : ''}
                    {formatSilver(calculations.profit)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RefiningCalculator;
