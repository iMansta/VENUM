import { createClient } from '@supabase/supabase-js';

const RENDER_BASE = 'https://render.albiononline.com/v1';
const BUCKET = process.env.ALBION_RENDER_BUCKET || 'albion-render-assets';
const SUPPORTED_TYPES = new Set(['item', 'spell', 'wardrobe', 'destiny']);
const PLACEHOLDER_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=',
  'base64'
);

const getAdmin = () => {
  const url =
    process.env.SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error('Supabase admin não configurado');
  return createClient(url, key);
};

const normalizeType = (value) => {
  const type = String(value || 'item').trim().toLowerCase();
  return SUPPORTED_TYPES.has(type) ? type : null;
};

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

const normalizeIdentifier = (value, type = 'item') => {
  const identifier = String(value || '').trim();
  return type === 'item' ? canonicalizeItemId(identifier) : identifier;
};

const normalizeOptionalInt = (value, min, max) => {
  if (value == null || value === '') return null;
  const n = Number(value);
  if (!Number.isInteger(n)) return null;
  return Math.min(Math.max(n, min), max);
};

const cacheKey = ({ type, identifier, size, quality }) => {
  const encodedId = Buffer.from(identifier, 'utf8').toString('base64url');
  const suffix = [
    size ? `s${size}` : null,
    quality ? `q${quality}` : null,
  ].filter(Boolean).join('-') || 'default';
  return `${type}/${encodedId}/${suffix}.png`;
};

const renderUrl = ({ type, identifier, size, quality }) => {
  const params = new URLSearchParams();
  if (size) params.set('size', String(size));
  if (type === 'item' && quality) params.set('quality', String(quality));
  const qs = params.toString();
  return `${RENDER_BASE}/${type}/${encodeURIComponent(identifier)}.png${qs ? `?${qs}` : ''}`;
};

const ensureBucket = async (admin) => {
  try {
    const { data } = await admin.storage.getBucket(BUCKET);
    if (data) return;
  } catch {
    // Continua para tentar criar; em ambientes sem permissão, o upload falhará com log.
  }

  try {
    await admin.storage.createBucket(BUCKET, {
      public: false,
      fileSizeLimit: 1024 * 1024,
      allowedMimeTypes: ['image/png'],
    });
  } catch {
    // Pode já existir ou ser gerenciado por migration.
  }
};

const readCached = async (admin, path) => {
  const { data, error } = await admin.storage.from(BUCKET).download(path);
  if (error || !data) return null;
  return Buffer.from(await data.arrayBuffer());
};

const writeCached = async (admin, path, bytes) => {
  await ensureBucket(admin);
  const { error } = await admin.storage.from(BUCKET).upload(path, bytes, {
    contentType: 'image/png',
    cacheControl: '31536000',
    upsert: true,
  });
  if (error) {
    console.warn('[albion-render] storage upload:', error.message || error);
  }
};

const writeMetadata = async (admin, payload) => {
  try {
    const { error } = await admin.from('albion_render_assets').upsert(payload, {
      onConflict: 'asset_type,identifier,size,quality',
    });
    if (error) {
      const message = error.message || String(error);
      if (message.includes("public.albion_render_assets")) return;
      console.warn('[albion-render] metadata:', message);
    }
  } catch {
    // Migration ainda não aplicada: a imagem continua sendo entregue.
  }
};

class RenderNotFoundError extends Error {
  constructor(message) {
    super(message);
    this.name = 'RenderNotFoundError';
  }
}

const fetchRender = async (url) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (response.status === 404) {
      throw new RenderNotFoundError('Render Service HTTP 404');
    }
    if (!response.ok) {
      throw new Error(`Render Service HTTP ${response.status}`);
    }
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('image/png')) {
      throw new Error(`Render Service retornou ${contentType || 'conteúdo inválido'}`);
    }
    return Buffer.from(await response.arrayBuffer());
  } finally {
    clearTimeout(timer);
  }
};

const sendPng = (res, bytes, cacheState) => {
  res.setHeader('Content-Type', 'image/png');
  res.setHeader('X-Albion-Render-Cache', cacheState);
  res.setHeader(
    'Cache-Control',
    'public, max-age=86400, s-maxage=604800, stale-while-revalidate=2592000'
  );
  res.status(200).send(bytes);
};

const sendPlaceholder = (res, req, reason) => {
  res.setHeader('Content-Type', 'image/png');
  res.setHeader('X-Albion-Render-Cache', 'placeholder');
  res.setHeader('X-Albion-Render-Missing', reason);
  res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=604800');
  res.status(200).send(req.method === 'HEAD' ? Buffer.alloc(0) : PLACEHOLDER_PNG);
};

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.status(405).json({ ok: false, error: 'Method not allowed' });
    return;
  }

  const type = normalizeType(req.query?.type);
  const identifier = normalizeIdentifier(req.query?.id || req.query?.identifier, type);
  const size = normalizeOptionalInt(req.query?.size, 1, type === 'spell' ? 172 : 217);
  const quality = normalizeOptionalInt(req.query?.quality, 1, 5);

  if (!type || !identifier) {
    res.status(400).json({ ok: false, error: 'Parâmetros type/id inválidos' });
    return;
  }

  try {
    const admin = getAdmin();
    const key = cacheKey({ type, identifier, size, quality });
    const cached = await readCached(admin, key);
    if (cached) {
      sendPng(res, req.method === 'HEAD' ? Buffer.alloc(0) : cached, 'hit');
      return;
    }

    const sourceUrl = renderUrl({ type, identifier, size, quality });
    const bytes = await fetchRender(sourceUrl);
    await writeCached(admin, key, bytes);
    await writeMetadata(admin, {
      asset_type: type,
      identifier,
      size,
      quality,
      source_url: sourceUrl,
      cache_path: key,
      content_type: 'image/png',
      byte_size: bytes.length,
      cached_at: new Date().toISOString(),
    });
    sendPng(res, req.method === 'HEAD' ? Buffer.alloc(0) : bytes, 'stored');
  } catch (err) {
    if (err instanceof RenderNotFoundError) {
      sendPlaceholder(res, req, 'not-found');
      return;
    }
    console.warn('[api/albion-render] placeholder:', err?.message || err);
    sendPlaceholder(res, req, err?.name === 'AbortError' ? 'timeout' : 'upstream-error');
  }
}
