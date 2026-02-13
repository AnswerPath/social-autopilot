#!/usr/bin/env node

/**
 * Scheduled Posts Worker
 * 
 * This script runs continuously and processes scheduled posts every minute.
 * It can be run as a standalone process or with PM2 for production.
 * 
 * Usage:
 *   node scripts/scheduler-worker.js
 *   pm2 start scripts/scheduler-worker.js --name scheduler
 */

import { createRequire } from 'module'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { config } from 'dotenv'

const require = createRequire(import.meta.url)
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const log = require(join(__dirname, 'logger.js'))

// Load environment variables
config({ path: join(__dirname, '..', '.env.local') })
config({ path: join(__dirname, '..', '.env') })

const INTERVAL_MS = 60 * 1000 // 1 minute

// Configuration
const config_interval = process.env.SCHEDULER_INTERVAL_MS
  ? parseInt(process.env.SCHEDULER_INTERVAL_MS, 10)
  : INTERVAL_MS

// Get the API URL (defaults to localhost:3000 for development)
const API_URL = process.env.NEXT_PUBLIC_APP_URL || 
                process.env.API_URL || 
                'http://localhost:3000'

let isProcessing = false
let lastProcessTime = null
let consecutiveErrors = 0
const MAX_CONSECUTIVE_ERRORS = 10

/**
 * Process the scheduled posts queue by calling the API endpoint
 */
async function runScheduler() {
  // Prevent concurrent executions
  if (isProcessing) {
    log.info('Skipping: Previous run still in progress')
    return
  }

  isProcessing = true
  const startTime = Date.now()

  try {
    log.info('Processing scheduled posts queue')
    
    // Call the dispatch API endpoint
    const response = await fetch(`${API_URL}/api/scheduler/dispatch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Add a custom header to identify worker requests
        'X-Scheduler-Worker': 'true'
      }
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`API returned ${response.status}: ${errorText}`)
    }
    
    const result = await response.json()
    const duration = Date.now() - startTime
    lastProcessTime = new Date()
    consecutiveErrors = 0

    if (result.processed > 0) {
      log.info({ processed: result.processed, duration }, 'Processed posts')
      if (result.results && Array.isArray(result.results)) {
        result.results.forEach((r) => {
          log.info({ jobId: r.id, status: r.status, error: r.error }, 'Job result')
        })
      }
    } else {
      log.info({ duration }, 'No posts to process')
    }

  } catch (error) {
    consecutiveErrors++
    const duration = Date.now() - startTime
    log.error({ err: error, duration, consecutiveErrors }, 'Error processing queue')
    if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
      log.fatal({ consecutiveErrors }, 'Too many consecutive errors, exiting')
      process.exit(1)
    }
  } finally {
    isProcessing = false
  }
}

/**
 * Health check endpoint (optional - for monitoring)
 */
async function startHealthCheck() {
  // Simple HTTP server for health checks (optional)
  if (process.env.ENABLE_HEALTH_CHECK === 'true') {
    const http = await import('http')
    const port = process.env.HEALTH_CHECK_PORT || 3001
    
    http.default.createServer((req, res) => {
      if (req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({
          status: 'healthy',
          lastProcessTime: lastProcessTime?.toISOString() || null,
          consecutiveErrors,
          isProcessing
        }))
      } else {
        res.writeHead(404)
        res.end('Not Found')
      }
    }).listen(port, () => {
      log.info({ port }, 'Health check server running')
    })
  }
}

/**
 * Main entry point
 */
async function main() {
  log.info({ intervalSec: config_interval / 1000, apiUrl: API_URL, env: process.env.NODE_ENV || 'development' }, 'Scheduled Posts Worker starting')
  try {
    await fetch(`${API_URL}/api/scheduler/dispatch`, { method: 'GET', headers: { 'X-Scheduler-Worker': 'true' } })
    log.info('API endpoint is accessible')
  } catch (error) {
    log.warn({ err: error }, 'Could not reach API endpoint; ensure Next.js app is running if using localhost')
  }
  if (process.env.ENABLE_HEALTH_CHECK === 'true') {
    await startHealthCheck()
  }
  await runScheduler()
  setInterval(runScheduler, config_interval)
  log.info({ intervalSec: config_interval / 1000 }, 'Worker running')
  process.on('SIGINT', () => {
    log.info('Shutting down gracefully')
    process.exit(0)
  })
  process.on('SIGTERM', () => {
    log.info('Shutting down gracefully')
    process.exit(0)
  })
}

main().catch(error => {
  log.fatal({ err: error }, 'Fatal error starting worker')
  process.exit(1)
})

