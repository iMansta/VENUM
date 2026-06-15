-- VENUM MARKET - Update RLS Policies for Admin Management
-- This script updates Row Level Security policies to allow admin users to manage guild codes and users

-- Drop existing policies that might conflict
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can delete profiles" ON profiles;

-- Create new RLS policies for profiles table
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles" ON profiles
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Admins can update all profiles" ON profiles
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can delete profiles" ON profiles
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Drop existing policies for guild_codes table
DROP POLICY IF EXISTS "Users can view guild codes" ON guild_codes;
DROP POLICY IF EXISTS "Admins can manage guild codes" ON guild_codes;

-- Create new RLS policies for guild_codes table
CREATE POLICY "Users can view guild codes" ON guild_codes
  FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admins can manage guild codes" ON guild_codes
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Drop existing policies for missions table
DROP POLICY IF EXISTS "Users can view missions" ON missions;
DROP POLICY IF EXISTS "Admins can manage missions" ON missions;

-- Create new RLS policies for missions table
CREATE POLICY "Users can view missions" ON missions
  FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admins can manage missions" ON missions
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Drop existing policies for points_ledger table
DROP POLICY IF EXISTS "Users can view own points" ON points_ledger;
DROP POLICY IF EXISTS "Admins can view all points" ON points_ledger;

-- Create new RLS policies for points_ledger table
CREATE POLICY "Users can view own points" ON points_ledger
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Admins can view all points" ON points_ledger
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Verify the policies were created
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename IN ('profiles', 'guild_codes', 'missions', 'points_ledger')
ORDER BY tablename, policyname;
