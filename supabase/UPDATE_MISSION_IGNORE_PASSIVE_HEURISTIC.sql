-- =====================================================================
-- Missões: ignorar heurísticas de rede (falsos positivos de kill/fama)
-- =====================================================================
-- Tráfego UDP passivo e observações com source *passive_network_heuristic*
-- geravam mob_kill/pve_fame sem combate real. Marcamos como processadas
-- sem alterar missões nem fama.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.celeste_apply_observation(
  p_obs_id UUID,
  p_cycle UUID
)
RETURNS TABLE (
  mission_updates INTEGER,
  fame_updates INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_obs RECORD;
  v_qty INTEGER := 1;
  v_profile_id UUID;
  v_username TEXT;
  v_username_norm TEXT;
  v_type TEXT;
  v_mission_type TEXT;
  v_item_hint TEXT;
  v_target_key TEXT;
  v_updates INTEGER := 0;
  v_fame INTEGER := 0;
BEGIN
  SELECT *
  INTO v_obs
  FROM public.celeste_observations
  WHERE id = p_obs_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT 0, 0;
    RETURN;
  END IF;

  v_type := lower(COALESCE(v_obs.type, 'raw'));
  v_qty := GREATEST(COALESCE(FLOOR(v_obs.value_numeric)::INTEGER, 1), 1);

  -- Telemetria de rede e heurísticas sintéticas não contam para missões/fama.
  IF v_type IN ('net_udp_packets', 'net_udp_albion')
     OR COALESCE(v_obs.payload->>'source', '') LIKE '%passive_network_heuristic%'
     OR COALESCE(v_obs.payload->>'source', '') LIKE '%fame_delta_dynamic_threshold%' THEN
    UPDATE public.celeste_observations
    SET processed_at = NOW(),
        aggregated_cycle = p_cycle
    WHERE id = v_obs.id;
    RETURN QUERY SELECT 0, 0;
    RETURN;
  END IF;

  v_profile_id := v_obs.profile_id;
  v_username := COALESCE(v_obs.username, v_obs.payload->>'username', v_obs.payload->>'character');
  v_item_hint := COALESCE(
    v_obs.payload->>'item_id',
    v_obs.payload->>'item',
    v_obs.payload->>'resource',
    v_obs.payload->>'target_name'
  );
  v_target_key := lower(COALESCE(v_obs.payload->>'target_key', v_obs.payload->>'mob_key', v_item_hint, ''));

  IF v_profile_id IS NULL AND v_obs.payload ? 'profile_id' THEN
    BEGIN
      v_profile_id := (v_obs.payload->>'profile_id')::UUID;
    EXCEPTION WHEN OTHERS THEN
      v_profile_id := NULL;
    END;
  END IF;

  IF v_profile_id IS NULL AND COALESCE(v_username, '') <> '' THEN
    v_username_norm := regexp_replace(lower(v_username), '[^a-z0-9]', '', 'g');
    SELECT p.id INTO v_profile_id
    FROM public.profiles p
    WHERE lower(p.username) = lower(v_username)
       OR lower(COALESCE(p.albion_character_name, '')) = lower(v_username)
       OR (
         length(v_username_norm) >= 4
         AND (
           regexp_replace(lower(COALESCE(p.username, '')), '[^a-z0-9]', '', 'g') LIKE '%' || v_username_norm || '%'
           OR regexp_replace(lower(COALESCE(p.albion_character_name, '')), '[^a-z0-9]', '', 'g') LIKE '%' || v_username_norm || '%'
         )
       )
    LIMIT 1;
  END IF;

  IF v_profile_id IS NULL AND COALESCE(v_obs.client_id, '') <> '' THEN
    SELECT cc.profile_id,
           COALESCE(v_username, cc.username)
    INTO v_profile_id, v_username
    FROM public.celeste_clients cc
    WHERE cc.client_id = v_obs.client_id
    LIMIT 1;

    IF v_profile_id IS NULL AND COALESCE(v_username, '') <> '' THEN
      v_username_norm := regexp_replace(lower(v_username), '[^a-z0-9]', '', 'g');
      SELECT p.id INTO v_profile_id
      FROM public.profiles p
      WHERE lower(p.username) = lower(v_username)
         OR lower(COALESCE(p.albion_character_name, '')) = lower(v_username)
         OR (
           length(v_username_norm) >= 4
           AND (
             regexp_replace(lower(COALESCE(p.username, '')), '[^a-z0-9]', '', 'g') LIKE '%' || v_username_norm || '%'
             OR regexp_replace(lower(COALESCE(p.albion_character_name, '')), '[^a-z0-9]', '', 'g') LIKE '%' || v_username_norm || '%'
           )
         )
      LIMIT 1;
    END IF;
  END IF;

  IF v_profile_id IS NOT NULL THEN
    UPDATE public.celeste_observations
    SET profile_id = v_profile_id
    WHERE id = v_obs.id AND profile_id IS NULL;

    IF COALESCE(v_obs.client_id, '') <> '' THEN
      UPDATE public.celeste_clients
      SET profile_id = COALESCE(profile_id, v_profile_id),
          username = COALESCE(username, NULLIF(v_username, ''))
      WHERE client_id = v_obs.client_id;
    END IF;
  END IF;

  IF v_profile_id IS NOT NULL THEN
    IF v_type = 'mob_kill' THEN
      UPDATE public.profiles
      SET albion_kill_fame = COALESCE(albion_kill_fame, 0) + v_qty,
          albion_fame_synced_at = NOW()
      WHERE id = v_profile_id;
      v_fame := v_fame + 1;
    ELSIF v_type = 'fame' THEN
      UPDATE public.profiles
      SET albion_pve_fame = COALESCE(albion_pve_fame, 0) + v_qty,
          albion_fame_synced_at = NOW()
      WHERE id = v_profile_id;
      v_fame := v_fame + 1;
    ELSIF v_type = 'gathering' THEN
      UPDATE public.profiles
      SET albion_gathering_fame = COALESCE(albion_gathering_fame, 0) + v_qty,
          albion_fame_synced_at = NOW()
      WHERE id = v_profile_id;
      v_fame := v_fame + 1;
    END IF;
  END IF;

  v_mission_type := CASE
    WHEN v_type = 'gathering' THEN 'gathering'
    WHEN v_type = 'pvp_kill' THEN 'pvp'
    WHEN v_type IN ('mob_kill', 'fame', 'pve_fame') THEN 'pve'
    WHEN v_type = 'mission' THEN 'other'
    WHEN v_type IN ('big_chest', 'chest', 'outpost_capture', 'outpost', 'castle_capture', 'castle', 'objective') THEN 'other'
    ELSE NULL
  END;

  IF v_target_key = '' AND v_type IN ('big_chest', 'chest', 'outpost_capture', 'outpost', 'castle_capture', 'castle') THEN
    v_target_key := v_type;
  END IF;

  IF v_mission_type IS NOT NULL THEN
    WITH updated AS (
      UPDATE public.missions m
      SET current_quantity = LEAST(
        COALESCE(m.target_quantity, 0),
        COALESCE(m.current_quantity, 0) + v_qty
      )
      WHERE m.status = 'active'
        AND m.mission_type = v_mission_type
        AND (m.end_date IS NULL OR m.end_date > NOW())
        AND (
          v_type <> 'mob_kill'
          OR COALESCE(m.min_fame_threshold, 0) <= 0
          OR COALESCE(
            NULLIF(regexp_replace(COALESCE(v_obs.payload->>'fame_delta', ''), '[^0-9-]', '', 'g'), '')::INTEGER,
            0
          ) >= COALESCE(m.min_fame_threshold, 0)
        )
        AND (
          COALESCE(m.target_item, '') = ''
          OR lower(m.target_item) IN ('any', 'general')
          OR (v_item_hint IS NOT NULL AND lower(m.target_item) = lower(v_item_hint))
          OR (v_target_key <> '' AND lower(m.target_item) = v_target_key)
          OR (v_type IN ('fame', 'pve_fame') AND lower(m.target_item) = 'pve_fame')
          OR (v_type = 'mob_kill' AND lower(m.target_item) IN ('mob_kill', 'kill', 'pve_kill'))
          OR (v_type = 'pvp_kill' AND lower(m.target_item) IN ('player_kill', 'pvp_kill'))
          OR (v_type IN ('big_chest', 'chest') AND lower(m.target_item) IN ('big_chest', 'chest'))
          OR (v_type IN ('outpost_capture', 'outpost') AND lower(m.target_item) IN ('outpost_capture', 'outpost'))
          OR (v_type IN ('castle_capture', 'castle') AND lower(m.target_item) IN ('castle_capture', 'castle'))
        )
      RETURNING m.id
    )
    SELECT COUNT(*) INTO v_updates FROM updated;

    IF v_profile_id IS NOT NULL AND v_updates > 0 THEN
      INSERT INTO public.mission_participants (mission_id, profile_id, contribution_quantity)
      SELECT m.id, v_profile_id, v_qty
      FROM public.missions m
      WHERE m.status = 'active'
        AND m.mission_type = v_mission_type
        AND (m.end_date IS NULL OR m.end_date > NOW())
        AND (
          v_type <> 'mob_kill'
          OR COALESCE(m.min_fame_threshold, 0) <= 0
          OR COALESCE(
            NULLIF(regexp_replace(COALESCE(v_obs.payload->>'fame_delta', ''), '[^0-9-]', '', 'g'), '')::INTEGER,
            0
          ) >= COALESCE(m.min_fame_threshold, 0)
        )
        AND (
          COALESCE(m.target_item, '') = ''
          OR lower(m.target_item) IN ('any', 'general')
          OR (v_item_hint IS NOT NULL AND lower(m.target_item) = lower(v_item_hint))
          OR (v_target_key <> '' AND lower(m.target_item) = v_target_key)
          OR (v_type IN ('fame', 'pve_fame') AND lower(m.target_item) = 'pve_fame')
          OR (v_type = 'mob_kill' AND lower(m.target_item) IN ('mob_kill', 'kill', 'pve_kill'))
          OR (v_type = 'pvp_kill' AND lower(m.target_item) IN ('player_kill', 'pvp_kill'))
          OR (v_type IN ('big_chest', 'chest') AND lower(m.target_item) IN ('big_chest', 'chest'))
          OR (v_type IN ('outpost_capture', 'outpost') AND lower(m.target_item) IN ('outpost_capture', 'outpost'))
          OR (v_type IN ('castle_capture', 'castle') AND lower(m.target_item) IN ('castle_capture', 'castle'))
        )
      ON CONFLICT (mission_id, profile_id) DO UPDATE
      SET contribution_quantity =
        COALESCE(public.mission_participants.contribution_quantity, 0) + EXCLUDED.contribution_quantity;
    END IF;
  END IF;

  UPDATE public.celeste_observations
  SET processed_at = NOW(),
      aggregated_cycle = p_cycle
  WHERE id = v_obs.id;

  RETURN QUERY SELECT v_updates, v_fame;
END;
$$;

GRANT EXECUTE ON FUNCTION public.celeste_apply_observation(UUID, UUID) TO anon, authenticated;

SELECT 'UPDATE_MISSION_IGNORE_PASSIVE_HEURISTIC aplicado' AS status;
