import { useState, useEffect, useMemo } from 'react';
import {
  Hammer,
  Flame,
  TrendingUp,
  ArrowRight,
  AlertCircle,
  Check,
  Info,
  Loader2,
  Package,
  Coins,
  Crown,
  Settings,
  ChevronDown,
} from 'lucide-react';
import { getCachedMarketPricesByLocation } from '@/lib/supabase/marketCacheByLocation';
import { buildItemId } from '@/constants/marketItems';
import {
  TIERS,
  CITIES,
  RESOURCE_TYPES,
  calcRefining,
  calcCrafting,
  refineInputsPerUnit,
} from '@/lib/production/calculator';

/**
 * Production Calculator — Craft & Refino Albion Online.
 */

const TIER_PREFIX = { 4: 'T4', 5: 'T5', 6: 'T6', 7: 'T7', 8: 'T8' };

const CRAFT_RECIPES = [
  {
    id: 'BAG',
    name: 'Mochila',
    icon: 'T4_BAG',
    materials: { T4: { LEATHER: 16, CLOTH: 12 }, T5: { LEATHER: 20, CLOTH: 16 }, T6: { LEATHER: 24, CLOTH: 20 }, T7: { LEATHER: 28, CLOTH: 24 }, T8: { LEATHER: 32, CLOTH: 28 } },
  },
  {
    id: 'MAIN_SWORD',
    name: 'Espada (Main Hand)',
    icon: 'T4_MAIN_SWORD',
    materials: { T4: { METALBAR: 12, LEATHER: 6, PLANKS: 6 }, T5: { METALBAR: 16, LEATHER: 8, PLANKS: 8 }, T6: { METALBAR: 20, LEATHER: 10, PLANKS: 10 }, T7: { METALBAR: 24, LEATHER: 12, PLANKS: 12 }, T8: { METALBAR: 28, LEATHER: 14, PLANKS: 14 } },
  },
  {
    id: 'MAIN_AXE',
    name: 'Machado (Main Hand)',
    icon: 'T4_MAIN_AXE',
    materials: { T4: { METALBAR: 12, PLANKS: 8, LEATHER: 6 }, T5: { METALBAR: 16, PLANKS: 12, LEATHER: 8 }, T6: { METALBAR: 20, PLANKS: 16, LEATHER: 10 }, T7: { METALBAR: 24, PLANKS: 20, LEATHER: 12 }, T8: { METALBAR: 28, PLANKS: 24, LEATHER: 14 } },
  },
  {
    id: 'MAIN_DAGGER',
    name: 'Adaga (Main Hand)',
    icon: 'T4_MAIN_DAGGER',
    materials: { T4: { METALBAR: 8, LEATHER: 8, PLANKS: 4 }, T5: { METALBAR: 12, LEATHER: 12, PLANKS: 6 }, T6: { METALBAR: 16, LEATHER: 16, PLANKS: 8 }, T7: { METALBAR: 20, LEATHER: 20, PLANKS: 10 }, T8: { METALBAR: 24, LEATHER: 24, PLANKS: 12 } },
  },
  {
    id: 'OFF_SHIELD',
    name: 'Escudo (Off Hand)',
    icon: 'T4_OFF_SHIELD',
    materials: { T4: { METALBAR: 12, PLANKS: 8 }, T5: { METALBAR: 16, PLANKS: 12 }, T6: { METALBAR: 20, PLANKS: 16 }, T7: { METALBAR: 24, PLANKS: 20 }, T8: { METALBAR: 28, PLANKS: 24 } },
  },
  {
    id: 'HEAD_PLATE',
    name: 'Elmo (Plate)',
    icon: 'T4_HEAD_PLATE',
    materials: { T4: { METALBAR: 8, LEATHER: 4 }, T5: { METALBAR: 12, LEATHER: 6 }, T6: { METALBAR: 16, LEATHER: 8 }, T7: { METALBAR: 20, LEATHER: 10 }, T8: { METALBAR: 24, LEATHER: 12 } },
  },
  {
    id: 'ARMOR_PLATE',
    name: 'Armadura (Plate)',
    icon: 'T4_ARMOR_PLATE',
    materials: { T4: { METALBAR: 16, LEATHER: 8 }, T5: { METALBAR: 20, LEATHER: 10 }, T6: { METALBAR: 24, LEATHER: 12 }, T7: { METALBAR: 28, LEATHER: 14 }, T8: { METALBAR: 32, LEATHER: 16 } },
  },
  {
    id: 'SHOES_PLATE',
    name: 'Botas (Plate)',
    icon: 'T4_SHOES_PLATE',
    materials: { T4: { METALBAR: 8, LEATHER: 6 }, T5: { METALBAR: 12, LEATHER: 8 }, T6: { METALBAR: 16, LEATHER: 10 }, T7: { METALBAR: 20, LEATHER: 12 }, T8: { METALBAR: 24, LEATHER: 14 } },
  },
];

// =============================================================================
// Componente principal
// =============================================================================

const Production = () => {
  // --- Modo (Refino | Craft)
  const [mode, setMode] = useState('craft');

  // --- Refino ---
  const [refResource, setRefResource] = useState('wood');
  const [refTier, setRefTier] = useState(4);
  const [refCity, setRefCity] = useState('Martlock');
  const [refUseFocus, setRefUseFocus] = useState(false);
  const [refRawPrice, setRefRawPrice] = useState(100);
  const [refRefinedPrice, setRefRefinedPrice] = useState(250);
  const [refStationFee, setRefStationFee] = useState(0);
  const [refPremium, setRefPremium] = useState(false);
  const [refQuantity, setRefQuantity] = useState(100);
  const [refLowerRefinedPrice, setRefLowerRefinedPrice] = useState(0);

  // --- Craft ---
  const [crRecipe, setCrRecipe] = useState(CRAFT_RECIPES[0]);
  const [crTier, setCrTier] = useState(4);
  const [crCity, setCrCity] = useState('Martlock');
  const [crUseFocus, setCrUseFocus] = useState(false);
  const [crSellPrice, setCrSellPrice] = useState(50000);
  const [crStationFee, setCrStationFee] = useState(0);
  const [crPremium, setCrPremium] = useState(false);
  const [crQuantity, setCrQuantity] = useState(1);

  // --- Preços de mercado carregados do cache/Supabase ---
  const [pricesByItem, setPricesByItem] = useState({});
  const [pricesLoading, setPricesLoading] = useState(false);

  const formatSilver = (value) =>
    new Intl.NumberFormat('pt-BR').format(Math.round(value || 0));

  // =========================================================================
  // Carrega preços do cache (Supabase) para recursos e itens finais.
  // =========================================================================
  useEffect(() => {
    let cancelled = false;

    const loadPrices = async () => {
      setPricesLoading(true);
      try {
        // Monta lista de IDs canônicos para buscar preço:
        //   - Recursos crus e refinados (todos tiers)
        //   - Item final do craft (todos tiers)
        const ids = new Set();
        for (const tier of TIERS) {
          for (const r of RESOURCE_TYPES) {
            ids.add(buildItemId(tier, r.raw, 0));
            ids.add(buildItemId(tier, r.refined, 0));
          }
          for (const recipe of CRAFT_RECIPES) {
            ids.add(buildItemId(tier, recipe.id, 0));
          }
        }

        const cached = await getCachedMarketPricesByLocation([...ids]);
        if (cancelled) return;

        // Indexa pelo item_id com a melhor oferta da cidade selecionada.
        const map = {};
        Object.keys(cached || {}).forEach((itemId) => {
          const rows = cached[itemId] || [];
          if (!rows.length) return;
          // Pega o menor "buy_price_min" entre as cidades reais
          // (preço de compra na cidade onde podemos comprar o material).
          let best = null;
          for (const row of rows) {
            const pd = row.priceData || {};
            const buyMin = Number(pd.buy_price_min || 0);
            const sellMin = Number(pd.sell_price_min || 0);
            const candidate = buyMin > 0 ? buyMin : sellMin;
            if (candidate > 0 && (best === null || candidate < best)) {
              best = candidate;
            }
          }
          if (best !== null) map[itemId] = best;
        });

        setPricesByItem(map);
      } catch (e) {
        console.error('[Production] price load failed:', e);
      } finally {
        if (!cancelled) setPricesLoading(false);
      }
    };

    loadPrices();
    return () => {
      cancelled = true;
    };
  }, []);

  const refResObj = RESOURCE_TYPES.find((r) => r.id === refResource) || RESOURCE_TYPES[0];
  const refCityObj = CITIES.find((c) => c.id === refCity) || CITIES[0];
  const crCityObj = CITIES.find((c) => c.id === crCity) || CITIES[0];

  // Preenche preços do cache quando tier/recurso/receita mudam
  useEffect(() => {
    if (!Object.keys(pricesByItem).length) return;

    const rawId = buildItemId(refTier, refResObj.raw, 0);
    const refinedId = buildItemId(refTier, refResObj.refined, 0);
    const inputs = refineInputsPerUnit(refTier);
    const lowerId = inputs.lowerTier
      ? buildItemId(inputs.lowerTier, refResObj.refined, 0)
      : null;

    if (pricesByItem[rawId]) setRefRawPrice(pricesByItem[rawId]);
    if (pricesByItem[refinedId]) setRefRefinedPrice(pricesByItem[refinedId]);
    if (lowerId && pricesByItem[lowerId]) {
      /* lower refined price used inside calcRefining via refLowerRefinedPrice state */
    }

    const tierKey = `T${crTier}`;
    const recipeMats = crRecipe.materials[tierKey] || {};
    const sellId = buildItemId(crTier, crRecipe.id, 0);
    if (pricesByItem[sellId]) setCrSellPrice(pricesByItem[sellId]);
  }, [pricesByItem, refTier, refResource, crTier, crRecipe.id]);

  useEffect(() => {
    const inputs = refineInputsPerUnit(refTier);
    if (!inputs.lowerTier || !Object.keys(pricesByItem).length) return;
    const lowerId = buildItemId(inputs.lowerTier, refResObj.refined, 0);
    if (pricesByItem[lowerId]) setRefLowerRefinedPrice(pricesByItem[lowerId]);
  }, [pricesByItem, refTier, refResource]);

  const refiningResult = useMemo(() => {
    return calcRefining({
      tier: refTier,
      city: refCityObj,
      useFocus: refUseFocus,
      rawPrice: refRawPrice,
      lowerRefinedPrice: refLowerRefinedPrice,
      refinedPrice: refRefinedPrice,
      stationFeePer100: refStationFee,
      premium: refPremium,
      quantity: refQuantity,
    });
  }, [
    refTier, refCityObj, refUseFocus, refRawPrice, refLowerRefinedPrice,
    refRefinedPrice, refStationFee, refPremium, refQuantity,
  ]);

  const craftingResult = useMemo(() => {
    const tierKey = `T${crTier}`;
    const recipe = crRecipe.materials[tierKey] || {};
    const materialPrices = {};
    Object.keys(recipe).forEach((resourceId) => {
      materialPrices[resourceId] = pricesByItem[buildItemId(crTier, resourceId, 0)] || 0;
    });

    const result = calcCrafting({
      tier: crTier,
      city: crCityObj,
      useFocus: crUseFocus,
      materials: recipe,
      materialPrices,
      sellPrice: crSellPrice,
      stationFeePer100: crStationFee,
      premium: crPremium,
      quantity: crQuantity,
    });

    const materialBreakdown = result.breakdown.map((m) => ({
      resourceId: m.resourceId,
      itemId: buildItemId(crTier, m.resourceId, 0),
      quantity: m.qtyPerUnit,
      marketPrice: m.unitPrice,
    }));

    return { ...result, materialBreakdown, rrrEffective: result.rrr };
  }, [
    crCityObj, crTier, crUseFocus, crRecipe, crSellPrice, crStationFee,
    crPremium, crQuantity, pricesByItem,
  ]);

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-zinc-100 flex items-center gap-3">
            <Hammer className="w-7 h-7 text-amber-500" />
            Calculadora de Craft & Refino
          </h1>
          <p className="text-zinc-400 mt-1 text-sm">
            Calcule o lucro real de produção no Albion Online,
            considerando taxas de mercado, RRR por cidade e bônus de foco.
          </p>
        </div>

        {/* Tabs */}
        <div className="flex bg-zinc-900 border border-zinc-800 rounded-lg p-1">
          <button
            onClick={() => setMode('craft')}
            className={`px-4 py-2 rounded text-sm font-medium transition-all flex items-center gap-2 ${
              mode === 'craft'
                ? 'bg-amber-500 text-zinc-950'
                : 'text-zinc-400 hover:text-zinc-100'
            }`}
          >
            <Hammer className="w-4 h-4" />
            Craft
          </button>
          <button
            onClick={() => setMode('refine')}
            className={`px-4 py-2 rounded text-sm font-medium transition-all flex items-center gap-2 ${
              mode === 'refine'
                ? 'bg-amber-500 text-zinc-950'
                : 'text-zinc-400 hover:text-zinc-100'
            }`}
          >
            <Flame className="w-4 h-4" />
            Refino
          </button>
        </div>
      </div>

      {/* Indicador de carregamento de preços */}
      {pricesLoading && (
        <div className="flex items-center gap-2 text-xs text-zinc-500 bg-zinc-900/60 border border-zinc-800 rounded px-3 py-2">
          <Loader2 className="w-3 h-3 animate-spin" />
          Carregando preços do mercado do Albion Online…
        </div>
      )}

      {mode === 'craft' ? (
        <CraftCalculator
          recipe={crRecipe}
          setRecipe={setCrRecipe}
          tier={crTier}
          setTier={setCrTier}
          city={crCity}
          setCity={setCrCity}
          useFocus={crUseFocus}
          setUseFocus={setCrUseFocus}
          sellPrice={crSellPrice}
          setSellPrice={setCrSellPrice}
          stationFee={crStationFee}
          setStationFee={setCrStationFee}
          premium={crPremium}
          setPremium={setCrPremium}
          quantity={crQuantity}
          setQuantity={setCrQuantity}
          result={craftingResult}
          formatSilver={formatSilver}
        />
      ) : (
        <RefineCalculator
          resource={refResource}
          setResource={setRefResource}
          tier={refTier}
          setTier={setRefTier}
          city={refCity}
          setCity={setRefCity}
          useFocus={refUseFocus}
          setUseFocus={setRefUseFocus}
          rawPrice={refRawPrice}
          setRawPrice={setRefRawPrice}
          refinedPrice={refRefinedPrice}
          setRefinedPrice={setRefRefinedPrice}
          stationFee={refStationFee}
          setStationFee={setRefStationFee}
          premium={refPremium}
          setPremium={setRefPremium}
          quantity={refQuantity}
          setQuantity={setRefQuantity}
          result={refiningResult}
          lowerRefinedPrice={refLowerRefinedPrice}
          setLowerRefinedPrice={setRefLowerRefinedPrice}
          formatSilver={formatSilver}
        />
      )}
    </div>
  );
};

// =============================================================================
// CraftCalculator — calcula o lucro de craftar um item final.
// =============================================================================
const CraftCalculator = ({
  recipe, setRecipe, tier, setTier, city, setCity,
  useFocus, setUseFocus, sellPrice, setSellPrice, stationFee, setStationFee,
  premium, setPremium, quantity, setQuantity, result, formatSilver,
}) => {
  const cityObj = CITIES.find((c) => c.id === city) || CITIES[0];
  const tierPrefix = TIER_PREFIX[tier];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Inputs */}
      <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-5 space-y-5">
        <h2 className="text-lg font-semibold text-zinc-100 flex items-center gap-2">
          <Settings className="w-5 h-5 text-amber-500" />
          Configuração do Craft
        </h2>

        {/* Receita */}
        <FieldGroup label="Item a fabricar">
          <select
            value={recipe.id}
            onChange={(e) => {
              const r = CRAFT_RECIPES.find((x) => x.id === e.target.value);
              if (r) setRecipe(r);
            }}
            className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
          >
            {CRAFT_RECIPES.map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
        </FieldGroup>

        {/* Tier */}
        <FieldGroup label="Tier">
          <div className="grid grid-cols-5 gap-2">
            {TIERS.map((t) => (
              <button
                key={t}
                onClick={() => setTier(t)}
                className={`h-10 rounded font-bold transition-all ${
                  tier === t
                    ? 'bg-amber-500 text-zinc-950'
                    : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-100'
                }`}
              >
                T{t}
              </button>
            ))}
          </div>
        </FieldGroup>

        {/* Cidade */}
        <FieldGroup label="Cidade de produção">
          <CitySelect value={city} onChange={setCity} />
        </FieldGroup>

        {/* Quantidade */}
        <FieldGroup label="Quantidade a produzir">
          <NumberInput
            value={quantity}
            onChange={setQuantity}
            min={1}
            step={1}
          />
        </FieldGroup>

        {/* Preço de venda do item final */}
        <FieldGroup
          label="Preço de venda estimado (por unidade)"
          rightHint="vem do cache de preços do Albion Online"
        >
          <NumberInput
            value={sellPrice}
            onChange={setSellPrice}
            min={0}
            step={1}
          />
        </FieldGroup>

        {/* Foco */}
        <Toggle
          label="Usar Foco na produção"
          description="Foco aumenta significativamente a RRR (+43%) e o preço do item craftado."
          checked={useFocus}
          onChange={setUseFocus}
          disabled={!cityObj.hasFocus}
        />
        {!cityObj.hasFocus && (
          <p className="text-xs text-amber-400 flex items-center gap-1 -mt-3 ml-1">
            <Info className="w-3 h-3" />
            {cityObj.name} não oferece foco pago.
          </p>
        )}

        {/* Taxa da estação */}
        <FieldGroup label="Station Fee (prata por 100 de nutrição)">
          <NumberInput
            value={stationFee}
            onChange={setStationFee}
            min={0}
            step={1}
          />
        </FieldGroup>

        {/* Premium */}
        <Toggle
          label="Possui Premium ativo"
          description="Reduz o imposto de venda de 8% para 4%."
          checked={premium}
          onChange={setPremium}
        />
      </div>

      {/* Resultados */}
      <div className="space-y-4">
        <ResultCard
          icon={<Coins className="w-5 h-5 text-amber-500" />}
          title="Custo Total Real de Produção"
          items={[
            { label: 'Custo base dos materiais', value: formatSilver(result.totalMaterialCost) },
            { label: `(-) Materiais devolvidos (${result.rrrEffective.toFixed(1)}% RRR)`, value: `−${formatSilver(result.returnedValueTotal)}`, color: 'text-emerald-400' },
            { label: '(+) Taxa da estação (nutrição)', value: `+${formatSilver(result.stationFeeTotal)}`, color: 'text-amber-400' },
          ]}
          total={{ label: 'CUSTO REAL', value: formatSilver(result.realCost) }}
        />

        <ResultCard
          icon={<TrendingUp className="w-5 h-5 text-emerald-400" />}
          title="Receita de Venda"
          items={[
            { label: 'Venda bruta no mercado', value: formatSilver(result.grossSell) },
            { label: `(−) Imposto (${(result.taxRate * 100).toFixed(0)}%)`, value: `−${formatSilver(result.marketTax)}`, color: 'text-red-400' },
            { label: '(−) Setup fee (2.5%)', value: `−${formatSilver(result.setupFee)}`, color: 'text-red-400' },
          ]}
          total={{ label: 'RECEITA LÍQUIDA', value: formatSilver(result.netSell) }}
        />

        <ResultCard
          icon={result.netProfit >= 0
            ? <Check className="w-5 h-5 text-emerald-400" />
            : <AlertCircle className="w-5 h-5 text-red-400" />}
          title="Resultado Final"
          items={[
            { label: 'Lucro líquido (venda − custo)', value: formatSilver(result.netProfit), big: true,
              color: result.netProfit >= 0 ? 'text-emerald-400' : 'text-red-400' },
            { label: 'Margem sobre custo', value: `${result.margin.toFixed(2)}%`,
              color: result.margin >= 0 ? 'text-emerald-400' : 'text-red-400' },
            { label: 'Lucro por unidade', value: formatSilver(result.netProfit / Math.max(quantity, 1)) },
          ]}
          footer={result.netProfit >= 0
            ? <span className="text-emerald-400 font-semibold flex items-center gap-2">
                <Check className="w-4 h-4" /> Craftar é lucrativo no Albion Online!
              </span>
            : <span className="text-red-400 font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4" /> Craftar dá prejuízo. Considere comprar.
              </span>}
        />

        {/* Breakdown de materiais */}
        <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-4">
          <h3 className="text-sm font-semibold text-zinc-200 mb-3 flex items-center gap-2">
            <Package className="w-4 h-4 text-amber-500" />
            Materiais consumidos (por unidade {tierPrefix})
          </h3>
          <div className="space-y-2 text-sm">
            {(result.materialBreakdown || []).map((m) => (
              <div
                key={m.resourceId}
                className="flex items-center justify-between py-1.5 border-b border-zinc-800 last:border-0"
              >
                <span className="text-zinc-300 font-mono text-xs">
                  {m.itemId}
                </span>
                <div className="flex items-center gap-3 text-xs">
                  <span className="text-zinc-500">×{m.quantity}</span>
                  <span className="text-zinc-100 font-medium">
                    {formatSilver(m.marketPrice * m.quantity)}
                  </span>
                </div>
              </div>
            ))}
            {(result.materialBreakdown || []).length === 0 && (
              <p className="text-zinc-500 text-xs">Sem materiais para esta receita.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// =============================================================================
// RefineCalculator — calcula o lucro de refinar recursos crus.
// =============================================================================
const RefineCalculator = ({
  resource, setResource, tier, setTier, city, setCity,
  useFocus, setUseFocus, rawPrice, setRawPrice, refinedPrice, setRefinedPrice,
  lowerRefinedPrice, setLowerRefinedPrice,
  stationFee, setStationFee, premium, setPremium, quantity, setQuantity,
  result, formatSilver,
}) => {
  const cityObj = CITIES.find((c) => c.id === city) || CITIES[0];
  const resObj = RESOURCE_TYPES.find((r) => r.id === resource) || RESOURCE_TYPES[0];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Inputs */}
      <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-5 space-y-5">
        <h2 className="text-lg font-semibold text-zinc-100 flex items-center gap-2">
          <Flame className="w-5 h-5 text-amber-500" />
          Configuração do Refino
        </h2>

        <FieldGroup label="Tipo de recurso">
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
            {RESOURCE_TYPES.map((r) => (
              <button
                key={r.id}
                onClick={() => setResource(r.id)}
                className={`px-3 py-2 rounded text-sm font-medium transition-all ${
                  resource === r.id
                    ? 'bg-amber-500 text-zinc-950'
                    : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-100'
                }`}
              >
                {r.name}
              </button>
            ))}
          </div>
        </FieldGroup>

        <FieldGroup label="Tier do material">
          <div className="grid grid-cols-7 gap-2">
            {TIERS.map((t) => (
              <button
                key={t}
                onClick={() => setTier(t)}
                className={`h-10 rounded font-bold transition-all ${
                  tier === t
                    ? 'bg-amber-500 text-zinc-950'
                    : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-100'
                }`}
              >
                T{t}
              </button>
            ))}
          </div>
        </FieldGroup>

        <FieldGroup label="Cidade de refino">
          <CitySelect value={city} onChange={setCity} />
        </FieldGroup>

        <FieldGroup label="Quantidade a refinar">
          <NumberInput value={quantity} onChange={setQuantity} min={1} step={1} />
        </FieldGroup>

        <div className="grid grid-cols-2 gap-3">
          <FieldGroup label={`Preço T${tier} cru`}>
            <NumberInput value={rawPrice} onChange={setRawPrice} min={0} step={1} />
          </FieldGroup>
          <FieldGroup label={`Preço T${tier} refinado`}>
            <NumberInput value={refinedPrice} onChange={setRefinedPrice} min={0} step={1} />
          </FieldGroup>
        </div>

        {tier > 2 && (
          <FieldGroup label={`Preço T${tier - 1} refinado (insumo)`}>
            <NumberInput value={lowerRefinedPrice} onChange={setLowerRefinedPrice} min={0} step={1} />
          </FieldGroup>
        )}

        <Toggle
          label="Usar Foco no refino"
          description="Foco aumenta a RRR em ~43%."
          checked={useFocus}
          onChange={setUseFocus}
          disabled={!cityObj.hasFocus}
        />

        <FieldGroup label="Station Fee (prata por 100 de nutrição)">
          <NumberInput value={stationFee} onChange={setStationFee} min={0} step={1} />
        </FieldGroup>

        <Toggle
          label="Possui Premium ativo"
          description="Reduz o imposto de venda de 8% para 4%."
          checked={premium}
          onChange={setPremium}
        />
      </div>

      {/* Resultados */}
      <div className="space-y-4">
        <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-4 text-xs text-zinc-400 flex items-start gap-2">
          <Info className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            Refino: <span className="font-mono text-zinc-300">
              {tier > 2 ? `1× T${tier}_${resObj.raw} + 1× T${tier - 1}_${resObj.refined} → 1× T${tier}_${resObj.refined}` : `1× T${tier}_${resObj.raw} → 1× T${tier}_${resObj.refined}`}
            </span>
            . RRR efetiva em {cityObj.name}:{' '}
            <span className="font-bold text-amber-400">{result.rrr.toFixed(1)}%</span>
            {result.focusActive && ' (com foco)'}.
          </div>
        </div>

        <ResultCard
          icon={<Coins className="w-5 h-5 text-amber-500" />}
          title="Custo Total Real"
          items={[
            { label: 'Custo dos materiais (cru + T-1 refinado)', value: formatSilver(result.grossMaterialCost) },
            { label: `(−) Cru devolvido (${result.rrr.toFixed(1)}% RRR)`, value: `−${formatSilver(result.returnedValue)}`, color: 'text-emerald-400' },
            { label: '(+) Taxa da estação', value: `+${formatSilver(result.stationFeeTotal)}`, color: 'text-amber-400' },
          ]}
          total={{ label: 'CUSTO REAL', value: formatSilver(result.realCost) }}
        />

        <ResultCard
          icon={<TrendingUp className="w-5 h-5 text-emerald-400" />}
          title="Receita de Venda"
          items={[
            { label: 'Venda bruta no mercado', value: formatSilver(result.grossSell) },
            { label: `(−) Imposto (${(result.taxRate * 100).toFixed(0)}%)`, value: `−${formatSilver(result.marketTax)}`, color: 'text-red-400' },
            { label: '(−) Setup fee (2.5%)', value: `−${formatSilver(result.setupFee)}`, color: 'text-red-400' },
          ]}
          total={{ label: 'RECEITA LÍQUIDA', value: formatSilver(result.netSell) }}
        />

        <ResultCard
          icon={result.netProfit >= 0
            ? <Check className="w-5 h-5 text-emerald-400" />
            : <AlertCircle className="w-5 h-5 text-red-400" />}
          title="Resultado Final"
          items={[
            { label: 'Lucro líquido', value: formatSilver(result.netProfit), big: true,
              color: result.netProfit >= 0 ? 'text-emerald-400' : 'text-red-400' },
            { label: 'Margem sobre custo', value: `${result.margin.toFixed(2)}%`,
              color: result.margin >= 0 ? 'text-emerald-400' : 'text-red-400' },
            { label: 'Lucro por unidade refinada', value: formatSilver(
              result.netProfit / Math.max(quantity, 1)
            ) },
          ]}
          footer={result.netProfit >= 0
            ? <span className="text-emerald-400 font-semibold flex items-center gap-2">
                <Check className="w-4 h-4" /> Refinar é lucrativo no Albion Online!
              </span>
            : <span className="text-red-400 font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4" /> Refinar dá prejuízo. Venda direto.
              </span>}
        />
      </div>
    </div>
  );
};

// =============================================================================
// Componentes utilitários
// =============================================================================

const FieldGroup = ({ label, children, rightHint }) => (
  <div>
    <div className="flex items-center justify-between mb-1.5">
      <label className="block text-sm font-medium text-zinc-300">{label}</label>
      {rightHint && <span className="text-[10px] text-zinc-500 uppercase tracking-wider">{rightHint}</span>}
    </div>
    {children}
  </div>
);

const NumberInput = ({ value, onChange, min = 0, step = 1 }) => (
  <input
    type="number"
    value={Number.isFinite(value) ? value : 0}
    onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
    min={min}
    step={step}
    className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
  />
);

const Toggle = ({ label, description, checked, onChange, disabled = false }) => (
  <div>
    <button
      type="button"
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      className={`w-full flex items-center justify-between px-3 py-2.5 rounded border transition-all ${
        disabled
          ? 'bg-zinc-900 border-zinc-800 text-zinc-600 cursor-not-allowed'
          : checked
            ? 'bg-amber-500/10 border-amber-500/40 text-amber-300'
            : 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:border-zinc-600'
      }`}
    >
      <div className="flex items-center gap-3">
        {checked ? <Crown className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
        <div className="text-left">
          <div className="text-sm font-medium">{label}</div>
          {description && (
            <div className="text-[11px] text-zinc-500">{description}</div>
          )}
        </div>
      </div>
      <div
        className={`w-9 h-5 rounded-full p-0.5 transition-colors ${
          checked ? 'bg-amber-500' : 'bg-zinc-700'
        }`}
      >
        <div
          className={`w-4 h-4 rounded-full bg-white transition-transform ${
            checked ? 'translate-x-4' : ''
          }`}
        />
      </div>
    </button>
  </div>
);

const CitySelect = ({ value, onChange }) => (
  <div className="relative">
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full appearance-none bg-zinc-800 border border-zinc-700 rounded px-3 py-2 pr-8 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
    >
      {CITIES.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name} {c.hasFocus ? '(oferece foco)' : '(sem foco pago)'}
        </option>
      ))}
    </select>
    <ChevronDown className="w-4 h-4 text-zinc-500 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
  </div>
);

const ResultCard = ({ icon, title, items, total, footer }) => (
  <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-4">
    <h3 className="text-sm font-semibold text-zinc-200 mb-3 flex items-center gap-2">
      {icon}
      {title}
    </h3>

    <div className="space-y-2 text-sm">
      {(items || [])
        .filter((i) => i.visible !== false)
        .map((item, idx) => (
          <div
            key={idx}
            className={`flex items-center justify-between ${
              item.big ? 'text-base font-semibold' : 'text-zinc-400'
            }`}
          >
            <span className={item.big ? 'text-zinc-200' : 'text-zinc-400'}>
              {item.label}
            </span>
            <span className={`font-medium ${item.color || 'text-zinc-100'}`}>
              {item.value}
            </span>
          </div>
        ))}

      {total && (
        <div className="border-t border-zinc-800 pt-2 mt-3 flex items-center justify-between">
          <span className="text-xs text-zinc-400 uppercase tracking-wider font-semibold">
            {total.label}
          </span>
          <span className="text-base font-bold text-amber-400">
            {total.value}
          </span>
        </div>
      )}
    </div>

    {footer && (
      <div className="mt-3 pt-3 border-t border-zinc-800 text-sm">
        {footer}
      </div>
    )}
  </div>
);

export default Production;