-- VENUM MARKET Database Schema
-- Run this in Supabase SQL Editor to create required tables

-- Profiles Table
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT NOT NULL UNIQUE,
  full_name TEXT,
  role TEXT DEFAULT 'member' CHECK (role IN ('admin', 'officer', 'member')),
  is_active BOOLEAN DEFAULT true,
  total_points INTEGER DEFAULT 0,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  avatar_url TEXT
);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policies for Profiles
CREATE POLICY "Users can view all profiles" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (id = auth.uid());
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (id = auth.uid());

-- Missions Table
CREATE TABLE IF NOT EXISTS public.missions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  mission_type TEXT NOT NULL DEFAULT 'other', -- gathering, crafting, pvp, trading, other
  target_item TEXT,
  target_quantity INTEGER DEFAULT 0,
  current_quantity INTEGER DEFAULT 0,
  points_reward INTEGER DEFAULT 0,
  start_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  end_date TIMESTAMP WITH TIME ZONE,
  status TEXT DEFAULT 'active', -- active, completed, cancelled
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on missions
ALTER TABLE public.missions ENABLE ROW LEVEL SECURITY;

-- Mission Participants Table
CREATE TABLE IF NOT EXISTS public.mission_participants (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  mission_id UUID REFERENCES public.missions(id) ON DELETE CASCADE,
  profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  contribution_quantity INTEGER DEFAULT 0,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(mission_id, profile_id)
);

-- Enable RLS on mission_participants
ALTER TABLE public.mission_participants ENABLE ROW LEVEL SECURITY;

-- RLS Policies for Mission Participants
CREATE POLICY "Users can view mission participants" ON public.mission_participants FOR SELECT USING (true);
CREATE POLICY "Users can insert own participation" ON public.mission_participants FOR INSERT WITH CHECK (profile_id = auth.uid());
CREATE POLICY "Users can delete own participation" ON public.mission_participants FOR DELETE USING (profile_id = auth.uid());
CREATE POLICY "Admins and officers can manage all participants" ON public.mission_participants FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role IN ('admin', 'officer')
  )
);

-- Transports Table
CREATE TABLE IF NOT EXISTS public.transports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  item_id TEXT NOT NULL,
  item_name TEXT,
  from_city TEXT NOT NULL,
  to_city TEXT NOT NULL,
  buy_price NUMERIC DEFAULT 0,
  sell_price NUMERIC DEFAULT 0,
  profit NUMERIC DEFAULT 0,
  expected_profit NUMERIC DEFAULT 0,
  quantity INTEGER DEFAULT 1,
  status TEXT DEFAULT 'available' CHECK (status IN ('available', 'reserved', 'completed', 'cancelled')),
  reserved_by UUID REFERENCES auth.users(id),
  reserved_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  checklist_data JSONB
);

-- Enable RLS on transports
ALTER TABLE public.transports ENABLE ROW LEVEL SECURITY;

-- Guild Codes Table
CREATE TABLE IF NOT EXISTS public.guild_codes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  max_uses INTEGER DEFAULT 1,
  used_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on guild_codes
ALTER TABLE public.guild_codes ENABLE ROW LEVEL SECURITY;

-- RLS Policies for Missions
CREATE POLICY "Anyone can view missions" ON public.missions FOR SELECT USING (true);
CREATE POLICY "Admins and officers can insert missions" ON public.missions FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role IN ('admin', 'officer')
  )
);
CREATE POLICY "Admins and officers can update missions" ON public.missions FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role IN ('admin', 'officer')
  )
);
CREATE POLICY "Admins can delete missions" ON public.missions FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- RLS Policies for Mission Participants
CREATE POLICY "Anyone can view mission participants" ON public.mission_participants FOR SELECT USING (true);
CREATE POLICY "Authenticated users can join missions" ON public.mission_participants FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Users can update their own participation" ON public.mission_participants FOR UPDATE USING (profile_id = auth.uid());

-- RLS Policies for Transports
CREATE POLICY "Transports are viewable by authenticated users" ON public.transports FOR SELECT TO authenticated USING (true);
CREATE POLICY "Transports can be updated by authenticated users" ON public.transports FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Transports can be inserted by authenticated users" ON public.transports FOR INSERT TO authenticated WITH CHECK (true);

-- RLS Policies for Guild Codes
CREATE POLICY "Anyone can view active codes" ON public.guild_codes FOR SELECT USING (is_active = true OR created_by = auth.uid());
CREATE POLICY "Admins and officers can create codes" ON public.guild_codes FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role IN ('admin', 'officer')
  )
);
CREATE POLICY "Admins and officers can update codes" ON public.guild_codes FOR UPDATE USING (
  created_by = auth.uid() OR EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role IN ('admin', 'officer')
  )
);
CREATE POLICY "Admins can delete codes" ON public.guild_codes FOR DELETE USING (
  created_by = auth.uid() OR EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_missions_status ON public.missions(status);
CREATE INDEX IF NOT EXISTS idx_missions_type ON public.missions(mission_type);
CREATE INDEX IF NOT EXISTS idx_transports_status ON public.transports(status);
CREATE INDEX IF NOT EXISTS idx_transports_reserved ON public.transports(reserved_by);
CREATE INDEX IF NOT EXISTS idx_guild_codes_active ON public.guild_codes(is_active);
CREATE INDEX IF NOT EXISTS idx_guild_codes_code ON public.guild_codes(code);

-- Functions for ranking (if needed)
CREATE OR REPLACE FUNCTION get_weekly_ranking(p_limit INTEGER DEFAULT 10)
RETURNS TABLE (
  profile_id UUID,
  username TEXT,
  full_name TEXT,
  points_earned BIGINT,
  missions_completed INTEGER,
  rank INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH weekly AS (
    SELECT
      p.id AS profile_id,
      p.username,
      p.full_name,
      COALESCE(SUM(CASE WHEN pl.amount > 0 THEN pl.amount ELSE 0 END), 0)::BIGINT AS points_earned,
      COALESCE(COUNT(DISTINCT mp.id), 0)::INTEGER AS missions_completed
    FROM public.profiles p
    LEFT JOIN public.points_ledger pl
      ON pl.profile_id = p.id
      AND pl.created_at >= NOW() - INTERVAL '7 days'
    LEFT JOIN public.mission_participants mp
      ON mp.profile_id = p.id
    WHERE p.is_active = true
    GROUP BY p.id, p.username, p.full_name
  )
  SELECT
    w.profile_id,
    w.username,
    w.full_name,
    w.points_earned,
    w.missions_completed,
    RANK() OVER (ORDER BY w.points_earned DESC)::INTEGER AS rank
  FROM weekly w
  ORDER BY w.points_earned DESC
  LIMIT p_limit;
END;
$$;

CREATE OR REPLACE FUNCTION get_monthly_ranking(p_limit INTEGER DEFAULT 10)
RETURNS TABLE (
  profile_id UUID,
  username TEXT,
  full_name TEXT,
  points_earned BIGINT,
  missions_completed INTEGER,
  rank INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH monthly AS (
    SELECT
      p.id AS profile_id,
      p.username,
      p.full_name,
      COALESCE(SUM(CASE WHEN pl.amount > 0 THEN pl.amount ELSE 0 END), 0)::BIGINT AS points_earned,
      COALESCE(COUNT(DISTINCT mp.id), 0)::INTEGER AS missions_completed
    FROM public.profiles p
    LEFT JOIN public.points_ledger pl
      ON pl.profile_id = p.id
      AND pl.created_at >= NOW() - INTERVAL '30 days'
    LEFT JOIN public.mission_participants mp
      ON mp.profile_id = p.id
    WHERE p.is_active = true
    GROUP BY p.id, p.username, p.full_name
  )
  SELECT
    m.profile_id,
    m.username,
    m.full_name,
    m.points_earned,
    m.missions_completed,
    RANK() OVER (ORDER BY m.points_earned DESC)::INTEGER AS rank
  FROM monthly m
  ORDER BY m.points_earned DESC
  LIMIT p_limit;
END;
$$;

CREATE OR REPLACE FUNCTION get_user_ranking_position(p_profile_id UUID)
RETURNS TABLE (
  weekly_rank BIGINT,
  weekly_points BIGINT,
  monthly_rank BIGINT,
  monthly_points BIGINT
) AS $$
BEGIN
  RETURN QUERY
  WITH weekly_data AS (
    SELECT 
      RANK() OVER (ORDER BY points_earned DESC) as weekly_rank,
      points_earned as weekly_points
    FROM (
      SELECT 
        p.id,
        COALESCE(SUM(CASE WHEN pl.amount > 0 THEN pl.amount ELSE 0 END), 0) as points_earned
      FROM profiles p
      LEFT JOIN points_ledger pl ON p.id = pl.profile_id 
        AND pl.created_at >= NOW() - INTERVAL '7 days'
      WHERE p.is_active = true
      GROUP BY p.id
    ) ranked
    WHERE id = p_profile_id
  ),
  monthly_data AS (
    SELECT 
      RANK() OVER (ORDER BY points_earned DESC) as monthly_rank,
      points_earned as monthly_points
    FROM (
      SELECT 
        p.id,
        COALESCE(SUM(CASE WHEN pl.amount > 0 THEN pl.amount ELSE 0 END), 0) as points_earned
      FROM profiles p
      LEFT JOIN points_ledger pl ON p.id = pl.profile_id 
        AND pl.created_at >= NOW() - INTERVAL '30 days'
      WHERE p.is_active = true
      GROUP BY p.id
    ) ranked
    WHERE id = p_profile_id
  )
  SELECT 
    wd.weekly_rank,
    wd.weekly_points,
    md.monthly_rank,
    md.monthly_points
  FROM weekly_data wd
  CROSS JOIN monthly_data md;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Award Points Function
CREATE OR REPLACE FUNCTION public.award_points(
  p_profile_id UUID,
  p_amount INTEGER,
  p_reason TEXT,
  p_reference_id UUID DEFAULT NULL,
  p_reference_type TEXT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  -- Insert into ledger
  INSERT INTO public.points_ledger (profile_id, amount, transaction_type, reason, reference_id, reference_type)
  VALUES (p_profile_id, p_amount, 'earned', p_reason, p_reference_id, p_reference_type);

  -- Update total points in profile
  UPDATE public.profiles
  SET total_points = total_points + p_amount, updated_at = NOW()
  WHERE id = p_profile_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Deduct Points Function
CREATE OR REPLACE FUNCTION public.deduct_points(
  p_profile_id UUID,
  p_amount INTEGER,
  p_reason TEXT,
  p_reference_id UUID DEFAULT NULL,
  p_reference_type TEXT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  -- Insert into ledger (negative value)
  INSERT INTO public.points_ledger (profile_id, amount, transaction_type, reason, reference_id, reference_type)
  VALUES (p_profile_id, -p_amount, 'spent', p_reason, p_reference_id, p_reference_type);

  -- Update total points in profile
  UPDATE public.profiles
  SET total_points = GREATEST(total_points - p_amount, 0), updated_at = NOW()
  WHERE id = p_profile_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Validate Guild Code Function
CREATE OR REPLACE FUNCTION public.validate_guild_code(p_code TEXT)
RETURNS JSON AS $$
DECLARE
  v_code RECORD;
BEGIN
  SELECT * INTO v_code FROM public.guild_codes
  WHERE code = p_code AND is_active = true;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'message', 'Código não encontrado ou inativo');
  END IF;

  IF v_code.max_uses > 0 AND v_code.used_count >= v_code.max_uses THEN
    RETURN json_build_object('success', false, 'message', 'Código atingiu o limite de usos');
  END IF;

  -- Increment usage count
  UPDATE public.guild_codes SET used_count = used_count + 1 WHERE id = v_code.id;

  RETURN json_build_object('success', true, 'message', 'Código válido');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Reserve Transport Function with Transaction
CREATE OR REPLACE FUNCTION public.reserve_transport(
  p_item_id TEXT,
  p_item_name TEXT,
  p_from_city TEXT,
  p_to_city TEXT,
  p_buy_price NUMERIC,
  p_sell_price NUMERIC,
  p_profit NUMERIC,
  p_expected_profit NUMERIC,
  p_quantity INTEGER,
  p_reserved_by UUID,
  p_expires_at TIMESTAMPTZ,
  p_checklist_data JSONB
)
RETURNS JSON AS $$
DECLARE
  v_transport_id UUID;
BEGIN
  -- Check if item is already reserved (concurrency check)
  IF EXISTS (
    SELECT 1 FROM public.transports
    WHERE item_id = p_item_id
    AND from_city = p_from_city
    AND to_city = p_to_city
    AND status = 'reserved'
    AND expires_at > NOW()
  ) THEN
    RETURN json_build_object('success', false, 'message', 'Esta rota já está reservada por outro jogador');
  END IF;

  -- Insert new transport with reserved status
  INSERT INTO public.transports (
    item_id,
    item_name,
    from_city,
    to_city,
    buy_price,
    sell_price,
    profit,
    expected_profit,
    quantity,
    status,
    reserved_by,
    reserved_at,
    expires_at,
    created_by,
    checklist_data
  )
  VALUES (
    p_item_id,
    p_item_name,
    p_from_city,
    p_to_city,
    p_buy_price,
    p_sell_price,
    p_profit,
    p_expected_profit,
    p_quantity,
    'reserved',
    p_reserved_by,
    NOW(),
    p_expires_at,
    p_reserved_by,
    p_checklist_data
  )
  RETURNING id INTO v_transport_id;

  RETURN json_build_object('success', true, 'transport_id', v_transport_id, 'message', 'Rota reservada com sucesso');
EXCEPTION
  WHEN unique_violation THEN
    RETURN json_build_object('success', false, 'message', 'Esta rota acabou de ser assumida por outro jogador');
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'message', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Points Ledger Table
CREATE TABLE IF NOT EXISTS public.points_ledger (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  transaction_type TEXT NOT NULL, -- 'earned', 'spent', 'adjusted'
  reason TEXT,
  reference_id UUID,
  reference_type TEXT, -- 'mission', 'transport', 'manual', etc
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on points_ledger
ALTER TABLE public.points_ledger ENABLE ROW LEVEL SECURITY;

-- RLS Policies for Points Ledger
CREATE POLICY "Users can view own ledger" ON public.points_ledger FOR SELECT USING (profile_id = auth.uid());
CREATE POLICY "Admins and officers can view all ledger" ON public.points_ledger FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role IN ('admin', 'officer')
  )
);
CREATE POLICY "System can insert ledger entries" ON public.points_ledger FOR INSERT WITH CHECK (true);
CREATE POLICY "Admin/Officer can insert points"
ON public.points_ledger
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role = ANY (ARRAY['admin'::text, 'officer'::text])
  )
);
CREATE POLICY "Admin/Officer can update points"
ON public.points_ledger
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role = ANY (ARRAY['admin'::text, 'officer'::text])
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role = ANY (ARRAY['admin'::text, 'officer'::text])
  )
);

GRANT INSERT ON public.points_ledger TO authenticated;

-- Trigger para preencher transaction_type automaticamente (earned/spent)
CREATE OR REPLACE FUNCTION public.points_ledger_set_transaction_type()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.transaction_type IS NULL THEN
    NEW.transaction_type := CASE WHEN NEW.amount >= 0 THEN 'earned' ELSE 'spent' END;
  END IF;

  NEW.transaction_type := lower(NEW.transaction_type);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_points_ledger_set_transaction_type ON public.points_ledger;

CREATE TRIGGER trg_points_ledger_set_transaction_type
BEFORE INSERT ON public.points_ledger
FOR EACH ROW
EXECUTE FUNCTION public.points_ledger_set_transaction_type();

-- Market Prices Cache Table
CREATE TABLE IF NOT EXISTS public.market_prices_cache (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  item_id TEXT NOT NULL UNIQUE,
  price_data JSONB NOT NULL,
  cached_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '15 minutes'
);

-- Enable RLS on market_prices_cache
ALTER TABLE public.market_prices_cache ENABLE ROW LEVEL SECURITY;

-- RLS Policies for Market Prices Cache
DROP POLICY IF EXISTS "Anyone can view market prices cache" ON public.market_prices_cache;
CREATE POLICY "Anyone can view market prices cache" ON public.market_prices_cache FOR SELECT USING (true);

DROP POLICY IF EXISTS "System can insert market prices cache" ON public.market_prices_cache;
CREATE POLICY "System can insert market prices cache" ON public.market_prices_cache FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "System can update market prices cache" ON public.market_prices_cache;
CREATE POLICY "System can update market prices cache" ON public.market_prices_cache FOR UPDATE WITH CHECK (true);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_market_prices_cache_item_id ON public.market_prices_cache(item_id);
CREATE INDEX IF NOT EXISTS idx_market_prices_cache_expires_at ON public.market_prices_cache(expires_at);

-- Function to get cached market prices
CREATE OR REPLACE FUNCTION public.get_cached_market_prices(p_item_ids TEXT[])
RETURNS TABLE (
  item_id TEXT,
  price_data JSONB,
  cached_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    mpc.item_id,
    mpc.price_data,
    mpc.cached_at,
    mpc.expires_at
  FROM public.market_prices_cache mpc
  WHERE mpc.item_id = ANY(p_item_ids)
    AND mpc.expires_at > NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute on get_cached_market_prices
GRANT EXECUTE ON FUNCTION public.get_cached_market_prices TO authenticated;

-- Function to set cached market prices
CREATE OR REPLACE FUNCTION public.set_cached_market_prices(p_item_id TEXT, p_price_data JSONB)
RETURNS VOID AS $$
BEGIN
  INSERT INTO public.market_prices_cache (item_id, price_data, cached_at, expires_at)
  VALUES (p_item_id, p_price_data, NOW(), NOW() + INTERVAL '15 minutes')
  ON CONFLICT (item_id) DO UPDATE
  SET 
    price_data = EXCLUDED.price_data,
    cached_at = NOW(),
    expires_at = NOW() + INTERVAL '15 minutes';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute on set_cached_market_prices
GRANT EXECUTE ON FUNCTION public.set_cached_market_prices TO authenticated;

-- Function to clear expired cache entries
CREATE OR REPLACE FUNCTION public.clear_expired_market_cache()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.market_prices_cache
  WHERE expires_at <= NOW();
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute on clear_expired_market_cache
GRANT EXECUTE ON FUNCTION public.clear_expired_market_cache TO authenticated;

-- Migration Script to ensure missions table has all required columns
-- Run this in Supabase SQL Editor if you encounter schema cache errors

DO $$
BEGIN
  -- Check if mission_type column exists, if not add it
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'missions' 
    AND column_name = 'mission_type'
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.missions ADD COLUMN mission_type TEXT NOT NULL DEFAULT 'other';
    RAISE NOTICE 'Added mission_type column to missions table';
  END IF;

  -- Check if other required columns exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'missions' 
    AND column_name = 'target_item'
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.missions ADD COLUMN target_item TEXT;
    RAISE NOTICE 'Added target_item column to missions table';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'missions' 
    AND column_name = 'target_quantity'
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.missions ADD COLUMN target_quantity INTEGER DEFAULT 0;
    RAISE NOTICE 'Added target_quantity column to missions table';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'missions' 
    AND column_name = 'current_quantity'
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.missions ADD COLUMN current_quantity INTEGER DEFAULT 0;
    RAISE NOTICE 'Added current_quantity column to missions table';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'missions' 
    AND column_name = 'points_reward'
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.missions ADD COLUMN points_reward INTEGER DEFAULT 0;
    RAISE NOTICE 'Added points_reward column to missions table';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'missions' 
    AND column_name = 'start_date'
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.missions ADD COLUMN start_date TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    RAISE NOTICE 'Added start_date column to missions table';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'missions' 
    AND column_name = 'end_date'
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.missions ADD COLUMN end_date TIMESTAMP WITH TIME ZONE;
    RAISE NOTICE 'Added end_date column to missions table';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'missions' 
    AND column_name = 'status'
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.missions ADD COLUMN status TEXT DEFAULT 'active';
    RAISE NOTICE 'Added status column to missions table';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'missions' 
    AND column_name = 'created_by'
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.missions ADD COLUMN created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
    RAISE NOTICE 'Added created_by column to missions table';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'missions' 
    AND column_name = 'created_at'
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.missions ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    RAISE NOTICE 'Added created_at column to missions table';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'missions' 
    AND column_name = 'updated_at'
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.missions ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    RAISE NOTICE 'Added updated_at column to missions table';
  END IF;

  RAISE NOTICE 'Migration completed successfully';
END $$;

-- Migration Script to ensure transports table has all required columns
-- Run this in Supabase SQL Editor if you encounter schema cache errors

DO $$
BEGIN
  -- Check if quantity column exists, if not add it
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'transports' 
    AND column_name = 'quantity'
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.transports ADD COLUMN quantity INTEGER DEFAULT 1;
    RAISE NOTICE 'Added quantity column to transports table';
  END IF;

  -- Check if status column exists, if not add it
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'transports' 
    AND column_name = 'status'
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.transports ADD COLUMN status TEXT DEFAULT 'available' CHECK (status IN ('available', 'reserved', 'completed', 'cancelled'));
    RAISE NOTICE 'Added status column to transports table';
  END IF;

  -- Check if reserved_by column exists, if not add it
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'transports' 
    AND column_name = 'reserved_by'
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.transports ADD COLUMN reserved_by UUID REFERENCES auth.users(id);
    RAISE NOTICE 'Added reserved_by column to transports table';
  END IF;

  -- Check if reserved_at column exists, if not add it
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'transports' 
    AND column_name = 'reserved_at'
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.transports ADD COLUMN reserved_at TIMESTAMPTZ;
    RAISE NOTICE 'Added reserved_at column to transports table';
  END IF;

  -- Check if created_by column exists, if not add it
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'transports' 
    AND column_name = 'created_by'
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.transports ADD COLUMN created_by UUID REFERENCES auth.users(id);
    RAISE NOTICE 'Added created_by column to transports table';
  END IF;

  -- Check if created_at column exists, if not add it
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'transports' 
    AND column_name = 'created_at'
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.transports ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW();
    RAISE NOTICE 'Added created_at column to transports table';
  END IF;

  -- Check if expected_profit column exists, if not add it
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'transports' 
    AND column_name = 'expected_profit'
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.transports ADD COLUMN expected_profit NUMERIC DEFAULT 0;
    RAISE NOTICE 'Added expected_profit column to transports table';
  END IF;

  -- Check if expires_at column exists, if not add it
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'transports' 
    AND column_name = 'expires_at'
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.transports ADD COLUMN expires_at TIMESTAMPTZ;
    RAISE NOTICE 'Added expires_at column to transports table';
  END IF;

  -- Check if checklist_data column exists, if not add it
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'transports' 
    AND column_name = 'checklist_data'
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.transports ADD COLUMN checklist_data JSONB;
    RAISE NOTICE 'Added checklist_data column to transports table';
  END IF;

  RAISE NOTICE 'Transports table migration completed successfully';
END $$;
