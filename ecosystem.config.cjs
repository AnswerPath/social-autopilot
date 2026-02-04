/**
 * PM2 ecosystem file for the scheduler worker.
 * Usage: pm2 start ecosystem.config.cjs
 */
module.exports = {
  apps: [
    {
      name: 'scheduler',
      script: 'scripts/scheduler-worker.js',
      cwd: __dirname,
      instances: 1,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      exp_backoff_restart_delay: 1000,
      env: { NODE_ENV: 'development' },
      env_production: { NODE_ENV: 'production' },
    },
  ],
};
