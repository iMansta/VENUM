/**
 * Itens locais por slot (fallback quando catálogo Supabase está vazio).
 */
const SLOT_FAMILIES = {
  MAIN_HAND: [
    'MAIN_SWORD', 'MAIN_AXE', 'MAIN_MACE', 'MAIN_HAMMER', 'MAIN_SPEAR',
    'MAIN_BOW', 'MAIN_CROSSBOW', 'MAIN_DAGGER', 'MAIN_QUARTERSTAFF',
    'MAIN_FIRESTAFF', 'MAIN_FROSTSTAFF', 'MAIN_HOLYSTAFF', 'MAIN_NATURESTAFF',
    'MAIN_ARCANESTAFF', 'MAIN_CURSEDSTAFF',
  ],
  OFF_HAND: [
    'OFF_SHIELD', 'OFF_TORCH', 'OFF_HORN', 'OFF_BOOK', 'OFF_ORB',
    'OFF_MISTCALLER', 'OFF_CENSER', 'OFF_TOTEM', 'OFF_HOLY', 'OFF_NATURE',
  ],
  HEAD: ['HEAD_CLOTH_SET1', 'HEAD_CLOTH_SET2', 'HEAD_CLOTH_SET3', 'HEAD_LEATHER_SET1', 'HEAD_LEATHER_SET2', 'HEAD_LEATHER_SET3', 'HEAD_PLATE_SET1', 'HEAD_PLATE_SET2', 'HEAD_PLATE_SET3', 'HEAD_CLOTH', 'HEAD_LEATHER', 'HEAD_PLATE'],
  ARMOR: ['ARMOR_CLOTH_SET1', 'ARMOR_CLOTH_SET2', 'ARMOR_CLOTH_SET3', 'ARMOR_LEATHER_SET1', 'ARMOR_LEATHER_SET2', 'ARMOR_LEATHER_SET3', 'ARMOR_PLATE_SET1', 'ARMOR_PLATE_SET2', 'ARMOR_PLATE_SET3', 'ARMOR_CLOTH', 'ARMOR_LEATHER', 'ARMOR_PLATE'],
  SHOES: ['SHOES_CLOTH_SET1', 'SHOES_CLOTH_SET2', 'SHOES_CLOTH_SET3', 'SHOES_LEATHER_SET1', 'SHOES_LEATHER_SET2', 'SHOES_LEATHER_SET3', 'SHOES_PLATE_SET1', 'SHOES_PLATE_SET2', 'SHOES_PLATE_SET3', 'SHOES_CLOTH', 'SHOES_LEATHER', 'SHOES_PLATE'],
  CAPE: ['CAPE', 'CAPE_BLOOD', 'CAPE_DEMON', 'CAPE_HERETIC', 'CAPE_KEEPER', 'CAPE_MORGANA', 'CAPE_UNDEAD'],
  BAG: ['BAG'],
  FOOD: ['MEAL_SOUP', 'MEAL_STEW', 'MEAL_SALAD', 'MEAL_PIE', 'MEAL_OMELETTE', 'MEAL_CASSEROLE', 'MEAL_ROAST', 'MEAL_FISH', 'MEAL_FISHCHOWDER'],
  POTION: ['POTION_HEAL', 'POTION_ENERGY', 'POTION_REVIVE', 'POTION_COOLDOWN', 'POTION_GIGANTISM', 'POTION_ACID', 'POTION_SLOWFIELD', 'POTION_POISON', 'POTION_BERSERK'],
  MOUNT: ['MOUNT_HORSE', 'MOUNT_ARMOREDHORSE', 'MOUNT_OX', 'MOUNT_DIREWOLF', 'MOUNT_DIREBEAR', 'MOUNT_DIREBOAR', 'MOUNT_LIZARD', 'MOUNT_MAMMOTH'],
};

export function getLocalItemsForSlot(slotKey, tier = 8, search = '') {
  const families = SLOT_FAMILIES[slotKey] || [];
  const q = search.trim().toLowerCase();
  const items = [];

  for (const family of families) {
    const itemId = `T${tier}_${family}`;
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
