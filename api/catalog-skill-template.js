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

const spellIcon = (spellId) =>
  `https://render.albiononline.com/v1/spell/${encodeURIComponent(spellId)}.png`;

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

const mapSpell = (spellId) => {
  const s = cache.spellsById.get(spellId);
  if (!s) {
    return {
      key: spellId,
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
    name_pt:
      localizedNameByTag ||
      pickLocale(s.LocalizedNames, 'name', s.name || spellId),
    description_pt:
      localizedDescByTag ||
      pickLocale(s.LocalizedDescriptions, 'description', s.description || ''),
    icon_url: s.iconUrl || spellIcon(spellId),
  };
};

const upsertTemplateForItem = async (admin, itemId) => {
  const item = cache.itemsById.get(itemId);
  if (!item) {
    return { ok: false, itemId, error: 'Item não encontrado no ao-data' };
  }

  const refs = collectSpellRefs(item, cache.spellsById);
  const { active, passive } = splitSpellRefs(refs);
  const activeSkills = active.map(mapSpell);
  const passiveSkills = passive.map(mapSpell);
  const gameInfoName = await fetchGameInfoItemName(itemId);
  const itemNameByTag = pickLocalizedByTag(locTagFromNode(item, 'name'));

  const payload = {
    item_id: itemId,
    name_pt:
      gameInfoName ||
      itemNameByTag ||
      pickLocale(item.LocalizedNames, 'name', itemId),
    image_url: `https://render.albiononline.com/v1/item/${encodeURIComponent(itemId)}.png`,
    active_skills: activeSkills,
    passive_skills: passiveSkills,
    updated_at: new Date().toISOString(),
  };

  const { error } = await admin.from('market_items').update(payload).eq('item_id', itemId);
  if (error) {
    return { ok: false, itemId, error: error.message || 'Erro ao atualizar item' };
  }

  return {
    ok: true,
    itemId,
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

