# Deployment Guide - Social Autopilot

This guide provides detailed instructions for deploying Social Autopilot to production environments.

## Table of Contents

1. [Pre-Deployment Checklist](#pre-deployment-checklist)
2. [Environment Setup](#environment-setup)
3. [Database Configuration](#database-configuration)
4. [Deployment Options](#deployment-options)
5. [Post-Deployment Configuration](#post-deployment-configuration)
6. [Security Hardening](#security-hardening)
7. [Monitoring and Maintenance](#monitoring-and-maintenance)
8. [Troubleshooting](#troubleshooting)
9. [Rollback Procedures](#rollback-procedures)

## Pre-Deployment Checklist

Before deploying to production, ensure you have:

### Infrastructure Requirements
- [ ] **Node.js**: Version 18.x or higher installed
- [ ] **npm**: Version 9.x or higher
- [ ] **PostgreSQL**: Database instance (via Supabase or self-hosted)
- [ ] **Domain Name**: Registered domain with DNS access
- [ ] **SSL Certificate**: For HTTPS (auto-provided by most hosting platforms)
- [ ] **Email Service**: SMTP server or email service provider

### Accounts and Services
- [ ] **Supabase Account**: Production project created
- [ ] **Hosting Platform**: Account on Vercel, Netlify, or custom server
- [ ] **Email Provider**: SendGrid, Mailgun, or SMTP service
- [ ] **Monitoring Service**: Sentry, LogRocket, or similar (optional)
- [ ] **Storage Service**: For user-uploaded files (Supabase Storage recommended)

### Configuration Files
- [ ] **Environment Variables**: All production values prepared
- [ ] **Database Migration Scripts**: Tested and ready
- [ ] **Build Configuration**: Next.js config optimized for production
- [ ] **Security Policies**: CORS, CSP, and security headers configured

## Environment Setup

### 1. Production Environment Variables

Create a `.env.production` file with the following variables:

```env
# ============================================
# Application Configuration
# ============================================
NODE_ENV=production
NEXT_PUBLIC_APP_URL=https://your-domain.com

# ============================================
# Supabase Configuration
# ============================================
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# ============================================
# Database Configuration
# ============================================
DATABASE_URL=postgresql://user:password@host:5432/database
DATABASE_POOL_SIZE=20
DATABASE_SSL=true

# ============================================
# Authentication & Security
# ============================================
JWT_SECRET=your-secure-jwt-secret-min-32-chars
JWT_EXPIRES_IN=3600
REFRESH_TOKEN_EXPIRES_IN=604800
SESSION_SECRET=your-secure-session-secret-min-32-chars

# Password hashing (default is bcrypt with 10 rounds)
BCRYPT_ROUNDS=12

# ============================================
# Cookie Configuration
# ============================================
COOKIE_SECURE=true
COOKIE_SAME_SITE=lax
COOKIE_DOMAIN=.your-domain.com

# ============================================
# Email Configuration
# ============================================
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASSWORD=your-sendgrid-api-key
EMAIL_FROM=noreply@your-domain.com
EMAIL_FROM_NAME=Social Autopilot

# ============================================
# Third-Party Integrations
# ============================================
TWITTER_CLIENT_ID=your-twitter-client-id
TWITTER_CLIENT_SECRET=your-twitter-client-secret
TWITTER_CALLBACK_URL=https://your-domain.com/api/auth/twitter/callback

# Apify (for web scraping)
APIFY_API_TOKEN=your-apify-token

# ============================================
# Storage Configuration
# ============================================
STORAGE_PROVIDER=supabase
SUPABASE_STORAGE_BUCKET=avatars
MAX_FILE_SIZE=5242880

# ============================================
# Rate Limiting
# ============================================
RATE_LIMIT_ENABLED=true
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100

# ============================================
# Logging & Monitoring
# ============================================
LOG_LEVEL=info
SENTRY_DSN=your-sentry-dsn
SENTRY_ENVIRONMENT=production

# ============================================
# Feature Flags
# ============================================
ENABLE_REGISTRATION=true
ENABLE_PASSWORD_RESET=true
ENABLE_2FA=true
```

### 2. Securing Environment Variables

#### Never commit `.env` files to version control

For hosting platforms, set environment variables in their dashboard:

**Vercel**:
```bash
vercel env add SUPABASE_SERVICE_ROLE_KEY production
```

**Netlify**:
```bash
netlify env:set SUPABASE_SERVICE_ROLE_KEY your-key
```

**Custom Server**:
Store in `/etc/environment` or use a secrets manager like:
- AWS Secrets Manager
- HashiCorp Vault
- Azure Key Vault

## Database Configuration

### 1. Supabase Setup

**Create Production Project**:
1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Click "New Project"
3. Choose organization
4. Set project name and database password
5. Select region (choose closest to your users)
6. Click "Create new project"

**Configure Database**:
1. Wait for database to initialize (2-3 minutes)
2. Save your connection strings
3. Enable Row Level Security (RLS)
4. Configure backup schedule

### 2. Run Database Migrations

#### Option A: Using Supabase CLI
```bash
# Install Supabase CLI
npm install -g supabase

# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref your-project-ref

# Run migrations
supabase db push
```

#### Option B: Manual SQL Execution
```bash
# Connect to your database
psql "postgresql://[user]:[password]@[host]:5432/postgres"

# Run setup script
\i setup-auth-tables.sql

# Run migrations
\i supabase/migrations/20250102000000_granular_permissions.sql
\i supabase/migrations/20250102000001_activity_logging_enhancement.sql
\i supabase/migrations/20250102000002_team_collaboration.sql
```

### 3. Verify Database Setup

Run this SQL to verify all tables exist:

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_type = 'BASE TABLE'
ORDER BY table_name;
```

Expected tables:
- `account_settings`
- `audit_logs`
- `permission_audit_logs`
- `team_invitations`
- `team_members`
- `teams`
- `user_permissions`
- `user_profiles`
- `user_roles`
- `user_sessions`

### 4. Create First Admin User

After deployment, create an admin user via SQL:

```sql
-- First, register via the app to create the base user

-- Then update their role to ADMIN
UPDATE user_roles 
SET role = 'ADMIN' 
WHERE user_id = 'new-user-id';

-- Verify
SELECT u.email, ur.role 
FROM auth.users u
JOIN user_roles ur ON u.id = ur.user_id
WHERE u.id = 'new-user-id';
```

## Deployment Options

### Option 1: Deploy to Vercel (Recommended)

**Prerequisites**:
- GitHub repository with your code
- Vercel account

**Steps**:

1. **Install Vercel CLI**:
```bash
npm install -g vercel
```

2. **Login to Vercel**:
```bash
vercel login
```

3. **Deploy**:
```bash
# From project root
vercel --prod
```

4. **Configure Environment Variables**:
```bash
# Add each environment variable
vercel env add NEXT_PUBLIC_SUPABASE_URL production
vercel env add SUPABASE_SERVICE_ROLE_KEY production
# ... add all variables
```

5. **Configure Domain**:
- Go to Vercel Dashboard → Project Settings → Domains
- Add your custom domain
- Configure DNS records as instructed
- Wait for SSL certificate provisioning

6. **Deploy Again** (to apply env vars):
```bash
vercel --prod
```

**Automatic Deployments**:
```bash
# Connect GitHub repo
vercel git connect

# Future pushes to main branch auto-deploy
git push origin main
```

### Option 2: Deploy to Netlify

**Prerequisites**:
- GitHub repository
- Netlify account

**Steps**:

1. **Install Netlify CLI**:
```bash
npm install -g netlify-cli
```

2. **Login**:
```bash
netlify login
```

3. **Initialize**:
```bash
netlify init
```

4. **Configure Build Settings**:
```toml
# netlify.toml
[build]
  command = "npm run build"
  publish = ".next"

[build.environment]
  NODE_VERSION = "18"

[[plugins]]
  package = "@netlify/plugin-nextjs"
```

5. **Add Environment Variables**:
```bash
netlify env:set NEXT_PUBLIC_SUPABASE_URL "your-url"
netlify env:set SUPABASE_SERVICE_ROLE_KEY "your-key"
# ... add all variables
```

6. **Deploy**:
```bash
netlify deploy --prod
```

### Option 3: Custom Server (VPS/Cloud)

**Prerequisites**:
- Ubuntu 20.04+ server
- Root or sudo access
- Domain pointing to server IP

**Steps**:

1. **Install Node.js**:
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

2. **Install PM2** (Process Manager):
```bash
sudo npm install -g pm2
```

3. **Clone Repository**:
```bash
cd /var/www
git clone https://github.com/yourusername/social-autopilot.git
cd social-autopilot
```

4. **Install Dependencies**:
```bash
npm ci --production
```

5. **Create `.env.production`**:
```bash
nano .env.production
# Paste your environment variables
```

6. **Build Application**:
```bash
npm run build
```

7. **Start with PM2**:
```bash
pm2 start npm --name "social-autopilot" -- start
pm2 save
pm2 startup
```

8. **Configure Nginx**:
```bash
sudo apt-get install nginx

# Create Nginx config
sudo nano /etc/nginx/sites-available/social-autopilot
```

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/social-autopilot /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

9. **Configure SSL with Let's Encrypt**:
```bash
sudo apt-get install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

10. **Configure Firewall**:
```bash
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

## Post-Deployment Configuration

### 1. Verify Deployment

**Health Check Endpoints**:
```bash
# Check app is running
curl https://your-domain.com

# Check API health
curl https://your-domain.com/api/health

# Check database connection
curl https://your-domain.com/api/health/db
```

**Test Authentication Flow**:
1. Visit `https://your-domain.com/auth`
2. Register a new account
3. Verify email (if enabled)
4. Login
5. Access dashboard

### 2. Configure DNS Records

Add these DNS records:

```text
Type    Name    Value                   TTL
A       @       your-server-ip          300
A       www     your-server-ip          300
CNAME   api     your-domain.com         300
```

### 3. Set Up Email Delivery

**SendGrid Configuration**:
1. Create SendGrid account
2. Generate API key
3. Add to environment variables
4. Verify sender domain
5. Test email delivery

**Test Email**:
```bash
curl -X POST https://your-domain.com/api/test/email \
  -H "Content-Type: application/json" \
  -d '{"to": "test@example.com"}'
```

### 4. Configure Backups

**Database Backups (Supabase)**:
1. Go to Supabase Dashboard → Settings → Database
2. Enable automatic backups
3. Set backup schedule (daily recommended)
4. Configure retention period

**Application Backups**:
```bash
# Backup script
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
pg_dump $DATABASE_URL > backup_$DATE.sql
aws s3 cp backup_$DATE.sql s3://your-bucket/backups/
```

Add to crontab:
```bash
0 2 * * * /path/to/backup-script.sh
```

## Security Hardening

### 1. Security Headers

Add to `next.config.mjs`:

```javascript
const securityHeaders = [
  {
    key: 'X-DNS-Prefetch-Control',
    value: 'on'
  },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload'
  },
  {
    key: 'X-Frame-Options',
    value: 'SAMEORIGIN'
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff'
  },
  {
    key: 'X-XSS-Protection',
    value: '1; mode=block'
  },
  {
    key: 'Referrer-Policy',
    value: 'origin-when-cross-origin'
  },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=()'
  }
];

export default {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
  },
};
```

### 2. Rate Limiting

Ensure rate limiting is enabled in production:

```env
RATE_LIMIT_ENABLED=true
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100
RATE_LIMIT_AUTH_MAX=5
```

### 3. CORS Configuration

Configure allowed origins in `lib/cors-config.ts`:

```typescript
export const corsConfig = {
  origin: process.env.NEXT_PUBLIC_APP_URL,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true,
  maxAge: 86400
};
```

### 4. Secret Rotation

Rotate secrets regularly:

1. Generate new secrets:
```bash
# Generate new JWT secret
openssl rand -base64 32

# Generate new session secret
openssl rand -base64 32
```

2. Update environment variables
3. Redeploy application
4. Invalidate old sessions (users will need to re-login)

### 5. Enable Audit Logging

Ensure audit logging is enabled for compliance:

```sql
-- Verify audit logging is active
SELECT COUNT(*) FROM audit_logs;

-- Check recent activity
SELECT * FROM audit_logs 
ORDER BY created_at DESC 
LIMIT 10;
```

## Monitoring and Maintenance

### 1. Application Monitoring

**Set Up Sentry** (Error Tracking):

1. Create Sentry project
2. Add Sentry DSN to environment variables
3. Install Sentry SDK:
```bash
npm install @sentry/nextjs
```

4. Initialize Sentry in `sentry.server.config.js` and `sentry.client.config.js`

**Set Up Uptime Monitoring**:
- UptimeRobot
- Pingdom
- StatusCake

Configure checks for:
- Homepage (/)
- API health (/api/health)
- Authentication (/api/auth/session)

### 2. Performance Monitoring

**Monitor Key Metrics**:
- Response times
- Error rates
- Database query performance
- Memory usage
- CPU usage

**Tools**:
- Vercel Analytics (built-in for Vercel)
- Google Analytics
- Custom dashboard with Grafana

### 3. Log Management

**Centralized Logging**:
```bash
# Install Winston for structured logging
npm install winston

# Configure in lib/logger.ts
```

**Log Aggregation Services**:
- Loggly
- Papertrail
- Datadog

### 4. Database Maintenance

**Regular Tasks**:
```sql
-- Vacuum database (weekly)
VACUUM ANALYZE;

-- Check database size
SELECT pg_size_pretty(pg_database_size('postgres'));

-- Check table sizes
SELECT 
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename))
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Archive old audit logs (monthly)
DELETE FROM audit_logs 
WHERE created_at < NOW() - INTERVAL '90 days';
```

## Troubleshooting

### Common Issues

**Issue**: "Cannot connect to database"
```bash
# Check database URL
echo $DATABASE_URL

# Test connection
psql $DATABASE_URL -c "SELECT 1;"

# Check Supabase status
curl https://status.supabase.com
```

**Issue**: "502 Bad Gateway"
```bash
# Check application status
pm2 status

# Check logs
pm2 logs social-autopilot

# Restart application
pm2 restart social-autopilot
```

**Issue**: "Authentication not working"
```bash
# Verify environment variables
env | grep SUPABASE

# Check cookie settings
# Ensure COOKIE_SECURE=true in production
# Ensure domain matches your site
```

**Issue**: "Emails not sending"
```bash
# Test SMTP connection
telnet smtp.sendgrid.net 587

# Check email logs
tail -f /var/log/mail.log

# Verify SendGrid API key
curl -X POST https://api.sendgrid.com/v3/mail/send \
  -H "Authorization: Bearer YOUR_API_KEY"
```

## Rollback Procedures

### 1. Application Rollback

**Vercel**:
1. Go to Vercel Dashboard
2. Select your project
3. Go to Deployments
4. Find previous working deployment
5. Click "..." → "Promote to Production"

**Custom Server**:
```bash
# Stop current version
pm2 stop social-autopilot

# Checkout previous version
git checkout previous-release-tag

# Install dependencies
npm ci --production

# Rebuild
npm run build

# Restart
pm2 start social-autopilot
```

### 2. Database Rollback

```bash
# Restore from backup
pg_restore -d $DATABASE_URL backup_file.sql

# Or use Supabase dashboard:
# 1. Go to Database → Backups
# 2. Select backup point
# 3. Click "Restore"
```

### 3. Emergency Maintenance Mode

Create `pages/maintenance.tsx`:
```typescript
export default function Maintenance() {
  return (
    <div>
      <h1>Scheduled Maintenance</h1>
      <p>We'll be back shortly.</p>
    </div>
  );
}
```

Enable maintenance mode:
```bash
# Vercel
vercel env add MAINTENANCE_MODE true production

# Custom server
export MAINTENANCE_MODE=true
pm2 restart social-autopilot
```

---

## Post-Deployment Checklist

After deployment, verify:

- [ ] Application is accessible at production URL
- [ ] SSL certificate is valid and HTTPS is working
- [ ] User registration works
- [ ] Email delivery works (welcome emails, password reset)
- [ ] Login and logout work
- [ ] Session management works correctly
- [ ] Profile updates work
- [ ] Avatar uploads work
- [ ] Role and permission system works
- [ ] Team creation and management work
- [ ] Audit logs are being recorded
- [ ] Database backups are configured
- [ ] Monitoring alerts are configured
- [ ] Error tracking is working (Sentry)
- [ ] Performance metrics are being collected
- [ ] Rate limiting is active
- [ ] Security headers are present
- [ ] Admin account created and accessible
- [ ] Documentation is accessible to team
- [ ] Support channels are set up

---

**Need deployment help?** Contact DevOps support at [devops@example.com](mailto:devops@example.com)

