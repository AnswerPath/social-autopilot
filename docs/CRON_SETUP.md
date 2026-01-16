# Scheduled Posts Cron Job Setup

This guide explains how to set up automatic processing of scheduled posts using Vercel Cron Jobs.

## Overview

Scheduled posts are processed automatically every minute via Vercel Cron Jobs. This ensures posts are published on time even when users aren't actively using the application.

## Setup Instructions

### 1. Deploy to Vercel

If you haven't already deployed to Vercel:

```bash
# Install Vercel CLI
npm install -g vercel

# Login
vercel login

# Deploy
vercel --prod
```

### 2. Verify Configuration

The `vercel.json` file is already configured with:

```json
{
  "crons": [
    {
      "path": "/api/scheduler/dispatch",
      "schedule": "*/1 * * * *"
    }
  ]
}
```

This runs the cron job **every minute** (`*/1 * * * *`).

### 3. Verify Cron Job is Active

After deployment:

1. Go to your Vercel Dashboard
2. Navigate to your project → **Settings** → **Cron Jobs**
3. You should see the cron job listed and its execution history

### 4. Test the Setup

#### Manual Testing (Development)

In development, you can manually trigger the queue:

```bash
# Using curl
curl -X POST http://localhost:3000/api/scheduler/dispatch

# Or visit in browser
http://localhost:3000/api/scheduler/dispatch
```

#### Production Testing

After deployment, check the Vercel Cron Jobs dashboard to see execution logs.

## How It Works

1. **Vercel Cron** calls `/api/scheduler/dispatch` every minute
2. The endpoint processes all scheduled posts that are due (`scheduled_at <= now`)
3. Posts with status `approved` or `pending_approval` are processed
4. Successful posts are marked as `published`
5. Failed posts are retried with exponential backoff

## Security

The dispatch endpoint is protected:
- **Production**: Only accepts requests from Vercel Cron (verified via `x-vercel-cron` header)
- **Development**: Allows manual calls for testing

## Adjusting the Schedule

If you want to change how often the queue is processed, edit `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/scheduler/dispatch",
      "schedule": "*/5 * * * *"  // Every 5 minutes instead of every minute
    }
  ]
}
```

Common schedules:
- `*/1 * * * *` - Every minute (current)
- `*/5 * * * *` - Every 5 minutes
- `*/15 * * * *` - Every 15 minutes
- `0 * * * *` - Every hour

## Troubleshooting

### Cron Job Not Running

1. **Check Vercel Dashboard**: Go to Settings → Cron Jobs to see execution history
2. **Verify Deployment**: Ensure `vercel.json` is committed and deployed
3. **Check Logs**: View function logs in Vercel Dashboard → Deployments → Functions

### Posts Not Publishing

1. **Check Post Status**: Posts must be in `approved` or `pending_approval` status
2. **Check Scheduled Time**: Ensure `scheduled_at` is in the past
3. **Check Error Logs**: Review the dispatch endpoint logs for errors
4. **Manual Trigger**: Try manually calling the endpoint to see error messages

### Database Errors

If you see database constraint errors, ensure you've run the migration:

```sql
-- Run this in Supabase SQL Editor
-- File: supabase/migrations/20251218000005_fix_approval_history_trigger.sql
```

## Alternative Solutions

If you're not using Vercel, consider:

1. **Supabase Edge Functions + pg_cron** (if on Supabase Pro)
2. **Separate worker service** (for more control)
3. **Node.js script with PM2** (for VPS deployments)

See the main deployment guide for details on these alternatives.

