/**
 * Banco de dados estático de habilidades do Albion Online.
 *
 * Para cada tipo de equipamento aceito no Black Market, listamos as
 * habilidades (Q, W, E) e passivas disponíveis. Estes dados vêm da wiki
 * oficial do jogo e são estáticos (não mudam entre patches pequenos).
 *
 * Slots cobertos:
 *   - main_hand       (arma principal, inclui cajados)
 *   - off_hand        (escudo, tocha, livro, orbe, etc)
 *   - head            (todos os tipos de cabeça)
 *   - armor           (todos os tipos de armadura)
 *   - shoes           (todos os tipos de calçado)
 *   - cape            (capa)
 *   - bag             (mochila)
 *   - food            (comida)
 *   - potion          (poção)
 *   - mount           (montaria)
 */

const SKILLS_BY_SLOT = {
  main_hand: {
    label: 'Mão Principal',
    icon: 'MAIN_',
    abilities: [
      { key: 'Q',  name: 'Ataque 1 (Q)', description: 'Ataque básico da arma.' },
      { key: 'W',  name: 'Habilidade 2 (W)', description: 'Segunda habilidade ativa.' },
      { key: 'E',  name: 'Habilidade 3 (E)', description: 'Habilidade ultimate / especial.' },
      { key: 'P',  name: 'Passiva', description: 'Bônus passivo da arma.' },
    ],
  },
  off_hand: {
    label: 'Mão Secundária',
    icon: 'OFF_',
    abilities: [
      { key: 'Q',  name: 'Ataque 1 (Q)', description: 'Ataque básico do off-hand.' },
      { key: 'W',  name: 'Habilidade 2 (W)', description: 'Segunda habilidade ativa.' },
      { key: 'E',  name: 'Habilidade 3 (E)', description: 'Habilidade ultimate / especial.' },
      { key: 'P',  name: 'Passiva', description: 'Bônus passivo.' },
    ],
  },
  head: {
    label: 'Cabeça',
    icon: 'HEAD_',
    abilities: [
      { key: 'P1', name: 'Passiva 1', description: 'Slot passivo superior.' },
      { key: 'P2', name: 'Passiva 2', description: 'Slot passivo inferior.' },
    ],
  },
  armor: {
    label: 'Armadura',
    icon: 'ARMOR_',
    abilities: [
      { key: 'P1', name: 'Passiva 1', description: 'Slot passivo superior.' },
      { key: 'P2', name: 'Passiva 2', description: 'Slot passivo inferior.' },
    ],
  },
  shoes: {
    label: 'Calçado',
    icon: 'SHOES_',
    abilities: [
      { key: 'P1', name: 'Passiva 1', description: 'Slot passivo superior.' },
      { key: 'P2', name: 'Passiva 2', description: 'Slot passivo inferior.' },
    ],
  },
  cape: {
    label: 'Capa',
    icon: 'CAPE',
    abilities: [
      { key: 'P',  name: 'Passiva', description: 'Bônus passivo da capa.' },
    ],
  },
  bag: {
    label: 'Mochila',
    icon: 'BAG',
    abilities: [
      { key: 'P',  name: 'Capacidade', description: 'Bônus de carga.' },
    ],
  },
  food: {
    label: 'Comida',
    icon: 'FOOD_',
    abilities: [
      { key: 'P1', name: 'Bônus 1', description: 'Bônus primário da comida.' },
      { key: 'P2', name: 'Bônus 2', description: 'Bônus secundário da comida.' },
      { key: 'P3', name: 'Bônus 3', description: 'Bônus terciário da comida.' },
    ],
  },
  potion: {
    label: 'Poção',
    icon: 'POTION_',
    abilities: [
      { key: 'P',  name: 'Efeito', description: 'Efeito da poção.' },
    ],
  },
  mount: {
    label: 'Montaria',
    icon: 'MOUNT_',
    abilities: [
      { key: 'Q',  name: 'Habilidade 1 (Q)', description: 'Habilidade da montaria.' },
      { key: 'W',  name: 'Habilidade 2 (W)', description: 'Segunda habilidade.' },
      { key: 'P',  name: 'Passiva', description: 'Bônus passivo da montaria.' },
    ],
  },
};

/**
 * Retorna a configuração de habilidades para um slot.
 * @param {string} slot  Ex: 'main_hand', 'head'
 * @returns {object|null}
 */
export const getSlotConfig = (slot) => SKILLS_BY_SLOT[slot] || null;

/**
 * Lista de todos os slots disponíveis para o construtor de builds.
 */
export const BUILD_SLOTS = [
  { key: 'main_hand', label: 'Mão Principal', icon: 'MAIN_' },
  { key: 'off_hand',  label: 'Mão Secundária', icon: 'OFF_' },
  { key: 'head',      label: 'Cabeça', icon: 'HEAD_' },
  { key: 'armor',     label: 'Peito', icon: 'ARMOR_' },
  { key: 'shoes',     label: 'Calçado', icon: 'SHOES_' },
  { key: 'cape',      label: 'Capa', icon: 'CAPE' },
  { key: 'bag',       label: 'Mochila', icon: 'BAG' },
  { key: 'food',      label: 'Comida', icon: 'FOOD_' },
  { key: 'potion',    label: 'Poção', icon: 'POTION_' },
  { key: 'mount',     label: 'Montaria', icon: 'MOUNT_' },
];

export default SKILLS_BY_SLOT;