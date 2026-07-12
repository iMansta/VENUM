import { createClient } from '@supabase/supabase-js';

const ITEMS_JSON_URL = 'https://raw.githubusercontent.com/ao-data/ao-bin-dumps/master/items.json';
const SPELLS_JSON_URL = 'https://raw.githubusercontent.com/ao-data/ao-bin-dumps/master/spells.json';
const LOCALIZATION_JSON_URL =
  'https://raw.githubusercontent.com/ao-data/ao-bin-dumps/master/localization.json';
const GAMEINFO_BASE =
  process.env.VITE_GAMEINFO_BASE || 'https://gameinfo.albiononline.com/api/gameinfo';

let cache = {
  loadedAt: 0,
  itemsById: new Map(),
  spellsById: new Map(),
  localizationByTag: new Map(),
};

const TTL_MS = 6 * 60 * 60 * 1000;

const getAdmin = () => {
  const url =
    process.env.SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error('Supabase admin não configurado');
  return createClient(url, key);
};

const renderAssetUrl = (type, identifier) => {
  const params = new URLSearchParams({ type, id: identifier });
  return `/api/albion-render?${params.toString()}`;
};

const itemIcon = (itemId) => renderAssetUrl('item', itemId);
const spellIcon = (spellId) => renderAssetUrl('spell', spellId);

const canonicalizeItemId = (itemId) => {
  const raw = String(itemId || '').trim();
  if (!raw) return '';
  const [base, enchantment] = raw.split('@');
  const canonical = base
    .replace(/^T(\d+)_MAIN_BOW$/, 'T$1_2H_BOW')
    .replace(/^T(\d+)_MAIN_CROSSBOW$/, 'T$1_2H_CROSSBOW')
    .replace(/^T(\d+)_MAIN_QUARTERSTAFF$/, 'T$1_2H_QUARTERSTAFF')
    .replace(/^T(\d+)_OFF_HORN$/, 'T$1_OFF_HORN_KEEPER')
    .replace(/^T(\d+)_OFF_ORB$/, 'T$1_OFF_ORB_MORGANA')
    .replace(/^T(\d+)_MOUNT_ARMOREDHORSE$/, 'T$1_MOUNT_ARMORED_HORSE')
    .replace(/^T(\d+)_HEAD_(CLOTH|LEATHER|PLATE)$/, 'T$1_HEAD_$2_SET1')
    .replace(/^T(\d+)_ARMOR_(CLOTH|LEATHER|PLATE)$/, 'T$1_ARMOR_$2_SET1')
    .replace(/^T(\d+)_SHOES_(CLOTH|LEATHER|PLATE)$/, 'T$1_SHOES_$2_SET1');
  return enchantment ? `${canonical}@${enchantment}` : canonical;
};

const pickLocale = (obj, key, fallback = '') => {
  if (!obj || typeof obj !== 'object') return fallback;
  return (
    obj['pt-BR'] ||
    obj['pt_BR'] ||
    obj['pt'] ||
    obj['en-US'] ||
    obj['en_US'] ||
    obj['en'] ||
    obj[key] ||
    fallback
  );
};

const uniqueNameFromNode = (node) =>
  node?.UniqueName || node?.uniqueName || node?.['@uniquename'] || node?.['@uniqueName'] || null;

const locTagFromNode = (node, kind = 'name') => {
  if (!node || typeof node !== 'object') return null;
  const keys =
    kind === 'description'
      ? ['@descriptionlocatag', 'descriptionLocatag', 'descriptionlocatag']
      : ['@namelocatag', 'nameLocatag', 'namelocatag'];
  for (const key of keys) {
    if (typeof node[key] === 'string' && node[key].trim()) {
      return node[key].trim();
    }
  }
  return null;
};

const collectObjects = (root, visitor) => {
  const stack = [root];
  while (stack.length > 0) {
    const node = stack.pop();
    if (!node || typeof node !== 'object') continue;
    visitor(node);
    if (Array.isArray(node)) {
      for (const entry of node) stack.push(entry);
    } else {
      for (const value of Object.values(node)) stack.push(value);
    }
  }
};

const collectSpellRefs = (root, spellsById) => {
  const refs = [];
  const walk = (node, path = []) => {
    if (node == null) return;
    if (typeof node === 'string') {
      if (spellsById.has(node)) {
        refs.push({ id: node, path: path.join('.').toLowerCase() });
      }
      return;
    }
    if (Array.isArray(node)) {
      node.forEach((entry, idx) => walk(entry, [...path, String(idx)]));
      return;
    }
    if (typeof node === 'object') {
      const maybeId = uniqueNameFromNode(node);
      if (maybeId && spellsById.has(maybeId)) {
        refs.push({ id: maybeId, path: path.join('.').toLowerCase() });
      }
      for (const [key, value] of Object.entries(node)) {
        walk(value, [...path, key]);
      }
    }
  };
  walk(root);
  return refs;
};

const splitSpellRefs = (refs) => {
  const active = [];
  const passive = [];

  for (const ref of refs) {
    if (ref.path.includes('passive')) {
      passive.push(ref.id);
    } else if (ref.path.includes('active')) {
      active.push(ref.id);
    } else {
      active.push(ref.id);
    }
  }

  return {
    active: [...new Set(active)],
    passive: [...new Set(passive)],
  };
};

const SPELL_TOKEN_BY_CATEGORY = {
  sword: 'SWORD',
  axe: 'AXE',
  mace: 'MACE',
  hammer: 'HAMMER',
  spear: 'SPEAR',
  bow: 'BOW',
  crossbow: 'CROSSBOW',
  dagger: 'DAGGER',
  quarterstaff: 'QUARTERSTAFF',
  firestaff: 'FIRE',
  froststaff: 'FROST',
  holystaff: 'HOLY',
  naturestaff: 'NATURE',
  arcanestaff: 'ARCANE',
  cursedstaff: 'CURSE',
  shield: 'SHIELD',
  torch: 'TORCH',
  horn: 'HORN',
  book: 'BOOK',
  orb: 'ORB',
  cloth: 'CLOTH',
  leather: 'LEATHER',
  plate: 'PLATE',
};

const inferCategory = (item, itemId) => {
  const candidates = [
    item?.['@craftingcategory'],
    item?.['@shopsubcategory1'],
    item?.['@shopsubcategory2'],
    item?.categoryId,
    itemId,
  ].filter(Boolean).map((value) => String(value).toLowerCase());

  for (const candidate of candidates) {
    for (const key of Object.keys(SPELL_TOKEN_BY_CATEGORY)) {
      if (candidate.includes(key)) return key;
    }
  }
  return null;
};

const hasVisibleSpellIcon = (spell) =>
  Boolean(spell?.['@uisprite'] || spell?.uiSprite) &&
  !String(spell?.['@hidespelleffecticon'] || spell?.hideSpellEffectIcon || '').toLowerCase().includes('true');

const isInternalSpell = (spellId) =>
  /(_EFFECT|_CONDITION|_VFX|_UNLOCK|_CHARGES|_STACK|_AURA|KILL_EMOTE|AVATARRING|TOKENLOCKED)/i.test(spellId);

const inferSpellRefsForItem = (item, itemId) => {
  const category = inferCategory(item, itemId);
  const token = SPELL_TOKEN_BY_CATEGORY[category];
  if (!token) return { active: [], passive: [] };

  const active = [];
  const passive = [];
  for (const [spellId, spell] of cache.spellsById.entries()) {
    const upper = String(spellId).toUpperCase();
    if (!upper.includes(token) || isInternalSpell(upper) || !hasVisibleSpellIcon(spell)) {
      continue;
    }
    if (upper.startsWith('PASSIVE_')) {
      passive.push(spellId);
    } else if (spell?.['@namelocatag'] || spell?.name || spell?.LocalizedNames) {
      active.push(spellId);
    }
  }

  const slotOrder = ['Q', 'W', 'E'];
  return {
    active: [...new Set(active)].slice(0, 18).map((id, index) => ({
      id,
      slot: slotOrder[index % slotOrder.length],
    })),
    passive: [...new Set(passive)].slice(0, 8).map((id) => ({ id, slot: 'P' })),
  };
};

const pickLocalizedByTag = (tag) => {
  if (!tag) return '';
  const row = cache.localizationByTag.get(tag);
  if (!row) return '';
  return pickLocale(row, 'pt-BR', '');
};

const fetchGameInfoItemName = async (itemId) => {
  const url = `${GAMEINFO_BASE}/items/${encodeURIComponent(itemId)}/data`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);
  try {
    const resp = await fetch(url, { signal: controller.signal });
    if (!resp.ok) return '';
    const json = await resp.json();
    return (
      json?.localizedNames?.['PT-BR'] ||
      json?.localizedNames?.['pt-BR'] ||
      json?.localizedNames?.['EN-US'] ||
      ''
    );
  } catch {
    return '';
  } finally {
    clearTimeout(timeout);
  }
};

const loadData = async () => {
  const now = Date.now();
  if (now - cache.loadedAt < TTL_MS && cache.itemsById.size > 0) return;

  const [itemsResp, spellsResp, localizationResp] = await Promise.all([
    fetch(ITEMS_JSON_URL),
    fetch(SPELLS_JSON_URL),
    fetch(LOCALIZATION_JSON_URL).catch(() => null),
  ]);
  if (!itemsResp.ok || !spellsResp.ok) throw new Error('Falha ao buscar ao-data');

  const [items, spells, localization] = await Promise.all([
    itemsResp.json(),
    spellsResp.json(),
    localizationResp?.ok ? localizationResp.json() : Promise.resolve(null),
  ]);
  const itemsById = new Map();
  const spellsById = new Map();
  const localizationByTag = new Map();

  collectObjects(items, (node) => {
    const id = uniqueNameFromNode(node);
    if (id && /^T\d+_/.test(id)) {
      itemsById.set(id, node);
    }
  });

  collectObjects(spells, (node) => {
    const id = uniqueNameFromNode(node);
    if (id) spellsById.set(id, node);
  });

  collectObjects(localization, (node) => {
    if (!node || typeof node !== 'object' || Array.isArray(node)) return;
    const tag = node['@tag'] || node.tag || node['@locatag'] || null;
    if (!tag) return;
    localizationByTag.set(tag, node);
  });

  cache = { loadedAt: now, itemsById, spellsById, localizationByTag };
};

const mapSpell = (spellId, slot = null) => {
  const s = cache.spellsById.get(spellId);
  if (!s) {
    return {
      key: spellId,
      slot,
      name_pt: spellId,
      description_pt: '',
      icon_url: spellIcon(spellId),
    };
  }
  const nameTag = locTagFromNode(s, 'name');
  const descTag = locTagFromNode(s, 'description');
  const localizedNameByTag = pickLocalizedByTag(nameTag);
  const localizedDescByTag = pickLocalizedByTag(descTag);

  return {
    key: spellId,
    slot,
    name_pt:
      localizedNameByTag ||
      pickLocale(s.LocalizedNames, 'name', s.name || spellId),
    description_pt:
      localizedDescByTag ||
      pickLocale(s.LocalizedDescriptions, 'description', s.description || ''),
    icon_url: spellIcon(spellId),
  };
};

const upsertTemplateForItem = async (admin, itemId) => {
  const originalItemId = itemId;
  itemId = canonicalizeItemId(itemId);
  const item = cache.itemsById.get(itemId);
  if (!item) {
    return { ok: false, itemId, error: 'Item não encontrado no ao-data' };
  }

  const refs = collectSpellRefs(item, cache.spellsById);
  const direct = splitSpellRefs(refs);
  const inferred = direct.active.length + direct.passive.length > 0
    ? {
        active: direct.active.map((id, index) => ({ id, slot: ['Q', 'W', 'E'][index % 3] })),
        passive: direct.passive.map((id) => ({ id, slot: 'P' })),
      }
    : inferSpellRefsForItem(item, itemId);
  const activeSkills = inferred.active.map((entry) => mapSpell(entry.id, entry.slot));
  const passiveSkills = inferred.passive.map((entry) => mapSpell(entry.id, entry.slot));
  const gameInfoName = await fetchGameInfoItemName(itemId);
  const itemNameByTag = pickLocalizedByTag(locTagFromNode(item, 'name'));

  const payload = {
    item_id: itemId,
    name_pt:
      gameInfoName ||
      itemNameByTag ||
      pickLocale(item.LocalizedNames, 'name', itemId),
    image_url: itemIcon(itemId),
    active_skills: activeSkills,
    passive_skills: passiveSkills,
    updated_at: new Date().toISOString(),
  };

  let error = null;
  if (originalItemId !== itemId) {
    const { data: existing } = await admin
      .from('market_items')
      .select('item_id')
      .eq('item_id', itemId)
      .maybeSingle();

    if (existing?.item_id) {
      const update = await admin.from('market_items').update(payload).eq('item_id', itemId);
      error = update.error;
      if (!error) {
        await admin.from('market_items').delete().eq('item_id', originalItemId);
      }
    } else {
      const update = await admin.from('market_items').update(payload).eq('item_id', originalItemId);
      error = update.error;
    }
  } else {
    const update = await admin.from('market_items').update(payload).eq('item_id', itemId);
    error = update.error;
  }
  if (error) {
    return { ok: false, itemId, error: error.message || 'Erro ao atualizar item' };
  }

  return {
    ok: true,
    itemId,
    originalItemId,
    activeCount: activeSkills.length,
    passiveCount: passiveSkills.length,
  };
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method not allowed' });
    return;
  }

  try {
    await loadData();
    const admin = getAdmin();
    const itemId = String(req.query?.itemId || req.body?.itemId || '').trim();

    if (itemId) {
      const result = await upsertTemplateForItem(admin, itemId);
      if (!result.ok) {
        res.status(404).json({ ok: false, error: result.error || 'Falha ao processar item' });
        return;
      }
      res.status(200).json(result);
      return;
    }

    // Modo lote: `force=1` reconstrói TODOS os itens de slots com skills,
    // sobrescrevendo dados legados/placeholder (sem icon_url real).
    const force =
      String(req.query?.force || req.body?.force || '').toLowerCase() === '1' ||
      String(req.query?.force || req.body?.force || '').toLowerCase() === 'true';

    const limit = Math.min(
      Number(req.query?.limit || req.body?.limit || 200) || 200,
      500
    );
    const skillSlots = new Set(['MAIN_HAND', 'OFF_HAND', 'HEAD', 'ARMOR', 'SHOES', 'CAPE']);

    const { data: candidates, error: queryError } = await admin
      .from('market_items')
      .select('item_id, slot, name_pt, active_skills, passive_skills')
      .in('slot', Array.from(skillSlots))
      .eq('enchantment', 0)
      .order('updated_at', { ascending: true })
      .limit(limit);

    if (queryError) throw queryError;

    // Detecta dados legados/falsos: skills sem icon_url oficial.
    const hasFakeSkills = (row) => {
      const all = [
        ...(Array.isArray(row.active_skills) ? row.active_skills : []),
        ...(Array.isArray(row.passive_skills) ? row.passive_skills : []),
      ];
      if (all.length === 0) return false;
      return all.some((s) => !s || !s.icon_url);
    };

    const targetIds = (candidates || [])
      .filter((row) => {
        if (!skillSlots.has(row.slot)) return false;
        if (force) return true;
        const activeCount = Array.isArray(row.active_skills) ? row.active_skills.length : 0;
        const passiveCount = Array.isArray(row.passive_skills) ? row.passive_skills.length : 0;
        const needsName =
          !row.name_pt || String(row.name_pt).trim() === '' || row.name_pt === row.item_id;
        const needsSkills = activeCount + passiveCount < 2;
        return needsName || needsSkills || hasFakeSkills(row);
      })
      .map((row) => row.item_id)
      .filter(Boolean);

    const summary = {
      ok: true,
      scanned: (candidates || []).length,
      attempted: targetIds.length,
      updated: 0,
      failed: 0,
      failures: [],
    };

    for (const id of targetIds) {
      const result = await upsertTemplateForItem(admin, id);
      if (result.ok) {
        summary.updated += 1;
      } else {
        summary.failed += 1;
        if (summary.failures.length < 20) {
          summary.failures.push({ itemId: id, error: result.error });
        }
      }
    }

    res.status(200).json(summary);
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message || 'Erro interno' });
  }
}

