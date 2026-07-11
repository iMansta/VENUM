-- =====================================================================
-- VENUM - Cache interno de assets do Albion Render Service
-- =====================================================================
-- Objetivo:
--   - O frontend deixa de consultar render.albiononline.com diretamente.
--   - /api/albion-render entrega PNGs a partir do Supabase Storage.
--   - Em cache miss, o servidor busca no Render Service, salva e registra
--     metadados nesta tabela.
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.albion_render_assets (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_type   TEXT NOT NULL CHECK (asset_type IN ('item', 'spell', 'wardrobe', 'destiny')),
  identifier   TEXT NOT NULL,
  size         INTEGER,
  quality      INTEGER,
  source_url   TEXT NOT NULL,
  cache_path   TEXT NOT NULL UNIQUE,
  content_type TEXT NOT NULL DEFAULT 'image/png',
  byte_size    INTEGER,
  cached_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (asset_type, identifier, size, quality)
);

ALTER TABLE public.albion_render_assets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view Albion render assets metadata"
  ON public.albion_render_assets;
CREATE POLICY "Anyone can view Albion render assets metadata"
  ON public.albion_render_assets
  FOR SELECT
  USING (true);

CREATE INDEX IF NOT EXISTS idx_albion_render_assets_type_identifier
  ON public.albion_render_assets (asset_type, identifier);

-- Bucket privado: a leitura pública passa por /api/albion-render, que controla
-- cache HTTP e evita expor dependência direta do Storage no frontend.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('albion-render-assets', 'albion-render-assets', false, 1048576, ARRAY['image/png'])
ON CONFLICT (id) DO UPDATE
  SET public = EXCLUDED.public,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Helper simples para IDs oficiais (UniqueName do Albion usa _, @, letras e números).
CREATE OR REPLACE FUNCTION public.albion_render_asset_url(p_type TEXT, p_identifier TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_identifier IS NULL OR trim(p_identifier) = '' THEN NULL
    ELSE '/api/albion-render?type=' || p_type || '&id=' || p_identifier
  END;
$$;

-- Converte image_url de itens já existentes para a rota interna.
UPDATE public.market_items
   SET image_url = public.albion_render_asset_url(
     'item',
     COALESCE(
       NULLIF(regexp_replace(image_url, '^https://render\.albiononline\.com/v1/item/([^?]+)\.png.*$', '\1'), image_url),
       item_id
     )
   ),
   updated_at = NOW()
 WHERE image_url IS NULL
    OR image_url LIKE 'https://render.albiononline.com/v1/item/%';

-- Converte icon_url de skills/passivas legadas para a rota interna.
UPDATE public.market_items mi
   SET active_skills = COALESCE(active.converted, '[]'::jsonb),
       passive_skills = COALESCE(passive.converted, '[]'::jsonb),
       updated_at = NOW()
  FROM LATERAL (
    SELECT jsonb_agg(
      CASE
        WHEN elem->>'icon_url' LIKE 'https://render.albiononline.com/v1/spell/%'
          THEN jsonb_set(
            elem,
            '{icon_url}',
            to_jsonb(public.albion_render_asset_url(
              'spell',
              regexp_replace(elem->>'icon_url', '^https://render\.albiononline\.com/v1/spell/([^?]+)\.png.*$', '\1')
            )),
            true
          )
        WHEN elem ? 'key'
          THEN jsonb_set(
            elem,
            '{icon_url}',
            to_jsonb(public.albion_render_asset_url('spell', elem->>'key')),
            true
          )
        ELSE elem
      END
      ORDER BY ord
    ) AS converted
    FROM jsonb_array_elements(COALESCE(mi.active_skills, '[]'::jsonb)) WITH ORDINALITY AS x(elem, ord)
  ) active,
  LATERAL (
    SELECT jsonb_agg(
      CASE
        WHEN elem->>'icon_url' LIKE 'https://render.albiononline.com/v1/spell/%'
          THEN jsonb_set(
            elem,
            '{icon_url}',
            to_jsonb(public.albion_render_asset_url(
              'spell',
              regexp_replace(elem->>'icon_url', '^https://render\.albiononline\.com/v1/spell/([^?]+)\.png.*$', '\1')
            )),
            true
          )
        WHEN elem ? 'key'
          THEN jsonb_set(
            elem,
            '{icon_url}',
            to_jsonb(public.albion_render_asset_url('spell', elem->>'key')),
            true
          )
        ELSE elem
      END
      ORDER BY ord
    ) AS converted
    FROM jsonb_array_elements(COALESCE(mi.passive_skills, '[]'::jsonb)) WITH ORDINALITY AS x(elem, ord)
  ) passive
 WHERE EXISTS (
   SELECT 1
   FROM jsonb_array_elements(COALESCE(mi.active_skills, '[]'::jsonb)) s
   WHERE s ? 'key'
 )
 OR EXISTS (
   SELECT 1
   FROM jsonb_array_elements(COALESCE(mi.passive_skills, '[]'::jsonb)) s
   WHERE s ? 'key'
 );
