import { buildItemId } from '@/constants/marketItems';
import { getAlbionIconUrl } from '@/utils/albionIcon';

const SLOT_FAMILIES = {
  MAIN_HAND: [
    'MAIN_SWORD', 'MAIN_AXE', 'MAIN_MACE', 'MAIN_HAMMER', 'MAIN_SPEAR',
    '2H_BOW', '2H_CROSSBOW', 'MAIN_DAGGER', '2H_QUARTERSTAFF',
    'MAIN_FIRESTAFF', 'MAIN_FROSTSTAFF', 'MAIN_HOLYSTAFF', 'MAIN_NATURESTAFF',
    'MAIN_ARCANESTAFF', 'MAIN_CURSEDSTAFF',
  ],
  OFF_HAND: ['OFF_SHIELD', 'OFF_TORCH', 'OFF_HORN_KEEPER', 'OFF_BOOK', 'OFF_ORB_MORGANA'],
  HEAD: ['HEAD_CLOTH_SET1', 'HEAD_LEATHER_SET1', 'HEAD_PLATE_SET1'],
  ARMOR: ['ARMOR_CLOTH_SET1', 'ARMOR_LEATHER_SET1', 'ARMOR_PLATE_SET1'],
  SHOES: ['SHOES_CLOTH_SET1', 'SHOES_LEATHER_SET1', 'SHOES_PLATE_SET1'],
  CAPE: ['CAPE'],
  BAG: ['BAG'],
  FOOD: ['MEAL_OMELETTE', 'MEAL_PIE', 'MEAL_SOUP', 'MEAL_STEW'],
  POTION: ['POTION_HEAL', 'POTION_ENERGY', 'POTION_REVIVE'],
  MOUNT: ['MOUNT_HORSE', 'MOUNT_ARMORED_HORSE', 'MOUNT_OX', 'MOUNT_DIREWOLF'],
};

const VALID_TIERS_BY_FAMILY = {
  MEAL_OMELETTE: new Set([5, 7]),
  MEAL_PIE: new Set([5, 7]),
  MEAL_SOUP: new Set([5]),
  MEAL_STEW: new Set([4, 6, 8]),
  POTION_HEAL: new Set([4, 6]),
  POTION_ENERGY: new Set([4, 6]),
  POTION_REVIVE: new Set([5, 7]),
  MOUNT_ARMORED_HORSE: new Set([5, 6, 7, 8]),
  MOUNT_DIREWOLF: new Set([6]),
};

const SKILL_SLOTS = new Set(['MAIN_HAND', 'OFF_HAND', 'HEAD', 'ARMOR', 'SHOES']);

export function slotSupportsSkills(slotKey) {
  return SKILL_SLOTS.has(slotKey);
}

export function getLocalItemsForSlot(slotKey, tier = 8, search = '') {
  const families = SLOT_FAMILIES[slotKey] || [];
  const q = search.trim().toLowerCase();
  const items = [];
  const tiers = Number.isInteger(tier) ? [tier] : [4, 5, 6, 7, 8];

  for (const selectedTier of tiers) {
    for (const family of families) {
      const validTiers = VALID_TIERS_BY_FAMILY[family];
      if (validTiers && !validTiers.has(selectedTier)) {
        continue;
      }
      const itemId = buildItemId(selectedTier, family, 0);
      if (q && !itemId.toLowerCase().includes(q) && !family.toLowerCase().includes(q)) {
        continue;
      }
      items.push({
        item_id: itemId,
        name_pt: itemId.replace(/_/g, ' '),
        tier: selectedTier,
        family,
        image_url: getAlbionIconUrl(itemId),
      });
    }
  }

  return items;
}

export default getLocalItemsForSlot;
