# Vercel Deployment Tutorial - VENUM MARKET

## Overview
Complete guide to deploy the VENUM MARKET application to Vercel.

## Prerequisites

- GitHub account with the project repository
- Vercel account (free tier is sufficient)
- Supabase project already set up
- Node.js installed locally

## Step 1: Prepare Your Repository

### 1.1 Push Code to GitHub

If your project is not already on GitHub:

```bash
# Initialize git repository (if not already done)
cd C:\Users\Mansta\CascadeProjects\albion-arbitrage-dashboard
git init
git add .
git commit -m "Initial commit - VENUM MARKET"

# Create repository on GitHub first, then:
git remote add origin https://github.com/YOUR_USERNAME/albion-arbitrage-dashboard.git
git branch -M main
git push -u origin main
```

### 1.2 Verify .gitignore

Ensure `.gitignore` exists and excludes sensitive files:

```gitignore
# Dependencies
node_modules/
.pnp
.pnp.js

# Environment variables
.env
.env.local
.env.development.local
.env.test.local
.env.production.local

# Build outputs
dist/
build/
.next/

# IDE
.vscode/
.idea/
*.swp
*.swo
*~

# OS
.DS_Store
Thumbs.db

# Logs
npm-debug.log*
yarn-debug.log*
yarn-error.log*
```

## Step 2: Set Up Vercel Project

### 2.1 Create Vercel Account

1. Go to [vercel.com](https://vercel.com)
2. Sign up with GitHub, GitLab, or Bitbucket
3. Verify your email address

### 2.2 Import Project

1. Click "Add New..." → "Project"
2. Select your GitHub repository: `albion-arbitrage-dashboard`
3. Vercel will automatically detect it as a Vite project
4. Click "Import"

### 2.3 Configure Project Settings

**Framework Preset**: Vite

**Root Directory**: `./` (leave as default)

**Build Command**: `npm run build`

**Output Directory**: `dist`

**Install Command**: `npm install`

## Step 3: Configure Environment Variables

### 3.1 Add Environment Variables in Vercel

1. In your project settings, go to "Environment Variables"
2. Add the following variables:

```
VITE_SUPABASE_URL=your-supabase-project-url
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
VITE_APP_NAME=VENUM MARKET
VITE_APP_URL=https://your-project.vercel.app
VITE_ENABLE_GUILD_HUB=true
VITE_ENABLE_SHOP=true
VITE_ENABLE_MISSIONS=true
```

### 3.2 Get Supabase Credentials

1. Go to your Supabase project dashboard
2. Settings → API
3. Copy "Project URL" and "anon/public" key
4. Paste them into Vercel environment variables

## Step 4: Deploy

### 4.1 Initial Deployment

1. Click "Deploy" button
2. Vercel will build and deploy your application
3. Wait for the build to complete (usually 1-2 minutes)
4. Your app will be available at `https://your-project-name.vercel.app`

### 4.2 Monitor Build

Watch the build logs for any errors:
- Install dependencies
- Build application
- Deploy to edge network

## Step 5: Configure Custom Domain (Optional)

### 5.1 Add Custom Domain

1. Go to project settings → "Domains"
2. Click "Add Domain"
3. Enter your domain (e.g., `venum.yourdomain.com`)
4. Follow DNS instructions provided by Vercel

### 5.2 DNS Configuration

Vercel will provide DNS records to add:
- **A Record**: `76.76.21.21`
- **CNAME Record**: `cname.vercel-dns.com`

## Step 6: Post-Deployment Setup

### 6.1 Test the Application

1. Visit your deployed URL
2. Test authentication flow
3. Verify Supabase connection
4. Test all features (market, guild hub, etc.)

### 6.2 Set Up Admin User

1. Sign up through the application with a guild code
2. Get user UUID from Supabase Dashboard → Authentication → Users
3. Run in Supabase SQL Editor:

```sql
UPDATE profiles SET role = 'admin' WHERE id = 'YOUR_USER_UUID';
```

### 6.3 Create Initial Guild Codes

Run in Supabase SQL Editor:

```sql
INSERT INTO guild_codes (code, max_uses, is_active) VALUES
('VENUM2024', 100, true),
('IVENUMI', 50, true);
```

## Step 7: Continuous Deployment

### 7.1 Automatic Deployments

Vercel automatically deploys when you:
- Push to main branch
- Create a pull request
- Merge a pull request

### 7.2 Branch Previews

Each pull request gets a preview URL for testing before merging.

## Step 8: Monitor and Maintain

### 8.1 Analytics

Vercel provides:
- Page views
- Visitor analytics
- Performance metrics
- Error tracking

### 8.2 Logs

Access deployment logs in Vercel dashboard:
- Build logs
- Server logs
- Function logs

### 8.3 Performance Optimization

Vercel automatically:
- Optimizes images
- Minifies JavaScript/CSS
- Implements caching
- Uses CDN

## Troubleshooting

### Build Failures

**Issue**: Build fails during deployment

**Solution**:
1. Check build logs in Vercel dashboard
2. Ensure all dependencies are in `package.json`
3. Verify environment variables are set correctly
4. Test build locally: `npm run build`

### Environment Variables Not Working

**Issue**: App can't access environment variables

**Solution**:
1. Ensure variables start with `VITE_` prefix
2. Redeploy after adding variables
3. Check variable names match exactly

### Supabase Connection Issues

**Issue**: Can't connect to Supabase

**Solution**:
1. Verify Supabase URL and anon key are correct
2. Check Supabase project is active
3. Ensure RLS policies allow access
4. Check CORS settings in Supabase

### White Screen After Deployment

**Issue**: App loads but shows white screen

**Solution**:
1. Check browser console for errors
2. Verify build completed successfully
3. Check if all assets are loading
4. Ensure environment variables are set

## Advanced Configuration

### Custom Build Settings

Create `vercel.json` in project root:

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "framework": "vite",
  "installCommand": "npm install"
}
```

### Redirects

Create `vercel.json` with redirects:

```json
{
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

### Headers

Add custom headers in `vercel.json`:

```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "X-Content-Type-Options",
          "value": "nosniff"
        },
        {
          "key": "X-Frame-Options",
          "value": "DENY"
        }
      ]
    }
  ]
}
```

## Security Best Practices

### 1. Environment Variables

- Never commit `.env` file
- Use different keys for development and production
- Rotate keys periodically
- Use Vercel's environment variable protection

### 2. API Security

- Use Supabase RLS policies
- Implement rate limiting
- Validate all inputs
- Use HTTPS only

### 3. Monitoring

- Set up error tracking (Sentry, LogRocket)
- Monitor build failures
- Track performance metrics
- Set up alerts for critical issues

## Cost Management

### Vercel Free Tier Limits

- 100GB bandwidth per month
- 6,000 minutes of build time per month
- Unlimited projects
- Automatic HTTPS
- Global CDN

### When to Upgrade

Consider upgrading when:
- Exceeding bandwidth limits
- Need custom domains (free tier includes 1)
- Need advanced analytics
- Need priority support
- Need team collaboration features

## Backup and Recovery

### Database Backups

Supabase handles database backups automatically:
- Daily backups retained for 7 days (free tier)
- Point-in-time recovery available
- Export database manually if needed

### Code Backups

- GitHub stores all code history
- Vercel maintains deployment history
- Use git branches for feature development
- Tag releases for easy rollback

## Performance Tips

### 1. Optimize Images

- Use WebP format
- Compress images
- Use lazy loading
- Implement responsive images

### 2. Code Splitting

- Use dynamic imports
- Lazy load components
- Implement route-based code splitting

### 3. Caching

- Implement service workers
- Use browser caching
- Leverage Vercel's edge caching
- Cache API responses

## Scaling

### When to Scale Up

Consider scaling when:
- High traffic volumes
- Need for faster build times
- Require more bandwidth
- Need advanced features

### Scaling Options

1. **Vercel Pro**: $20/month
   - 1TB bandwidth
   - Faster builds
   - Advanced analytics
   - Priority support

2. **Vercel Enterprise**: Custom pricing
   - Unlimited bandwidth
   - SSO
   - SLA guarantees
   - Dedicated support

## Support Resources

### Vercel Documentation
- [Vercel Docs](https://vercel.com/docs)
- [Deployment Guide](https://vercel.com/docs/deployments)
- [Environment Variables](https://vercel.com/docs/projects/environment-variables)

### Supabase Documentation
- [Supabase Docs](https://supabase.com/docs)
- [Deployment Guide](https://supabase.com/docs/guides/platform/deploying)

### Community Support
- [Vercel Discord](https://vercel.com/discord)
- [Supabase Discord](https://supabase.com/discord)
- [GitHub Issues](https://github.com/vercel/vercel/issues)

## Summary

Deploying VENUM MARKET to Vercel is straightforward:

1. Push code to GitHub
2. Import project in Vercel
3. Configure environment variables
4. Deploy
5. Set up admin user and guild codes
6. Test thoroughly

The free tier is sufficient for most use cases, with automatic scaling available as needed.
