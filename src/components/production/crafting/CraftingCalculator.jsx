import { useState, useMemo, useEffect } from 'react';
import { Hammer, AlertCircle, TrendingUp, Package, Check, X } from 'lucide-react';

// Sample crafting recipes - in production this would come from an API
const CRAFTING_RECIPES = [
  {
    id: 'T4_MAIN_SPEAR',
    name: 'Lança T4',
    materials: [
      { id: 'T4_METALBAR', name: 'Barra de Metal T4', quantity: 12 },
      { id: 'T4_PLANKS', name: 'Tábuas T4', quantity: 8 },
      { id: 'T4_LEATHER', name: 'Couro T4', quantity: 6 },
    ],
    focusCost: 144,
    returnRate: 43.1,
  },
  {
    id: 'T5_MAIN_SPEAR',
    name: 'Lança T5',
    materials: [
      { id: 'T5_METALBAR', name: 'Barra de Metal T5', quantity: 16 },
      { id: 'T5_PLANKS', name: 'Tábuas T5', quantity: 12 },
      { id: 'T5_LEATHER', name: 'Couro T5', quantity: 8 },
    ],
    focusCost: 216,
    returnRate: 47.8,
  },
  {
    id: 'T6_MAIN_SPEAR',
    name: 'Lança T6',
    materials: [
      { id: 'T6_METALBAR', name: 'Barra de Metal T6', quantity: 20 },
      { id: 'T6_PLANKS', name: 'Tábuas T6', quantity: 16 },
      { id: 'T6_LEATHER', name: 'Couro T6', quantity: 10 },
    ],
    focusCost: 288,
    returnRate: 53.6,
  },
  {
    id: 'T4_BAG',
    name: 'Mochila T4',
    materials: [
      { id: 'T4_LEATHER', name: 'Couro T4', quantity: 16 },
      { id: 'T4_CLOTH', name: 'Tecido T4', quantity: 12 },
    ],
    focusCost: 108,
    returnRate: 43.1,
  },
  {
    id: 'T5_BAG',
    name: 'Mochila T5',
    materials: [
      { id: 'T5_LEATHER', name: 'Couro T5', quantity: 20 },
      { id: 'T5_CLOTH', name: 'Tecido T5', quantity: 16 },
    ],
    focusCost: 162,
    returnRate: 47.8,
  },
];

/**
 * CraftingCalculator component - Calculate crafting costs vs buying
 */

const CraftingCalculator = () => {
  const [selectedRecipe, setSelectedRecipe] = useState(CRAFTING_RECIPES[0]);
  const [materialPrices, setMaterialPrices] = useState({});
  const [craftedItemPrice, setCraftedItemPrice] = useState(50000);
  const [quantity, setQuantity] = useState(1);
  const [useFocus, setUseFocus] = useState(true);

  // Initialize material prices with default values
  useEffect(() => {
    const defaultPrices = {};
    CRAFTING_RECIPES.forEach((recipe) => {
      recipe.materials.forEach((material) => {
        if (!defaultPrices[material.id]) {
          defaultPrices[material.id] = 1000;
        }
      });
    });
    setMaterialPrices(defaultPrices);
  }, []);

  const formatSilver = (value) => {
    return new Intl.NumberFormat('pt-BR').format(Math.round(value));
  };

  const calculations = useMemo(() => {
    const materialCost = selectedRecipe.materials.reduce((total, material) => {
      const price = materialPrices[material.id] || 0;
      return total + (price * material.quantity);
    }, 0);

    const totalMaterialCost = materialCost * quantity;
    const totalCraftedValue = craftedItemPrice * quantity;

    // Focus value calculation (approximate: 1 focus = 2-3 silver)
    const focusValue = useFocus ? selectedRecipe.focusCost * quantity * 2.5 : 0;
    const totalCostWithFocus = totalMaterialCost + focusValue;

    // Return rate calculation
    const returnedValue = (totalMaterialCost * selectedRecipe.returnRate) / 100;
    const realCost = totalMaterialCost - returnedValue + focusValue;

    const profit = totalCraftedValue - realCost;
    const profitMargin = realCost > 0 ? (profit / realCost) * 100 : 0;

    const buyCost = craftedItemPrice * quantity;
    const craftVsBuy = totalCostWithFocus - buyCost;

    return {
      materialCost,
      totalMaterialCost,
      totalCraftedValue,
      focusValue,
      totalCostWithFocus,
      returnedValue,
      realCost,
      profit,
      profitMargin,
      buyCost,
      craftVsBuy,
    };
  }, [selectedRecipe, materialPrices, craftedItemPrice, quantity, useFocus]);

  const handleMaterialPriceChange = (materialId, price) => {
    setMaterialPrices((prev) => ({
      ...prev,
      [materialId]: parseFloat(price) || 0,
    }));
  };

  const recommendation = useMemo(() => {
    if (calculations.profit > 0) {
      return {
        type: 'craft',
        message: `Craftar é lucrativo! Economize ${formatSilver(calculations.craftVsBuy)} comparado a comprar.`,
        icon: Check,
        color: 'green',
      };
    } else if (calculations.craftVsBuy < 0) {
      return {
        type: 'buy',
        message: `Comprar direto é melhor. Economize ${formatSilver(Math.abs(calculations.craftVsBuy))}.`,
        icon: Check,
        color: 'green',
      };
    } else {
      return {
        type: 'neutral',
        message: 'Custo similar entre craftar e comprar.',
        icon: AlertCircle,
        color: 'yellow',
      };
    }
  }, [calculations]);

  return (
    <div className="bg-slate-900 rounded-lg border border-slate-800 overflow-hidden">
      {/* Header */}
      <div className="bg-slate-800 px-6 py-4 border-b border-slate-700">
        <div className="flex items-center gap-3">
          <Hammer className="w-6 h-6 text-amber-500" />
          <h2 className="text-xl font-bold text-white">Calculadora de Craft</h2>
        </div>
      </div>

      <div className="p-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Input Section */}
          <div className="space-y-6">
            {/* Recipe Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Receita de Craft
              </label>
              <div className="grid grid-cols-2 gap-2">
                {CRAFTING_RECIPES.map((recipe) => (
                  <button
                    key={recipe.id}
                    onClick={() => setSelectedRecipe(recipe)}
                    className={`px-4 py-3 rounded-lg text-sm font-medium transition-all text-left ${
                      selectedRecipe.id === recipe.id
                        ? 'bg-amber-500 text-slate-950'
                        : 'bg-slate-800 text-gray-400 hover:bg-slate-700 hover:text-white'
                    }`}
                  >
                    {recipe.name}
                  </button>
                ))}
              </div>
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

            {/* Crafted Item Price */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Preço do Item Craftado (Prata)
              </label>
              <input
                type="number"
                value={craftedItemPrice}
                onChange={(e) => setCraftedItemPrice(parseFloat(e.target.value) || 0)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                min="0"
                step="100"
              />
            </div>

            {/* Focus Toggle */}
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="useFocus"
                checked={useFocus}
                onChange={(e) => setUseFocus(e.target.checked)}
                className="w-5 h-5 rounded border-slate-700 text-amber-500 focus:ring-amber-500 bg-slate-800"
              />
              <label htmlFor="useFocus" className="text-sm text-gray-300">
                Usar Focus (Custo estimado: 2.5 prata/focus)
              </label>
            </div>

            {/* Material Prices */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Preços dos Materiais
              </label>
              <div className="space-y-2">
                {selectedRecipe.materials.map((material) => (
                  <div key={material.id} className="flex items-center gap-3">
                    <div className="flex-1">
                      <span className="text-sm text-gray-400">{material.name}</span>
                      <span className="text-xs text-gray-500 ml-2">x{material.quantity}</span>
                    </div>
                    <input
                      type="number"
                      value={materialPrices[material.id] || 0}
                      onChange={(e) => handleMaterialPriceChange(material.id, e.target.value)}
                      className="w-32 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-right focus:outline-none focus:ring-2 focus:ring-amber-500"
                      min="0"
                      step="1"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Results Section */}
          <div className="space-y-4">
            {/* Material Breakdown */}
            <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Package className="w-5 h-5 text-amber-500" />
                Breakdown de Custo
              </h3>
              <div className="space-y-2">
                {selectedRecipe.materials.map((material) => {
                  const cost = (materialPrices[material.id] || 0) * material.quantity * quantity;
                  return (
                    <div key={material.id} className="flex justify-between items-center text-sm">
                      <span className="text-gray-400">
                        {material.name} x{material.quantity * quantity}
                      </span>
                      <span className="text-white">{formatSilver(cost)}</span>
                    </div>
                  );
                })}
                {useFocus && (
                  <div className="flex justify-between items-center text-sm pt-2 border-t border-slate-700">
                    <span className="text-gray-400">
                      Focus ({selectedRecipe.focusCost * quantity})
                    </span>
                    <span className="text-white">{formatSilver(calculations.focusValue)}</span>
                  </div>
                )}
                <div className="flex justify-between items-center text-sm pt-2 border-t border-slate-700">
                  <span className="text-gray-400">Retorno ({selectedRecipe.returnRate}%)</span>
                  <span className="text-green-400">-{formatSilver(calculations.returnedValue)}</span>
                </div>
                <div className="flex justify-between items-center font-medium pt-2 border-t border-slate-700">
                  <span className="text-gray-300">Custo Real:</span>
                  <span className="text-white">{formatSilver(calculations.realCost)}</span>
                </div>
              </div>
            </div>

            {/* Comparison */}
            <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-amber-500" />
                Comparação
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Custo de Craft:</span>
                  <span className="text-white font-medium">{formatSilver(calculations.realCost)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Custo de Compra:</span>
                  <span className="text-white font-medium">{formatSilver(calculations.buyCost)}</span>
                </div>
                <div className="flex justify-between items-center font-medium pt-2 border-t border-slate-700">
                  <span className="text-gray-300">Diferença:</span>
                  <span
                    className={
                      calculations.craftVsBuy < 0 ? 'text-green-400' : 'text-red-400'
                    }
                  >
                    {calculations.craftVsBuy < 0 ? '-' : '+'}
                    {formatSilver(Math.abs(calculations.craftVsBuy))}
                  </span>
                </div>
              </div>
            </div>

            {/* Profit Analysis */}
            <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
              <h3 className="text-lg font-semibold text-white mb-4">Análise de Lucro</h3>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Valor de Venda:</span>
                  <span className="text-white">{formatSilver(calculations.totalCraftedValue)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Lucro:</span>
                  <span
                    className={`font-bold ${
                      calculations.profit > 0 ? 'text-green-400' : 'text-red-400'
                    }`}
                  >
                    {formatSilver(calculations.profit)}
                  </span>
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
              </div>
            </div>

            {/* Recommendation */}
            <div
              className={`rounded-lg p-4 border ${
                recommendation.color === 'green'
                  ? 'bg-green-900/20 border-green-500/30'
                  : recommendation.color === 'red'
                  ? 'bg-red-900/20 border-red-500/30'
                  : 'bg-yellow-900/20 border-yellow-500/30'
              }`}
            >
              <div className="flex items-start gap-3">
                <recommendation.icon
                  className={`w-5 h-5 mt-0.5 ${
                    recommendation.color === 'green'
                      ? 'text-green-400'
                      : recommendation.color === 'red'
                      ? 'text-red-400'
                      : 'text-yellow-400'
                  }`}
                />
                <div>
                  <h4 className="font-semibold text-white mb-1">
                    {recommendation.type === 'craft'
                      ? 'Recomendado: Craftar'
                      : recommendation.type === 'buy'
                      ? 'Recomendado: Comprar'
                      : 'Análise Neutra'}
                  </h4>
                  <p className="text-sm text-gray-300">{recommendation.message}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CraftingCalculator;
