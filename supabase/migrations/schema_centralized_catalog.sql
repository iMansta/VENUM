-- ============================================================================
-- VENUM MARKET: Arquitetura Centralizada de Itens
-- ============================================================================
-- Schema SQL PURO (sem Markdown, pronto para Supabase SQL Editor)
-- Criação: 2026-06-27
-- ============================================================================

-- TAREFA 1: Criar Tabela albion_items_catalog
-- ============================================================================

CREATE TABLE IF NOT EXISTS albion_items_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Identificação
  item_id TEXT NOT NULL UNIQUE,
  
  -- Conteúdo
  name_pt TEXT NOT NULL,
  name_en TEXT,
  description TEXT,
  
  -- Classificação
  tier INTEGER NOT NULL,
  enchantment INTEGER DEFAULT 0,
  family TEXT NOT NULL,
  category TEXT,
  subcategory TEXT,
  rarity TEXT DEFAULT 'normal',
  
  -- Visual
  icon_url TEXT,
  albion_api_id TEXT UNIQUE,
  properties JSONB DEFAULT '{}',
  
  -- Flags
  is_craftable BOOLEAN DEFAULT false,
  is_tradeable BOOLEAN DEFAULT true,
  base_price INTEGER,
  
  -- Auditoria
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  last_synced_at TIMESTAMP,
  
  CONSTRAINT valid_tier CHECK (tier >= 0 AND tier <= 8),
  CONSTRAINT valid_enchantment CHECK (enchantment >= 0 AND enchantment <= 4)
);

-- Índices para albion_items_catalog
CREATE INDEX IF NOT EXISTS idx_albion_items_tier ON albion_items_catalog(tier);
CREATE INDEX IF NOT EXISTS idx_albion_items_family ON albion_items_catalog(family);
CREATE INDEX IF NOT EXISTS idx_albion_items_category ON albion_items_catalog(category);
CREATE INDEX IF NOT EXISTS idx_albion_items_enchantment ON albion_items_catalog(enchantment);
CREATE INDEX IF NOT EXISTS idx_albion_items_tier_ench ON albion_items_catalog(tier, enchantment);
CREATE INDEX IF NOT EXISTS idx_albion_items_family_tier ON albion_items_catalog(family, tier, enchantment);
CREATE INDEX IF NOT EXISTS idx_albion_items_name_pt_fts ON albion_items_catalog USING GIN(to_tsvector('portuguese', name_pt));

-- Row Level Security para albion_items_catalog
ALTER TABLE albion_items_catalog ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view items" ON albion_items_catalog;
CREATE POLICY "Anyone can view items"
  ON albion_items_catalog FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Only admins can modify" ON albion_items_catalog;
CREATE POLICY "Only admins can modify"
  ON albion_items_catalog FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- ============================================================================
-- TAREFA 2: Criar Tabela market_prices_by_location
-- ============================================================================

CREATE TABLE IF NOT EXISTS market_prices_by_location (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Chave composta
  item_id TEXT NOT NULL,
  location TEXT NOT NULL,
  
  -- Preços em JSONB
  price_data JSONB NOT NULL,
  
  -- Controle de cache
  cached_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL,
  
  -- Auditoria
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  CONSTRAINT unique_item_location UNIQUE(item_id, location),
  CONSTRAINT valid_expiry CHECK (expires_at > cached_at)
);

-- Índices para market_prices_by_location
CREATE INDEX IF NOT EXISTS idx_market_prices_item ON market_prices_by_location(item_id);
CREATE INDEX IF NOT EXISTS idx_market_prices_location ON market_prices_by_location(location);
CREATE INDEX IF NOT EXISTS idx_market_prices_expires ON market_prices_by_location(expires_at);
CREATE INDEX IF NOT EXISTS idx_market_prices_item_location ON market_prices_by_location(item_id, location);

-- Row Level Security para market_prices_by_location
ALTER TABLE market_prices_by_location ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view prices" ON market_prices_by_location;
CREATE POLICY "Anyone can view prices"
  ON market_prices_by_location FOR SELECT
  USING (expires_at > NOW());

-- ============================================================================
-- TAREFA 3: Criar RPC get_items_for_slot
-- ============================================================================

CREATE OR REPLACE FUNCTION get_items_for_slot(
  p_slot_key TEXT,
  p_tier INTEGER DEFAULT 8,
  p_enchantment INTEGER DEFAULT 0,
  p_limit INTEGER DEFAULT 120
)
RETURNS TABLE (
  item_id TEXT,
  name_pt TEXT,
  family TEXT,
  icon_url TEXT,
  rarity TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.item_id,
    c.name_pt,
    c.family,
    c.icon_url,
    c.rarity
  FROM albion_items_catalog c
  WHERE c.tier = p_tier
    AND c.enchantment = p_enchantment
    AND c.is_tradeable = true
    AND CASE 
      WHEN p_slot_key = 'MAIN_HAND' THEN c.family LIKE 'MAIN_%'
      WHEN p_slot_key = 'OFF_HAND' THEN c.family LIKE 'OFF_%' OR c.family LIKE 'SHIELD%'
      WHEN p_slot_key = 'HEAD' THEN c.family LIKE 'HEAD_%'
      WHEN p_slot_key = 'ARMOR' THEN c.family LIKE 'ARMOR_%'
      WHEN p_slot_key = 'SHOES' THEN c.family LIKE 'SHOES_%'
      WHEN p_slot_key = 'CAPE' THEN c.family = 'CAPE'
      WHEN p_slot_key = 'BAG' THEN c.family = 'BAG'
      WHEN p_slot_key = 'FOOD' THEN c.category = 'consumable' AND c.family LIKE 'FOOD%'
      WHEN p_slot_key = 'POTION' THEN c.category = 'consumable' AND c.family LIKE 'POTION%'
      WHEN p_slot_key = 'MOUNT' THEN c.category = 'mount'
      ELSE FALSE
    END
  ORDER BY c.subcategory, c.name_pt
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- TAREFA 4: Criar RPC get_prices_for_items
-- ============================================================================

CREATE OR REPLACE FUNCTION get_prices_for_items(
  p_item_ids TEXT[],
  p_locations TEXT[] DEFAULT NULL
)
RETURNS TABLE (
  item_id TEXT,
  location TEXT,
  buy_price_min BIGINT,
  buy_price_max BIGINT,
  sell_price_min BIGINT,
  sell_price_max BIGINT,
  expires_at TIMESTAMP
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    mp.item_id,
    mp.location,
    (mp.price_data->>'buy_price_min')::BIGINT,
    (mp.price_data->>'buy_price_max')::BIGINT,
    (mp.price_data->>'sell_price_min')::BIGINT,
    (mp.price_data->>'sell_price_max')::BIGINT,
    mp.expires_at
  FROM market_prices_by_location mp
  WHERE mp.item_id = ANY(p_item_ids)
    AND (p_locations IS NULL OR mp.location = ANY(p_locations))
    AND mp.expires_at > NOW()
  ORDER BY mp.item_id, mp.location;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- TAREFA 5: Criar RPC sync_prices_from_albion_api (Placeholder)
-- ============================================================================

CREATE OR REPLACE FUNCTION sync_prices_from_albion_api(
  p_locations TEXT[] DEFAULT ARRAY['Martlock', 'Bridgewatch', 'Lymhurst', 'Fort Sterling', 'Thetford', 'Caerleon', 'Black Market'],
  p_limit INTEGER DEFAULT 1000
)
RETURNS JSONB AS $$
DECLARE
  v_inserted INT := 0;
  v_updated INT := 0;
BEGIN
  RETURN jsonb_build_object(
    'success', true,
    'timestamp', NOW(),
    'locations_synced', array_length(p_locations, 1),
    'inserted', v_inserted,
    'updated', v_updated,
    'message', 'Prices sync scheduled (implementation via Edge Function)'
  );
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TAREFA 6: Criar RPC cleanup_expired_prices
-- ============================================================================

CREATE OR REPLACE FUNCTION cleanup_expired_prices()
RETURNS JSONB AS $$
DECLARE
  v_deleted INT;
BEGIN
  DELETE FROM market_prices_by_location
  WHERE expires_at <= NOW();
  
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  
  RETURN jsonb_build_object(
    'success', true,
    'deleted', v_deleted,
    'timestamp', NOW()
  );
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TAREFA 7: Seed Data Inicial
-- ============================================================================

-- Inserir itens T8 base
INSERT INTO albion_items_catalog (
  item_id, name_pt, name_en, tier, enchantment, family, category, subcategory,
  icon_url, is_craftable, is_tradeable, base_price
) VALUES
  ('T8_MAIN_SWORD', 'Espada Longa T8', 'Longsword T8', 8, 0, 'MAIN_SWORD', 'weapon', 'sword',
   'https://render.albiononline.com/v1/item/T8_MAIN_SWORD.png', true, true, 45000),
  ('T8_MAIN_AXE', 'Machado T8', 'Axe T8', 8, 0, 'MAIN_AXE', 'weapon', 'axe',
   'https://render.albiononline.com/v1/item/T8_MAIN_AXE.png', true, true, 48000),
  ('T8_MAIN_DAGGER', 'Adaga T8', 'Dagger T8', 8, 0, 'MAIN_DAGGER', 'weapon', 'dagger',
   'https://render.albiononline.com/v1/item/T8_MAIN_DAGGER.png', true, true, 35000),
  ('T8_OFF_SHIELD', 'Escudo T8', 'Shield T8', 8, 0, 'OFF_SHIELD', 'armor', 'shield',
   'https://render.albiononline.com/v1/item/T8_OFF_SHIELD.png', true, true, 40000),
  ('T8_HEAD_PLATE', 'Elmo Placa T8', 'Plate Helmet T8', 8, 0, 'HEAD_PLATE', 'armor', 'helmet',
   'https://render.albiononline.com/v1/item/T8_HEAD_PLATE.png', true, true, 35000),
  ('T8_HEAD_CLOTH', 'Chapéu Pano T8', 'Cloth Helmet T8', 8, 0, 'HEAD_CLOTH', 'armor', 'helmet',
   'https://render.albiononline.com/v1/item/T8_HEAD_CLOTH.png', true, true, 28000),
  ('T8_ARMOR_PLATE', 'Armadura Placa T8', 'Plate Armor T8', 8, 0, 'ARMOR_PLATE', 'armor', 'body',
   'https://render.albiononline.com/v1/item/T8_ARMOR_PLATE.png', true, true, 50000),
  ('T8_ARMOR_CLOTH', 'Armadura Pano T8', 'Cloth Armor T8', 8, 0, 'ARMOR_CLOTH', 'armor', 'body',
   'https://render.albiononline.com/v1/item/T8_ARMOR_CLOTH.png', true, true, 40000),
  ('T8_SHOES_PLATE', 'Botas Placa T8', 'Plate Boots T8', 8, 0, 'SHOES_PLATE', 'armor', 'boots',
   'https://render.albiononline.com/v1/item/T8_SHOES_PLATE.png', true, true, 30000),
  ('T8_SHOES_CLOTH', 'Botas Pano T8', 'Cloth Boots T8', 8, 0, 'SHOES_CLOTH', 'armor', 'boots',
   'https://render.albiononline.com/v1/item/T8_SHOES_CLOTH.png', true, true, 24000),
  ('T8_CAPE', 'Capa T8', 'Cape T8', 8, 0, 'CAPE', 'accessory', 'cape',
   'https://render.albiononline.com/v1/item/T8_CAPE.png', false, true, 10000),
  ('T8_BAG', 'Mochila T8', 'Bag T8', 8, 0, 'BAG', 'accessory', 'bag',
   'https://render.albiononline.com/v1/item/T8_BAG.png', false, true, 5000),
  ('T8_FOOD_ROASTED_MEAT', 'Carne Assada T8', 'Roasted Meat T8', 0, 0, 'FOOD', 'consumable', 'food',
   'https://render.albiononline.com/v1/item/T8_FOOD_ROASTED_MEAT.png', false, true, 500),
  ('T8_POTION_HEALING', 'Poção de Cura T8', 'Healing Potion T8', 0, 0, 'POTION', 'consumable', 'potion',
   'https://render.albiononline.com/v1/item/T8_POTION_HEALING.png', false, true, 800),
  ('T8_MOUNT_HORSE', 'Cavalo de Batalha T8', 'War Horse T8', 0, 0, 'MOUNT_HORSE', 'mount', 'horse',
   'https://render.albiononline.com/v1/item/T8_MOUNT_HORSE.png', false, true, 100000),
  ('T8_METALBAR', 'Barra de Metal T8', 'Metal Bar T8', 8, 0, 'METALBAR', 'material', 'metal',
   'https://render.albiononline.com/v1/item/T8_METALBAR.png', true, true, 1200),
  ('T8_LEATHER', 'Couro T8', 'Leather T8', 8, 0, 'LEATHER', 'material', 'leather',
   'https://render.albiononline.com/v1/item/T8_LEATHER.png', true, true, 800),
  ('T8_PLANKS', 'Tábuas T8', 'Planks T8', 8, 0, 'PLANKS', 'material', 'wood',
   'https://render.albiononline.com/v1/item/T8_PLANKS.png', true, true, 600),
  ('T8_CLOTH', 'Pano T8', 'Cloth T8', 8, 0, 'CLOTH', 'material', 'cloth',
   'https://render.albiononline.com/v1/item/T8_CLOTH.png', true, true, 700),
  ('T8_STONEBLOCK', 'Bloco de Pedra T8', 'Stone Block T8', 8, 0, 'STONEBLOCK', 'material', 'stone',
   'https://render.albiononline.com/v1/item/T8_STONEBLOCK.png', true, true, 400)
ON CONFLICT (item_id) DO NOTHING;

-- Inserir preços de exemplo
INSERT INTO market_prices_by_location (
  item_id, location, price_data, expires_at
) VALUES
  ('T8_MAIN_SWORD', 'Martlock',
   '{"buy_price_min": 48000, "buy_price_max": 50000, "sell_price_min": 42000, "sell_price_max": 44000}'::jsonb,
   NOW() + INTERVAL '15 minutes'),
  ('T8_MAIN_SWORD', 'Black Market',
   '{"buy_price_min": 52000, "buy_price_max": 55000, "sell_price_min": 46000, "sell_price_max": 48000}'::jsonb,
   NOW() + INTERVAL '15 minutes'),
  ('T8_METALBAR', 'Martlock',
   '{"buy_price_min": 1200, "buy_price_max": 1300, "sell_price_min": 1000, "sell_price_max": 1100}'::jsonb,
   NOW() + INTERVAL '15 minutes'),
  ('T8_LEATHER', 'Martlock',
   '{"buy_price_min": 800, "buy_price_max": 900, "sell_price_min": 700, "sell_price_max": 800}'::jsonb,
   NOW() + INTERVAL '15 minutes'),
  ('T8_PLANKS', 'Martlock',
   '{"buy_price_min": 600, "buy_price_max": 700, "sell_price_min": 500, "sell_price_max": 600}'::jsonb,
   NOW() + INTERVAL '15 minutes')
ON CONFLICT (item_id, location) DO UPDATE SET
  price_data = EXCLUDED.price_data,
  expires_at = EXCLUDED.expires_at,
  updated_at = NOW();

-- ============================================================================
-- VERIFICAÇÃO: Confirmar que tudo foi criado
-- ============================================================================

-- Testar RPC get_items_for_slot
SELECT 'Testing get_items_for_slot' as test;
SELECT * FROM get_items_for_slot('MAIN_HAND', 8, 0, 5);

-- Testar RPC get_prices_for_items
SELECT 'Testing get_prices_for_items' as test;
SELECT * FROM get_prices_for_items(
  ARRAY['T8_MAIN_SWORD', 'T8_METALBAR'],
  ARRAY['Martlock']
);

-- Contar itens e preços
SELECT 
  (SELECT COUNT(*) FROM albion_items_catalog) as total_items,
  (SELECT COUNT(*) FROM market_prices_by_location) as total_prices;
