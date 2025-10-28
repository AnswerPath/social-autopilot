import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    
    return NextResponse.json({
      success: true,
      config: {
        url: supabaseUrl ? `${supabaseUrl.substring(0, 20)}...` : 'MISSING',
        serviceKey: supabaseServiceKey ? `${supabaseServiceKey.substring(0, 20)}...` : 'MISSING',
        anonKey: supabaseAnonKey ? `${supabaseAnonKey.substring(0, 20)}...` : 'MISSING',
        urlLength: supabaseUrl?.length || 0,
        serviceKeyLength: supabaseServiceKey?.length || 0,
        anonKeyLength: supabaseAnonKey?.length || 0
      }
    })
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}
