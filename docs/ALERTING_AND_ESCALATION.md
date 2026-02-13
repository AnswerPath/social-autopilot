# Error Tracking and Alerting

## Sentry Integration

- **Error tracking:** `@sentry/nextjs` is configured via `sentry.client.config.ts`, `sentry.server.config.ts`, and `sentry.edge.config.ts`. Set `SENTRY_DSN` (or `NEXT_PUBLIC_SENTRY_DSN`) to enable.
- **API errors:** Errors from [lib/error-handling.ts](../lib/error-handling.ts) are logged and sent to Sentry via `ApiErrorHandler.logError` and `ErrorMonitor.sendAlert`, with context: `service`, `error_type`, `severity`, `userId`, `endpoint`.
- **Unhandled errors:** The Sentry Next.js SDK captures unhandled exceptions in API routes and server/client code automatically.

## Alert Rules (Sentry)

Configure in Sentry Project Settings > Alerts:

| Severity | Condition | Action |
|----------|-----------|--------|
| Critical | 1+ event with tag `severity:critical` | Immediate notification (Slack/email/PagerDuty) |
| High | 5+ events with tag `severity:high` in 15 min | Notify within 15 min |
| Medium | 10+ events with tag `severity:medium` in 1 hour | Daily digest or notify |
| Low | 50+ events with tag `severity:low` in 1 hour | Optional; reduce noise |

Align thresholds with [docs/APM_AND_MONITORING.md](APM_AND_MONITORING.md) (e.g. error rate > 5%).

## Escalation

- **Critical:** Page on-call immediately; resolve or escalate within 30 min.
- **High:** Acknowledge within 15 min; resolve or escalate within 2 hours.
- **Medium:** Address within 24 hours; add to sprint if recurring.
- **Low:** Include in weekly review; no immediate escalation.

## Notification Channels

Configure in Sentry: Slack, email, PagerDuty, or webhooks. Use at least one channel for Critical/High so the team is notified in real time.
