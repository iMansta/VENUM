export const MISSION_TARGET_SUGGESTIONS = {
  pve: [
    { value: 'pve_fame', label: 'Farmar fama PvE' },
    { value: 'bottled_mage', label: 'Matar Mago Engarrafado' },
    { value: 'crystal_mob', label: 'Matar Aranha/Mob de Cristal' },
    { value: 'world_boss', label: 'Matar Boss de Mundo' },
    { value: 'mob_kill', label: 'Kills PvE (qualquer mob)' },
  ],
  pvp: [
    { value: 'player_kill', label: 'Kill de jogador (qualquer)' },
    { value: 'hellgate_kill', label: 'Kill em Hellgate' },
    { value: 'corrupted_kill', label: 'Kill em Corrompida' },
  ],
  gathering: [
    { value: 'gather_any', label: 'Coleta geral' },
    { value: 'wood', label: 'Coletar Madeira' },
    { value: 'ore', label: 'Coletar Minério' },
    { value: 'fiber', label: 'Coletar Fibra' },
    { value: 'hide', label: 'Coletar Couro' },
    { value: 'stone', label: 'Coletar Pedra' },
  ],
  crafting: [
    { value: 'craft_any', label: 'Crafting geral' },
    { value: 'refine_hide', label: 'Refinar Couro' },
    { value: 'refine_ore', label: 'Refinar Minério' },
    { value: 'refine_wood', label: 'Refinar Madeira' },
    { value: 'armory_meta', label: 'Armar Zerg (itens meta)' },
  ],
  trading: [
    { value: 'trade_any', label: 'Comércio geral' },
    { value: 'black_market', label: 'Operação Black Market' },
    { value: 'market_supply_t4_planks', label: 'Abastecimento Tábuas T4' },
    { value: 'market_supply_t5_ore', label: 'Abastecimento Minério T5' },
    { value: 'bank_recovery', label: 'Arrecadação de prata da guilda' },
  ],
  other: [{ value: 'general', label: 'Objetivo genérico' }],
};

// Objetivos que fazem sentido em missões de GRUPO (conquistas coletivas).
// A Anaconda envia observações destes tipos e o backend soma para a meta coletiva.
export const GROUP_OBJECTIVE_SUGGESTIONS = [
  { value: 'big_chest', label: 'Abrir Baús Grandes' },
  { value: 'outpost_capture', label: 'Capturar Outpost' },
  { value: 'castle_capture', label: 'Capturar Castelo' },
  { value: 'world_boss', label: 'Matar Boss de Mundo' },
];

const TARGET_LABEL_BY_VALUE = [
  ...Object.values(MISSION_TARGET_SUGGESTIONS).flat(),
  ...GROUP_OBJECTIVE_SUGGESTIONS,
].reduce((acc, row) => {
  acc[row.value] = row.label;
  return acc;
}, {});

// scope: 'individual' | 'group'. Em grupo, o tipo "Outro" oferece conquistas coletivas.
export const getMissionTargetSuggestions = (missionType, scope = 'individual') => {
  const base = MISSION_TARGET_SUGGESTIONS[missionType] || MISSION_TARGET_SUGGESTIONS.other;
  if (scope === 'group' && missionType === 'other') {
    return [...GROUP_OBJECTIVE_SUGGESTIONS, ...base];
  }
  return base;
};

export const getMissionTargetLabel = (value) => TARGET_LABEL_BY_VALUE[value] || value || '—';

