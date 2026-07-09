-- =====================================================================
-- Cargo STAFF
-- =====================================================================
-- Adiciona o cargo 'staff' (entre officer e admin) com acesso ao painel
-- administrativo e às mesmas permissões de escrita dos oficiais/admins.
-- =====================================================================

-- 1) Atualiza a constraint de role
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('admin', 'staff', 'officer', 'member'));

-- 2) profiles: staff também pode gerenciar perfis (cargos/status)
DROP POLICY IF EXISTS "Admins can update any profile" ON public.profiles;
CREATE POLICY "Admins can update any profile"
  ON public.profiles FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'staff'))
  );

-- 3) guild_codes
DROP POLICY IF EXISTS "Only admins can manage codes" ON public.guild_codes;
CREATE POLICY "Only admins can manage codes"
  ON public.guild_codes FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'staff', 'officer'))
  );

-- 4) missions
DROP POLICY IF EXISTS "Officers can manage missions" ON public.missions;
CREATE POLICY "Officers can manage missions"
  ON public.missions FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'staff', 'officer'))
  );

-- 5) mission_participants
DROP POLICY IF EXISTS "Officers can view all participations" ON public.mission_participants;
CREATE POLICY "Officers can view all participations"
  ON public.mission_participants FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'staff', 'officer'))
  );

DROP POLICY IF EXISTS "Officers can update participations" ON public.mission_participants;
CREATE POLICY "Officers can update participations"
  ON public.mission_participants FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'staff', 'officer'))
  );

-- 6) points_ledger
DROP POLICY IF EXISTS "Officers can view all ledger entries" ON public.points_ledger;
CREATE POLICY "Officers can view all ledger entries"
  ON public.points_ledger FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'staff', 'officer'))
  );

-- 7) shop_items
DROP POLICY IF EXISTS "Officers can manage shop" ON public.shop_items;
CREATE POLICY "Officers can manage shop"
  ON public.shop_items FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'staff', 'officer'))
  );

-- 8) shop_purchases (oficiais gerenciam status) — recria se a policy existir
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'shop_purchases' AND policyname = 'Officers can manage purchases'
  ) THEN
    EXECUTE 'DROP POLICY "Officers can manage purchases" ON public.shop_purchases';
  END IF;
END $$;
CREATE POLICY "Officers can manage purchases"
  ON public.shop_purchases FOR ALL USING (
    profile_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'staff', 'officer'))
  );

-- 9) guild_announcements (se existir)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'guild_announcements') THEN
    IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'guild_announcements' AND policyname = 'Officers can manage announcements') THEN
      EXECUTE 'DROP POLICY "Officers can manage announcements" ON public.guild_announcements';
    END IF;
    EXECUTE 'CREATE POLICY "Officers can manage announcements" ON public.guild_announcements FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN (''admin'', ''staff'', ''officer'')))';
  END IF;
END $$;

-- 10) discord_content_events (se existir)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'discord_content_events') THEN
    IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'discord_content_events' AND policyname = 'Officers can manage content') THEN
      EXECUTE 'DROP POLICY "Officers can manage content" ON public.discord_content_events';
    END IF;
    EXECUTE 'CREATE POLICY "Officers can manage content" ON public.discord_content_events FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN (''admin'', ''staff'', ''officer'')))';
  END IF;
END $$;

SELECT 'UPDATE_STAFF_ROLE aplicado' AS status;
