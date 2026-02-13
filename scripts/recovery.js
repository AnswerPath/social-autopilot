#!/usr/bin/env node

/**
 * Recovery script for scheduler worker and failed jobs.
 *
 * Usage:
 *   node scripts/recovery.js [--retry-jobs]
 *
 * Options:
 *   --retry-jobs  Call admin API to retry all failed jobs (requires ADMIN_RECOVERY_TOKEN
 *                 or session cookie; app must be running)
 *
 * Environment:
 *   APP_URL                    Base URL of the app (default: http://localhost:3000)
 *   HEALTH_CHECK_PORT          Scheduler worker health port (default: 3001)
 *   ENABLE_HEALTH_CHECK        Must be 'true' for scheduler health check
 *   ADMIN_RECOVERY_TOKEN       Optional token for admin API auth (Bearer)
 */

import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { config } = require('dotenv');

config({ path: '.env.local' });
config({ path: '.env' });

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || process.env.API_URL || 'http://localhost:3000';
const HEALTH_CHECK_PORT = process.env.HEALTH_CHECK_PORT || 3001;
const ENABLE_HEALTH_CHECK = process.env.ENABLE_HEALTH_CHECK === 'true';
const ADMIN_RECOVERY_TOKEN = process.env.ADMIN_RECOVERY_TOKEN;

const args = process.argv.slice(2);
const retryJobs = args.includes('--retry-jobs');

async function checkSchedulerHealth() {
  if (!ENABLE_HEALTH_CHECK) {
    console.log('Scheduler health check skipped (ENABLE_HEALTH_CHECK is not true)');
    return null;
  }
  try {
    const res = await fetch(`http://localhost:${HEALTH_CHECK_PORT}/health`);
    if (res.ok) {
      const data = await res.json();
      console.log('Scheduler worker healthy:', JSON.stringify(data, null, 2));
      return data;
    }
    console.warn('Scheduler worker health check failed:', res.status);
    return null;
  } catch (err) {
    console.warn('Could not reach scheduler health endpoint:', err.message);
    console.log('');
    console.log('Recovery: If the scheduler worker is stuck, run:');
    console.log('  pm2 restart scheduler');
    console.log('Or: sudo systemctl restart scheduler-worker');
    return null;
  }
}

async function callRetryJobs() {
  const headers = {
    'Content-Type': 'application/json',
  };
  if (ADMIN_RECOVERY_TOKEN) {
    headers['Authorization'] = `Bearer ${ADMIN_RECOVERY_TOKEN}`;
  }

  try {
    const res = await fetch(`${APP_URL}/api/admin/jobs/retry`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ retryAll: true }),
    });
    const data = await res.json();
    if (res.ok) {
      console.log('Retry jobs:', data.message, '(count:', data.retryCount, ')');
      return true;
    }
    if (res.status === 403) {
      console.warn('Retry jobs: Forbidden. Set ADMIN_RECOVERY_TOKEN or use an admin session.');
      return false;
    }
    console.warn('Retry jobs failed:', res.status, data);
    return false;
  } catch (err) {
    console.warn('Could not call retry API:', err.message);
    console.log('Ensure the app is running at', APP_URL);
    return false;
  }
}

async function main() {
  console.log('Recovery script');
  console.log('---');

  await checkSchedulerHealth();

  if (retryJobs) {
    console.log('');
    if (!ADMIN_RECOVERY_TOKEN) {
      console.warn('ADMIN_RECOVERY_TOKEN not set. The retry API requires admin auth.');
      console.log('Set ADMIN_RECOVERY_TOKEN in .env, or call the API with an admin session.');
    }
    await callRetryJobs();
  } else {
    console.log('');
    console.log('To retry all failed jobs, run with --retry-jobs');
    console.log('  node scripts/recovery.js --retry-jobs');
  }
}

main().catch((err) => {
  console.error('Recovery script error:', err);
  process.exit(1);
});
