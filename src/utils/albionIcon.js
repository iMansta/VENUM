/**
 * URLs internas para assets renderizados do Albion.
 *
 * O navegador não deve consultar render.albiononline.com diretamente. A rota
 * /api/albion-render lê do cache do Supabase Storage e só busca no Render
 * Service em cache miss.
 */

import { canonicalizeAlbionItemId } from '@/constants/marketItems';

const ALBION_RENDER_RE = /^https:\/\/render\.albiononline\.com\/v1\/(item|spell|wardrobe|destiny)\/([^/?#]+)\.png/i;

export const getAlbionRenderAssetUrl = ({
  type = 'item',
  identifier,
  size = null,
  quality = null,
} = {}) => {
  if (!identifier || typeof identifier !== 'string' || !identifier.trim()) return null;

  const params = new URLSearchParams({
    type,
    id: identifier.trim(),
  });
  if (size) params.set('size', String(size));
  if (quality) params.set('quality', String(quality));
  return `/api/albion-render?${params.toString()}`;
};

/**
 * Retorna a URL do ícone do item no Albion Online.
 * @param {string} itemId  Ex: 'T8_MAIN_HOLYSTAFF@1' ou 'T4_BAG'
 * @returns {string|null}   URL absoluta ou null se itemId inválido
 */
export const getAlbionIconUrl = (itemId) => {
  if (!itemId || typeof itemId !== 'string' || !itemId.trim()) return null;
  return getAlbionRenderAssetUrl({ type: 'item', identifier: canonicalizeAlbionItemId(itemId) });
};

export const getAlbionSpellIconUrl = (spellId) =>
  getAlbionRenderAssetUrl({ type: 'spell', identifier: spellId });

export const normalizeAlbionAssetUrl = (url, fallback = null) => {
  if (!url || typeof url !== 'string') return fallback;
  if (url.startsWith('/api/albion-render')) return url;

  const match = url.match(ALBION_RENDER_RE);
  if (!match) return url;

  try {
    const parsed = new URL(url);
    return getAlbionRenderAssetUrl({
      type: match[1].toLowerCase(),
      identifier: match[1].toLowerCase() === 'item'
        ? canonicalizeAlbionItemId(decodeURIComponent(match[2]))
        : decodeURIComponent(match[2]),
      size: parsed.searchParams.get('size'),
      quality: parsed.searchParams.get('quality'),
    });
  } catch {
    return fallback;
  }
};

export default getAlbionIconUrl;
