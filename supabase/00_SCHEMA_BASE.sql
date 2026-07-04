-- =====================================================================
-- VENUM — PASSO 0: Schema base (OBRIGATÓRIO primeiro)
-- Guilda I V E N U M I
-- =====================================================================
-- Execute ESTE arquivo ANTES de UPDATE_PRODUCTION.sql e UPDATE_PHASE2.sql
-- Idempotente: seguro rodar mais de uma vez.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) profiles
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  role TEXT DEFAULT 'member' CHECK (role IN ('admin', 'officer', 'member')),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  total_points INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  albion_character_name TEXT,
  albion_player_id TEXT,
  guild_verified BOOLEAN DEFAULT false,
  last_guild_verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles(username);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_albion_name ON public.profiles (lower(albion_character_name));

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Public profiles are viewable by everyone"
  ON public.profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "Admins can update any profile" ON public.profiles;
CREATE POLICY "Admins can update any profile"
  ON public.profiles FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Colunas extras se profiles já existia sem elas
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS albion_character_name TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS albion_player_id TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS guild_verified BOOLEAN DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_guild_verified_at TIMESTAMPTZ;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- ---------------------------------------------------------------------
-- 2) guild_codes
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.guild_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  max_uses INTEGER DEFAULT 1,
  used_count INTEGER DEFAULT 0,
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT valid_code CHECK (used_count <= max_uses)
);

CREATE INDEX IF NOT EXISTS idx_guild_codes_code ON public.guild_codes(code);
CREATE INDEX IF NOT EXISTS idx_guild_codes_active ON public.guild_codes(is_active);

ALTER TABLE public.guild_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can validate codes" ON public.guild_codes;
CREATE POLICY "Anyone can validate codes"
  ON public.guild_codes FOR SELECT USING (true);

DROP POLICY IF EXISTS "Only admins can manage codes" ON public.guild_codes;
CREATE POLICY "Only admins can manage codes"
  ON public.guild_codes FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'officer'))
  );

-- ---------------------------------------------------------------------
-- 3) missions
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.missions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  mission_type TEXT NOT NULL CHECK (mission_type IN ('gathering', 'crafting', 'pve', 'pvp', 'trading', 'other')),
  target_item TEXT,
  min_fame_threshold INTEGER,
  target_quantity INTEGER NOT NULL,
  current_quantity INTEGER DEFAULT 0,
  points_reward INTEGER NOT NULL,
  start_date TIMESTAMPTZ DEFAULT NOW(),
  end_date TIMESTAMPTZ,
  status TEXT DEFAULT 'active' CHECK (status IN ('draft', 'active', 'completed', 'cancelled')),
  discord_notified BOOLEAN DEFAULT false,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.missions ADD COLUMN IF NOT EXISTS discord_notified BOOLEAN DEFAULT false;
ALTER TABLE public.missions ADD COLUMN IF NOT EXISTS min_fame_threshold INTEGER;

CREATE INDEX IF NOT EXISTS idx_missions_status ON public.missions(status);
CREATE INDEX IF NOT EXISTS idx_missions_type ON public.missions(mission_type);
CREATE INDEX IF NOT EXISTS idx_missions_dates ON public.missions(start_date, end_date);

ALTER TABLE public.missions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Active missions are viewable by members" ON public.missions;
CREATE POLICY "Active missions are viewable by members"
  ON public.missions FOR SELECT USING (status = 'active');

DROP POLICY IF EXISTS "Officers can manage missions" ON public.missions;
CREATE POLICY "Officers can manage missions"
  ON public.missions FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'officer'))
  );

-- ---------------------------------------------------------------------
-- 4) mission_participants
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.mission_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id UUID REFERENCES public.missions(id) ON DELETE CASCADE,
  profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  contribution_quantity INTEGER DEFAULT 0,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(mission_id, profile_id)
);

CREATE INDEX IF NOT EXISTS idx_participants_mission ON public.mission_participants(mission_id);
CREATE INDEX IF NOT EXISTS idx_participants_profile ON public.mission_participants(profile_id);

ALTER TABLE public.mission_participants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Participants can view their participations" ON public.mission_participants;
CREATE POLICY "Participants can view their participations"
  ON public.mission_participants FOR SELECT USING (profile_id = auth.uid());

DROP POLICY IF EXISTS "Officers can view all participations" ON public.mission_participants;
CREATE POLICY "Officers can view all participations"
  ON public.mission_participants FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'officer'))
  );

DROP POLICY IF EXISTS "Members can join missions" ON public.mission_participants;
CREATE POLICY "Members can join missions"
  ON public.mission_participants FOR INSERT WITH CHECK (
    profile_id = auth.uid() AND
    EXISTS (SELECT 1 FROM public.missions WHERE id = mission_id AND status = 'active')
  );

DROP POLICY IF EXISTS "Officers can update participations" ON public.mission_participants;
CREATE POLICY "Officers can update participations"
  ON public.mission_participants FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'officer'))
  );

-- ---------------------------------------------------------------------
-- 4.1) guild_metrics_snapshots
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.guild_metrics_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id TEXT NOT NULL,
  guild_name TEXT NOT NULL,
  member_count INTEGER,
  silver_amount BIGINT,
  season_points BIGINT,
  kill_fame BIGINT,
  death_fame BIGINT,
  total_fame BIGINT,
  source TEXT DEFAULT 'unknown',
  payload JSONB,
  collected_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_guild_metrics_snapshots_collected_at
  ON public.guild_metrics_snapshots(collected_at DESC);
CREATE INDEX IF NOT EXISTS idx_guild_metrics_snapshots_guild
  ON public.guild_metrics_snapshots(guild_id, collected_at DESC);

ALTER TABLE public.guild_metrics_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Guild metrics are viewable by members" ON public.guild_metrics_snapshots;
CREATE POLICY "Guild metrics are viewable by members"
  ON public.guild_metrics_snapshots FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "No direct writes guild metrics" ON public.guild_metrics_snapshots;
CREATE POLICY "No direct writes guild metrics"
  ON public.guild_metrics_snapshots FOR ALL USING (false) WITH CHECK (false);

-- ---------------------------------------------------------------------
-- 5) points_ledger
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.points_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  transaction_type TEXT CHECK (transaction_type IN ('earned', 'spent', 'adjusted')),
  reason TEXT NOT NULL,
  reference_id UUID,
  reference_type TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ledger_profile ON public.points_ledger(profile_id);
CREATE INDEX IF NOT EXISTS idx_ledger_type ON public.points_ledger(transaction_type);
CREATE INDEX IF NOT EXISTS idx_ledger_date ON public.points_ledger(created_at);

ALTER TABLE public.points_ledger ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own ledger" ON public.points_ledger;
CREATE POLICY "Users can view their own ledger"
  ON public.points_ledger FOR SELECT USING (profile_id = auth.uid());

DROP POLICY IF EXISTS "Officers can view all ledger entries" ON public.points_ledger;
CREATE POLICY "Officers can view all ledger entries"
  ON public.points_ledger FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'officer'))
  );

-- ---------------------------------------------------------------------
-- 6) shop_items + shop_purchases
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.shop_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  cost_points INTEGER NOT NULL,
  stock INTEGER DEFAULT -1,
  category TEXT DEFAULT 'general',
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.shop_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  shop_item_id UUID REFERENCES public.shop_items(id) ON DELETE SET NULL,
  points_spent INTEGER NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'delivered', 'cancelled')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.shop_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_purchases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Active shop items are viewable by members" ON public.shop_items;
CREATE POLICY "Active shop items are viewable by members"
  ON public.shop_items FOR SELECT USING (is_active = true);

DROP POLICY IF EXISTS "Officers can manage shop" ON public.shop_items;
CREATE POLICY "Officers can manage shop"
  ON public.shop_items FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'officer'))
  );

DROP POLICY IF EXISTS "Users can view their own purchases" ON public.shop_purchases;
CREATE POLICY "Users can view their own purchases"
  ON public.shop_purchases FOR SELECT USING (profile_id = auth.uid());

DROP POLICY IF EXISTS "Officers can view all purchases" ON public.shop_purchases;
CREATE POLICY "Officers can view all purchases"
  ON public.shop_purchases FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'officer'))
  );

DROP POLICY IF EXISTS "Users can create purchases" ON public.shop_purchases;
CREATE POLICY "Users can create purchases"
  ON public.shop_purchases FOR INSERT WITH CHECK (profile_id = auth.uid());

-- ---------------------------------------------------------------------
-- 7) Funções base
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_missions_updated_at ON public.missions;
CREATE TRIGGER update_missions_updated_at
  BEFORE UPDATE ON public.missions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_shop_items_updated_at ON public.shop_items;
CREATE TRIGGER update_shop_items_updated_at
  BEFORE UPDATE ON public.shop_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.award_points(
  p_profile_id UUID, p_amount INTEGER, p_reason TEXT,
  p_reference_id UUID DEFAULT NULL, p_reference_type TEXT DEFAULT NULL
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.points_ledger (profile_id, amount, transaction_type, reason, reference_id, reference_type)
  VALUES (p_profile_id, p_amount, 'earned', p_reason, p_reference_id, p_reference_type);
  UPDATE public.profiles SET total_points = total_points + p_amount, updated_at = NOW()
  WHERE id = p_profile_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.deduct_points(
  p_profile_id UUID, p_amount INTEGER, p_reason TEXT,
  p_reference_id UUID DEFAULT NULL, p_reference_type TEXT DEFAULT NULL
) RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE current_points INTEGER;
BEGIN
  SELECT total_points INTO current_points FROM public.profiles WHERE id = p_profile_id;
  IF current_points < p_amount THEN RETURN false; END IF;
  INSERT INTO public.points_ledger (profile_id, amount, transaction_type, reason, reference_id, reference_type)
  VALUES (p_profile_id, -p_amount, 'spent', p_reason, p_reference_id, p_reference_type);
  UPDATE public.profiles SET total_points = total_points - p_amount, updated_at = NOW()
  WHERE id = p_profile_id;
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_guild_code(p_code TEXT)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE code_record public.guild_codes%ROWTYPE;
BEGIN
  SELECT * INTO code_record FROM public.guild_codes
  WHERE code = UPPER(TRIM(p_code)) AND is_active = true
    AND (expires_at IS NULL OR expires_at > NOW());
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'message', 'Invalid or expired code');
  END IF;
  IF code_record.used_count >= code_record.max_uses THEN
    RETURN json_build_object('success', false, 'message', 'Code has been fully used');
  END IF;
  UPDATE public.guild_codes SET used_count = used_count + 1 WHERE id = code_record.id;
  IF code_record.used_count + 1 >= code_record.max_uses THEN
    UPDATE public.guild_codes SET is_active = false WHERE id = code_record.id;
  END IF;
  RETURN json_build_object('success', true, 'message', 'Code validated successfully');
END;
$$;

GRANT EXECUTE ON FUNCTION public.validate_guild_code TO authenticated, anon;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, full_name, avatar_url, albion_character_name, guild_verified, is_active)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url',
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    false,
    true
  )
  ON CONFLICT (id) DO UPDATE SET
    username = EXCLUDED.username,
    full_name = EXCLUDED.full_name,
    updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ---------------------------------------------------------------------
-- 8) Verificação
-- ---------------------------------------------------------------------
SELECT 'profiles' AS tabela, COUNT(*) AS registros FROM public.profiles
UNION ALL SELECT 'missions', COUNT(*) FROM public.missions
UNION ALL SELECT 'guild_codes', COUNT(*) FROM public.guild_codes;

-- Próximo passo: execute UPDATE_PRODUCTION.sql e depois UPDATE_PHASE2.sql
