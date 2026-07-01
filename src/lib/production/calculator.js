/**
 * Fórmulas oficiais simplificadas — Craft & Refino Albion Online.
 */

export const TIERS = [4, 5, 6, 7, 8];

export const CITIES = [
  { id: 'Martlock', name: 'Martlock', rrBonus: 18.7, hasFocus: true },
  { id: 'Bridgewatch', name: 'Bridgewatch', rrBonus: 18.7, hasFocus: true },
  { id: 'Lymhurst', name: 'Lymhurst', rrBonus: 18.7, hasFocus: true },
  { id: 'Fort Sterling', name: 'Fort Sterling', rrBonus: 18.7, hasFocus: true },
  { id: 'Thetford', name: 'Thetford', rrBonus: 18.7, hasFocus: true },
  { id: 'Caerleon', name: 'Caerleon', rrBonus: 0, hasFocus: false },
  { id: 'Brecilien', name: 'Brecilien', rrBonus: 0, hasFocus: false },
];

export const RESOURCE_TYPES = [
  { id: 'wood', name: 'Madeira', raw: 'WOOD', refined: 'PLANKS' },
  { id: 'ore', name: 'Minério', raw: 'ORE', refined: 'METALBAR' },
  { id: 'fiber', name: 'Fibra', raw: 'FIBER', refined: 'CLOTH' },
  { id: 'hide', name: 'Couro', raw: 'HIDE', refined: 'LEATHER' },
  { id: 'rock', name: 'Pedra', raw: 'ROCK', refined: 'STONEBLOCK' },
];

/** RRR base por tier (refino) — valores da wiki/comunidade. */
export const BASE_RRR = {
  2: 24.5,
  3: 35.4,
  4: 43.1,
  5: 47.8,
  6: 53.6,
  7: 58.5,
  8: 64.7,
};

/** Bônus de foco sobre a RRR (% absoluto adicionado). */
export const FOCUS_RRR_BONUS = 43.5;

/** Nutrição consumida por 1 unidade refinada (aprox.). */
export const REFINE_NUTRITION = { 4: 45, 5: 90, 6: 135, 7: 270, 8: 540 };

export const MARKET_TAX_PREMIUM = 0.04;
export const MARKET_TAX_NORMAL = 0.08;
export const SETUP_FEE = 0.025;

/**
 * Por 1 unidade refinada de tier T:
 * - rawPerUnit: quantidade de recurso cru
 * - lowerRefinedPerUnit: quantidade do refinado T-1 (0 no T2)
 */
export const refineInputsPerUnit = (tier) => ({
  rawPerUnit: 1,
  lowerRefinedPerUnit: tier > 2 ? 1 : 0,
  lowerTier: tier > 2 ? tier - 1 : null,
});

export const effectiveRrr = (tier, city, useFocus) => {
  const base = BASE_RRR[tier] || 43.1;
  const cityBonus = city?.rrBonus || 0;
  const focusBonus = useFocus && city?.hasFocus ? FOCUS_RRR_BONUS : 0;
  return base + cityBonus + focusBonus;
};

export const calcRefining = ({
  tier,
  city,
  useFocus,
  rawPrice,
  lowerRefinedPrice,
  refinedPrice,
  stationFeePer100,
  premium,
  quantity,
}) => {
  const cityObj = city || CITIES[0];
  const focusActive = useFocus && cityObj.hasFocus;
  const rrr = effectiveRrr(tier, cityObj, focusActive);
  const inputs = refineInputsPerUnit(tier);
  const taxRate = premium ? MARKET_TAX_PREMIUM : MARKET_TAX_NORMAL;

  const rawUnits = quantity * inputs.rawPerUnit;
  const lowerUnits = quantity * inputs.lowerRefinedPerUnit;

  const grossMaterialCost = rawUnits * rawPrice + lowerUnits * lowerRefinedPrice;
  const returnedRawUnits = (rawUnits * rrr) / 100;
  const returnedValue = returnedRawUnits * rawPrice;

  const nutrition = (REFINE_NUTRITION[tier] || 45) * quantity;
  const stationFeeTotal = (stationFeePer100 / 100) * nutrition;

  const realCost = Math.max(0, grossMaterialCost - returnedValue + stationFeeTotal);

  const grossSell = refinedPrice * quantity;
  const marketTax = grossSell * taxRate;
  const setupFee = grossSell * SETUP_FEE;
  const netSell = grossSell - marketTax - setupFee;
  const netProfit = netSell - realCost;
  const margin = realCost > 0 ? (netProfit / realCost) * 100 : 0;

  return {
    rrr,
    focusActive,
    rawUnits,
    lowerUnits,
    grossMaterialCost,
    returnedRawUnits,
    returnedValue,
    stationFeeTotal,
    nutrition,
    realCost,
    grossSell,
    marketTax,
    setupFee,
    netSell,
    netProfit,
    margin,
    taxRate,
    inputs,
  };
};

export const calcCrafting = ({
  tier,
  city,
  useFocus,
  materials,
  materialPrices,
  sellPrice,
  stationFeePer100,
  premium,
  quantity,
}) => {
  const cityObj = city || CITIES[0];
  const focusActive = useFocus && cityObj.hasFocus;
  const rrr = effectiveRrr(tier, cityObj, focusActive);
  const taxRate = premium ? MARKET_TAX_PREMIUM : MARKET_TAX_NORMAL;

  const breakdown = Object.entries(materials || {}).map(([resourceId, qtyPerUnit]) => {
    const unitPrice = materialPrices[resourceId] || 0;
    return {
      resourceId,
      qtyPerUnit,
      unitPrice,
      totalPerCraft: unitPrice * qtyPerUnit,
    };
  });

  const materialCostPerUnit = breakdown.reduce((s, m) => s + m.totalPerCraft, 0);
  const totalMaterialUnitsPerUnit = breakdown.reduce((s, m) => s + m.qtyPerUnit, 0);
  const totalMaterialCost = materialCostPerUnit * quantity;

  const returnedUnitsPerCraft = (totalMaterialUnitsPerUnit * rrr) / 100;
  const returnedValuePerCraft =
    totalMaterialUnitsPerUnit > 0
      ? (returnedUnitsPerCraft / totalMaterialUnitsPerUnit) * materialCostPerUnit
      : 0;
  const returnedValueTotal = returnedValuePerCraft * quantity;

  const stationFeeTotal = (stationFeePer100 / 100) * quantity * 10;

  const realCost = Math.max(0, totalMaterialCost - returnedValueTotal + stationFeeTotal);

  const grossSell = sellPrice * quantity;
  const marketTax = grossSell * taxRate;
  const setupFee = grossSell * SETUP_FEE;
  const netSell = grossSell - marketTax - setupFee;
  const netProfit = netSell - realCost;
  const margin = realCost > 0 ? (netProfit / realCost) * 100 : 0;

  return {
    rrr,
    focusActive,
    breakdown,
    materialCostPerUnit,
    totalMaterialCost,
    returnedUnitsPerCraft,
    returnedValueTotal,
    stationFeeTotal,
    realCost,
    grossSell,
    marketTax,
    setupFee,
    netSell,
    netProfit,
    margin,
    taxRate,
  };
};
