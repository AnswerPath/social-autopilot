import { NextRequest, NextResponse } from 'next/server'
import { uploadMedia } from '@/lib/twitter-api-node'
import { getPlatformConfig } from '@/lib/media-config'

export const runtime = 'nodejs'

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

    // Server-side validation using Twitter specs
    const platformConfig = getPlatformConfig('twitter')
    const mimeType = file.type
    
    // Validate file type
    let isValidType = false
    if (mimeType.startsWith('image/')) {
      isValidType = platformConfig.specs.images.formats.includes(mimeType)
    } else if (mimeType.startsWith('video/')) {
      isValidType = platformConfig.specs.videos.formats.includes(mimeType)
    }
    
    if (!isValidType) {
      return NextResponse.json(
        { error: `File type not supported. Allowed: ${mimeType.startsWith('image/') ? platformConfig.specs.images.formats.join(', ') : platformConfig.specs.videos.formats.join(', ')}` },
        { status: 400 }
      )
    }
    
    // Validate file size
    const maxSize = mimeType.startsWith('image/') 
      ? platformConfig.specs.images.maxSize 
      : platformConfig.specs.videos.maxSize
    
    if (file.size > maxSize) {
      const sizeLabel = mimeType.startsWith('image/') ? 'Image' : 'Video'
      const maxSizeMB = Math.round(maxSize / (1024 * 1024))
      return NextResponse.json(
        { error: `${sizeLabel} too large. Maximum size: ${maxSizeMB}MB` },
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
