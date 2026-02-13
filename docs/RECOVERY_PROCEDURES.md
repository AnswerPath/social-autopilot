# Automated Recovery Procedures

## Scheduler worker

- **Health:** When `ENABLE_HEALTH_CHECK=true`, the worker exposes `GET http://localhost:HEALTH_CHECK_PORT/health` with `status`, `lastProcessTime`, `consecutiveErrors`, `isProcessing`.
- **Restart:** After `MAX_CONSECUTIVE_ERRORS` (10) consecutive errors, the worker exits with code 1 so PM2/systemd can restart it.
- **PM2:** Use `ecosystem.config.cjs` (see project root) or:
  - `pm2 start scripts/scheduler-worker.js --name scheduler --max-restarts 10 --exp-backoff-restart-delay 1000`
  - `pm2 save` and `pm2 startup` for boot persistence.
- **Manual recovery:** If the worker is stuck, restart it: `pm2 restart scheduler` or `sudo systemctl restart scheduler-worker`. Ensure the Next.js app and DB are reachable first.

## Job queue (scheduled_posts)

- **Retry:** Failed jobs are retried with exponential backoff (1 min, 5 min, 30 min) up to `max_retries` (default 3). Status moves to `approved` with updated `scheduled_at` and `retry_count`.
- **Permanent failure:** When `retry_count >= max_retries`, status is set to `failed` and the job is no longer retried.
- **Dead-letter view:** Query failed jobs with:
  ```sql
  SELECT id, content, scheduled_at, error, retry_count, status
  FROM scheduled_posts
  WHERE status = 'failed'
  ORDER BY scheduled_at DESC;
  ```
- **Manual retry:** To retry a failed job, set `status = 'approved'`, `retry_count = 0`, and `scheduled_at` to now (or a future time). Fix any credential or X API issue before retrying.
- **Admin retry API:** `POST /api/admin/jobs/retry` with body `{ jobIds?: string[], retryAll?: boolean }`:
  - `jobIds`: retry specific failed jobs by ID
  - `retryAll`: retry all failed jobs (up to 100). Auth: admin session or `Authorization: Bearer <ADMIN_RECOVERY_TOKEN>`

## Circuit breaker (X API / Apify)

- **State:** Per client instance (each `XApiService` / `ApifyService` has its own circuit breaker). When open, calls fail immediately without hitting the API.
- **Reset:** Call the admin reset endpoint to reset all registered circuit breakers without restarting the app:
  - `POST /api/admin/recovery/circuit-breaker-reset` (admin session or `Authorization: Bearer <ADMIN_RECOVERY_TOKEN>`)
  - Alternatively, restart the Next.js app to get new instances with closed circuits.
- **Threshold:** Default is 5 failures before opening; 60s reset timeout before half-open.

## Recovery script

Run `node scripts/recovery.js` to:

- Check scheduler worker health (when `ENABLE_HEALTH_CHECK=true`)
- Output recovery commands if the worker is unhealthy

With `--retry-jobs`, the script calls the admin retry API to queue all failed jobs. Requires `ADMIN_RECOVERY_TOKEN` in `.env` or an admin session.

```bash
node scripts/recovery.js              # Health check only
node scripts/recovery.js --retry-jobs # Health check + retry failed jobs
```

## API timeouts

- **Policy:** Long-running routes (e.g. analytics sync) should enforce a maximum duration (e.g. 60–120s). If exceeded, return 503 with a user-friendly message and log the timeout.
- **Implementation:** Use `AbortController` + `setTimeout` or a promise race with a timeout promise; catch timeout and return `NextResponse.json({ error: 'Request timed out. Please try again or use a smaller range.' }, { status: 503 })`.

## Simulated failure recovery (staging validation)

To validate recovery procedures in staging:

1. **Scheduler worker:** Stop the worker or make `/api/scheduler/dispatch` return 500. Run `node scripts/recovery.js` and confirm it reports unhealthy and suggests `pm2 restart scheduler`.
2. **Job retry:** Create a failed job (e.g. invalid credentials), then call `POST /api/admin/jobs/retry` with `{ retryAll: true }`. Verify the job moves to `approved` and is picked up by the worker.
3. **Circuit breaker:** Trigger 5+ failures to X API or Apify so the circuit opens. Call `POST /api/admin/recovery/circuit-breaker-reset`. Verify the next request succeeds.
