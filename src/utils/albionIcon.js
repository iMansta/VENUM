/**
 * Albion Online - URL canônica dos ícones de item.
 *
 * Endpoint oficial usado pelo app.albiononline.com e pela wiki:
 *   https://render.albiononline.com/v1/item/[ITEM_ID].png
 *
 * - Substitui `_` por espaço? Não — o ID vai RAW na URL.
 * - Encantamentos: T8_MAIN_SWORD@1 → a API renderiza automaticamente o
 *   ícone com a runa do encantamento.
 * - Items sem ícone oficial (recursos crus) recebem 404; o componente
 *   consumidor deve cair num fallback.
 */

const ALBION_ICON_BASE = 'https://render.albiononline.com/v1/item';

/**
 * Retorna a URL do ícone do item no Albian Online.
 * @param {string} itemId  Ex: 'T8_MAIN_HOLYSTAFF@1' ou 'T4_BAG'
 * @returns {string|null}   URL absoluta ou null se itemId inválido
 */
export const getAlbionIconUrl = (itemId) => {
  if (!itemId || typeof itemId !== 'string' || !itemId.trim()) return null;
  return `${ALBION_ICON_BASE}/${encodeURIComponent(itemId)}.png`;
};

export default getAlbionIconUrl;