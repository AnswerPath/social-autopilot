# Feature Flags

## Overview

Feature flags are read from environment variables. Set `FEATURE_<NAME>=true` or `FEATURE_<NAME>=1` to enable. No DB/Redis required for the initial implementation.

## Known flags

| Flag | Env var | Purpose |
|------|---------|---------|
| `analytics_sync_v2` | `FEATURE_ANALYTICS_SYNC_V2` | Use v2 analytics sync pipeline |
| `mention_stream_enabled` | `FEATURE_MENTION_STREAM_ENABLED` | Enable real-time mention stream |
| `approval_workflow_v2` | `FEATURE_APPROVAL_WORKFLOW_V2` | Use v2 approval workflow |

## Usage in code

```ts
import { isEnabled } from '@/lib/feature-flags';

if (isEnabled('analytics_sync_v2', { userId })) {
  // Use v2 path
} else {
  // Use default path
}
```

## Adding a new flag

1. Add the flag name to the `FlagName` type in `lib/feature-flags.ts`.
2. Add a short description to `FLAG_DESCRIPTIONS` in the same file.
3. Use `isEnabled('your_flag_name')` where needed.
4. Document the env var (`FEATURE_YOUR_FLAG_NAME`) in this file and in `.env.example` if desired.

## Toggling at runtime

Currently flags require a process restart (env change). For runtime toggles without restart, add a DB table or Redis key and read it inside `isEnabled()` with a short cache TTL.
