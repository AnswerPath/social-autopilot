import { NextRequest, NextResponse } from 'next/server'
import { generateCSVTemplate } from '@/lib/csv-parser'

export const runtime = 'nodejs'

/**
 * Download CSV template for scheduled posts import
 * GET /api/scheduled-posts/csv-template
 */
export async function GET(_request: NextRequest) {
  try {
    const template = generateCSVTemplate()

    return new NextResponse(template, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="scheduled-posts-template.csv"'
      }
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to generate CSV template'
    console.error('CSV template generation error:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to generate CSV template',
      details: errorMessage
    }, { status: 500 })
  }
}


