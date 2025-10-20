/**
 * Tests for media validation utilities
 */

import { 
  validateFileType, 
  validateFileSize, 
  validateMediaCount,
  validateMediaFile,
  generateThumbnail,
  createMediaAttachment,
  type MediaAttachment 
} from '@/lib/media-validation'

// Mock File object for testing
function createMockFile(name: string, type: string, size: number): File {
  const file = new File([''], name, { type })
  Object.defineProperty(file, 'size', { value: size })
  return file
}

describe('Media Validation', () => {
  describe('validateFileType', () => {
    it('should accept valid image formats', () => {
      const jpgFile = createMockFile('test.jpg', 'image/jpeg', 1000)
      const pngFile = createMockFile('test.png', 'image/png', 1000)
      const gifFile = createMockFile('test.gif', 'image/gif', 1000)
      const webpFile = createMockFile('test.webp', 'image/webp', 1000)

      expect(validateFileType(jpgFile, 'twitter').isValid).toBe(true)
      expect(validateFileType(pngFile, 'twitter').isValid).toBe(true)
      expect(validateFileType(gifFile, 'twitter').isValid).toBe(true)
      expect(validateFileType(webpFile, 'twitter').isValid).toBe(true)
    })

    it('should accept valid video formats', () => {
      const mp4File = createMockFile('test.mp4', 'video/mp4', 1000)
      const movFile = createMockFile('test.mov', 'video/quicktime', 1000)

      expect(validateFileType(mp4File, 'twitter').isValid).toBe(true)
      expect(validateFileType(movFile, 'twitter').isValid).toBe(true)
    })

    it('should reject invalid formats', () => {
      const pdfFile = createMockFile('test.pdf', 'application/pdf', 1000)
      const txtFile = createMockFile('test.txt', 'text/plain', 1000)
      const bmpFile = createMockFile('test.bmp', 'image/bmp', 1000)

      expect(validateFileType(pdfFile, 'twitter').isValid).toBe(false)
      expect(validateFileType(txtFile, 'twitter').isValid).toBe(false)
      expect(validateFileType(bmpFile, 'twitter').isValid).toBe(false)
    })
  })

  describe('validateFileSize', () => {
    it('should accept files within size limits', () => {
      const smallImage = createMockFile('small.jpg', 'image/jpeg', 4 * 1024 * 1024) // 4MB
      const smallVideo = createMockFile('small.mp4', 'video/mp4', 500 * 1024 * 1024) // 500MB

      expect(validateFileSize(smallImage, 'twitter').isValid).toBe(true)
      expect(validateFileSize(smallVideo, 'twitter').isValid).toBe(true)
    })

    it('should reject files exceeding size limits', () => {
      const largeImage = createMockFile('large.jpg', 'image/jpeg', 6 * 1024 * 1024) // 6MB
      const largeVideo = createMockFile('large.mp4', 'video/mp4', 600 * 1024 * 1024) // 600MB

      expect(validateFileSize(largeImage, 'twitter').isValid).toBe(false)
      expect(validateFileSize(largeVideo, 'twitter').isValid).toBe(false)
    })
  })

  describe('validateMediaCount', () => {
    const mockAttachments: MediaAttachment[] = [
      {
        id: '1',
        file: createMockFile('img1.jpg', 'image/jpeg', 1000),
        thumbnail: 'data:image/jpeg;base64,...',
        type: 'image',
        size: 1000,
        name: 'img1.jpg'
      },
      {
        id: '2',
        file: createMockFile('img2.jpg', 'image/jpeg', 1000),
        thumbnail: 'data:image/jpeg;base64,...',
        type: 'image',
        size: 1000,
        name: 'img2.jpg'
      }
    ]

    it('should allow adding images up to the limit', () => {
      const newImage = createMockFile('img3.jpg', 'image/jpeg', 1000)
      const result = validateMediaCount(mockAttachments, newImage, 'twitter')
      expect(result.isValid).toBe(true)
    })

    it('should reject adding more images than the limit', () => {
      const attachments = Array.from({ length: 4 }, (_, i) => ({
        id: `${i}`,
        file: createMockFile(`img${i}.jpg`, 'image/jpeg', 1000),
        thumbnail: 'data:image/jpeg;base64,...',
        type: 'image' as const,
        size: 1000,
        name: `img${i}.jpg`
      }))

      const newImage = createMockFile('img5.jpg', 'image/jpeg', 1000)
      const result = validateMediaCount(attachments, newImage, 'twitter')
      expect(result.isValid).toBe(false)
      expect(result.error).toContain('Maximum 4 images allowed')
    })

    it('should reject mixing images and videos', () => {
      const imageAttachments = [
        {
          id: '1',
          file: createMockFile('img1.jpg', 'image/jpeg', 1000),
          thumbnail: 'data:image/jpeg;base64,...',
          type: 'image' as const,
          size: 1000,
          name: 'img1.jpg'
        }
      ]

      const videoFile = createMockFile('video.mp4', 'video/mp4', 1000)
      const result = validateMediaCount(imageAttachments, videoFile, 'twitter')
      expect(result.isValid).toBe(false)
      expect(result.error).toContain('Cannot mix images and videos')
    })
  })

  describe('validateMediaFile', () => {
    it('should validate all aspects of a file', () => {
      const validFile = createMockFile('test.jpg', 'image/jpeg', 2 * 1024 * 1024) // 2MB
      const result = validateMediaFile(validFile, [], 'twitter')
      expect(result.isValid).toBe(true)
    })

    it('should fail validation if any aspect is invalid', () => {
      const invalidFile = createMockFile('test.pdf', 'application/pdf', 1000)
      const result = validateMediaFile(invalidFile, [], 'twitter')
      expect(result.isValid).toBe(false)
    })
  })

  describe('generateThumbnail', () => {
    // Note: These tests would require mocking Canvas API
    // For now, we'll test the error cases
    it('should reject non-image files', async () => {
      const videoFile = createMockFile('test.mp4', 'video/mp4', 1000)
      
      await expect(generateThumbnail(videoFile)).rejects.toThrow('File is not an image')
    })
  })
})
