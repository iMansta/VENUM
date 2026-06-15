-- VENUM MARKET - Initial Setup Script
-- Execute this after running DATABASE_SCHEMA.md

-- Step 1: Create initial guild recruitment codes
-- These codes will be used by new members to join the guild
INSERT INTO guild_codes (code, max_uses, is_active) VALUES
('VENUM2024', 100, true),
('IVENUMI', 50, true),
('ALBION', 25, true);

-- Step 2: Create initial admin user
-- NOTE: You need to sign up first through the application, then replace 'YOUR_USER_UUID' below
-- The UUID can be found in Supabase Dashboard > Authentication > Users

-- After signing up, run this to make yourself admin:
-- UPDATE profiles SET role = 'admin' WHERE id = 'YOUR_USER_UUID';

-- Step 3: Create initial shop items for the guild store
INSERT INTO shop_items (name, description, cost_points, category, is_active) VALUES
('T8 Regear Set', 'Complete T8 gear set for regearing', 5000, 'gear', true),
('Silver Chest', '100,000 silver', 2000, 'currency', true),
('Mount Skin', 'Rare mount skin', 3000, 'cosmetic', true),
('Premium Access', '1 month premium features', 1000, 'subscription', true),
('Guild Buff', 'Temporary guild buff', 500, 'consumable', true),
('Crafting Focus', 'Additional crafting focus', 1500, 'resource', true),
('PvP Tournament Entry', 'Entry to guild PvP tournament', 2500, 'event', true);

-- Step 4: Create sample missions (optional - can also be created through admin panel)
INSERT INTO missions (title, description, mission_type, target_item, target_quantity, points_reward, status) VALUES
('Coleta de Madeira T6', 'Colete 500k de madeira T6 para o banco da guilda', 'gathering', 'T6_WOOD', 500000, 100, 'active'),
('Craft de Spears T5', 'Craft 100 spears T5 para estoque de guerra', 'crafting', 'T5_MAIN_SPEAR', 100, 150, 'active'),
('Silver Farm', 'Ganhe 1M de prata através de PvP', 'pvp', null, 1000000, 200, 'active'),
('Trade Route', 'Complete 10 rotas de trade lucrativas', 'trading', null, 10, 75, 'active');

-- Step 5: Verification queries
-- Run these to verify setup

-- Check guild codes
SELECT * FROM guild_codes WHERE is_active = true;

-- Check shop items
SELECT * FROM shop_items WHERE is_active = true;

-- Check missions
SELECT * FROM missions WHERE status = 'active';

-- Check profiles (after users sign up)
SELECT id, username, role, total_points, joined_at FROM profiles;

-- IMPORTANT: After first user signs up, make them admin:
-- 1. Go to Supabase Dashboard > Authentication > Users
-- 2. Copy the UUID of the first user
-- 3. Run: UPDATE profiles SET role = 'admin' WHERE id = 'COPIED_UUID';
