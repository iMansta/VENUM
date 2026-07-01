/**
 * Catálogo de itens para arbitragem Black Market (T4–T8).
 * Gera IDs no formato Albion: T8_MAIN_SWORD@1
 */

const TIERS = [4, 5, 6, 7, 8];
const ENCHANTMENTS = [0, 1, 2, 3];

const EQUIPMENT_FAMILIES = [
  'MAIN_SWORD', 'MAIN_AXE', 'MAIN_MACE', 'MAIN_HAMMER', 'MAIN_SPEAR',
  'MAIN_BOW', 'MAIN_CROSSBOW', 'MAIN_DAGGER', 'MAIN_QUARTERSTAFF',
  'MAIN_CURSEDSTAFF', 'MAIN_FIRESTAFF', 'MAIN_FROSTSTAFF', 'MAIN_HOLYSTAFF',
  'MAIN_NATURESTAFF', 'MAIN_ARCANESTAFF',
  'OFF_SHIELD', 'OFF_TORCH', 'OFF_HORN', 'OFF_BOOK', 'OFF_ORB',
  'HEAD_CLOTH', 'HEAD_LEATHER', 'HEAD_PLATE',
  'ARMOR_CLOTH', 'ARMOR_LEATHER', 'ARMOR_PLATE',
  'SHOES_CLOTH', 'SHOES_LEATHER', 'SHOES_PLATE',
  'CAPE', 'BAG',
];

/**
 * Monta ID de item Albion.
 * @param {number} tier
 * @param {string} family
 * @param {number} enchantment 0–3
 */
export const buildItemId = (tier, family, enchantment = 0) => {
  const base = `T${tier}_${family}`;
  return enchantment > 0 ? `${base}@${enchantment}` : base;
};

const generateMarketItems = () => {
  const items = new Set();
  for (const tier of TIERS) {
    for (const family of EQUIPMENT_FAMILIES) {
      for (const ench of ENCHANTMENTS) {
        items.add(buildItemId(tier, family, ench));
      }
    }
  }
  return Array.from(items);
};

/** Lista completa (~400+ itens) para TransportList e Production. */
export const MARKET_ITEMS = generateMarketItems();

/** Subconjunto reutilizado pelo hook de oportunidades (mesma lista). */
export const COMMON_ITEMS = MARKET_ITEMS;

export default MARKET_ITEMS;
