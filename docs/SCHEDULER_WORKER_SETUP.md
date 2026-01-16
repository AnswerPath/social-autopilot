# Scheduler Worker Setup Guide

This guide explains how to set up the standalone Node.js worker for processing scheduled posts when Vercel is not available.

## Overview

The scheduler worker is a simple Node.js script that runs continuously and calls your API endpoint to process scheduled posts. It's perfect for:
- Self-hosted deployments
- VPS/cloud server deployments
- Local development
- Any environment where Vercel Cron Jobs aren't available

## Quick Start

### 1. Install Dependencies

Make sure you have Node.js 20+ installed and all dependencies:

```bash
npm install
```

### 2. Configure Environment Variables

Ensure your `.env` or `.env.local` file has:

```env
# Required
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Optional - defaults to http://localhost:3000
NEXT_PUBLIC_APP_URL=http://localhost:3000
# or for production:
# NEXT_PUBLIC_APP_URL=https://your-domain.com

# Optional - defaults to 60 seconds (60000ms)
SCHEDULER_INTERVAL_MS=60000

# Optional - enable health check server
ENABLE_HEALTH_CHECK=true
HEALTH_CHECK_PORT=3001
```

### 3. Start Your Next.js App

The worker needs your API to be running. Start your app:

```bash
# Development
npm run dev

# Production
npm run build
npm start
```

### 4. Run the Worker

#### Development (Manual)

```bash
npm run scheduler
```

#### Production (with PM2 - Recommended)

```bash
# Install PM2 globally
npm install -g pm2

# Start the worker
pm2 start scripts/scheduler-worker.js --name scheduler

# Save PM2 configuration
pm2 save

# Set up PM2 to start on system boot
pm2 startup
```

#### Production (with systemd)

Create `/etc/systemd/system/scheduler-worker.service`:

```ini
[Unit]
Description=Scheduled Posts Worker
After=network.target

[Service]
Type=simple
User=your-user
WorkingDirectory=/path/to/social-autopilot
Environment=NODE_ENV=production
ExecStart=/usr/bin/node scripts/scheduler-worker.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Then:

```bash
sudo systemctl daemon-reload
sudo systemctl enable scheduler-worker
sudo systemctl start scheduler-worker
sudo systemctl status scheduler-worker
```

## Configuration Options

### Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `NEXT_PUBLIC_APP_URL` | Your Next.js app URL | `http://localhost:3000` | No |
| `SCHEDULER_INTERVAL_MS` | How often to process queue (ms) | `60000` (1 min) | No |
| `ENABLE_HEALTH_CHECK` | Enable health check HTTP server | `false` | No |
| `HEALTH_CHECK_PORT` | Port for health check server | `3001` | No |

### Adjusting Processing Frequency

Edit your `.env` file:

```env
# Process every 30 seconds
SCHEDULER_INTERVAL_MS=30000

# Process every 5 minutes
SCHEDULER_INTERVAL_MS=300000
```

## Monitoring

### PM2 Monitoring

```bash
# View logs
pm2 logs scheduler

# View status
pm2 status

# Monitor in real-time
pm2 monit

# Restart worker
pm2 restart scheduler

# Stop worker
pm2 stop scheduler
```

### Health Check (if enabled)

If you enabled the health check server:

```bash
# Check worker status
curl http://localhost:3001/health

# Response:
{
  "status": "healthy",
  "lastProcessTime": "2025-12-18T10:30:00.000Z",
  "consecutiveErrors": 0,
  "isProcessing": false
}
```

### systemd Monitoring

```bash
# View logs
sudo journalctl -u scheduler-worker -f

# Check status
sudo systemctl status scheduler-worker

# Restart
sudo systemctl restart scheduler-worker
```

## Troubleshooting

### Worker Not Processing Posts

1. **Check API is Running**: Ensure your Next.js app is running and accessible
2. **Check API URL**: Verify `NEXT_PUBLIC_APP_URL` is correct
3. **Check Logs**: Review worker logs for errors
4. **Test Manually**: Try calling the API endpoint directly:
   ```bash
   curl -X POST http://localhost:3000/api/scheduler/dispatch
   ```

### Database Errors

If you see database constraint errors, ensure you've run the migration:

```sql
-- Run in Supabase SQL Editor
-- File: supabase/migrations/20251218000005_fix_approval_history_trigger.sql
```

### Worker Crashes

The worker will exit after 10 consecutive errors. Check:
- Database connectivity
- API endpoint accessibility
- Environment variables
- Network connectivity

PM2/systemd will automatically restart the worker.

### Posts Not Publishing

1. **Check Post Status**: Posts must be `approved` or `pending_approval`
2. **Check Scheduled Time**: Ensure `scheduled_at` is in the past
3. **Check Worker Logs**: Look for error messages
4. **Check API Logs**: Review Next.js server logs

## Production Deployment

### Recommended Setup

1. **Use PM2** for process management (auto-restart, logging)
2. **Set up monitoring** (health checks, logs)
3. **Use environment variables** (never hardcode secrets)
4. **Set up log rotation** (PM2 handles this)
5. **Monitor resource usage** (CPU, memory)

### PM2 Ecosystem File

Create `ecosystem.config.js`:

```javascript
module.exports = {
  apps: [{
    name: 'scheduler',
    script: 'scripts/scheduler-worker.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '200M',
    env: {
      NODE_ENV: 'production'
    },
    error_file: './logs/scheduler-error.log',
    out_file: './logs/scheduler-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
  }]
}
```

Then:

```bash
pm2 start ecosystem.config.js
pm2 save
```

## Comparison with Other Solutions

| Solution | Pros | Cons |
|----------|------|------|
| **Node.js Worker** | Simple, works anywhere, full control | Requires server/VPS, manual setup |
| **Vercel Cron** | Zero infrastructure, automatic | Requires Vercel deployment |
| **Supabase pg_cron** | Database-level, no external service | Requires Supabase Pro plan |
| **Separate Service** | Scalable, isolated | More complex, more expensive |

## Next Steps

1. ✅ Set up the worker
2. ✅ Test with a scheduled post
3. ✅ Set up monitoring
4. ✅ Configure auto-restart (PM2/systemd)
5. ✅ Set up log rotation

Your scheduled posts will now be processed automatically! 🎉

