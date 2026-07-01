/**
 * Itens locais por slot — apenas IDs válidos do Albion (render API).
 */
import { buildItemId } from '@/constants/marketItems';

const SLOT_FAMILIES = {
  MAIN_HAND: [
    'MAIN_SWORD', 'MAIN_AXE', 'MAIN_MACE', 'MAIN_HAMMER', 'MAIN_SPEAR',
    'MAIN_BOW', 'MAIN_CROSSBOW', 'MAIN_DAGGER', 'MAIN_QUARTERSTAFF',
    'MAIN_FIRESTAFF', 'MAIN_FROSTSTAFF', 'MAIN_HOLYSTAFF', 'MAIN_NATURESTAFF',
    'MAIN_ARCANESTAFF', 'MAIN_CURSEDSTAFF',
  ],
  OFF_HAND: ['OFF_SHIELD', 'OFF_TORCH', 'OFF_HORN', 'OFF_BOOK', 'OFF_ORB'],
  HEAD: ['HEAD_CLOTH', 'HEAD_LEATHER', 'HEAD_PLATE'],
  ARMOR: ['ARMOR_CLOTH', 'ARMOR_LEATHER', 'ARMOR_PLATE'],
  SHOES: ['SHOES_CLOTH', 'SHOES_LEATHER', 'SHOES_PLATE'],
  CAPE: ['CAPE'],
  BAG: ['BAG'],
  FOOD: ['MEAL_OMELETTE', 'MEAL_PIE', 'MEAL_SOUP', 'MEAL_STEW'],
  POTION: ['POTION_HEAL', 'POTION_ENERGY', 'POTION_REVIVE'],
  MOUNT: ['MOUNT_HORSE', 'MOUNT_ARMOREDHORSE', 'MOUNT_OX', 'MOUNT_DIREWOLF'],
};

const SKILL_SLOTS = new Set(['MAIN_HAND', 'OFF_HAND', 'HEAD', 'ARMOR', 'SHOES']);

export function slotSupportsSkills(slotKey) {
  return SKILL_SLOTS.has(slotKey);
}

export function getLocalItemsForSlot(slotKey, tier = 8, search = '') {
  const families = SLOT_FAMILIES[slotKey] || [];
  const q = search.trim().toLowerCase();
  const items = [];

  for (const family of families) {
    const itemId = buildItemId(tier, family, 0);
    if (q && !itemId.toLowerCase().includes(q) && !family.toLowerCase().includes(q)) {
      continue;
    }
    items.push({
      item_id: itemId,
      name_pt: itemId.replace(/_/g, ' '),
      tier,
      family,
      image_url: `https://render.albiononline.com/v1/item/${encodeURIComponent(itemId)}.png`,
    });
  }

  return items;
}

export default getLocalItemsForSlot;
