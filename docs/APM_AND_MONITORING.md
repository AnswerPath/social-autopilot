# Application Performance Monitoring (APM) and Thresholds

## Choice and Rationale

**Selected:** Sentry Performance (part of Sentry SDK for Next.js).

- **Rationale:** Single SDK for both performance (25.1) and error tracking/alerting (25.2). Next.js–friendly via `@sentry/nextjs`, automatic instrumentation for API routes and server components. Free tier available; upgrade path for higher volume.
- **Alternatives considered:** Vercel Speed Insights (tied to Vercel), OpenTelemetry + Grafana Cloud (more setup), Datadog (higher cost).

## Critical Paths (KPIs)

Performance and error rate are collected for:

| Path pattern | Description |
|--------------|-------------|
| `/api/twitter/*` | Post, reply, upload, profile, mentions |
| `/api/analytics/*` | Sync, summary, posts, recommendations, export |
| `/api/scheduled-posts/*` | CRUD, bulk, CSV import |
| `/api/scheduler/*` | Queue, dispatch |

## Baseline Thresholds

Used for alerting (25.2) and admin dashboard (25.5).

| Metric | Baseline | Alert if |
|--------|----------|----------|
| p95 latency (API) | < 2s | > 5s |
| Error rate | < 1% | > 5% |
| Throughput | Baseline per env | Drop > 50% sustained |

Thresholds are documented here; actual alert rules are configured in Sentry (see docs for alerting/escalation).

## Instrumentation

- **Server:** `sentry.server.config.ts` + Next.js `instrumentation.ts` (when used).
- **Client:** `sentry.client.config.ts` for client-side navigation and errors.
- **Edge:** `sentry.edge.config.ts` for edge runtime if used.

Traces are sampled (e.g. 10% in prod) to control volume; adjust via `SENTRY_TRACES_SAMPLE_RATE`.

## Pilot Validation Checklist

After APM setup, validate that performance data reaches Sentry:

1. **Set environment variables**
   - `SENTRY_DSN` (or `NEXT_PUBLIC_SENTRY_DSN`) must be set to enable Sentry
   - Optionally set `SENTRY_TRACES_SAMPLE_RATE` (e.g. `1` for 100% during pilot, `0.1` for 10% in prod)

2. **Run the load test**
   - Start the app: `npm run dev` (or production build)
   - Run: `npx artillery run scripts/load-test.yml`
   - The load test hits: scheduler queue, error monitoring health, twitter profile, analytics summary, scheduled posts list, analytics posts

3. **Verify transactions in Sentry**
   - Open Sentry → Performance → Transactions
   - Confirm transactions appear for the critical paths (e.g. `/api/scheduler/queue`, `/api/analytics/summary`)
   - Check that traces show duration and span data

4. **Threshold accuracy (optional)**
   - In Sentry Performance, compare p95 latency and error rate against the baseline thresholds
   - If p95 > 5s or error rate > 5%, investigate before enabling alerts
   - Configure Sentry alert rules to match the thresholds in the table above (see [ALERTING_AND_ESCALATION.md](ALERTING_AND_ESCALATION.md))
