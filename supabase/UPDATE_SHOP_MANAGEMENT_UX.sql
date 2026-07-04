-- =====================================================================
-- Shop UX - suporte catálogo canônico no admin
-- =====================================================================

ALTER TABLE public.shop_items
  ADD COLUMN IF NOT EXISTS catalog_item_id TEXT;

ALTER TABLE public.shop_items
  ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'geral';

ALTER TABLE public.shop_items
  ADD COLUMN IF NOT EXISTS image_url TEXT;

ALTER TABLE public.shop_items
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

CREATE INDEX IF NOT EXISTS idx_shop_items_catalog_item_id
  ON public.shop_items(catalog_item_id);

CREATE INDEX IF NOT EXISTS idx_shop_items_category
  ON public.shop_items(category);

SELECT 'UPDATE_SHOP_MANAGEMENT_UX aplicado' AS status;
