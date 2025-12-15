"use client"

import { useMemo, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

interface PostAnalyticsData {
  postId: string
  tweetId: string
  content: string
  postedAt: string
  analytics: Array<{
    likes: number
    retweets: number
    replies: number
    impressions?: number
    collected_at: Date
  }>
  latest: {
    likes: number
    retweets: number
    replies: number
    impressions?: number
  } | null
}

interface PerformanceHeatmapProps {
  data: PostAnalyticsData[]
  loading?: boolean
}

interface DayData {
  date: Date
  engagementRate: number
  totalEngagement: number
  impressions: number
  postCount: number
  intensity: number // 0-4 scale for color intensity
}

export function PerformanceHeatmap({ data, loading = false }: PerformanceHeatmapProps) {

  // Group posts by date and calculate daily metrics
  const dailyData = useMemo(() => {
    const dayMap = new Map<string, DayData>()

    data
      .filter(post => post.latest)
      .forEach(post => {
        const date = new Date(post.postedAt)
        const dateKey = date.toISOString().split('T')[0]
        
        const latest = post.latest!
        const totalEngagement = latest.likes + latest.retweets + latest.replies
        const engagementRate = latest.impressions && latest.impressions > 0
          ? (totalEngagement / latest.impressions) * 100
          : 0

        const existing = dayMap.get(dateKey)
        if (existing) {
          existing.totalEngagement += totalEngagement
          existing.impressions += latest.impressions || 0
          existing.postCount += 1
          // Recalculate average engagement rate
          existing.engagementRate = existing.impressions > 0
            ? (existing.totalEngagement / existing.impressions) * 100
            : 0
        } else {
          dayMap.set(dateKey, {
            date,
            engagementRate,
            totalEngagement,
            impressions: latest.impressions || 0,
            postCount: 1,
            intensity: 0 // Will be calculated below
          })
        }
      })

    // Calculate intensity levels (0-4 scale) based on engagement rate
    const engagementRates = Array.from(dayMap.values())
      .map(d => d.engagementRate)
      .filter(r => r > 0)
      .sort((a, b) => a - b)

    if (engagementRates.length > 0) {
      const min = engagementRates[0]
      const max = engagementRates[engagementRates.length - 1]
      const range = max - min

      dayMap.forEach((dayData) => {
        if (dayData.engagementRate > 0 && range > 0) {
          // Normalize to 0-4 scale
          const normalized = ((dayData.engagementRate - min) / range) * 4
          dayData.intensity = Math.min(4, Math.max(0, Math.round(normalized)))
        } else {
          dayData.intensity = 0
        }
      })
    }

    return Array.from(dayMap.values())
  }, [data])

  // Generate calendar grid (weeks × days)
  const calendarGrid = useMemo(() => {
    if (dailyData.length === 0) return []

    // Get date range
    const dates = dailyData.map(d => d.date).sort((a, b) => a.getTime() - b.getTime())
    const startDate = dates[0]
    const endDate = dates[dates.length - 1]

    // Create a map for quick lookup
    const dataMap = new Map<string, DayData>()
    dailyData.forEach(day => {
      const key = day.date.toISOString().split('T')[0]
      dataMap.set(key, day)
    })

    // Get the first day of the week for start date (Sunday = 0)
    const startDayOfWeek = startDate.getDay()
    const firstDay = new Date(startDate)
    firstDay.setDate(firstDay.getDate() - startDayOfWeek)

    // Get the last day of the week for end date
    const endDayOfWeek = endDate.getDay()
    const lastDay = new Date(endDate)
    lastDay.setDate(lastDay.getDate() + (6 - endDayOfWeek))

    // Generate all days in range
    const allDays: (DayData | null)[] = []
    const current = new Date(firstDay)
    
    while (current <= lastDay) {
      const key = current.toISOString().split('T')[0]
      const dayData = dataMap.get(key)
      
      if (current >= startDate && current <= endDate) {
        allDays.push(dayData || null)
      } else {
        allDays.push(null) // Day outside range
      }
      
      current.setDate(current.getDate() + 1)
    }

    // Group into weeks (7 days per week)
    const weeks: (DayData | null)[][] = []
    for (let i = 0; i < allDays.length; i += 7) {
      weeks.push(allDays.slice(i, i + 7))
    }

    return weeks
  }, [dailyData])

  // Get color intensity class
  const getIntensityClass = (intensity: number): string => {
    switch (intensity) {
      case 0:
        return 'bg-gray-100 hover:bg-gray-200'
      case 1:
        return 'bg-blue-100 hover:bg-blue-200'
      case 2:
        return 'bg-blue-300 hover:bg-blue-400'
      case 3:
        return 'bg-blue-500 hover:bg-blue-600'
      case 4:
        return 'bg-blue-700 hover:bg-blue-800'
      default:
        return 'bg-gray-100 hover:bg-gray-200'
    }
  }

  // Format date for tooltip
  const formatDate = (date: Date): string => {
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    })
  }

  // Check if date is today
  const isToday = (date: Date): boolean => {
    const today = new Date()
    return date.toDateString() === today.toDateString()
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <div className="h-6 w-48 bg-gray-200 rounded animate-pulse" />
          <div className="h-4 w-64 bg-gray-200 rounded animate-pulse mt-2" />
        </CardHeader>
        <CardContent>
          <div className="h-[300px] bg-gray-200 rounded animate-pulse" />
        </CardContent>
      </Card>
    )
  }

  if (dailyData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Performance Heatmap</CardTitle>
          <CardDescription>Daily engagement rate intensity over time</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] flex items-center justify-center">
            <div className="text-sm text-muted-foreground">No performance data available</div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Performance Heatmap</CardTitle>
        <CardDescription>Daily engagement rate intensity over time</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Calendar Grid */}
          <div className="overflow-x-auto">
            <div className="inline-block min-w-full">
              <div className="flex gap-1">
                {/* Day labels */}
                <div className="flex flex-col gap-1 mr-2">
                  <div className="h-4"></div>
                  {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
                    <div key={i} className="h-3 w-3 text-xs text-muted-foreground text-center">
                      {day}
                    </div>
                  ))}
                </div>
                
                {/* Weeks */}
                <div className="flex gap-1">
                  {calendarGrid.map((week, weekIndex) => (
                    <div key={weekIndex} className="flex flex-col gap-1">
                      {/* Week label (first day of week) */}
                      {weekIndex === 0 && (
                        <div className="h-4 text-xs text-muted-foreground">
                          {week[0]?.date ? week[0].date.toLocaleDateString('en-US', { month: 'short' }) : ''}
                        </div>
                      )}
                      {weekIndex > 0 && week[0]?.date && 
                       calendarGrid[weekIndex - 1][0]?.date &&
                       week[0].date.getMonth() !== calendarGrid[weekIndex - 1][0].date.getMonth() && (
                        <div className="h-4 text-xs text-muted-foreground">
                          {week[0].date.toLocaleDateString('en-US', { month: 'short' })}
                        </div>
                      )}
                      {(!week[0]?.date || (weekIndex > 0 && week[0].date.getMonth() === calendarGrid[weekIndex - 1][0]?.date.getMonth())) && (
                        <div className="h-4"></div>
                      )}
                      
                      {/* Days */}
                      {week.map((day, dayIndex) => {
                        if (!day) {
                          return (
                            <div
                              key={dayIndex}
                              className="w-3 h-3 rounded-sm border border-gray-200 bg-gray-50"
                            />
                          )
                        }
                        return (
                          <TooltipProvider key={dayIndex}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div
                                  className={cn(
                                    "w-3 h-3 rounded-sm border border-gray-200 transition-colors cursor-pointer",
                                    getIntensityClass(day.intensity),
                                    isToday(day.date) && 'ring-2 ring-blue-500 ring-offset-1'
                                  )}
                                />
                              </TooltipTrigger>
                              <TooltipContent>
                                <div className="space-y-1">
                                  <div className="font-medium">{formatDate(day.date)}</div>
                                  <div className="text-xs space-y-0.5">
                                    <div>Engagement Rate: {day.engagementRate.toFixed(2)}%</div>
                                    <div>Impressions: {day.impressions.toLocaleString()}</div>
                                    <div>Posts: {day.postCount}</div>
                                  </div>
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span>Less</span>
            <div className="flex gap-1">
              <div className="w-3 h-3 rounded-sm bg-gray-100 border border-gray-200" />
              <div className="w-3 h-3 rounded-sm bg-blue-100 border border-gray-200" />
              <div className="w-3 h-3 rounded-sm bg-blue-300 border border-gray-200" />
              <div className="w-3 h-3 rounded-sm bg-blue-500 border border-gray-200" />
              <div className="w-3 h-3 rounded-sm bg-blue-700 border border-gray-200" />
            </div>
            <span>More</span>
          </div>

        </div>
      </CardContent>
    </Card>
  )
}
