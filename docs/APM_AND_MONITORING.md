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

## Pilot Validation

After setup: run a few requests to critical routes (e.g. GET `/api/scheduler/queue`, POST to analytics sync) and confirm transactions appear in Sentry Performance. Optional: light load test with Artillery/k6 to validate throughput and latency under load.
