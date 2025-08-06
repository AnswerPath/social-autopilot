import { NextRequest, NextResponse } from 'next/server'
import { uploadMedia } from '@/lib/twitter-api'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    
    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    
    // Determine media type
    const mediaType = file.type.startsWith('image/') ? 'image' : 'video'
    
    const result = await uploadMedia(buffer, mediaType)

    if (result.success) {
      return NextResponse.json({ mediaId: result.mediaId })
    } else {
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      )
    }
  } catch (error: any) {
    console.error('API Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
