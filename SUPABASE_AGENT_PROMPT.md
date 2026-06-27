# 🤖 Prompt para Supabase Agent: Implementar Arquitetura Centralizada

## 📌 Contexto

Projeto: **VENUM MARKET** (Dashboard Albion Online com arbitragem + production calculators)

**Problema atual:**
- ❌ Múltiplas views/RPCs para itens (duplicação)
- ❌ Preços e itens desacoplados (inconsistência)
- ❌ Cada módulo carrega dados diferente (ineficiência)
- ❌ 100% dependente da Albion API (sem dados = sem UI)
- ❌ Sem cache unificado (queries redundantes)

**Solução:** Catálogo centralizado `albion_items_catalog` + cache de preços separado `market_prices_by_location`

---

## 🎯 Objetivo

Implementar nova arquitetura de dados que:
1. ✅ Centraliza 1000+ itens do Albion em UMA tabela permanente
2. ✅ Separa preços (dados quentes) em tabela cache com TTL
3. ✅ Permite Builds, Production, Market consultarem mesma source
4. ✅ Reduz queries de 5 para 2 por page load
5. ✅ Cache em 1h para itens, 15-30min para preços

---

## 📋 Tarefas Específicas

### **TAREFA 1: Criar Tabela `albion_items_catalog`**

**Descrição:**
Tabela centralizada com TODOS os itens tradáveis do Albion Online (T1-T8, com e sem encantamentos).

**Script SQL:**
```sql
CREATE TABLE albion_items_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Identificação
  item_id TEXT NOT NULL UNIQUE,              -- ex: 'T8_MAIN_SWORD'
  
  -- Conteúdo
  name_pt TEXT NOT NULL,                     -- "Espada Longa T8"
  name_en TEXT,                              -- "Longsword T8"
  description TEXT,                          -- Descrição breve
  
  -- Classificação
  tier INTEGER NOT NULL,                     -- 0-8 (0=consumível)
  enchantment INTEGER DEFAULT 0,             -- 0-4 (nível)
  family TEXT NOT NULL,                      -- MAIN_SWORD, OFF_SHIELD, HEAD_PLATE, etc
  category TEXT,                             -- weapon, armor, consumable, mount
  subcategory TEXT,                          -- sword, shield, helmet, etc
  rarity TEXT DEFAULT 'normal',              -- normal, rare, epic, legendary
  
  -- Visual
  icon_url TEXT,                             -- https://render.albiononline.com/v1/item/{item_id}.png
  albion_api_id TEXT UNIQUE,                 -- ID da API (para sync)
  properties JSONB DEFAULT '{}',             -- {"damage": 42.5, "crafting_materials": {...}}
  
  -- Flags
  is_craftable BOOLEAN DEFAULT false,
  is_tradeable BOOLEAN DEFAULT true,
  base_price INTEGER,                        -- referência em silver
  
  -- Auditoria
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  last_synced_at TIMESTAMP,
  
  CONSTRAINT valid_tier CHECK (tier >= 0 AND tier <= 8),
  CONSTRAINT valid_enchantment CHECK (enchantment >= 0 AND enchantment <= 4)
);

-- Índices
CREATE INDEX idx_albion_items_tier ON albion_items_catalog(tier);
CREATE INDEX idx_albion_items_family ON albion_items_catalog(family);
CREATE INDEX idx_albion_items_category ON albion_items_catalog(category);
CREATE INDEX idx_albion_items_enchantment ON albion_items_catalog(enchantment);
CREATE INDEX idx_albion_items_tier_ench ON albion_items_catalog(tier, enchantment);
CREATE INDEX idx_albion_items_family_tier ON albion_items_catalog(family, tier, enchantment);
CREATE INDEX idx_albion_items_name_pt_fts ON albion_items_catalog USING GIN(to_tsvector('portuguese', name_pt));

-- Row Level Security
ALTER TABLE albion_items_catalog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view items"
  ON albion_items_catalog FOR SELECT
  USING (true);

CREATE POLICY "Only admins can modify"
  ON albion_items_catalog FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
```

**Validação:**
- [ ] Tabela criada
- [ ] Índices criados
- [ ] RLS ativado (leitura pública, escrita admin-only)
- [ ] Constraint de tier/enchantment funcionando

---

### **TAREFA 2: Criar Tabela `market_prices_by_location`**

**Descrição:**
Cache de preços sincronizado com Albion API. Dados dinâmicos com TTL automático.

**Script SQL:**
```sql
CREATE TABLE market_prices_by_location (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Chave composta
  item_id TEXT NOT NULL,                     -- FK → albion_items_catalog.item_id
  location TEXT NOT NULL,                    -- "Martlock", "Bridgewatch", "Black Market"
  
  -- Preços em JSONB (flexível)
  price_data JSONB NOT NULL,                 -- {"buy_price_min": 48000, "sell_price_min": 42000, ...}
  
  -- Controle de cache
  cached_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL,             -- NOW() + INTERVAL '15 minutes'
  
  -- Auditoria
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  CONSTRAINT unique_item_location UNIQUE(item_id, location),
  CONSTRAINT valid_expiry CHECK (expires_at > cached_at)
);

-- Índices
CREATE INDEX idx_market_prices_item ON market_prices_by_location(item_id);
CREATE INDEX idx_market_prices_location ON market_prices_by_location(location);
CREATE INDEX idx_market_prices_expires ON market_prices_by_location(expires_at);
CREATE INDEX idx_market_prices_item_location ON market_prices_by_location(item_id, location);

-- Row Level Security
ALTER TABLE market_prices_by_location ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view prices"
  ON market_prices_by_location FOR SELECT
  USING (expires_at > NOW());  -- Só retorna prices ainda válidos
```

**Validação:**
- [ ] Tabela criada
- [ ] Índices criados
- [ ] RLS ativado (leitura pública, apenas preços válidos)
- [ ] UNIQUE constraint (item_id, location)

---

### **TAREFA 3: Criar RPC `get_items_for_slot`**

**Descrição:**
Busca rápida de itens por slot (para BuildBuilder.jsx). Filtrado por tier, enchantment, slot.

**Script SQL:**
```sql
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
```

**Teste:**
```sql
SELECT * FROM get_items_for_slot('MAIN_HAND', 8, 0, 20);
-- Esperado: 20 armas tipo espada/machado/adaga T8 base
```

**Validação:**
- [ ] RPC criada
- [ ] Teste retorna resultados
- [ ] Filtro de slot funcionando
- [ ] Tempo de query < 50ms

---

### **TAREFA 4: Criar RPC `get_prices_for_items`**

**Descrição:**
Busca preços para uma lista de item_ids em locais específicos. Usado por Market e Production.

**Script SQL:**
```sql
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
```

**Teste:**
```sql
-- Depois de inserir preços de teste
SELECT * FROM get_prices_for_items(
  ARRAY['T8_MAIN_SWORD', 'T8_OFF_SHIELD'],
  ARRAY['Martlock', 'Black Market']
);
```

**Validação:**
- [ ] RPC criada
- [ ] Retorna apenas preços válidos (expires_at > NOW())
- [ ] Filtro de locations funcionando
- [ ] Tempo de query < 30ms

---

### **TAREFA 5: Criar RPC `sync_prices_from_albion_api`**

**Descrição:**
Função para sincronizar preços com Albion Data Project API. Será chamada por cron job.

**Script SQL:**
```sql
CREATE OR REPLACE FUNCTION sync_prices_from_albion_api(
  p_locations TEXT[] DEFAULT ARRAY['Martlock', 'Bridgewatch', 'Lymhurst', 'Fort Sterling', 'Thetford', 'Caerleon', 'Black Market'],
  p_limit INTEGER DEFAULT 1000
)
RETURNS JSONB AS $$
DECLARE
  v_inserted INT := 0;
  v_updated INT := 0;
BEGIN
  -- Placeholder: Esta função será completada com:
  --   1. HTTP call para Albion Data Project API
  --   2. Parse JSON response
  --   3. UPSERT em market_prices_by_location
  --   4. Remover expirados
  
  -- Por enquanto, retornar sucesso para testes
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
```

**Nota importante:**
> A implementação completa desta RPC requer um **Supabase Edge Function** ou **webhook externo** que:
> 1. Chama Albion Data Project API (`https://www.albion-online-data.com/api/v2/stats/prices/`)
> 2. Parse resultados
> 3. Insere em `market_prices_by_location`
> 
> Recomendação: Usar **GitHub Actions** ou **Cloud Functions** para chamar esta RPC a cada 30 minutos.

**Validação:**
- [ ] RPC criada
- [ ] Teste executa sem erro
- [ ] Retorno é JSONB com status

---

### **TAREFA 6: Criar RPC `cleanup_expired_prices`**

**Descrição:**
Limpar preços expirados da tabela (TTL automático). Será chamado após sync.

**Script SQL:**
```sql
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
```

**Validação:**
- [ ] RPC criada
- [ ] Teste executa
- [ ] Retorno mostra quantidade deletada

---

### **TAREFA 7: Seed Data Inicial**

**Descrição:**
Inserir 50-100 itens T8 base para testes.

**Script SQL:**
```sql
INSERT INTO albion_items_catalog (
  item_id, name_pt, name_en, tier, enchantment, family, category, subcategory,
  icon_url, is_craftable, is_tradeable, base_price
) VALUES
  -- Weapons MAIN_HAND
  ('T8_MAIN_SWORD', 'Espada Longa T8', 'Longsword T8', 8, 0, 'MAIN_SWORD', 'weapon', 'sword',
   'https://render.albiononline.com/v1/item/T8_MAIN_SWORD.png', true, true, 45000),
  ('T8_MAIN_AXE', 'Machado T8', 'Axe T8', 8, 0, 'MAIN_AXE', 'weapon', 'axe',
   'https://render.albiononline.com/v1/item/T8_MAIN_AXE.png', true, true, 48000),
  ('T8_MAIN_DAGGER', 'Adaga T8', 'Dagger T8', 8, 0, 'MAIN_DAGGER', 'weapon', 'dagger',
   'https://render.albiononline.com/v1/item/T8_MAIN_DAGGER.png', true, true, 35000),
  
  -- Armor OFF_HAND
  ('T8_OFF_SHIELD', 'Escudo T8', 'Shield T8', 8, 0, 'OFF_SHIELD', 'armor', 'shield',
   'https://render.albiononline.com/v1/item/T8_OFF_SHIELD.png', true, true, 40000),
  
  -- Armor HEAD
  ('T8_HEAD_PLATE', 'Elmo Placa T8', 'Plate Helmet T8', 8, 0, 'HEAD_PLATE', 'armor', 'helmet',
   'https://render.albiononline.com/v1/item/T8_HEAD_PLATE.png', true, true, 35000),
  ('T8_HEAD_CLOTH', 'Chapéu Pano T8', 'Cloth Helmet T8', 8, 0, 'HEAD_CLOTH', 'armor', 'helmet',
   'https://render.albiononline.com/v1/item/T8_HEAD_CLOTH.png', true, true, 28000),
  
  -- Armor ARMOR
  ('T8_ARMOR_PLATE', 'Armadura Placa T8', 'Plate Armor T8', 8, 0, 'ARMOR_PLATE', 'armor', 'body',
   'https://render.albiononline.com/v1/item/T8_ARMOR_PLATE.png', true, true, 50000),
  ('T8_ARMOR_CLOTH', 'Armadura Pano T8', 'Cloth Armor T8', 8, 0, 'ARMOR_CLOTH', 'armor', 'body',
   'https://render.albiononline.com/v1/item/T8_ARMOR_CLOTH.png', true, true, 40000),
  
  -- Armor SHOES
  ('T8_SHOES_PLATE', 'Botas Placa T8', 'Plate Boots T8', 8, 0, 'SHOES_PLATE', 'armor', 'boots',
   'https://render.albiononline.com/v1/item/T8_SHOES_PLATE.png', true, true, 30000),
  ('T8_SHOES_CLOTH', 'Botas Pano T8', 'Cloth Boots T8', 8, 0, 'SHOES_CLOTH', 'armor', 'boots',
   'https://render.albiononline.com/v1/item/T8_SHOES_CLOTH.png', true, true, 24000),
  
  -- Accessories
  ('T8_CAPE', 'Capa T8', 'Cape T8', 8, 0, 'CAPE', 'accessory', 'cape',
   'https://render.albiononline.com/v1/item/T8_CAPE.png', false, true, 10000),
  ('T8_BAG', 'Mochila T8', 'Bag T8', 8, 0, 'BAG', 'accessory', 'bag',
   'https://render.albiononline.com/v1/item/T8_BAG.png', false, true, 5000),
  
  -- Consumables
  ('T8_FOOD_ROASTED_MEAT', 'Carne Assada T8', 'Roasted Meat T8', 0, 0, 'FOOD', 'consumable', 'food',
   'https://render.albiononline.com/v1/item/T8_FOOD_ROASTED_MEAT.png', false, true, 500),
  ('T8_POTION_HEALING', 'Poção de Cura T8', 'Healing Potion T8', 0, 0, 'POTION', 'consumable', 'potion',
   'https://render.albiononline.com/v1/item/T8_POTION_HEALING.png', false, true, 800),
  
  -- Mount
  ('T8_MOUNT_HORSE', 'Cavalo de Batalha T8', 'War Horse T8', 0, 0, 'MOUNT_HORSE', 'mount', 'horse',
   'https://render.albiononline.com/v1/item/T8_MOUNT_HORSE.png', false, true, 100000),
  
  -- Refined materials (para Production)
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
   NOW() + INTERVAL '15 minutes')
ON CONFLICT (item_id, location) DO UPDATE SET
  price_data = EXCLUDED.price_data,
  expires_at = EXCLUDED.expires_at,
  updated_at = NOW();
```

**Validação:**
- [ ] 20+ itens inseridos
- [ ] Preços de exemplo inseridos
- [ ] Queries de teste retornam dados

---

## ✅ Checklist de Entrega

### Banco de Dados
- [ ] Tabela `albion_items_catalog` criada com índices
- [ ] Tabela `market_prices_by_location` criada com índices
- [ ] RLS habilitado em ambas as tabelas
- [ ] RPC `get_items_for_slot` funcionando (<50ms)
- [ ] RPC `get_prices_for_items` funcionando (<30ms)
- [ ] RPC `sync_prices_from_albion_api` criada
- [ ] RPC `cleanup_expired_prices` criada
- [ ] Seed data (20+ itens + preços de exemplo) inserida
- [ ] Testes de query funcionando

### Documentação
- [ ] README com schema explicado
- [ ] Instruções de seed data
- [ ] Exemplos de queries
- [ ] Performance benchmarks

### Próximas Etapas (Frontend)
- [ ] Criar `src/lib/supabase/itemsService.js`
- [ ] Refatorar BuildBuilder.jsx
- [ ] Refatorar Production.jsx
- [ ] Refatorar Market.jsx
- [ ] Setup cron job para sync automático

---

## 📞 Perguntas para o Supabase Agent

1. **Sobre Sync:**
   - Como você recomenda chamar `sync_prices_from_albion_api()` regularmente?
   - Usar Supabase Edge Function, GitHub Actions, ou outro serviço?

2. **Performance:**
   - Há alguma otimização adicional para os índices?
   - Recomenda CLUSTER ou VACUUM periódico?

3. **Monitoramento:**
   - Como monitorar cache hits vs misses?
   - Como detectar quando preços estão ficando muito stale?

4. **Escalabilidade:**
   - Esta arquitetura aguenta 10k+ itens sem problema?
   - Quando precisaremos fazer sharding de preços?

---

## 🎯 Timeline Estimado

- **Tarefas 1-7 (Banco):** 2-3 horas
- **Tests + validação:** 1 hora
- **Total:** 3-4 horas para Supabase

---

**Criado em:** 2026-06-27
**Status:** Pronto para implementação
**Prioridade:** 🔴 ALTA
