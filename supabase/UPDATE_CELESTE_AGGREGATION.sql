-- =====================================================================
-- Celeste aggregation pipeline
-- Converte observações brutas em progresso de missão + fama + pontos
-- =====================================================================

ALTER TABLE public.celeste_observations
  ADD COLUMN IF NOT EXISTS profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS username TEXT,
  ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS aggregated_cycle UUID;

ALTER TABLE public.celeste_clients
  ADD COLUMN IF NOT EXISTS profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS username TEXT;

ALTER TABLE public.missions
  ADD COLUMN IF NOT EXISTS min_fame_threshold INTEGER;

CREATE INDEX IF NOT EXISTS idx_celeste_observations_unprocessed
  ON public.celeste_observations (processed_at)
  WHERE processed_at IS NULL;

CREATE TABLE IF NOT EXISTS public.mission_reward_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id UUID NOT NULL REFERENCES public.missions(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  awarded_points INTEGER NOT NULL DEFAULT 0,
  awarded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (mission_id, profile_id)
);

ALTER TABLE public.mission_reward_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "No direct access mission reward events" ON public.mission_reward_events;
CREATE POLICY "No direct access mission reward events"
  ON public.mission_reward_events FOR ALL USING (false);

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

  -- Atualização de fama por categoria
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
    ELSE NULL
  END;

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

CREATE OR REPLACE FUNCTION public.celeste_finalize_completed_missions()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_awarded INTEGER := 0;
  v_row RECORD;
BEGIN
  -- Regra: missão permanece ativa até prazo/admin. Recompensa é por participante
  -- quando ele atinge a meta individual (contribution_quantity >= target_quantity).
  FOR v_row IN
    SELECT
      mp.mission_id,
      mp.profile_id,
      m.points_reward
    FROM public.mission_participants mp
    INNER JOIN public.missions m ON m.id = mp.mission_id
    LEFT JOIN public.mission_reward_events mre
      ON mre.mission_id = mp.mission_id AND mre.profile_id = mp.profile_id
    WHERE m.status = 'active'
      AND (m.end_date IS NULL OR m.end_date > NOW())
      AND COALESCE(mp.contribution_quantity, 0) >= COALESCE(m.target_quantity, 0)
      AND COALESCE(m.target_quantity, 0) > 0
      AND COALESCE(m.points_reward, 0) > 0
      AND mre.id IS NULL
  LOOP
    PERFORM public.award_points(
      v_row.profile_id,
      v_row.points_reward,
      'Missão concluída via Celeste',
      v_row.mission_id,
      'mission'
    );

    INSERT INTO public.mission_reward_events (mission_id, profile_id, awarded_points)
    VALUES (v_row.mission_id, v_row.profile_id, v_row.points_reward)
    ON CONFLICT (mission_id, profile_id) DO NOTHING;
    v_awarded := v_awarded + 1;
  END LOOP;

  RETURN COALESCE(v_awarded, 0);
END;
$$;

CREATE OR REPLACE FUNCTION public.process_celeste_observations(p_limit INTEGER DEFAULT 500)
RETURNS TABLE (
  processed INTEGER,
  mission_updates INTEGER,
  fame_updates INTEGER,
  missions_completed INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cycle UUID := gen_random_uuid();
  v_id UUID;
  v_processed INTEGER := 0;
  v_mission_updates INTEGER := 0;
  v_fame_updates INTEGER := 0;
  v_completed INTEGER := 0;
  v_apply RECORD;
BEGIN
  FOR v_id IN
    SELECT id
    FROM public.celeste_observations
    WHERE processed_at IS NULL
    ORDER BY observed_at ASC
    LIMIT GREATEST(COALESCE(p_limit, 500), 1)
    FOR UPDATE SKIP LOCKED
  LOOP
    SELECT * INTO v_apply FROM public.celeste_apply_observation(v_id, v_cycle);
    v_processed := v_processed + 1;
    v_mission_updates := v_mission_updates + COALESCE(v_apply.mission_updates, 0);
    v_fame_updates := v_fame_updates + COALESCE(v_apply.fame_updates, 0);
  END LOOP;

  v_completed := public.celeste_finalize_completed_missions();

  RETURN QUERY
  SELECT v_processed, v_mission_updates, v_fame_updates, COALESCE(v_completed, 0);
END;
$$;

GRANT EXECUTE ON FUNCTION public.celeste_apply_observation(UUID, UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.celeste_finalize_completed_missions() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_celeste_observations(INTEGER) TO anon, authenticated;

SELECT 'UPDATE_CELESTE_AGGREGATION aplicado' AS status;
