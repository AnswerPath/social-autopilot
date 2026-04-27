/**
 * Optional debug telemetry (local RLS / credential diagnostics).
 * No-op unless DEBUG_RLS_INGEST=true — avoids production noise and unawaited fire-and-forget fetches.
 */
const INGEST_URL = 'http://127.0.0.1:7242/ingest/02db0ba7-e7e9-4c3a-b6c8-00220ae7f134'

export function isDebugRlsIngestEnabled(): boolean {
  return process.env.DEBUG_RLS_INGEST === 'true'
}

export async function sendDebugIngest(payload: Record<string, unknown>): Promise<void> {
  if (!isDebugRlsIngestEnabled()) return
  try {
    await fetch(INGEST_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Debug-Session-Id': '62a58b',
      },
      body: JSON.stringify(payload),
    })
  } catch (e) {
    console.warn('[debug-ingest] fetch failed:', e instanceof Error ? e.message : e)
  }
}
