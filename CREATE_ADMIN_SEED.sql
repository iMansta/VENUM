-- VENUM MARKET - Create Admin Seed User
-- This script creates the initial admin user with credentials:
-- Username: Mansta
-- Password: Mansta01@

-- Step 1: Create the auth user via Supabase Auth API (manual step)
-- Go to Supabase Dashboard → Authentication → Users → Add User
-- Email: mansta@venum.local (auto-generated from username)
-- Password: Mansta01@
-- Click "Create User"

-- Step 2: After creating the auth user, get the UUID and run this SQL
-- UPDATE profiles SET role = 'admin', username = 'Mansta' WHERE id = 'YOUR_USER_UUID';

-- Step 3: Alternative - Create a function to handle admin creation
CREATE OR REPLACE FUNCTION promote_to_admin(p_username TEXT)
RETURNS VOID AS $$
BEGIN
  UPDATE profiles
  SET role = 'admin'
  WHERE id = (
    SELECT id FROM auth.users WHERE email = LOWER(p_username) || '@venum.local'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 4: Call the function after creating the user
-- SELECT promote_to_admin('Mansta');

-- Step 5: Update the username to ensure it matches
UPDATE profiles 
SET username = 'Mansta' 
WHERE username = LOWER('Mansta');

-- Step 6: Verify the admin user was created
SELECT id, username, email, role, is_active 
FROM profiles 
WHERE role = 'admin';

-- Step 7: Add unique constraint on username if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'profiles_username_key'
  ) THEN
    ALTER TABLE profiles ADD CONSTRAINT profiles_username_key UNIQUE (username);
  END IF;
END $$;
