import { NextRequest, NextResponse } from 'next/server'
import { generateCSVTemplate } from '@/lib/csv-parser'

export const runtime = 'nodejs'

export async function GET(_request: NextRequest) {
  try {
    const template = generateCSVTemplate()

    return new NextResponse(template, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="scheduled-posts-template.csv"'
      }
    })
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: 'Failed to generate CSV template',
      details: error.message
    }, { status: 500 })
  }
}

