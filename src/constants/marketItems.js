/**
 * VENUM MARKET - Catálogo expandido de itens negociáveis no Black Market.
 *
 * Apenas itens EQUIPÁVEIS (que podem ser vendidos no Black Market).
 * Recursos (PLANK, ORE, FIBER, etc.) são explicitamente excluídos porque
 * o BM não os aceita.
 *
 * Cada item é gerado para os tiers T4-T8 e encantamentos 0-3, o que dá
 * uma cobertura muito maior do que a lista estática anterior (125 itens).
 *
 * O Albion Data Project aceita um número grande de IDs por requisição
 * (até ~200-300 antes de começar a truncar), mas com caching por
 * (item, location) em market_prices_cache_by_location isso deixa de ser
 * problema porque itens raros nunca chegam a ser pedidos de novo dentro
 * do TTL de 15 min.
 */

const TIERS = [4, 5, 6, 7, 8];
const ENCHANTMENTS = [0, 1, 2, 3];

// Famílias de equipamentos aceitos no Black Market.
const EQUIPMENT_FAMILIES = [
  'BAG',
  // Cabeças
  'HEAD_PLATE', 'HEAD_CLOTH', 'HEAD_LEATHER',
  // Armaduras
  'ARMOR_PLATE', 'ARMOR_CLOTH', 'ARMOR_LEATHER',
  // Calçados
  'SHOES_PLATE', 'SHOES_CLOTH', 'SHOES_LEATHER',
  // Armas principais
  'MAIN_AXE', 'MAIN_SWORD', 'MAIN_MACE', 'MAIN_DAGGER',
  'MAIN_QUARTERSTAFF', 'MAIN_HAMMER', 'MAIN_SPEAR', 'MAIN_BOW',
  'MAIN_CROSSBOW', 'MAIN_FIRESTAFF', 'MAIN_FROSTSTAFF',
  'MAIN_HOLYSTAFF', 'MAIN_NATURESTAFF', 'MAIN_ARCANESTAFF',
  'MAIN_DEMONICSTAFF', 'MAIN_CURSEDSTAFF',
  // Armas off-hand
  'OFF_AXE', 'OFF_DAGGER', 'OFF_HOLY', 'OFF_NATURE',
  'OFF_ARCANESTAFF', 'OFF_DEMONICSTAFF', 'OFF_FIRESTAFF',
  'OFF_FROSTSTAFF', 'OFF_CROSSBOW', 'OFF_TORCH', 'OFF_SHIELD',
  'OFF_BOOK', 'OFF_ORB', 'OFF_TOTEM', 'OFF_HORN',
  // Escudos e capas
  'SHIELD', 'CAPE',
];

// Padrões que JAMAIS devem chegar no fetch (recursos, não vão ao BM).
// Mantido por segurança caso alguém adicione um id manualmente depois.
const EXCLUDED_PATTERNS = [
  'PLANK', 'WOOD', 'ORE', 'METALBAR', 'FIBER',
  'ROCK', 'STONE', 'HIDE', 'LEATHER_RAW', 'CLOTH_RAW',
];

const isExcluded = (itemId) => {
  if (!itemId) return true;
  const upper = String(itemId).toUpperCase();
  return EXCLUDED_PATTERNS.some((p) => upper.includes(p));
};

const buildItems = () => {
  const items = [];
  for (const tier of TIERS) {
    for (const family of EQUIPMENT_FAMILIES) {
      // Apenas uma variedade de encantamento 0 para BAG (não há bag encantada).
      const enchants = family === 'BAG' ? [0] : ENCHANTMENTS;
      for (const enc of enchants) {
        const itemId = `T${tier}_${family}.${enc}`;
        if (isExcluded(itemId)) continue;
        items.push({ itemId, enchantment: enc, quantity: 1 });
      }
    }
  }
  return items;
};

/**
 * Lista mestra de itens que o app consulta no Albion Data Project.
 * Calculada uma única vez no carregamento do módulo.
 */
export const MARKET_ITEMS = Object.freeze(buildItems());

/**
 * Mantido por compatibilidade com componentes legados que ainda
 * importam `COMMON_ITEMS`. Aponta para a mesma lista mestra.
 */
export const COMMON_ITEMS = MARKET_ITEMS;

export const MARKET_ITEM_COUNT = MARKET_ITEMS.length;