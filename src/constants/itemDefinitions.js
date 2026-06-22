/**
 * VENUM MARKET - Dicionário de definições de itens do Albian Online.
 *
 * Estrutura compacta (mentalidade: o agente trata o item como uma chave):
 *
 *   ITEM_ID → {
 *     slot:    'MAIN_HAND' | 'OFF_HAND' | 'HEAD' | 'ARMOR' | 'SHOES' | 'CAPE' | 'BAG' | 'FOOD' | 'POTION' | 'MOUNT'
 *     skills:  { q: ['Q1','Q2'], w: ['W1'], e: ['E'] }
 *     passives: ['P1', 'P2']
 *   }
 *
 * Apenas a versão base (encantamento 0) é catalogada. Os encantamentos
 * @1, @2, @3 herdam o mesmo set de skills/passivas.
 *
 * A função `getItemDefinition(itemId)` é a API pública.
 */

// =============================================================================
// Slots oficiais (padronizados para o construtor de builds)
// =============================================================================
export const ITEM_SLOTS = [
  'MAIN_HAND',
  'OFF_HAND',
  'HEAD',
  'ARMOR',
  'SHOES',
  'CAPE',
  'BAG',
  'FOOD',
  'POTION',
  'MOUNT',
];

export const SLOT_LABELS_PT = {
  MAIN_HAND: 'Mão Principal',
  OFF_HAND:  'Mão Secundária',
  HEAD:      'Cabeça',
  ARMOR:     'Peito',
  SHOES:     'Calçado',
  CAPE:      'Capa',
  BAG:       'Mochila',
  FOOD:      'Comida',
  POTION:    'Poção',
  MOUNT:     'Montaria',
};

// =============================================================================
// Família do item → slot
// =============================================================================
export const FAMILY_TO_SLOT = {
  // Main hand
  MAIN_AXE: 'MAIN_HAND', MAIN_SWORD: 'MAIN_HAND', MAIN_MACE: 'MAIN_HAND',
  MAIN_DAGGER: 'MAIN_HAND', MAIN_QUARTERSTAFF: 'MAIN_HAND',
  MAIN_HAMMER: 'MAIN_HAND', MAIN_SPEAR: 'MAIN_HAND', MAIN_BOW: 'MAIN_HAND',
  MAIN_CROSSBOW: 'MAIN_HAND', MAIN_FIRESTAFF: 'MAIN_HAND',
  MAIN_FROSTSTAFF: 'MAIN_HAND', MAIN_HOLYSTAFF: 'MAIN_HAND',
  MAIN_NATURESTAFF: 'MAIN_HAND', MAIN_ARCANESTAFF: 'MAIN_HAND',
  MAIN_DEMONICSTAFF: 'MAIN_HAND', MAIN_CURSEDSTAFF: 'MAIN_HAND',
  // Off hand
  OFF_AXE: 'OFF_HAND', OFF_DAGGER: 'OFF_HAND', OFF_HOLY: 'OFF_HAND',
  OFF_NATURE: 'OFF_HAND', OFF_ARCANESTAFF: 'OFF_HAND',
  OFF_DEMONICSTAFF: 'OFF_HAND', OFF_FIRESTAFF: 'OFF_HAND',
  OFF_FROSTSTAFF: 'OFF_HAND', OFF_CROSSBOW: 'OFF_HAND',
  OFF_TORCH: 'OFF_HAND', OFF_SHIELD: 'OFF_HAND', OFF_BOOK: 'OFF_HAND',
  OFF_ORB: 'OFF_HAND', OFF_TOTEM: 'OFF_HAND', OFF_HORN: 'OFF_HAND',
  // Standalone
  SHIELD: 'OFF_HAND',
  HEAD_PLATE: 'HEAD', HEAD_CLOTH: 'HEAD', HEAD_LEATHER: 'HEAD',
  ARMOR_PLATE: 'ARMOR', ARMOR_CLOTH: 'ARMOR', ARMOR_LEATHER: 'ARMOR',
  SHOES_PLATE: 'SHOES', SHOES_CLOTH: 'SHOES', SHOES_LEATHER: 'SHOES',
  CAPE: 'CAPE',
  BAG: 'BAG',
};

// =============================================================================
// Dicionário de skills/passivas por item base
// (formato compacto: ITEM_ID sem tier/enchant → skills + passives)
// =============================================================================
//
// Cada chave é o `family` + tier (ex: 'MAIN_HOLYSTAFF_T8').
// `skills` lista as habilidades ativas (Q/W/E).
// `passives` lista as passivas disponíveis para aquele item.
//
// Quando o usuário seleciona um item, o BuildBuilder consulta este
// dicionário via getItemDefinition() e renderiza os selects.
// =============================================================================

const ITEM_DEFINITIONS = {
  // ---------------------- MAIN HAND ----------------------
  MAIN_AXE_T8:           { slot: 'MAIN_HAND', skills: { q: ['Q1: Corte Seco', 'Q2: Fúria'],     w: ['W: Giro Abrasivo'],  e: ['E: BERSERK'] },     passives: ['P1: Sangramento', 'P2: Dano Crítico'] },
  MAIN_SWORD_T8:         { slot: 'MAIN_HAND', skills: { q: ['Q1: Estocada', 'Q2: Corte Cruzado'], w: ['W: Lâmina Relâmpago'], e: ['E: Tempestade de Aço'] }, passives: ['P1: Dano em Cadeia'] },
  MAIN_MACE_T8:         { slot: 'MAIN_HAND', skills: { q: ['Q1: Pancada', 'Q2: Martelada'],      w: ['W: Onda de Choque'],   e: ['E: Julgamento Divino'] }, passives: ['P1: Atordoar', 'P2: Cura por Golpe'] },
  MAIN_DAGGER_T8:        { slot: 'MAIN_HAND', skills: { q: ['Q1: Apunhalar', 'Q2: Lâminas Gêmeas'], w: ['W: Distração'],        e: ['E: Execução'] },     passives: ['P1: Ataque Furtivo', 'P2: Veneno'] },
  MAIN_QUARTERSTAFF_T8:  { slot: 'MAIN_HAND', skills: { q: ['Q1: Golpe de Bastão'],            w: ['W: AOE Cônico'],       e: ['E: Salto Heroico'] }, passives: ['P1: Resistência'] },
  MAIN_HAMMER_T8:        { slot: 'MAIN_HAND', skills: { q: ['Q1: Martelo Pesado'],              w: ['W: Tremor'],          e: ['E: Bigorna'] },     passives: ['P1: Dano de Área'] },
  MAIN_SPEAR_T8:         { slot: 'MAIN_HAND', skills: { q: ['Q1: Estocada Longa'],              w: ['W: Lança Perfurante'], e: ['E: Chuva de Lanças'] }, passives: ['P1: Alcance'] },
  MAIN_BOW_T8:           { slot: 'MAIN_HAND', skills: { q: ['Q1: Tiro Certeiro', 'Q2: Chuva de Flechas'], w: ['W: Flecha Explosiva'], e: ['E: Voo do Caçador'] }, passives: ['P1: Mira'] },
  MAIN_CROSSBOW_T8:      { slot: 'MAIN_HAND', skills: { q: ['Q1: Disparo'],                     w: ['W: Explosão Mecânica'], e: ['E: Rajada de Aço'] }, passives: ['P1: Recarregar'] },
  MAIN_HOLYSTAFF_T8:     { slot: 'MAIN_HAND', skills: { q: ['Q1: Luz Sagrada', 'Q2: Bênção'], w: ['W: Martelo Divino'], e: ['E: Ressurreição'] }, passives: ['P1: Cura Aliada', 'P2: Proteção Divina'] },
  MAIN_FIRESTAFF_T8:     { slot: 'MAIN_HAND', skills: { q: ['Q1: Bola de Fogo'],                w: ['W: Chama Wall'],     e: ['E: Meteoro'] },     passives: ['P1: Queimadura', 'P2: Imunidade a Fogo'] },
  MAIN_FROSTSTAFF_T8:    { slot: 'MAIN_HAND', skills: { q: ['Q1: Lança de Gelo'],               w: ['W: Muralha de Gelo'],  e: ['E: Nevasca'] },     passives: ['P1: Congelamento', 'P2: Imunidade a Gelo'] },
  MAIN_ARCANESTAFF_T8:   { slot: 'MAIN_HAND', skills: { q: ['Q1: Projétil Arcano'],              w: ['W: Orbe Arcano'],    e: ['E: Tornado Arcano'] }, passives: ['P1: Mana Extra'] },
  MAIN_DEMONICSTAFF_T8:  { slot: 'MAIN_HAND', skills: { q: ['Q1: Sombra Demoníaca'],             w: ['W: Chamas Negras'],  e: ['E: Pacto Sombrio'] }, passives: ['P1: Roubo de Vida', 'P2: Dano Sombrio'] },
  MAIN_NATURESTAFF_T8:   { slot: 'MAIN_HAND', skills: { q: ['Q1: Espinhos'],                     w: ['W: Cura Natural'],    e: ['E: Tornado de Folhas'] }, passives: ['P1: Regeneração'] },
  MAIN_CURSEDSTAFF_T8:   { slot: 'MAIN_HAND', skills: { q: ['Q1: Maldição'],                    w: ['W: Corrente Sombria'], e: ['E: Pacto Infernal'] }, passives: ['P1: Lifesteal'] },

  // ---------------------- OFF HAND ----------------------
  OFF_SHIELD_T8:         { slot: 'OFF_HAND',  skills: { q: ['Q1: Bloqueio', 'Q2: Empurrar'],     w: ['W: AOE Taunt'],       e: ['E: Fortaleza Inabalável'] }, passives: ['P1: Defesa Aumentada'] },
  OFF_TORCH_T8:          { slot: 'OFF_HAND',  skills: { q: ['Q1: Tocha'],                       w: ['W: Chama'],         e: ['E: Explosão'] },     passives: ['P1: Luz'] },
  OFF_BOOK_T8:           { slot: 'OFF_HAND',  skills: { q: ['Q1: Ler Feitiço'],                 w: ['W: Escudo Arcano'],   e: ['E: Prisão Mágica'] }, passives: ['P1: Mana Regeneração'] },
  OFF_ORB_T8:            { slot: 'OFF_HAND',  skills: { q: ['Q1: Raio Místico'],                w: ['W: Aura'],           e: ['E: Explosão Arcana'] }, passives: ['P1: Poder Mágico'] },
  OFF_TOTEM_T8:          { slot: 'OFF_HAND',  skills: { q: ['Q1: Invocar Espírito'],            w: ['W: Aura Totêmica'],  e: ['E: Transcender'] }, passives: ['P1: Espírito Guardião'] },
  OFF_HORN_T8:           { slot: 'OFF_HAND',  skills: { q: ['Q1: Brado'],                       w: ['W: Canção de Guerra'], e: ['E: Ressonância'] }, passives: ['P1: Buffar Party'] },

  // ---------------------- ARMOR / HEAD / SHOES ----------------------
  HEAD_PLATE_T8:         { slot: 'HEAD', skills: {}, passives: ['P1: HP Máximo', 'P2: Resistência Física'] },
  HEAD_CLOTH_T8:         { slot: 'HEAD', skills: {}, passives: ['P1: Poder Mágico', 'P2: Regeneração de Mana'] },
  HEAD_LEATHER_T8:       { slot: 'HEAD', skills: {}, passives: ['P1: Velocidade de Ataque', 'P2: Evasão'] },
  ARMOR_PLATE_T8:        { slot: 'ARMOR', skills: {}, passives: ['P1: Defesa Física', 'P2: HP Máximo'] },
  ARMOR_CLOTH_T8:        { slot: 'ARMOR', skills: {}, passives: ['P1: Poder Mágico', 'P2: Resistência Mágica'] },
  ARMOR_LEATHER_T8:      { slot: 'ARMOR', skills: {}, passives: ['P1: Velocidade de Movimento', 'P2: Evasão'] },
  SHOES_PLATE_T8:        { slot: 'SHOES', skills: {}, passives: ['P1: Resistência', 'P2: HP'] },
  SHOES_CLOTH_T8:        { slot: 'SHOES', skills: {}, passives: ['P1: Cooldown Reduzido', 'P2: Mana'] },
  SHOES_LEATHER_T8:      { slot: 'SHOES', skills: {}, passives: ['P1: Velocidade de Movimento', 'P2: Sprint'] },

  // ---------------------- CAPE / BAG ----------------------
  CAPE_T8:               { slot: 'CAPE', skills: {}, passives: ['P1: Resistência AOE', 'P2: Buff de Party'] },
  BAG_T8:                { slot: 'BAG',  skills: {}, passives: ['P1: Capacidade de Carga'] },

  // ---------------------- FOOD / POTION / MOUNT ----------------------
  FOOD_T8:               { slot: 'FOOD',   skills: {}, passives: ['P1: Bônus de Dano', 'P2: Bônus de Defesa', 'P3: Bônus de Cura'] },
  POTION_T8:             { slot: 'POTION', skills: {}, passives: ['P1: Cura Instantânea', 'P2: Buff Temporário'] },
  MOUNT_T8:              { slot: 'MOUNT',  skills: { q: ['Q: Dash', 'Q2: Galope'], w: ['W: Investida'], e: ['E: Carregamento'] }, passives: ['P1: Velocidade Base', 'P2: Carga Extra'] },
};

/**
 * API pública: extrai skills/passivas de um itemId.
 *
 * Aceita qualquer variante de encantamento (base, @1, @2, @3) — o
 * lookup é feito pela family+tier.
 *
 * @param {string} itemId   Ex: 'T8_MAIN_HOLYSTAFF' ou 'T8_MAIN_HOLYSTAFF@2'
 * @returns {{ slot, skills, passives } | null}
 */
export const getItemDefinition = (itemId) => {
  if (!itemId || typeof itemId !== 'string') return null;

  // Parse: T{n}_{FAMILY}@{enc}
  const m = itemId.match(/^T(\d+)_(.+?)(?:@(\d+))?$/);
  if (!m) return null;

  const tier = m[1];
  const family = m[2];
  const key = `${family}_T${tier}`;

  // 1) Tenta match exato
  if (ITEM_DEFINITIONS[key]) return ITEM_DEFINITIONS[key];

  // 2) Fallback: tenta match só pela family (qualquer tier)
  const fallbackKey = Object.keys(ITEM_DEFINITIONS).find((k) => k.startsWith(family + '_T'));
  if (fallbackKey) return ITEM_DEFINITIONS[fallbackKey];

  // 3) Sem definição: retorna slot genérico (sem skills/passivas)
  const slot = FAMILY_TO_SLOT[family] || null;
  return slot ? { slot, skills: {}, passives: [] } : null;
};

export default ITEM_DEFINITIONS;