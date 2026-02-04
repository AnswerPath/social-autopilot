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

## Circuit breaker (X API / Apify)

- **State:** Per client instance (each `XApiService` / `ApifyService` has its own circuit breaker). When open, calls fail immediately without hitting the API.
- **Reset:** Restart the Next.js app (or the process that holds the client) to get a new instance and a closed circuit. Alternatively, implement a “reset” endpoint that replaces the client instance (not provided by default).
- **Threshold:** Default is 5 failures before opening; 60s reset timeout before half-open.

## API timeouts

- **Policy:** Long-running routes (e.g. analytics sync) should enforce a maximum duration (e.g. 60–120s). If exceeded, return 503 with a user-friendly message and log the timeout.
- **Implementation:** Use `AbortController` + `setTimeout` or a promise race with a timeout promise; catch timeout and return `NextResponse.json({ error: 'Request timed out. Please try again or use a smaller range.' }, { status: 503 })`.
