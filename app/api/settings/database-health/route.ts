import { NextRequest, NextResponse } from 'next/server'
import { getDatabaseHealth } from '@/lib/database-storage'

export async function GET(request: NextRequest) {
  try {
    const health = await getDatabaseHealth()
    
    return NextResponse.json(health)
  } catch (error: any) {
    console.error('API Error:', error)
    return NextResponse.json(
      { 
        success: false,
        tableExists: false,
        canRead: false,
        canWrite: false,
        recordCount: 0,
        error: 'Internal server error' 
      },
      { status: 500 }
    )
  }
}
