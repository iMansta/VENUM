/**
 * Catálogo de itens para arbitragem Black Market (T4–T8).
 * Gera IDs no formato Albion: T8_MAIN_SWORD@1
 *
 * Importante: a lista abaixo usa famílias reais do Render/GameInfo.
 * IDs genéricos como T8_ARMOR_CLOTH, T8_MAIN_BOW ou T8_MOUNT_ARMOREDHORSE
 * não existem no Albion e causam falhas no catálogo/ícones.
 */

const TIERS = [4, 5, 6, 7, 8];
const ENCHANTMENTS = [0, 1, 2, 3];

const EQUIPMENT_FAMILIES = [
  'MAIN_SWORD', 'MAIN_AXE', 'MAIN_MACE', 'MAIN_HAMMER', 'MAIN_SPEAR',
  '2H_BOW', '2H_CROSSBOW', 'MAIN_DAGGER', '2H_QUARTERSTAFF',
  'MAIN_CURSEDSTAFF', 'MAIN_FIRESTAFF', 'MAIN_FROSTSTAFF', 'MAIN_HOLYSTAFF',
  'MAIN_NATURESTAFF', 'MAIN_ARCANESTAFF',
  'OFF_SHIELD', 'OFF_TORCH', 'OFF_HORN_KEEPER', 'OFF_BOOK', 'OFF_ORB_MORGANA',
  'HEAD_CLOTH_SET1', 'HEAD_LEATHER_SET1', 'HEAD_PLATE_SET1',
  'ARMOR_CLOTH_SET1', 'ARMOR_LEATHER_SET1', 'ARMOR_PLATE_SET1',
  'SHOES_CLOTH_SET1', 'SHOES_LEATHER_SET1', 'SHOES_PLATE_SET1',
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
