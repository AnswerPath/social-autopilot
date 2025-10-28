import { NextRequest, NextResponse } from 'next/server'
import { createDemoCredentials, getDatabaseHealth } from '@/lib/database-storage'

export async function POST(request: NextRequest) {
  try {
    console.log('🎭 Creating demo credentials via API...')
    
    // First check database health
    const health = await getDatabaseHealth()
    
    if (!health.success) {
      return NextResponse.json({
        success: false,
        error: 'Database not accessible',
        details: health.error
      }, { status: 500 })
    }
    
    if (!health.tableExists) {
      return NextResponse.json({
        success: false,
        error: 'Database table does not exist',
        details: 'Please run the database setup first'
      }, { status: 500 })
    }
    
    // Create demo credentials
    const result = await createDemoCredentials()
    
    if (result.success) {
      return NextResponse.json({
        success: true,
        message: 'Demo credentials created successfully',
        details: {
          userId: 'demo-user',
          credentialType: 'twitter',
          note: 'These are demo credentials for testing only'
        }
      })
    } else {
      return NextResponse.json({
        success: false,
        error: result.error || 'Failed to create demo credentials'
      }, { status: 500 })
    }
  } catch (error: any) {
    console.error('API Error creating demo credentials:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      details: error.message
    }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    // Check if demo credentials exist
    const health = await getDatabaseHealth()
    
    if (!health.success) {
      return NextResponse.json({
        success: false,
        error: 'Database not accessible',
        details: health.error
      }, { status: 500 })
    }
    
    return NextResponse.json({
      success: true,
      databaseHealth: health,
      demoCredentialsAvailable: health.recordCount > 0
    })
  } catch (error: any) {
    console.error('API Error checking demo credentials:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      details: error.message
    }, { status: 500 })
  }
}
