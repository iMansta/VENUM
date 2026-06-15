-- VENUM MARKET - Create Admin User Script
-- This script creates the initial admin user with credentials:
-- Username: Mansta
-- Password: Mansta01@

-- IMPORTANT: This script should be executed AFTER the main DATABASE_SCHEMA.md
-- The password hash below is for "Mansta01@" (without quotes)

-- Step 1: Create the auth user (this needs to be done via Supabase Auth API)
-- For security reasons, we cannot create auth users directly via SQL
-- You need to use the Supabase Dashboard or Auth API to create the user

-- Step 2: After creating the auth user, get the UUID and run this:
-- UPDATE profiles SET role = 'admin' WHERE id = 'YOUR_USER_UUID';

-- Step 3: Alternative - Create a function to handle admin creation
-- This function can be called after manual user creation

CREATE OR REPLACE FUNCTION promote_to_admin(p_email TEXT)
RETURNS VOID AS $$
BEGIN
  UPDATE profiles
  SET role = 'admin'
  WHERE id = (
    SELECT id FROM auth.users WHERE email = p_email
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 4: Call the function after creating the user
-- SELECT promote_to_admin('mansta@email.com');

-- MANUAL INSTRUCTIONS:
-- 1. Go to Supabase Dashboard → Authentication → Users
-- 2. Click "Add User"
-- 3. Email: mansta@email.com (or your preferred email)
-- 4. Password: Mansta01@
-- 5. Click "Create User"
-- 6. Copy the UUID of the created user
-- 7. Run this SQL: UPDATE profiles SET role = 'admin' WHERE id = 'COPIED_UUID';
-- 8. Or run: SELECT promote_to_admin('mansta@email.com');

-- Step 5: Verify the admin user was created
SELECT id, username, email, role, is_active 
FROM profiles 
WHERE role = 'admin';

-- Step 6: Update the username to "Mansta" if needed
UPDATE profiles 
SET username = 'Mansta' 
WHERE role = 'admin';

-- Final verification
SELECT id, username, email, role, is_active 
FROM profiles 
WHERE role = 'admin';
