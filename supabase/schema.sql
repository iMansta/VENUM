-- VENUM MARKET Database Schema
-- Run this in Supabase SQL Editor to create required tables

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

-- Transports Table
CREATE TABLE IF NOT EXISTS public.transports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  item_id TEXT NOT NULL,
  item_name TEXT,
  from_city TEXT NOT NULL,
  to_city TEXT NOT NULL,
  buy_price INTEGER NOT NULL,
  sell_price INTEGER NOT NULL,
  profit INTEGER NOT NULL,
  status TEXT DEFAULT 'available', -- available, reserved, completed
  reserved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reserved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
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
CREATE POLICY "Anyone can view available transports" ON public.transports FOR SELECT USING (status = 'available' OR reserved_by = auth.uid());
CREATE POLICY "Authenticated users can reserve transports" ON public.transports FOR UPDATE USING (
  auth.uid() IS NOT NULL AND status = 'available'
);
CREATE POLICY "Users can cancel their own reservations" ON public.transports FOR UPDATE USING (
  reserved_by = auth.uid()
);

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
) AS $$
BEGIN
  RETURN QUERY
  WITH weekly_points AS (
    SELECT 
      p.id as profile_id,
      p.username,
      p.full_name,
      COALESCE(SUM(CASE WHEN pl.amount > 0 THEN pl.amount ELSE 0 END), 0) as points_earned,
      COUNT(DISTINCT mp.id) as missions_completed
    FROM profiles p
    LEFT JOIN points_ledger pl ON p.id = pl.profile_id 
      AND pl.created_at >= NOW() - INTERVAL '7 days'
    LEFT JOIN mission_participants mp ON p.id = mp.profile_id
    WHERE p.is_active = true
    GROUP BY p.id, p.username, p.full_name
  )
  SELECT 
    profile_id,
    username,
    full_name,
    points_earned,
    missions_completed,
    RANK() OVER (ORDER BY points_earned DESC) as rank
  FROM weekly_points
  ORDER BY points_earned DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_monthly_ranking(p_limit INTEGER DEFAULT 10)
RETURNS TABLE (
  profile_id UUID,
  username TEXT,
  full_name TEXT,
  points_earned BIGINT,
  missions_completed INTEGER,
  rank INTEGER
) AS $$
BEGIN
  RETURN QUERY
  WITH monthly_points AS (
    SELECT 
      p.id as profile_id,
      p.username,
      p.full_name,
      COALESCE(SUM(CASE WHEN pl.amount > 0 THEN pl.amount ELSE 0 END), 0) as points_earned,
      COUNT(DISTINCT mp.id) as missions_completed
    FROM profiles p
    LEFT JOIN points_ledger pl ON p.id = pl.profile_id 
      AND pl.created_at >= NOW() - INTERVAL '30 days'
    LEFT JOIN mission_participants mp ON p.id = mp.profile_id
    WHERE p.is_active = true
    GROUP BY p.id, p.username, p.full_name
  )
  SELECT 
    profile_id,
    username,
    full_name,
    points_earned,
    missions_completed,
    RANK() OVER (ORDER BY points_earned DESC) as rank
  FROM monthly_points
  ORDER BY points_earned DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_user_ranking_position(p_profile_id UUID)
RETURNS TABLE (
  weekly_rank INTEGER,
  weekly_points BIGINT,
  monthly_rank INTEGER,
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
