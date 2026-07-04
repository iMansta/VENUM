-- =====================================================================
-- Backfill de market_items.name_pt com a localização oficial PT-BR
-- (ao-bin-dumps). Corrige nomes que estavam em inglês/cru na Loja,
-- Black Market e Builds. Idempotente: pode rodar novamente.
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS http WITH SCHEMA extensions;

CREATE TEMP TABLE _loc ON COMMIT DROP AS
SELECT x->>'UniqueName' AS item_id,
       x->'LocalizedNames'->>'PT-BR' AS name_pt
FROM (
  SELECT (extensions.http_get(
    'https://raw.githubusercontent.com/ao-data/ao-bin-dumps/master/formatted/items.json'
  )).content::jsonb AS j
) d,
LATERAL jsonb_array_elements(d.j) AS x
WHERE x->'LocalizedNames'->>'PT-BR' IS NOT NULL;

-- Itens sem encantamento
UPDATE public.market_items m
SET name_pt = l.name_pt
FROM _loc l
WHERE m.item_id = l.item_id
  AND m.item_id NOT LIKE '%@%';

-- Variantes encantadas (@1/@2/@3) herdam o nome base + sufixo ".N"
UPDATE public.market_items m
SET name_pt = l.name_pt || ' .' || split_part(m.item_id, '@', 2)
FROM _loc l
WHERE m.item_id LIKE '%@%'
  AND l.item_id = split_part(m.item_id, '@', 1);

SELECT 'UPDATE_ITEM_NAMES_PT aplicado' AS status;
