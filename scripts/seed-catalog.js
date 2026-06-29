#!/usr/bin/env node

/**
 * VENUM - Script de População do Catálogo de Itens
 * 
 * Este script busca dados do repositório público ao-data/ao-bin-dumps,
 * processa as informações de itens e habilidades, e alimenta o banco
 * de dados Supabase com o catálogo canônico de itens de Albion Online.
 * 
 * Uso:
 *   node scripts/seed-catalog.js
 * 
 * Requisitos:
 *   - SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env
 *   - Conexão com internet para buscar dados do GitHub
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

// URLs dos dados brutos do repositório da comunidade
const ITEMS_JSON_URL = 'https://raw.githubusercontent.com/ao-data/ao-bin-dumps/master/items.json';
const SPELLS_JSON_URL = 'https://raw.githubusercontent.com/ao-data/ao-bin-dumps/master/spells.json';

// Configuração do Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Erro: SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórios no .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Mapeamento de slot canônico baseado em padrões de item_id
const SLOT_MAPPING = {
  BAG: ['BAG'],
  CAPE: ['CAPE'],
  HEAD: ['HEAD_PLATE', 'HEAD_CLOTH', 'HEAD_LEATHER'],
  ARMOR: ['ARMOR_PLATE', 'ARMOR_CLOTH', 'ARMOR_LEATHER'],
  SHOES: ['SHOES_PLATE', 'SHOES_CLOTH', 'SHOES_LEATHER'],
  MAIN_HAND: [
    'MAIN_AXE', 'MAIN_SWORD', 'MAIN_MACE', 'MAIN_DAGGER',
    'MAIN_QUARTERSTAFF', 'MAIN_HAMMER', 'MAIN_SPEAR', 'MAIN_BOW',
    'MAIN_CROSSBOW', 'MAIN_FIRESTAFF', 'MAIN_FROSTSTAFF',
    'MAIN_HOLYSTAFF', 'MAIN_NATURESTAFF', 'MAIN_ARCANESTAFF',
    'MAIN_DEMONICSTAFF', 'MAIN_CURSEDSTAFF'
  ],
  OFF_HAND: [
    'OFF_AXE', 'OFF_DAGGER', 'OFF_HOLY', 'OFF_NATURE',
    'OFF_ARCANESTAFF', 'OFF_DEMONICSTAFF', 'OFF_FIRESTAFF',
    'OFF_FROSTSTAFF', 'OFF_CROSSBOW', 'OFF_TORCH', 'OFF_SHIELD',
    'OFF_BOOK', 'OFF_ORB', 'OFF_TOTEM', 'OFF_HORN'
  ],
  FOOD: ['FOOD'],
  POTION: ['POTION'],
  MOUNT: ['MOUNT_HORSE', 'MOUNT_ARMOREDHORSE', 'MOUNT_DIREWOLF', 'MOUNT_MAMMOTH', 'MOUNT_OX', 'MOUNT_GIANT_STAG'],
  TRINKET: ['TRINKET']
};

/**
 * Determina o slot canônico baseado no item_id
 */
function getSlotFromItemId(itemId) {
  const upperItemId = itemId.toUpperCase();
  
  for (const [slot, patterns] of Object.entries(SLOT_MAPPING)) {
    for (const pattern of patterns) {
      if (upperItemId.includes(pattern)) {
        return slot;
      }
    }
  }
  
  return null;
}

/**
 * Determina a subcategoria baseada no item_id
 */
function getSubcategory(itemId) {
  const upperItemId = itemId.toUpperCase();
  
  if (upperItemId.includes('_PLATE')) return 'plate_armor';
  if (upperItemId.includes('_CLOTH')) return 'cloth_armor';
  if (upperItemId.includes('_LEATHER')) return 'leather_armor';
  if (upperItemId.includes('_AXE')) return 'axe';
  if (upperItemId.includes('_SWORD')) return 'sword';
  if (upperItemId.includes('_MACE')) return 'mace';
  if (upperItemId.includes('_DAGGER')) return 'dagger';
  if (upperItemId.includes('_STAFF')) return 'staff';
  if (upperItemId.includes('_BOW')) return 'bow';
  if (upperItemId.includes('_CROSSBOW')) return 'crossbow';
  if (upperItemId.includes('_HOLY')) return 'holy';
  if (upperItemId.includes('_NATURE')) return 'nature';
  if (upperItemId.includes('_FIRE')) return 'fire';
  if (upperItemId.includes('_FROST')) return 'frost';
  if (upperItemId.includes('_ARCANE')) return 'arcane';
  if (upperItemId.includes('_DEMONIC')) return 'demonic';
  if (upperItemId.includes('_CURSED')) return 'cursed';
  
  return null;
}

/**
 * Extrai informações de tier e encantamento do item_id
 */
function parseItemId(itemId) {
  const match = itemId.match(/^T(\d+)(?:@(\d+))?_(.+)$/);
  if (!match) return null;
  
  return {
    tier: parseInt(match[1], 10),
    enchantment: match[2] ? parseInt(match[2], 10) : 0,
    family: match[3].split('@')[0] // Remove encantamento do family se existir
  };
}

/**
 * Busca dados JSON de uma URL
 */
async function fetchJson(url) {
  console.log(`📥 Buscando: ${url}`);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Falha ao buscar ${url}: ${response.statusText}`);
  }
  return response.json();
}

/**
 * Processa habilidades de um item
 */
function processItemSkills(item, spellsMap) {
  const activeSkills = [];
  const passiveSkills = [];
  
  // Processar habilidades ativas
  if (item.activeSpellSlots && Array.isArray(item.activeSpellSlots)) {
    for (const slot of item.activeSpellSlots) {
      if (slot && spellsMap[slot]) {
        const spell = spellsMap[slot];
        activeSkills.push({
          key: slot,
          name_pt: spell.name || slot,
          description_pt: spell.description || '',
          icon_url: spell.iconUrl || ''
        });
      }
    }
  }
  
  // Processar habilidades passivas
  if (item.passiveSpellSlots && Array.isArray(item.passiveSpellSlots)) {
    for (const slot of item.passiveSpellSlots) {
      if (slot && spellsMap[slot]) {
        const spell = spellsMap[slot];
        passiveSkills.push({
          key: slot,
          name_pt: spell.name || slot,
          description_pt: spell.description || ''
        });
      }
    }
  }
  
  return { activeSkills, passiveSkills };
}

/**
 * Processa um item do ao-data para o formato do VENUM
 */
function processItem(item, spellsMap) {
  const parsed = parseItemId(item.UniqueName);
  if (!parsed) return null;
  
  const slot = getSlotFromItemId(item.UniqueName);
  const subcategory = getSubcategory(item.UniqueName);
  const { activeSkills, passiveSkills } = processItemSkills(item, spellsMap);
  
  return {
    item_id: item.UniqueName,
    tier: parsed.tier,
    enchantment: parsed.enchantment,
    family: parsed.family,
    category: item.ItemType || 'equipment',
    subcategory: subcategory,
    slot: slot,
    name_pt: item.LocalizedNames?.['pt-BR'] || item.LocalizedNames?.['en-US'] || item.UniqueName,
    image_url: `https://render.albiononline.com/v1/item/${item.UniqueName}.png`,
    active_skills: activeSkills,
    passive_skills: passiveSkills
  };
}

/**
 * Processa itens em batches e envia para o Supabase
 */
async function upsertBatch(items, batchSize = 200) {
  let totalProcessed = 0;
  let totalBatches = Math.ceil(items.length / batchSize);
  
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchNumber = Math.floor(i / batchSize) + 1;
    
    console.log(`📦 Processando batch ${batchNumber}/${totalBatches} (${batch.length} itens)`);
    
    try {
      const { data, error } = await supabase.rpc('upsert_market_items_full', {
        p_items: JSON.stringify(batch)
      });
      
      if (error) {
        console.error(`❌ Erro no batch ${batchNumber}:`, error);
        throw error;
      }
      
      totalProcessed += data || batch.length;
      console.log(`✅ Batch ${batchNumber} concluído. Total processado: ${totalProcessed}`);
      
      // Pequeno delay para evitar rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
      
    } catch (error) {
      console.error(`❌ Falha no batch ${batchNumber}:`, error);
      throw error;
    }
  }
  
  return totalProcessed;
}

/**
 * Função principal
 */
async function main() {
  console.log('🚀 Iniciando população do catálogo VENUM...');
  console.log('========================================\n');
  
  try {
    // 1. Buscar dados do repositório ao-data
    console.log('📥 Etapa 1: Buscando dados do repositório ao-data...');
    const [itemsData, spellsData] = await Promise.all([
      fetchJson(ITEMS_JSON_URL),
      fetchJson(SPELLS_JSON_URL)
    ]);
    
    console.log(`✅ ${itemsData.length} itens carregados`);
    console.log(`✅ ${spellsData.length} habilidades carregadas\n`);
    
    // 2. Criar mapa de habilidades para lookup rápido
    console.log('🗂️  Etapa 2: Indexando habilidades...');
    const spellsMap = {};
    for (const spell of spellsData) {
      if (spell.UniqueName) {
        spellsMap[spell.UniqueName] = spell;
      }
    }
    console.log(`✅ ${Object.keys(spellsMap).length} habilidades indexadas\n`);
    
    // 3. Processar itens
    console.log('⚙️  Etapa 3: Processando itens...');
    const processedItems = [];
    
    for (const item of itemsData) {
      if (!item.UniqueName) continue;
      
      // Filtrar apenas equipamentos relevantes para o Black Market
      const upperId = item.UniqueName.toUpperCase();
      const excludedPatterns = ['PLANK', 'WOOD', 'ORE', 'METALBAR', 'FIBER', 'ROCK', 'STONE', 'HIDE', 'LEATHER_RAW', 'CLOTH_RAW'];
      
      const isExcluded = excludedPatterns.some(pattern => upperId.includes(pattern));
      if (isExcluded) continue;
      
      const processed = processItem(item, spellsMap);
      if (processed) {
        processedItems.push(processed);
      }
    }
    
    console.log(`✅ ${processedItems.length} itens processados\n`);
    
    // 4. Upsert no Supabase em batches
    console.log('💾 Etapa 4: Enviando dados para o Supabase...');
    const totalProcessed = await upsertBatch(processedItems, 200);
    
    console.log('\n========================================');
    console.log(`✅ População concluída com sucesso!`);
    console.log(`📊 Total de itens processados: ${totalProcessed}`);
    console.log('========================================\n');
    
  } catch (error) {
    console.error('\n❌ Erro durante a população:', error);
    process.exit(1);
  }
}

// Executar
main();
