import { NextRequest, NextResponse } from 'next/server'
import { processQueue } from '@/lib/job-queue'

export const runtime = 'nodejs'

/**
 * Enhanced dispatch endpoint with job queue processing and retry logic
 */
export async function POST(_request: NextRequest) {
  try {
    const result = await processQueue()

    return NextResponse.json({
      success: true,
      processed: result.processed,
      results: result.results
    })
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: 'Dispatch failed',
      details: error.message
    }, { status: 500 })
  }
}


