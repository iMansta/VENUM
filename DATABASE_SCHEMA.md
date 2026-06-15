# VENUM MARKET - Supabase Database Schema

## Overview
Database schema for Guild Hub module including user profiles, missions, points system, and recruitment codes.

## Tables

### 1. profiles
Extended user profiles for guild members with roles and permissions.

```sql
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  role TEXT DEFAULT 'member' CHECK (role IN ('admin', 'officer', 'member')),
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  total_points INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Public profiles are viewable by everyone"
  ON profiles FOR SELECT
  USING (true);

CREATE POLICY "Users can insert their own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Admins can update any profile"
  ON profiles FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Indexes
CREATE INDEX idx_profiles_username ON profiles(username);
CREATE INDEX idx_profiles_role ON profiles(role);
```

### 2. guild_codes
Recruitment codes for guild access validation.

```sql
CREATE TABLE guild_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  max_uses INTEGER DEFAULT 1,
  used_count INTEGER DEFAULT 0,
  expires_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT valid_code CHECK (used_count <= max_uses)
);

ALTER TABLE guild_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can validate codes"
  ON guild_codes FOR SELECT
  USING (true);

CREATE POLICY "Only admins can manage codes"
  ON guild_codes FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'officer')
    )
  );

CREATE INDEX idx_guild_codes_code ON guild_codes(code);
CREATE INDEX idx_guild_codes_active ON guild_codes(is_active);
```

### 3. missions
Guild missions with objectives and targets.

```sql
CREATE TABLE missions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  mission_type TEXT NOT NULL CHECK (mission_type IN ('gathering', 'crafting', 'pvp', 'trading', 'other')),
  target_item TEXT,
  target_quantity INTEGER NOT NULL,
  current_quantity INTEGER DEFAULT 0,
  points_reward INTEGER NOT NULL,
  start_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  end_date TIMESTAMP WITH TIME ZONE,
  status TEXT DEFAULT 'active' CHECK (status IN ('draft', 'active', 'completed', 'cancelled')),
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE missions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Active missions are viewable by members"
  ON missions FOR SELECT
  USING (status = 'active');

CREATE POLICY "Officers can manage missions"
  ON missions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'officer')
    )
  );

CREATE INDEX idx_missions_status ON missions(status);
CREATE INDEX idx_missions_type ON missions(mission_type);
CREATE INDEX idx_missions_dates ON missions(start_date, end_date);
```

### 4. mission_participants
Track which members are participating in missions.

```sql
CREATE TABLE mission_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id UUID REFERENCES missions(id) ON DELETE CASCADE,
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  contribution_quantity INTEGER DEFAULT 0,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(mission_id, profile_id)
);

ALTER TABLE mission_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants can view their participations"
  ON mission_participants FOR SELECT
  USING (profile_id = auth.uid());

CREATE POLICY "Officers can view all participations"
  ON mission_participants FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'officer')
    )
  );

CREATE POLICY "Members can join missions"
  ON mission_participants FOR INSERT
  WITH CHECK (
    profile_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM missions
      WHERE id = mission_id AND status = 'active'
    )
  );

CREATE POLICY "Officers can update participations"
  ON mission_participants FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'officer')
    )
  );

CREATE INDEX idx_participants_mission ON mission_participants(mission_id);
CREATE INDEX idx_participants_profile ON mission_participants(profile_id);
```

### 5. points_ledger
Complete transaction history of points for audit trail.

```sql
CREATE TABLE points_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('earned', 'spent', 'adjusted')),
  reason TEXT NOT NULL,
  reference_id UUID, -- Can reference mission_id, shop_item_id, etc.
  reference_type TEXT,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE points_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own ledger"
  ON points_ledger FOR SELECT
  USING (profile_id = auth.uid());

CREATE POLICY "Officers can view all ledger entries"
  ON points_ledger FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'officer')
    )
  );

CREATE POLICY "Only system can create ledger entries"
  ON points_ledger FOR INSERT
  WITH CHECK (false); -- Only via database functions

CREATE INDEX idx_ledger_profile ON points_ledger(profile_id);
CREATE INDEX idx_ledger_type ON points_ledger(transaction_type);
CREATE INDEX idx_ledger_date ON points_ledger(created_at);
```

### 6. shop_items
Rewards available in the guild shop.

```sql
CREATE TABLE shop_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  cost_points INTEGER NOT NULL,
  stock INTEGER DEFAULT -1, -- -1 means unlimited
  category TEXT DEFAULT 'general',
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE shop_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Active shop items are viewable by members"
  ON shop_items FOR SELECT
  USING (is_active = true);

CREATE POLICY "Officers can manage shop"
  ON shop_items FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'officer')
    )
  );

CREATE INDEX idx_shop_items_active ON shop_items(is_active);
CREATE INDEX idx_shop_items_category ON shop_items(category);
```

### 7. shop_purchases
Record of shop purchases.

```sql
CREATE TABLE shop_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  shop_item_id UUID REFERENCES shop_items(id) ON DELETE SET NULL,
  points_spent INTEGER NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'delivered', 'cancelled')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE shop_purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own purchases"
  ON shop_purchases FOR SELECT
  USING (profile_id = auth.uid());

CREATE POLICY "Officers can view all purchases"
  ON shop_purchases FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'officer')
    )
  );

CREATE POLICY "Users can create purchases"
  ON shop_purchases FOR INSERT
  WITH CHECK (
    profile_id = auth.uid()
  );

CREATE INDEX idx_purchases_profile ON shop_purchases(profile_id);
CREATE INDEX idx_purchases_status ON shop_purchases(status);
```

## Database Functions

### Function: Award Points
Automatically awards points and updates profile total.

```sql
CREATE OR REPLACE FUNCTION award_points(
  p_profile_id UUID,
  p_amount INTEGER,
  p_reason TEXT,
  p_reference_id UUID DEFAULT NULL,
  p_reference_type TEXT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  -- Insert ledger entry
  INSERT INTO points_ledger (profile_id, amount, transaction_type, reason, reference_id, reference_type)
  VALUES (p_profile_id, p_amount, 'earned', p_reason, p_reference_id, p_reference_type);
  
  -- Update profile total
  UPDATE profiles
  SET total_points = total_points + p_amount,
      updated_at = NOW()
  WHERE id = p_profile_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Function: Deduct Points
Deducts points for shop purchases.

```sql
CREATE OR REPLACE FUNCTION deduct_points(
  p_profile_id UUID,
  p_amount INTEGER,
  p_reason TEXT,
  p_reference_id UUID DEFAULT NULL,
  p_reference_type TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  current_points INTEGER;
BEGIN
  -- Get current points
  SELECT total_points INTO current_points
  FROM profiles
  WHERE id = p_profile_id;
  
  -- Check if user has enough points
  IF current_points < p_amount THEN
    RETURN false;
  END IF;
  
  -- Insert ledger entry
  INSERT INTO points_ledger (profile_id, amount, transaction_type, reason, reference_id, reference_type)
  VALUES (p_profile_id, -p_amount, 'spent', p_reason, p_reference_id, p_reference_type);
  
  -- Update profile total
  UPDATE profiles
  SET total_points = total_points - p_amount,
      updated_at = NOW()
  WHERE id = p_profile_id;
  
  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Function: Validate Guild Code
Validates and consumes a recruitment code.

```sql
CREATE OR REPLACE FUNCTION validate_guild_code(p_code TEXT)
RETURNS JSON AS $$
DECLARE
  code_record guild_codes%ROWTYPE;
BEGIN
  -- Find active code
  SELECT * INTO code_record
  FROM guild_codes
  WHERE code = p_code
    AND is_active = true
    AND (expires_at IS NULL OR expires_at > NOW());
  
  -- Check if code exists
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'message', 'Invalid or expired code');
  END IF;
  
  -- Check if code has uses remaining
  IF code_record.used_count >= code_record.max_uses THEN
    RETURN json_build_object('success', false, 'message', 'Code has been fully used');
  END IF;
  
  -- Increment usage
  UPDATE guild_codes
  SET used_count = used_count + 1
  WHERE id = code_record.id;
  
  -- Deactivate if max uses reached
  IF code_record.used_count + 1 >= code_record.max_uses THEN
    UPDATE guild_codes
    SET is_active = false
    WHERE id = code_record.id;
  END IF;
  
  RETURN json_build_object('success', true, 'message', 'Code validated successfully');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

## Triggers

### Update Timestamp Trigger
Automatically update updated_at columns.

```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to relevant tables
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_missions_updated_at BEFORE UPDATE ON missions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_shop_items_updated_at BEFORE UPDATE ON shop_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_shop_purchases_updated_at BEFORE UPDATE ON shop_purchases
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

### Profile Creation Trigger
Automatically create profile when user signs up.

```sql
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, username, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
```

### Function: Get Weekly Ranking
Returns ranking of users based on points earned in the current week.

```sql
CREATE OR REPLACE FUNCTION get_weekly_ranking(p_limit INTEGER DEFAULT 10)
RETURNS TABLE (
  rank INTEGER,
  profile_id UUID,
  username TEXT,
  full_name TEXT,
  points_earned INTEGER,
  missions_completed INTEGER
) AS $$
BEGIN
  RETURN QUERY
  WITH weekly_points AS (
    SELECT 
      pl.profile_id,
      COALESCE(SUM(pl.amount), 0) as points_earned,
      COUNT(DISTINCT pl.reference_id) FILTER (WHERE pl.reference_type = 'mission') as missions_completed
    FROM points_ledger pl
    WHERE pl.created_at >= date_trunc('week', NOW())
      AND pl.amount > 0
    GROUP BY pl.profile_id
  ),
  ranked_users AS (
    SELECT 
      wp.*,
      ROW_NUMBER() OVER (ORDER BY wp.points_earned DESC) as rank
    FROM weekly_points wp
  )
  SELECT 
    ru.rank,
    ru.profile_id,
    p.username,
    p.full_name,
    ru.points_earned,
    ru.missions_completed
  FROM ranked_users ru
  JOIN profiles p ON ru.profile_id = p.id
  WHERE p.is_active = true
  ORDER BY ru.points_earned DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Function: Get Monthly Ranking
Returns ranking of users based on points earned in the current month.

```sql
CREATE OR REPLACE FUNCTION get_monthly_ranking(p_limit INTEGER DEFAULT 10)
RETURNS TABLE (
  rank INTEGER,
  profile_id UUID,
  username TEXT,
  full_name TEXT,
  points_earned INTEGER,
  missions_completed INTEGER
) AS $$
BEGIN
  RETURN QUERY
  WITH monthly_points AS (
    SELECT 
      pl.profile_id,
      COALESCE(SUM(pl.amount), 0) as points_earned,
      COUNT(DISTINCT pl.reference_id) FILTER (WHERE pl.reference_type = 'mission') as missions_completed
    FROM points_ledger pl
    WHERE pl.created_at >= date_trunc('month', NOW())
      AND pl.amount > 0
    GROUP BY pl.profile_id
  ),
  ranked_users AS (
    SELECT 
      mp.*,
      ROW_NUMBER() OVER (ORDER BY mp.points_earned DESC) as rank
    FROM monthly_points mp
  )
  SELECT 
    ru.rank,
    ru.profile_id,
    p.username,
    p.full_name,
    ru.points_earned,
    ru.missions_completed
  FROM ranked_users ru
  JOIN profiles p ON ru.profile_id = p.id
  WHERE p.is_active = true
  ORDER BY ru.points_earned DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Function: Get User Ranking Position
Returns a user's position in weekly and monthly rankings.

```sql
CREATE OR REPLACE FUNCTION get_user_ranking_position(p_profile_id UUID)
RETURNS JSON AS $$
DECLARE
  weekly_rank INTEGER;
  monthly_rank INTEGER;
  weekly_points INTEGER;
  monthly_points INTEGER;
BEGIN
  -- Get weekly rank
  SELECT rank, points_earned INTO weekly_rank, weekly_points
  FROM (
    SELECT 
      ROW_NUMBER() OVER (ORDER BY COALESCE(SUM(amount), 0) DESC) as rank,
      COALESCE(SUM(amount), 0) as points_earned
    FROM points_ledger
    WHERE created_at >= date_trunc('week', NOW())
      AND amount > 0
    GROUP BY profile_id
  ) ranked
  WHERE profile_id = p_profile_id;
  
  -- Get monthly rank
  SELECT rank, points_earned INTO monthly_rank, monthly_points
  FROM (
    SELECT 
      ROW_NUMBER() OVER (ORDER BY COALESCE(SUM(amount), 0) DESC) as rank,
      COALESCE(SUM(amount), 0) as points_earned
    FROM points_ledger
    WHERE created_at >= date_trunc('month', NOW())
      AND amount > 0
    GROUP BY profile_id
  ) ranked
  WHERE profile_id = p_profile_id;
  
  RETURN json_build_object(
    'weekly_rank', weekly_rank,
    'weekly_points', COALESCE(weekly_points, 0),
    'monthly_rank', monthly_rank,
    'monthly_points', COALESCE(monthly_points, 0)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```
