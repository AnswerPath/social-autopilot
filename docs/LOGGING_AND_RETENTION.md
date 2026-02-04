# Structured Logging and Retention

## Logger

- **Module:** `lib/logger.ts`
- **Backend:** Pino (JSON in production, pretty-print in development).
- **Context fields:** `requestId`, `userId`, `service`, plus any custom keys.

## Request ID

- Set per request via `middleware.ts` for `/api/*` routes as `x-request-id`.
- In API route handlers, read with `request.headers.get('x-request-id')` and pass to `createLogger({ requestId })`.

## Retention and Aggregation

- **Development:** Logs go to stdout (pretty). No retention policy.
- **Production:** Logs are JSON to stdout. Retention is determined by your host:
  - **Vercel:** Log drain to a provider (e.g. Axiom, Datadog); set retention there.
  - **Self-hosted:** Use a log shipper (e.g. Vector, Fluentd) to ELK, Loki, or Axiom; set retention in that backend.
- **Recommendation:** Retain at least 7 days for errors, 24–48 hours for info/debug. Document actual retention in your runbook.

## Usage in Code

```ts
import { createLogger } from '@/lib/logger';

// In an API route:
const requestId = request.headers.get('x-request-id') ?? undefined;
const log = createLogger({ requestId, service: 'api/twitter/post' });
log.info({ userId }, 'Post requested');
log.error({ err: error }, 'Post failed');
```
