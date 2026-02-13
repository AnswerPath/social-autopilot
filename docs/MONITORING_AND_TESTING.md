# Monitoring and Testing

## Running tests

- **Unit tests:** `npm test` or `npm run test:watch`
- **Coverage:** `npm run test:coverage`
- **CI:** `npm run test:ci`

Relevant suites for monitoring and error handling:

- `__tests__/lib/error-handling.test.ts` – retry delay, normalization, user messages, circuit breaker, ErrorMonitor
- `__tests__/lib/logger.test.ts` – logger and request ID

## APM and Sentry

- **APM:** See [APM_AND_MONITORING.md](APM_AND_MONITORING.md). Set `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` to enable performance and error tracking.
- **Alerting:** See [ALERTING_AND_ESCALATION.md](ALERTING_AND_ESCALATION.md) for Sentry alert rules and escalation.

## Load and chaos (lightweight)

- **Load:** Use Artillery or k6 against critical endpoints. Example (Artillery):

  ```yaml
  # load-test.yml
  config:
    target: "http://localhost:3000"
    phases:
      - duration: 30
        arrivalRate: 5
  scenarios:
    - name: "scheduler queue"
      flow:
        - get:
            url: "/api/scheduler/queue"
    - name: "health"
      flow:
        - get:
            url: "/api/settings/error-monitoring?action=health"
  ```

  Run: `npx artillery run load-test.yml` (create `load-test.yml` in project root or `scripts/`).

- **Chaos:** Manually or via a script: mock X API down (e.g. invalid credentials or network error), trigger a post, assert circuit breaker opens and user sees a friendly error message. No Chaos Monkey required; one scenario is enough to validate behavior.

## Recovery

See [RECOVERY_PROCEDURES.md](RECOVERY_PROCEDURES.md) for scheduler restart, queue retry, circuit breaker reset, and API timeout policy.
