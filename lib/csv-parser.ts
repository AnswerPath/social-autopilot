import Papa from 'papaparse'

/**
 * CSV parser and validator for scheduled posts import
 */

export interface CSVRow {
  content: string
  scheduled_date: string // YYYY-MM-DD
  scheduled_time: string // HH:MM
  timezone?: string
  media_urls?: string
  platform?: string
}

export interface ParsedScheduledPost {
  content: string
  scheduledDate: string
  scheduledTime: string
  timezone?: string
  mediaUrls?: string[]
  platform?: string
}

export interface CSVParseResult {
  success: boolean
  posts?: ParsedScheduledPost[]
  errors?: Array<{ row: number; error: string; data: any }>
  warnings?: Array<{ row: number; warning: string; data: any }>
}

/**
 * Validate a CSV row
 */
function validateRow(row: any, rowIndex: number): { valid: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = []
  const warnings: string[] = []

  // Check required fields
  if (!row.content || typeof row.content !== 'string' || row.content.trim().length === 0) {
    errors.push('content is required')
  } else if (row.content.length > 280) {
    errors.push('content exceeds 280 characters')
  }

  if (!row.scheduled_date || typeof row.scheduled_date !== 'string') {
    errors.push('scheduled_date is required (format: YYYY-MM-DD)')
  } else {
    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/
    if (!dateRegex.test(row.scheduled_date)) {
      errors.push('scheduled_date must be in format YYYY-MM-DD')
    } else {
      const date = new Date(row.scheduled_date)
      if (isNaN(date.getTime())) {
        errors.push('scheduled_date is not a valid date')
      }
    }
  }

  if (!row.scheduled_time || typeof row.scheduled_time !== 'string') {
    errors.push('scheduled_time is required (format: HH:MM)')
  } else {
    // Validate time format
    const timeRegex = /^\d{2}:\d{2}$/
    if (!timeRegex.test(row.scheduled_time)) {
      errors.push('scheduled_time must be in format HH:MM')
    } else {
      const [hours, minutes] = row.scheduled_time.split(':').map(Number)
      if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
        errors.push('scheduled_time has invalid hours or minutes')
      }
    }
  }

  // Validate timezone if provided
  if (row.timezone && typeof row.timezone === 'string') {
    try {
      // Basic timezone validation
      Intl.DateTimeFormat(undefined, { timeZone: row.timezone })
    } catch {
      warnings.push(`timezone "${row.timezone}" may not be valid`)
    }
  }

  // Validate media URLs if provided
  if (row.media_urls && typeof row.media_urls === 'string' && row.media_urls.trim().length > 0) {
    const urls = row.media_urls.split(',').map((url: string) => url.trim()).filter((url: string) => url.length > 0)
    if (urls.length > 4) {
      warnings.push('media_urls should not exceed 4 URLs')
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  }
}

/**
 * Parse and validate CSV file
 */
export function parseCSVFile(file: File): Promise<CSVParseResult> {
  return new Promise((resolve) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header: string) => {
        // Normalize header names (case-insensitive, handle spaces/underscores)
        return header.toLowerCase().trim().replace(/\s+/g, '_')
      },
      complete: (results: Papa.ParseResult<any>) => {
        const posts: ParsedScheduledPost[] = []
        const errors: Array<{ row: number; error: string; data: any }> = []
        const warnings: Array<{ row: number; warning: string; data: any }> = []

        if (results.errors && results.errors.length > 0) {
          resolve({
            success: false,
            errors: results.errors.map(err => ({
              row: err.row || 0,
              error: err.message || 'CSV parsing error',
              data: null
            }))
          })
          return
        }

        // Validate and parse each row
        results.data.forEach((row: any, index: number) => {
          const rowNumber = index + 2 // +2 because index is 0-based and header is row 1
          const validation = validateRow(row, rowNumber)

          if (!validation.valid) {
            errors.push({
              row: rowNumber,
              error: validation.errors.join('; '),
              data: row
            })
            return
          }

          // Add warnings
          validation.warnings.forEach(warning => {
            warnings.push({
              row: rowNumber,
              warning,
              data: row
            })
          })

          // Parse media URLs
          let mediaUrls: string[] | undefined
          if (row.media_urls && typeof row.media_urls === 'string') {
            mediaUrls = row.media_urls
              .split(',')
              .map((url: string) => url.trim())
              .filter((url: string) => url.length > 0)
          }

          posts.push({
            content: row.content.trim(),
            scheduledDate: row.scheduled_date.trim(),
            scheduledTime: row.scheduled_time.trim(),
            timezone: row.timezone?.trim() || undefined,
            mediaUrls,
            platform: row.platform?.trim() || undefined
          })
        })

        resolve({
          success: errors.length === 0,
          posts: errors.length === 0 ? posts : undefined,
          errors: errors.length > 0 ? errors : undefined,
          warnings: warnings.length > 0 ? warnings : undefined
        })
      },
      error: (error: Error) => {
        resolve({
          success: false,
          errors: [{
            row: 0,
            error: error.message || 'Failed to parse CSV file',
            data: null
          }]
        })
      }
    })
  })
}

/**
 * Generate CSV template content
 */
export function generateCSVTemplate(): string {
  const rows = [
    ['content', 'scheduled_date', 'scheduled_time', 'timezone', 'media_urls', 'platform'],
    ['Example post content', '2025-02-01', '09:00', 'America/New_York', '', 'twitter'],
    ['Another example', '2025-02-02', '14:30', 'UTC', 'https://example.com/image1.jpg,https://example.com/image2.jpg', 'twitter'],
  ]

  return Papa.unparse(rows)
}

