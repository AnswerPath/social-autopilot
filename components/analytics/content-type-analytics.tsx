"use client"

import { useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, ResponsiveContainer, Legend } from "recharts"

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
  mediaUrls?: string[]
}

interface ContentTypeAnalyticsProps {
  data: PostAnalyticsData[]
  loading?: boolean
}

type ContentType = 'Text Only' | 'Media'
type LengthCategory = 'Short' | 'Medium' | 'Long'

interface MediaTypeData {
  type: ContentType
  avgEngagementRate: number
  postCount: number
}

interface LengthCategoryData {
  category: LengthCategory
  avgEngagementRate: number
  postCount: number
}

export function ContentTypeAnalytics({ data, loading = false }: ContentTypeAnalyticsProps) {
  // Categorize posts by media type
  const categorizeByMediaType = (post: PostAnalyticsData): ContentType => {
    // Check if post has media URLs
    if (post.mediaUrls && post.mediaUrls.length > 0) {
      return 'Media'
    }
    return 'Text Only'
  }

  // Categorize posts by length
  const categorizeByLength = (post: PostAnalyticsData): LengthCategory => {
    const length = post.content.length
    if (length <= 100) {
      return 'Short'
    } else if (length <= 200) {
      return 'Medium'
    } else {
      return 'Long'
    }
  }

  // Calculate engagement rate for a post (based on likes, not impressions)
  const calculateEngagementRate = (post: PostAnalyticsData): number => {
    if (!post.latest) return 0
    const latest = post.latest
    // Engagement rate is now based on likes only (average likes per post)
    return latest.likes || 0
  }

  // Aggregate data by media type
  const mediaTypeData = useMemo((): MediaTypeData[] => {
    const typeMap = new Map<ContentType, { totalEngagementRate: number; count: number }>()

    data
      .filter(post => post.latest)
      .forEach(post => {
        const type = categorizeByMediaType(post)
        const engagementRate = calculateEngagementRate(post)
        
        const existing = typeMap.get(type) || { totalEngagementRate: 0, count: 0 }
        typeMap.set(type, {
          totalEngagementRate: existing.totalEngagementRate + engagementRate,
          count: existing.count + 1
        })
      })

    return Array.from(typeMap.entries())
      .map(([type, stats]) => ({
        type,
        avgEngagementRate: stats.count > 0 ? stats.totalEngagementRate / stats.count : 0,
        postCount: stats.count
      }))
      .sort((a, b) => a.type.localeCompare(b.type))
  }, [data])

  // Aggregate data by length category
  const lengthCategoryData = useMemo((): LengthCategoryData[] => {
    const categoryMap = new Map<LengthCategory, { totalEngagementRate: number; count: number }>()

    data
      .filter(post => post.latest)
      .forEach(post => {
        const category = categorizeByLength(post)
        const engagementRate = calculateEngagementRate(post)
        
        const existing = categoryMap.get(category) || { totalEngagementRate: 0, count: 0 }
        categoryMap.set(category, {
          totalEngagementRate: existing.totalEngagementRate + engagementRate,
          count: existing.count + 1
        })
      })

    // Order: Short, Medium, Long
    const order: LengthCategory[] = ['Short', 'Medium', 'Long']
    return order
      .map(category => {
        const stats = categoryMap.get(category) || { totalEngagementRate: 0, count: 0 }
        return {
          category,
          avgEngagementRate: stats.count > 0 ? stats.totalEngagementRate / stats.count : 0,
          postCount: stats.count
        }
      })
  }, [data])

  // Transform data for charts
  const mediaTypeChartData = useMemo(() => {
    return mediaTypeData.map(item => ({
      type: item.type,
      'Avg Engagement Rate': Number(item.avgEngagementRate.toFixed(2)),
      'Post Count': item.postCount
    }))
  }, [mediaTypeData])

  const lengthCategoryChartData = useMemo(() => {
    return lengthCategoryData.map(item => ({
      category: item.category,
      'Avg Engagement Rate': Number(item.avgEngagementRate.toFixed(2)),
      'Post Count': item.postCount
    }))
  }, [lengthCategoryData])

  if (loading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {[1, 2].map((i) => (
          <Card key={i}>
            <CardHeader>
              <div className="h-6 w-32 bg-gray-200 rounded animate-pulse" />
              <div className="h-4 w-48 bg-gray-200 rounded animate-pulse mt-2" />
            </CardHeader>
            <CardContent>
              <div className="h-[300px] bg-gray-200 rounded animate-pulse" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  const hasData = mediaTypeData.length > 0 || lengthCategoryData.length > 0

  if (!hasData) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Content Type Comparison</CardTitle>
            <CardDescription>Media vs Text Only posts</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] flex items-center justify-center">
              <div className="text-sm text-muted-foreground">No data available</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Length Category Comparison</CardTitle>
            <CardDescription>Short vs Medium vs Long posts</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] flex items-center justify-center">
              <div className="text-sm text-muted-foreground">No data available</div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Media Type Comparison */}
      <Card>
        <CardHeader>
          <CardTitle>Content Type Comparison</CardTitle>
          <CardDescription>Average engagement rate by media type</CardDescription>
        </CardHeader>
        <CardContent>
          {mediaTypeChartData.length === 0 ? (
            <div className="h-[300px] flex items-center justify-center">
              <div className="text-sm text-muted-foreground">No data available</div>
            </div>
          ) : (
            <ChartContainer
              config={{
                'Avg Engagement Rate': { label: "Avg Engagement Rate", color: "hsl(var(--chart-1))" },
                'Post Count': { label: "Post Count", color: "hsl(var(--chart-2))" }
              }}
              className="h-[300px]"
            >
              <BarChart data={mediaTypeChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="type" 
                  tick={{ fontSize: 12 }}
                />
                <YAxis yAxisId="left" />
                <YAxis yAxisId="right" orientation="right" />
                <ChartTooltip 
                  content={<ChartTooltipContent />}
                  formatter={(value: number, name: string) => {
                    if (name === 'Avg Engagement Rate') {
                      return [`${value.toFixed(2)}%`, name]
                    }
                    return [value, name]
                  }}
                />
                <Legend />
                <Bar 
                  yAxisId="left"
                  dataKey="Avg Engagement Rate" 
                  fill="var(--color-avg-engagement-rate)" 
                  radius={4}
                  name="Avg Engagement Rate"
                />
                <Bar 
                  yAxisId="right"
                  dataKey="Post Count" 
                  fill="var(--color-post-count)" 
                  radius={4}
                  name="Post Count"
                />
              </BarChart>
            </ChartContainer>
          )}
          {mediaTypeData.length > 0 && (
            <div className="mt-4 text-xs text-muted-foreground space-y-1">
              {mediaTypeData.map(item => (
                <div key={item.type} className="flex justify-between">
                  <span>{item.type}:</span>
                  <span>{item.postCount} posts, {item.avgEngagementRate.toFixed(2)} avg ER</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Length Category Comparison */}
      <Card>
        <CardHeader>
          <CardTitle>Length Category Comparison</CardTitle>
          <CardDescription>Average engagement rate by post length</CardDescription>
        </CardHeader>
        <CardContent>
          {lengthCategoryChartData.length === 0 ? (
            <div className="h-[300px] flex items-center justify-center">
              <div className="text-sm text-muted-foreground">No data available</div>
            </div>
          ) : (
            <ChartContainer
              config={{
                'Avg Engagement Rate': { label: "Avg Engagement Rate", color: "hsl(var(--chart-1))" },
                'Post Count': { label: "Post Count", color: "hsl(var(--chart-2))" }
              }}
              className="h-[300px]"
            >
              <BarChart data={lengthCategoryChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="category" 
                  tick={{ fontSize: 12 }}
                />
                <YAxis yAxisId="left" />
                <YAxis yAxisId="right" orientation="right" />
                <ChartTooltip 
                  content={<ChartTooltipContent />}
                  formatter={(value: number, name: string) => {
                    if (name === 'Avg Engagement Rate') {
                      return [`${value.toFixed(2)}%`, name]
                    }
                    return [value, name]
                  }}
                />
                <Legend />
                <Bar 
                  yAxisId="left"
                  dataKey="Avg Engagement Rate" 
                  fill="var(--color-avg-engagement-rate)" 
                  radius={4}
                  name="Avg Engagement Rate"
                />
                <Bar 
                  yAxisId="right"
                  dataKey="Post Count" 
                  fill="var(--color-post-count)" 
                  radius={4}
                  name="Post Count"
                />
              </BarChart>
            </ChartContainer>
          )}
          {lengthCategoryData.length > 0 && (
            <div className="mt-4 text-xs text-muted-foreground space-y-1">
              {lengthCategoryData.map(item => (
                <div key={item.category} className="flex justify-between">
                  <span>{item.category} ({(item.category === 'Short' ? '0-100' : item.category === 'Medium' ? '101-200' : '201+')} chars):</span>
                  <span>{item.postCount} posts, {item.avgEngagementRate.toFixed(2)} avg ER</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
