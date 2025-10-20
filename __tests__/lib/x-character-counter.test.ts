import {
  calculateXCharacterCount,
  getCharacterCountBreakdown,
  exceedsCharacterLimit,
  getRemainingCharacters,
  getCharacterCountStatus
} from '@/lib/x-character-counter'

describe('X Character Counter', () => {
  describe('calculateXCharacterCount', () => {
    it('should count basic text correctly', () => {
      expect(calculateXCharacterCount('Hello world')).toBe(11)
      expect(calculateXCharacterCount('')).toBe(0)
      expect(calculateXCharacterCount('a')).toBe(1)
    })

    it('should count URLs as 23 characters', () => {
      expect(calculateXCharacterCount('https://example.com')).toBe(23)
      expect(calculateXCharacterCount('http://test.org')).toBe(23)
      expect(calculateXCharacterCount('Check this out: https://example.com')).toBe(39) // 16 + 23
    })

    it('should handle multiple URLs', () => {
      const text = 'Visit https://example.com and https://test.org'
      expect(calculateXCharacterCount(text)).toBe(57) // 11 + 23 + 23
    })

    it('should handle mixed content with URLs', () => {
      const text = 'Hello world! Check out https://example.com for more info.'
      expect(calculateXCharacterCount(text)).toBe(61) // 38 + 23
    })

    it('should handle URLs with query parameters', () => {
      expect(calculateXCharacterCount('https://example.com?param=value&other=test')).toBe(23)
    })

    it('should handle URLs with fragments', () => {
      expect(calculateXCharacterCount('https://example.com#section')).toBe(23)
    })

    it('should handle emoji correctly', () => {
      // Emoji should be counted as single characters
      expect(calculateXCharacterCount('Hello 😀')).toBe(7) // 6 + 1
      expect(calculateXCharacterCount('😀😀😀')).toBe(3)
    })

    it('should handle CJK characters correctly', () => {
      expect(calculateXCharacterCount('你好世界')).toBe(4)
      expect(calculateXCharacterCount('Hello 世界')).toBe(8) // 6 + 2
    })

    it('should handle complex mixed content', () => {
      const text = 'Hello 😀! Check https://example.com and visit 世界'
      expect(calculateXCharacterCount(text)).toBe(51) // 28 + 23
    })
  })

  describe('getCharacterCountBreakdown', () => {
    it('should provide detailed breakdown for simple text', () => {
      const result = getCharacterCountBreakdown('Hello world')
      expect(result).toEqual({
        totalCount: 11,
        textCharacters: 11,
        urlCount: 0,
        urlCharacters: 0,
        urls: []
      })
    })

    it('should provide detailed breakdown for text with URLs', () => {
      const result = getCharacterCountBreakdown('Check https://example.com')
      expect(result).toEqual({
        totalCount: 29,
        textCharacters: 6,
        urlCount: 1,
        urlCharacters: 23,
        urls: ['https://example.com']
      })
    })

    it('should provide detailed breakdown for multiple URLs', () => {
      const result = getCharacterCountBreakdown('https://example.com and https://test.org')
      expect(result).toEqual({
        totalCount: 51,
        textCharacters: 5,
        urlCount: 2,
        urlCharacters: 46,
        urls: ['https://example.com', 'https://test.org']
      })
    })

    it('should handle empty text', () => {
      const result = getCharacterCountBreakdown('')
      expect(result).toEqual({
        totalCount: 0,
        textCharacters: 0,
        urlCount: 0,
        urlCharacters: 0,
        urls: []
      })
    })
  })

  describe('exceedsCharacterLimit', () => {
    it('should return false for text within limit', () => {
      expect(exceedsCharacterLimit('Hello world')).toBe(false)
      expect(exceedsCharacterLimit('a'.repeat(280))).toBe(false)
    })

    it('should return true for text exceeding limit', () => {
      expect(exceedsCharacterLimit('a'.repeat(281))).toBe(true)
    })

    it('should work with custom limits', () => {
      expect(exceedsCharacterLimit('Hello', 3)).toBe(true)
      expect(exceedsCharacterLimit('Hi', 3)).toBe(false)
    })

    it('should account for URL shortening', () => {
      // 12 URLs * 23 characters + 12 spaces = 288 characters
      const text = 'https://example.com '.repeat(12)
      expect(exceedsCharacterLimit(text)).toBe(true) // 288 > 280
      
      // 11 URLs * 23 characters + 11 spaces = 264 characters
      const textUnderLimit = 'https://example.com '.repeat(11)
      expect(exceedsCharacterLimit(textUnderLimit)).toBe(false) // 264 < 280
    })
  })

  describe('getRemainingCharacters', () => {
    it('should return positive for text within limit', () => {
      expect(getRemainingCharacters('Hello')).toBe(275)
      expect(getRemainingCharacters('a'.repeat(280))).toBe(0)
    })

    it('should return negative for text exceeding limit', () => {
      expect(getRemainingCharacters('a'.repeat(281))).toBe(-1)
    })

    it('should work with custom limits', () => {
      expect(getRemainingCharacters('Hello', 10)).toBe(5)
      expect(getRemainingCharacters('Hello world', 10)).toBe(-1)
    })
  })

  describe('getCharacterCountStatus', () => {
    it('should return safe status for low character count', () => {
      const result = getCharacterCountStatus('Hello')
      expect(result.status).toBe('safe')
      expect(result.color).toBe('text-muted-foreground')
      expect(result.message).toBe('')
    })

    it('should return warning status for approaching limit', () => {
      const text = 'a'.repeat(200) // 71% of 280
      const result = getCharacterCountStatus(text)
      expect(result.status).toBe('warning')
      expect(result.color).toBe('text-yellow-600')
      expect(result.message).toBe('Approaching character limit')
    })

    it('should return danger status for near limit', () => {
      const text = 'a'.repeat(260) // 93% of 280
      const result = getCharacterCountStatus(text)
      expect(result.status).toBe('danger')
      expect(result.color).toBe('text-orange-600')
      expect(result.message).toBe('Near character limit')
    })

    it('should return critical status for exceeding limit', () => {
      const text = 'a'.repeat(285)
      const result = getCharacterCountStatus(text)
      expect(result.status).toBe('critical')
      expect(result.color).toBe('text-red-600 font-bold')
      expect(result.message).toBe('Exceeds limit by 5 characters')
    })

    it('should work with custom limits', () => {
      const text = 'a'.repeat(8) // 80% of 10
      const result = getCharacterCountStatus(text, 10)
      expect(result.status).toBe('warning')
    })
  })

  describe('Edge cases', () => {
    it('should handle null and undefined input', () => {
      expect(calculateXCharacterCount(null as any)).toBe(0)
      expect(calculateXCharacterCount(undefined as any)).toBe(0)
    })

    it('should handle URLs without protocol', () => {
      // URLs without protocol should not be counted as URLs
      expect(calculateXCharacterCount('example.com')).toBe(11)
    })

    it('should handle malformed URLs', () => {
      expect(calculateXCharacterCount('https://')).toBe(8) // Not a valid URL
      expect(calculateXCharacterCount('http://')).toBe(7) // Not a valid URL
    })

    it('should handle URLs with spaces', () => {
      expect(calculateXCharacterCount('https://example.com test')).toBe(28) // 5 + 23
    })

    it('should handle very long URLs', () => {
      const longUrl = 'https://example.com/' + 'a'.repeat(1000)
      expect(calculateXCharacterCount(longUrl)).toBe(23)
    })
  })
})
