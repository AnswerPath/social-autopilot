import { fromZonedTime, toZonedTime, formatInTimeZone } from 'date-fns-tz'
import { addMinutes, differenceInMinutes, format } from 'date-fns'

/**
 * Timezone utility functions for scheduling system
 */

/**
 * Convert a date/time in a specific timezone to UTC
 * @param dateString - Date string in format 'YYYY-MM-DD'
 * @param timeString - Time string in format 'HH:MM'
 * @param timezone - IANA timezone identifier (e.g., 'America/New_York')
 * @returns UTC Date object
 */
export function convertToUtc(
  dateString: string,
  timeString: string,
  timezone: string = 'UTC'
): Date {
  try {
    // Combine date and time without timezone info (local time)
    const dateTimeString = `${dateString}T${timeString}:00`
    
    // Convert from the specified timezone to UTC using date-fns-tz
    // This assumes the date/time is in the specified timezone
    const localDate = new Date(dateTimeString)
    const utcDate = fromZonedTime(localDate, timezone)
    
    return utcDate
  } catch (error) {
    throw new Error(`Failed to convert to UTC: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Convert a UTC date to a specific timezone
 * @param utcDate - UTC Date object
 * @param timezone - IANA timezone identifier
 * @returns Date object in the specified timezone
 */
export function convertFromUtc(
  utcDate: Date,
  timezone: string = 'UTC'
): Date {
  try {
    return toZonedTime(utcDate, timezone)
  } catch (error) {
    throw new Error(`Failed to convert from UTC: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Format a UTC date for display in a specific timezone
 * @param utcDate - UTC Date object
 * @param timezone - IANA timezone identifier
 * @param formatString - Date format string (default: 'yyyy-MM-dd HH:mm')
 * @returns Formatted date string
 */
export function formatInTimezone(
  utcDate: Date,
  timezone: string = 'UTC',
  formatString: string = 'yyyy-MM-dd HH:mm'
): string {
  try {
    return formatInTimeZone(utcDate, timezone, formatString)
  } catch (error) {
    throw new Error(`Failed to format date: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Get the current time in a specific timezone
 * @param timezone - IANA timezone identifier
 * @returns Current Date object in the specified timezone
 */
export function getCurrentTimeInTimezone(timezone: string = 'UTC'): Date {
  return toZonedTime(new Date(), timezone)
}

/**
 * Validate if a timezone string is valid IANA timezone
 * @param timezone - Timezone string to validate
 * @returns true if valid, false otherwise
 */
export function isValidTimezone(timezone: string): boolean {
  try {
    // Try to use the timezone - if it throws, it's invalid
    toZonedTime(new Date(), timezone)
    return true
  } catch {
    return false
  }
}

/**
 * Get common timezones list for UI dropdowns
 */
export function getCommonTimezones(): Array<{ value: string; label: string; offset: string }> {
  const timezones = [
    { value: 'America/New_York', label: 'Eastern Time (ET)', offset: 'UTC-5' },
    { value: 'America/Chicago', label: 'Central Time (CT)', offset: 'UTC-6' },
    { value: 'America/Denver', label: 'Mountain Time (MT)', offset: 'UTC-7' },
    { value: 'America/Los_Angeles', label: 'Pacific Time (PT)', offset: 'UTC-8' },
    { value: 'Europe/London', label: 'London (GMT)', offset: 'UTC+0' },
    { value: 'Europe/Paris', label: 'Paris (CET)', offset: 'UTC+1' },
    { value: 'Asia/Tokyo', label: 'Tokyo (JST)', offset: 'UTC+9' },
    { value: 'Asia/Shanghai', label: 'Shanghai (CST)', offset: 'UTC+8' },
    { value: 'Australia/Sydney', label: 'Sydney (AEDT)', offset: 'UTC+10' },
    { value: 'UTC', label: 'UTC', offset: 'UTC+0' },
  ]
  
  return timezones
}

/**
 * Get user's timezone from browser
 * @returns IANA timezone identifier
 */
export function getUserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone
  } catch {
    return 'UTC'
  }
}

