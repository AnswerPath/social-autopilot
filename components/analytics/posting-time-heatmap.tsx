"use client"

import { useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { Skeleton } from "@/components/ui/skeleton"

interface PostingTimeHeatmapProps {
  data: number[][] // 7x24 matrix: [dayOfWeek][hour] = engagement rate
  loading?: boolean
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const HOUR_LABELS = Array.from({ length: 24 }, (_, i) => {
  const hour = i === 0 ? 12 : i > 12 ? i - 12 : i
  const period = i >= 12 ? 'PM' : 'AM'
  return `${hour}${period}`
})

export function PostingTimeHeatmap({ data, loading = false }: PostingTimeHeatmapProps) {
  // Calculate intensity levels for color coding
  const { maxRate, minRate } = useMemo(() => {
    if (!data || data.length === 0) return { maxRate: 0, minRate: 0 }
    
    const rates = data.flat().filter(rate => rate > 0)
    if (rates.length === 0) return { maxRate: 0, minRate: 0 }
    
    return {
      maxRate: Math.max(...rates),
      minRate: Math.min(...rates),
    }
  }, [data])

  const getIntensity = (rate: number): number => {
    if (rate === 0 || maxRate === minRate) return 0
    const normalized = ((rate - minRate) / (maxRate - minRate)) * 4
    return Math.min(4, Math.max(0, Math.round(normalized)))
  }

  const getColorClass = (intensity: number): string => {
    switch (intensity) {
      case 0:
        return 'bg-gray-100 hover:bg-gray-200'
      case 1:
        return 'bg-blue-100 hover:bg-blue-200'
      case 2:
        return 'bg-blue-300 hover:bg-blue-400'
      case 3:
        return 'bg-blue-500 hover:bg-blue-600 text-white'
      case 4:
        return 'bg-blue-700 hover:bg-blue-800 text-white'
      default:
        return 'bg-gray-100'
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Optimal Posting Times</CardTitle>
          <CardDescription>Heatmap showing engagement rates by time of day</CardDescription>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[400px] w-full" />
        </CardContent>
      </Card>
    )
  }

  if (!data || data.length === 0 || maxRate === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Optimal Posting Times</CardTitle>
          <CardDescription>Heatmap showing engagement rates by time of day</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground py-8">
            <p>No data available for heatmap</p>
            <p className="text-sm mt-2">Post more content to see optimal posting times</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Optimal Posting Times</CardTitle>
        <CardDescription>
          Heatmap showing engagement rates by day and hour. Darker colors indicate higher engagement.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <div className="inline-block min-w-full">
            {/* Header row with hour labels */}
            <div className="flex mb-2">
              <div className="w-16 flex-shrink-0" /> {/* Spacer for day names */}
              <div className="flex flex-1 gap-1">
                {HOUR_LABELS.map((label, hour) => (
                  <div
                    key={hour}
                    className="flex-1 text-xs text-center text-muted-foreground font-medium"
                    style={{ minWidth: '24px' }}
                  >
                    {hour % 2 === 0 ? label : ''}
                  </div>
                ))}
              </div>
            </div>

            {/* Heatmap grid */}
            <div className="space-y-1">
              {DAY_NAMES.map((dayName, dayIndex) => (
                <div key={dayIndex} className="flex items-center gap-2">
                  {/* Day name */}
                  <div className="w-14 flex-shrink-0 text-sm font-medium text-right">
                    {dayName}
                  </div>

                  {/* Hour cells */}
                  <div className="flex flex-1 gap-1">
                    {Array.from({ length: 24 }).map((_, hour) => {
                      const rate = data[dayIndex]?.[hour] || 0
                      const intensity = getIntensity(rate)
                      const colorClass = getColorClass(intensity)

                      return (
                        <TooltipProvider key={hour}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div
                                className={cn(
                                  'flex-1 h-8 rounded cursor-pointer transition-colors',
                                  colorClass,
                                  'border border-gray-200'
                                )}
                                style={{ minWidth: '24px' }}
                              />
                            </TooltipTrigger>
                            <TooltipContent>
                              <div className="text-sm">
                                <div className="font-semibold">
                                  {dayName}, {HOUR_LABELS[hour]}
                                </div>
                                <div className="text-muted-foreground mt-1">
                                  Engagement Rate: {rate > 0 ? `${rate.toFixed(2)}%` : 'No data'}
                                </div>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Legend */}
            <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
              <span>Less engagement</span>
              <div className="flex items-center gap-1">
                <div className="w-4 h-4 bg-gray-100 border border-gray-200 rounded" />
                <div className="w-4 h-4 bg-blue-100 border border-gray-200 rounded" />
                <div className="w-4 h-4 bg-blue-300 border border-gray-200 rounded" />
                <div className="w-4 h-4 bg-blue-500 border border-gray-200 rounded" />
                <div className="w-4 h-4 bg-blue-700 border border-gray-200 rounded" />
              </div>
              <span>More engagement</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
