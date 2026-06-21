/**
 * Tradução nativa para PT-BR de IDs brutos do Albian Online Data Project.
 *
 * Converte IDs no padrão `T{n}_{FAMILY}` ou `T{n}_{FAMILY}@{N}` em
 * nomes legíveis:
 *
 *   "T8_MAIN_HOLYSTAFF@1" → "Cajado Sagrado do Ancião .1"
 *   "T4_HEAD_CLOTH"       → "Capote de Erudito do Adepto"
 *   "T6_MAIN_SWORD"       → "Espada do Mestre"
 *
 * Usa o dicionário oficial de nomes da wiki do Albion Online
 * (nomenclatura em português) e adiciona o sufixo ".N" para
 * encantamentos (1-3) quando aplicável.
 */

const TIER_NAMES = {
  4: 'do Adepto',
  5: 'do Perito',
  6: 'do Mestre',
  7: 'do Grão-mestre',
  8: 'do Ancião',
};

const ENCHANTMENT_SUFFIX = {
  1: '.1',
  2: '.2',
  3: '.3',
};

/**
 * Dicionário de famílias de equipamento.
 * Cada chave é o sufixo da família (após T{n}_) e o valor é o nome
 * em português sem o sufixo de tier.
 *
 * Quando uma família tem variantes (ex: HEAD_PLATE / HEAD_CLOTH /
 * HEAD_LEATHER) o nome base é o mesmo e o sufixo varia.
 */
const FAMILY_NAMES = {
  // Bags
  BAG: 'Mochila',

  // Heads
  HEAD_PLATE: 'Elmo de Placas',
  HEAD_CLOTH: 'Capote de Erudito',
  HEAD_LEATHER: 'Capuz de Couro',

  // Armors
  ARMOR_PLATE: 'Armadura de Placas',
  ARMOR_CLOTH: 'Vestes de Erudito',
  ARMOR_LEATHER: 'Armadura de Couro',

  // Shoes
  SHOES_PLATE: 'Botas de Placas',
  SHOES_CLOTH: 'Sapatos de Erudito',
  SHOES_LEATHER: 'Botas de Couro',

  // Main hands
  MAIN_AXE: 'Machado',
  MAIN_SWORD: 'Espada',
  MAIN_MACE: 'Maça',
  MAIN_DAGGER: 'Adaga',
  MAIN_QUARTERSTAFF: 'Bastão',
  MAIN_HAMMER: 'Martelo',
  MAIN_SPEAR: 'Lança',
  MAIN_BOW: 'Arco',
  MAIN_CROSSBOW: 'Besta',
  MAIN_FIRESTAFF: 'Cajado de Fogo',
  MAIN_FROSTSTAFF: 'Cajado de Gelo',
  MAIN_HOLYSTAFF: 'Cajado Sagrado',
  MAIN_NATURESTAFF: 'Cajado Natural',
  MAIN_ARCANESTAFF: 'Cajado Arcano',
  MAIN_DEMONICSTAFF: 'Cajado Demoníaco',
  MAIN_CURSEDSTAFF: 'Cajado Amaldiçoado',

  // Off hands
  OFF_AXE: 'Machado (Mão Esquerda)',
  OFF_DAGGER: 'Adaga (Mão Esquerda)',
  OFF_HOLY: 'Tomo Sagrado',
  OFF_NATURE: 'Tomo Natural',
  OFF_ARCANESTAFF: 'Cajado Arcano (Esq.)',
  OFF_DEMONICSTAFF: 'Cajado Demoníaco (Esq.)',
  OFF_FIRESTAFF: 'Cajado de Fogo (Esq.)',
  OFF_FROSTSTAFF: 'Cajado de Gelo (Esq.)',
  OFF_CROSSBOW: 'Besta (Esq.)',
  OFF_TORCH: 'Tocha',
  OFF_SHIELD: 'Escudo',
  OFF_BOOK: 'Livro',
  OFF_ORB: 'Orbe',
  OFF_TOTEM: 'Totem',
  OFF_HORN: 'Corneta',

  // Standalone
  SHIELD: 'Escudo',
  CAPE: 'Capa',
};

/**
 * Extrai tier, family e encantamento de um itemId.
 * Aceita:
 *   T4_BAG         → { tier: 4, family: 'BAG',     enchant: 0 }
 *   T8_MAIN_SWORD  → { tier: 8, family: 'MAIN_SWORD', enchant: 0 }
 *   T6_HEAD_CLOTH@2 → { tier: 6, family: 'HEAD_CLOTH', enchant: 2 }
 */
export const parseItemId = (itemId) => {
  if (!itemId || typeof itemId !== 'string') {
    return { tier: null, family: null, enchant: 0 };
  }

  const m = itemId.match(/^T(\d+)_(.+?)(?:@(\d+))?$/);
  if (!m) return { tier: null, family: null, enchant: 0 };

  return {
    tier: parseInt(m[1], 10),
    family: m[2],
    enchant: m[3] ? parseInt(m[3], 10) : 0,
  };
};

/**
 * Formata um itemId do Albian Online em português.
 *
 * @param {string} itemId  Ex: 'T8_MAIN_HOLYSTAFF@1'
 * @param {object} [opts]
 * @param {boolean} [opts.includeTier=true]  Se false, omite "do Ancião"
 * @param {boolean} [opts.includeEnchant=true] Se false, omite ".1"
 * @returns {string} Nome em PT-BR
 */
export const translateItem = (itemId, opts = {}) => {
  const { includeTier = true, includeEnchant = true } = opts;

  if (!itemId || typeof itemId !== 'string') return '—';

  const { tier, family, enchant } = parseItemId(itemId);

  if (!tier || !family) return itemId;

  const baseName = FAMILY_NAMES[family] || family;
  const tierSuffix = includeTier ? ` ${TIER_NAMES[tier] || ''}` : '';
  const enchantSuffix =
    includeEnchant && enchant > 0
      ? ` ${ENCHANTMENT_SUFFIX[enchant] || `.${enchant}`}`
      : '';

  // Limpa espaços duplos
  return `${baseName}${tierSuffix}${enchantSuffix}`.replace(/\s+/g, ' ').trim();
};

/**
 * Versão segura: nunca quebra, nunca retorna undefined.
 * Use em UI para garantir string sempre válida.
 */
export const safeTranslate = (itemId) => {
  try {
    return translateItem(itemId) || itemId || '—';
  } catch (e) {
    return itemId || '—';
  }
};

/**
 * Map de tiers para uso em outros lugares (badges, etc).
 */
export const TIER_BADGE = {
  4: { label: 'Adepto',       color: 'text-zinc-300' },
  5: { label: 'Perito',       color: 'text-emerald-400' },
  6: { label: 'Mestre',       color: 'text-blue-400' },
  7: { label: 'Grão-mestre',  color: 'text-purple-400' },
  8: { label: 'Ancião',       color: 'text-amber-400' },
};

export default translateItem;