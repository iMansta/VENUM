# Supabase Setup Guide - VENUM MARKET

## Overview
Complete step-by-step guide to set up Supabase for the VENUM MARKET application.

## Prerequisites

- Supabase account (free tier is sufficient)
- Basic understanding of SQL
- Access to the project files

## Step 1: Create Supabase Project

### 1.1 Sign Up/Login to Supabase

1. Go to [supabase.com](https://supabase.com)
2. Click "Start your project" or sign in
3. Sign up with GitHub (recommended) or email

### 1.2 Create New Project

1. Click "New Project"
2. Fill in project details:
   - **Name**: `venum-market`
   - **Database Password**: Generate a strong password (save it securely!)
   - **Region**: Choose closest to your users (South America for Brazil)
   - **Pricing Plan**: Free tier is sufficient

3. Click "Create new project"
4. Wait for project provisioning (2-3 minutes)

## Step 2: Get API Credentials

### 2.1 Access Project Settings

1. Go to your project dashboard
2. Click "Settings" (gear icon) in left sidebar
3. Select "API" from the menu

### 2.2 Copy API Credentials

You'll need these values:
- **Project URL**: `https://xxx.supabase.co`
- **anon/public** Key: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`

Copy both values and save them securely.

### 2.3 Configure Environment Variables

In your project `.env` file:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

## Step 3: Execute Database Schema

### 3.1 Open SQL Editor

1. In Supabase dashboard, click "SQL Editor" in left sidebar
2. Click "New query"

### 3.2 Execute Schema

1. Open `DATABASE_SCHEMA.md` from your project
2. Copy the entire SQL content
3. Paste into SQL Editor
4. Click "Run" (or press `Ctrl+Enter`)

This will create:
- All tables (profiles, guild_codes, missions, etc.)
- Database functions
- Row Level Security policies
- Triggers

### 3.3 Verify Schema Creation

Check that all tables were created:
- Go to "Table Editor" in left sidebar
- Verify all tables appear:
  - `profiles`
  - `guild_codes`
  - `missions`
  - `mission_participants`
  - `points_ledger`
  - `shop_items`
  - `shop_purchases`

## Step 4: Execute Initial Setup Script

### 4.1 Run Initial Setup

1. In SQL Editor, create a new query
2. Open `INITIAL_SETUP.sql` from your project
3. Copy and paste the SQL content
4. Click "Run"

This will create:
- Initial guild recruitment codes
- Sample shop items
- Sample missions

### 4.2 Verify Initial Data

Check that data was created:
- **Guild Codes**: Go to `guild_codes` table → should have 3 codes
- **Shop Items**: Go to `shop_items` table → should have 7 items
- **Missions**: Go to `missions` table → should have 4 missions

## Step 5: Configure Authentication

### 5.1 Enable Email Provider

1. Go to "Authentication" in left sidebar
2. Click "Providers" tab
3. Ensure "Email" provider is enabled (default)

### 5.2 Configure Email Templates (Optional)

1. In Authentication → "Providers" → "Email"
2. Click "Email Templates"
3. Customize templates for:
   - Confirm signup
   - Reset password
   - Email change

### 5.3 Enable Email Confirmation (Recommended)

1. In Authentication → "Providers" → "Email"
2. Toggle "Confirm email" to ON
3. This requires users to confirm their email before accessing

## Step 6: Create First Admin User

### 6.1 Sign Up Through Application

1. Run your local development server: `npm run dev`
2. Navigate to `http://localhost:3000`
3. Click "Cadastrar" (Register)
4. Use one of the guild codes from step 4:
   - `VENUM2024`
   - `IVENUMI`
   - `ALBION`
5. Fill in registration details:
   - Username: Your choice
   - Email: Your email
   - Password: Strong password
6. Click "Cadastrar"

### 6.2 Get User UUID

1. Go to Supabase Dashboard
2. Click "Authentication" in left sidebar
3. Click "Users" tab
4. Find your newly created user
5. Copy the UUID (looks like: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`)

### 6.3 Promote to Admin

1. Go to SQL Editor
2. Run this query (replace with your UUID):

```sql
UPDATE profiles 
SET role = 'admin' 
WHERE id = 'YOUR_USER_UUID_HERE';
```

3. Verify the change:
   - Go to `profiles` table
   - Find your user
   - Check that `role` is now `admin`

## Step 7: Configure Row Level Security (RLS)

### 7.1 Verify RLS is Enabled

1. Go to "Database" in left sidebar
2. Click "Tables"
3. For each table, verify:
   - RLS is enabled (shield icon)
   - Policies exist

### 7.2 Test RLS Policies

1. Sign out of your application
2. Try to access protected routes
3. Verify you're redirected to login
4. Sign in as admin
5. Verify you can access admin features

## Step 8: Test Database Functions

### 8.1 Test Guild Code Validation

1. In SQL Editor, run:

```sql
SELECT validate_guild_code('VENUM2024');
```

Should return: `{"success": true, "message": "Code validated successfully"}`

### 8.2 Test Points Awarding

1. In SQL Editor, run:

```sql
SELECT award_points(
  'YOUR_USER_UUID',
  100,
  'Test points',
  null,
  null
);
```

2. Check `profiles` table → your points should increase by 100
3. Check `points_ledger` table → new entry should appear

### 8.3 Test Points Deduction

1. In SQL Editor, run:

```sql
SELECT deduct_points(
  'YOUR_USER_UUID',
  50,
  'Test deduction',
  null,
  null
);
```

2. Check `profiles` table → your points should decrease by 50
3. Check `points_ledger` table → new entry should appear

## Step 9: Configure CORS (If Needed)

### 9.1 Add Allowed Origins

1. Go to "Project Settings" → "API"
2. Scroll to "Additional Configuration"
3. Add your development URL:
   - `http://localhost:3000`
4. Add your production URL (after deployment):
   - `https://your-project.vercel.app`

## Step 10: Set Up Real-time Subscriptions (Optional)

### 10.1 Enable Realtime

1. Go to "Database" → "Replication"
2. Add tables you want real-time updates for:
   - `missions`
   - `points_ledger`
   - `shop_items`

### 10.2 Test Realtime

1. In your application, subscribe to table changes
2. Make changes in Supabase dashboard
3. Verify updates appear in real-time

## Step 11: Backup and Recovery

### 11.1 Enable Automatic Backups

1. Go to "Database" → "Backups"
2. Verify automatic backups are enabled (free tier: 7 days)
3. Check backup schedule

### 11.2 Manual Backup

1. Go to "Database" → "Backups"
2. Click "New backup"
3. Wait for backup completion
4. Download backup file if needed

### 11.3 Restore from Backup

1. Go to "Database" → "Backups"
2. Select backup to restore
3. Click "Restore"
4. Confirm restore operation

## Step 12: Monitor and Maintain

### 12.1 Check Database Size

1. Go to "Project Settings" → "Database"
2. Monitor database size
3. Free tier: 500MB

### 12.2 Monitor API Usage

1. Go to "Project Settings" → "API"
2. Check request count
3. Free tier: 50,000 requests/month

### 12.3 Set Up Alerts

1. Go to "Project Settings" → "Alerts"
2. Configure alerts for:
   - Database size approaching limit
   - API usage approaching limit
   - Failed requests

## Troubleshooting

### Issue: Tables Not Created

**Symptoms**: Tables don't appear in Table Editor

**Solutions**:
1. Check SQL execution logs for errors
2. Verify SQL syntax is correct
3. Try running schema in smaller chunks
4. Check for duplicate table names

### Issue: RLS Policies Not Working

**Symptoms**: Users can access data they shouldn't

**Solutions**:
1. Verify RLS is enabled on tables
2. Check policy conditions
3. Test policies with different user roles
4. Review policy execution order

### Issue: Functions Not Working

**Symptoms**: Database functions return errors

**Solutions**:
1. Check function syntax
2. Verify function parameters
3. Check function permissions (SECURITY DEFINER)
4. Test functions in SQL Editor

### Issue: Authentication Not Working

**Symptoms**: Users can't sign up/login

**Solutions**:
1. Verify email provider is enabled
2. Check email templates
3. Verify JWT settings
4. Check user confirmation status

### Issue: Connection Refused

**Symptoms**: Application can't connect to Supabase

**Solutions**:
1. Verify environment variables are set
2. Check Supabase project is active
3. Verify API credentials are correct
4. Check CORS settings

## Security Best Practices

### 1. Protect Your Credentials

- Never commit `.env` file
- Use different keys for dev/prod
- Rotate keys periodically
- Use Supabase's key management

### 2. Implement Proper RLS

- Enable RLS on all tables
- Test policies thoroughly
- Use least privilege principle
- Review policies regularly

### 3. Monitor Access

- Check authentication logs
- Monitor failed login attempts
- Review user activity
- Set up alerts for suspicious activity

### 4. Regular Backups

- Enable automatic backups
- Test restore procedures
- Keep backups off-site
- Document backup schedule

## Performance Optimization

### 1. Indexing

Add indexes to frequently queried columns:

```sql
CREATE INDEX idx_profiles_username ON profiles(username);
CREATE INDEX idx_missions_status ON missions(status);
CREATE INDEX idx_points_ledger_profile ON points_ledger(profile_id);
```

### 2. Query Optimization

- Use specific column selection
- Avoid `SELECT *`
- Use joins efficiently
- Implement pagination

### 3. Connection Pooling

- Configure connection pool size
- Use connection pooling in production
- Monitor connection usage
- Adjust pool size as needed

## Migration Guide

### From Development to Production

1. **Export Development Data**:
   - Use Supabase's export feature
   - Or run SQL dump

2. **Create Production Project**:
   - New Supabase project
   - Execute schema
   - Configure environment

3. **Import Data**:
   - Import essential data only
   - Don't import user passwords
   - Regenerate API keys

4. **Update Environment Variables**:
   - Update production `.env`
   - Deploy to production
   - Test thoroughly

## Cost Management

### Free Tier Limits

- 500MB database storage
- 50,000 API requests/month
- 1GB bandwidth/month
- 7-day backup retention

### When to Upgrade

Consider upgrading when:
- Approaching storage limits
- High API usage
- Need longer backup retention
- Need additional features

### Upgrade Options

1. **Pro Plan**: $25/month
   - 8GB storage
   - 100,000 API requests
   - 30-day backups
   - Daily backups

2. **Enterprise**: Custom pricing
   - Unlimited storage
   - Custom SLA
   - Dedicated support
   - Advanced features

## Support Resources

### Supabase Documentation
- [Supabase Docs](https://supabase.com/docs)
- [Database Guide](https://supabase.com/docs/guides/database)
- [Auth Guide](https://supabase.com/docs/guides/auth)
- [RLS Guide](https://supabase.com/docs/guides/auth/row-level-security)

### Community Support
- [Supabase Discord](https://supabase.com/discord)
- [GitHub Issues](https://github.com/supabase/supabase/issues)
- [Stack Overflow](https://stackoverflow.com/questions/tagged/supabase)

### Additional Resources
- [SQL Tutorial](https://www.w3schools.com/sql/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Database Design Guide](https://www.postgresqltutorial.com/)

## Checklist

Use this checklist to verify your setup:

- [ ] Supabase project created
- [ ] API credentials obtained
- [ ] Environment variables configured
- [ ] Database schema executed
- [ ] Initial setup script executed
- [ ] Authentication configured
- [ ] First admin user created
- [ ] RLS policies verified
- [ ] Database functions tested
- [ ] CORS configured
- [ ] Backups enabled
- [ ] Monitoring set up
- [ ] Security reviewed
- [ ] Performance optimized

## Next Steps

After completing Supabase setup:

1. Test the application thoroughly
2. Create additional guild codes as needed
3. Add more shop items
4. Create initial missions
5. Invite guild members
6. Deploy to production
7. Set up monitoring
8. Document procedures

## Summary

Setting up Supabase for VENUM MARKET involves:

1. Creating a Supabase project
2. Executing the database schema
3. Running initial setup scripts
4. Configuring authentication
5. Creating the first admin user
6. Testing all functionality
7. Configuring security and monitoring

The free tier is sufficient for most guild use cases, with clear upgrade paths when needed.
