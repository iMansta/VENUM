# Supabase Setup Guide for VENUM MARKET

## Prerequisites
- A Supabase account (free tier is sufficient)
- Basic understanding of SQL and database concepts

## Step 1: Create Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Sign up or log in
3. Click "New Project"
4. Fill in the project details:
   - Name: `venum-market`
   - Database Password: (generate a strong password)
   - Region: Choose closest to your users
5. Click "Create new project"
6. Wait for the project to be provisioned (2-3 minutes)

## Step 2: Get API Credentials

1. Go to Project Settings → API
2. Copy the following values:
   - **Project URL**: `https://xxx.supabase.co`
   - **anon/public** Key: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`

## Step 3: Set Environment Variables

1. Create a `.env` file in the project root:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` and add your Supabase credentials:
   ```env
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   ```

3. Restart the development server to load the new environment variables.

## Step 4: Execute Database Schema

1. Go to the Supabase Dashboard → SQL Editor
2. Create a new query
3. Copy the contents of `DATABASE_SCHEMA.md`
4. Execute the SQL script

This will create:
- `profiles` table
- `guild_codes` table
- `missions` table
- `mission_participants` table
- `points_ledger` table
- `shop_items` table
- `shop_purchases` table
- Database functions and triggers
- Row Level Security (RLS) policies

## Step 5: Configure Authentication

1. Go to Authentication → Providers
2. Enable Email provider (should be enabled by default)
3. Configure email templates if desired
4. Set up email confirmation (optional but recommended)

## Step 6: Create Initial Guild Code

1. Go to SQL Editor
2. Run this query to create an initial recruitment code:
   ```sql
   INSERT INTO guild_codes (code, max_uses, created_by)
   VALUES ('VENUM2024', 100, null);
   ```

## Step 7: Create First Admin User

1. Run the development server: `npm run dev`
2. Navigate to the app and sign up with the guild code
3. Go to Supabase Dashboard → Authentication → Users
4. Find your user and copy their UUID
5. Run this query to make them an admin:
   ```sql
   UPDATE profiles
   SET role = 'admin'
   WHERE id = 'your-user-uuid';
   ```

## Step 8: Test the Setup

1. Try signing up with the guild code
2. Verify the profile is created in the `profiles` table
3. Check that the user has the correct role
4. Test creating a mission (as admin)
5. Test joining a mission (as regular user)

## Step 9: Populate Shop Items (Optional)

Add some initial shop items:

```sql
INSERT INTO shop_items (name, description, cost_points, category, is_active) VALUES
('T8 Regear Set', 'Complete T8 gear set for regearing', 5000, 'gear', true),
('Silver Chest', '100,000 silver', 2000, 'currency', true),
('Mount Skin', 'Rare mount skin', 3000, 'cosmetic', true),
('Premium Access', '1 month premium features', 1000, 'subscription', true);
```

## Troubleshooting

### "Supabase credentials not found" error
- Make sure `.env` file exists in the project root
- Verify the environment variables are set correctly
- Restart the development server

### RLS policy errors
- Check that the SQL schema was executed completely
- Verify RLS is enabled on all tables
- Check the policy definitions match your use case

### Authentication errors
- Verify email provider is enabled
- Check email templates are configured
- Ensure the user's email is confirmed (if required)

### Database function errors
- Verify all functions were created successfully
- Check function permissions (SECURITY DEFINER)
- Review function parameters match the calls in the code

## Security Notes

1. **Never commit `.env` file** to version control
2. **Use Row Level Security (RLS)** for all tables
3. **Limit anon key permissions** in production
4. **Enable email confirmation** for production
5. **Regularly rotate** API keys and passwords
6. **Monitor** database access logs
7. **Backup** your database regularly

## Production Deployment

When deploying to production:

1. **Enable additional security**:
   - Enable 2FA for admin accounts
   - Set up IP whitelisting
   - Enable audit logging

2. **Configure email service**:
   - Set up custom SMTP
   - Configure email templates
   - Enable rate limiting

3. **Database optimization**:
   - Add indexes for frequently queried columns
   - Set up connection pooling
   - Enable query caching

4. **Monitoring**:
   - Set up error tracking (Sentry, etc.)
   - Monitor database performance
   - Track user activity

## Additional Resources

- [Supabase Documentation](https://supabase.com/docs)
- [Supabase Auth Guide](https://supabase.com/docs/guides/auth)
- [Row Level Security Guide](https://supabase.com/docs/guides/auth/row-level-security)
- [Database Functions Guide](https://supabase.com/docs/guides/database/functions)
