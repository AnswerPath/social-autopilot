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
    console.log('⏭️  Skipping: Previous run still in progress')
    return
  }

  isProcessing = true
  const startTime = Date.now()

  try {
    console.log(`\n🔄 [${new Date().toISOString()}] Processing scheduled posts queue...`)
    
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
      console.log(`✅ Processed ${result.processed} post(s) in ${duration}ms`)
      
      // Log details for each processed post
      if (result.results && Array.isArray(result.results)) {
        result.results.forEach((r) => {
          if (r.status === 'published') {
            console.log(`   📤 Post ${r.id}: Published successfully`)
          } else if (r.status === 'failed') {
            console.log(`   ❌ Post ${r.id}: Failed - ${r.error || 'Unknown error'}`)
          } else if (r.status === 'scheduled_retry') {
            console.log(`   🔄 Post ${r.id}: Scheduled for retry - ${r.error || 'Unknown error'}`)
          } else if (r.status === 'skipped') {
            console.log(`   ⏭️  Post ${r.id}: Skipped - ${r.error || 'Unknown error'}`)
          }
        })
      }
    } else {
      console.log(`ℹ️  No posts to process (${duration}ms)`)
    }

  } catch (error) {
    consecutiveErrors++
    const duration = Date.now() - startTime
    
    console.error(`❌ Error processing queue (${duration}ms):`, error.message)
    if (error.stack) {
      console.error('   Stack:', error.stack)
    }
    
    // If too many consecutive errors, exit and let PM2/systemd restart
    if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
      console.error(`\n💥 Too many consecutive errors (${consecutiveErrors}). Exiting...`)
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
      console.log(`🏥 Health check server running on port ${port}`)
    })
  }
}

/**
 * Main entry point
 */
async function main() {
  console.log('🚀 Scheduled Posts Worker Starting...')
  console.log(`   Interval: ${config_interval / 1000}s`)
  console.log(`   API URL: ${API_URL}`)
  console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`)
  
  // Check that the API is accessible
  try {
    const healthCheck = await fetch(`${API_URL}/api/scheduler/dispatch`, {
      method: 'GET',
      headers: { 'X-Scheduler-Worker': 'true' }
    })
    console.log('✅ API endpoint is accessible')
  } catch (error) {
    console.warn('⚠️  Warning: Could not reach API endpoint:', error.message)
    console.warn('   Make sure your Next.js app is running if using localhost')
  }
  
  // Start health check server if enabled
  if (process.env.ENABLE_HEALTH_CHECK === 'true') {
    await startHealthCheck()
  }
  
  // Process immediately on startup
  await runScheduler()
  
  // Then process on interval
  setInterval(runScheduler, config_interval)
  
  console.log(`\n✅ Worker running. Processing every ${config_interval / 1000} seconds...`)
  console.log('   Press Ctrl+C to stop\n')
  
  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n\n🛑 Shutting down gracefully...')
    process.exit(0)
  })
  
  process.on('SIGTERM', () => {
    console.log('\n\n🛑 Shutting down gracefully...')
    process.exit(0)
  })
}

// Run the worker
main().catch(error => {
  console.error('💥 Fatal error starting worker:', error)
  process.exit(1)
})

