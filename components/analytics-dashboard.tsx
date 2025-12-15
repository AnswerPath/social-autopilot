"use client"

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { TrendingUp, TrendingDown, Users, MessageSquare, Heart, Repeat2, Download, RefreshCw } from 'lucide-react'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { Line, LineChart, Bar, BarChart, CartesianGrid, XAxis, YAxis, ResponsiveContainer } from "recharts"
import { useToast } from "@/hooks/use-toast"
import { PostAnalyticsTable } from "./analytics/post-analytics-table"
import { ContentTypeAnalytics } from "./analytics/content-type-analytics"
import { PerformanceHeatmap } from "./analytics/performance-heatmap"
import { DateRangeSelector, type DateRange } from "./analytics/date-range-selector"
import { PostingRecommendations } from "./analytics/posting-recommendations"
import { format } from 'date-fns'

interface SummaryMetrics {
  totalImpressions: number
  totalLikes: number
  totalRetweets: number
  totalReplies: number
  averageEngagementRate: number
  totalPosts: number
}

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

interface FollowerAnalyticsData {
  date: string
  followerCount: number
  growth: number
  growthPercent: number
}

interface EngagementDataPoint {
  date: string
  likes: number
  retweets: number
  replies: number
  impressions: number
}

export function AnalyticsDashboard() {
  const [summaryMetrics, setSummaryMetrics] = useState<SummaryMetrics | null>(null)
  const [postAnalytics, setPostAnalytics] = useState<PostAnalyticsData[]>([])
  const [followerAnalytics, setFollowerAnalytics] = useState<FollowerAnalyticsData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => {
    // Initialize with last 7 days
    const endDate = new Date()
    endDate.setHours(23, 59, 59, 999)
    const startDate = new Date()
    startDate.setDate(endDate.getDate() - 7)
    startDate.setHours(0, 0, 0, 0)
    return { from: startDate, to: endDate }
  })
  const [contentTypeFilter, setContentTypeFilter] = useState<string>('all')
  const [lengthFilter, setLengthFilter] = useState<string>('all')
  const { toast } = useToast()

  // Convert DateRange to ISO date strings
  const getDateRangeStrings = useCallback((range: DateRange | undefined) => {
    if (!range?.from || !range?.to) {
      // Default to last 7 days if no range is set
      const endDate = new Date()
      const startDate = new Date()
      startDate.setDate(endDate.getDate() - 7)
      return {
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0]
      }
    }
    
    return {
      startDate: format(range.from, 'yyyy-MM-dd'),
      endDate: format(range.to, 'yyyy-MM-dd')
    }
  }, [])

  // Fetch summary metrics
  const fetchSummaryMetrics = useCallback(async (startDate: string, endDate: string) => {
    try {
      const response = await fetch(
        `/api/analytics/summary?startDate=${startDate}&endDate=${endDate}`,
        {
          headers: {
            'x-user-id': 'demo-user'
          }
        }
      )
      
      const data = await response.json()
      if (data.success && data.summary) {
        setSummaryMetrics(data.summary)
      } else {
        setSummaryMetrics(null)
      }
    } catch (err) {
      console.error('Error fetching summary metrics:', err)
      setSummaryMetrics(null)
    }
  }, [])

  // Fetch post analytics
  const fetchPostAnalytics = useCallback(async (startDate: string, endDate: string) => {
    try {
      const response = await fetch(
        `/api/analytics/posts?startDate=${startDate}&endDate=${endDate}`,
        {
          headers: {
            'x-user-id': 'demo-user'
          }
        }
      )
      
      const data = await response.json()
      if (data.success && data.data) {
        setPostAnalytics(data.data)
      } else {
        setPostAnalytics([])
      }
    } catch (err) {
      console.error('Error fetching post analytics:', err)
      setPostAnalytics([])
    }
  }, [])

  // Fetch follower analytics
  const fetchFollowerAnalytics = useCallback(async (startDate: string, endDate: string) => {
    try {
      const response = await fetch(
        `/api/analytics/followers?startDate=${startDate}&endDate=${endDate}`,
        {
          headers: {
            'x-user-id': 'demo-user'
          }
        }
      )
      
      const data = await response.json()
      if (data.success && data.data) {
        setFollowerAnalytics(data.data)
      } else {
        setFollowerAnalytics([])
      }
    } catch (err) {
      console.error('Error fetching follower analytics:', err)
      setFollowerAnalytics([])
    }
  }, [])

  // Fetch all data
  const fetchAllData = useCallback(async () => {
    try {
      setError(null)
      const { startDate, endDate } = getDateRangeStrings(dateRange)
      
      await Promise.all([
        fetchSummaryMetrics(startDate, endDate),
        fetchPostAnalytics(startDate, endDate),
        fetchFollowerAnalytics(startDate, endDate)
      ])
    } catch (err) {
      console.error('Error fetching analytics data:', err)
      setError('Failed to load analytics data')
      toast({
        title: 'Error',
        description: 'Failed to fetch analytics data. Please try again.',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }, [dateRange, getDateRangeStrings, fetchSummaryMetrics, fetchPostAnalytics, fetchFollowerAnalytics, toast])

  // Handle export
  const handleExport = useCallback(async () => {
    if (!dateRange?.from || !dateRange?.to) {
      toast({
        title: 'Error',
        description: 'Please select a date range before exporting.',
        variant: 'destructive'
      })
      return
    }

    try {
      setExporting(true)
      const { startDate, endDate } = getDateRangeStrings(dateRange)
      
      const response = await fetch(
        `/api/analytics/export?startDate=${startDate}&endDate=${endDate}&format=csv`,
        {
          headers: {
            'x-user-id': 'demo-user'
          }
        }
      )
      
      if (!response.ok) {
        throw new Error('Failed to export analytics')
      }
      
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `analytics-report-${startDate}-to-${endDate}.csv`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
      
      toast({
        title: 'Export completed',
        description: 'Your analytics report has been downloaded.',
      })
    } catch (err) {
      console.error('Error exporting analytics:', err)
      toast({
        title: 'Export failed',
        description: 'Failed to export analytics report. Please try again.',
        variant: 'destructive'
      })
    } finally {
      setExporting(false)
    }
  }, [dateRange, getDateRangeStrings, toast])

  // Initial fetch and polling setup
  useEffect(() => {
    fetchAllData()
    
    // Set up polling every 45 seconds
    const interval = setInterval(() => {
      fetchAllData()
    }, 45000)
    
    return () => clearInterval(interval)
  }, [dateRange]) // Re-fetch when date range changes

  // Calculate KPI metrics
  const calculateMetrics = () => {
    if (!summaryMetrics) {
      return {
        engagementRate: { value: "0%", change: "0%", trend: "neutral" as const },
        totalReach: { value: "0", change: "0%", trend: "neutral" as const },
        followerGrowth: { value: "0", change: "0%", trend: "neutral" as const },
        avgReplies: { value: "0", change: "0%", trend: "neutral" as const }
      }
    }

    // Engagement Rate: (likes + retweets + replies) / impressions * 100
    const totalEngagement = summaryMetrics.totalLikes + summaryMetrics.totalRetweets + summaryMetrics.totalReplies
    const engagementRate = summaryMetrics.totalImpressions > 0
      ? (totalEngagement / summaryMetrics.totalImpressions) * 100
      : 0
    
    // Total Reach (using impressions as proxy)
    const totalReach = summaryMetrics.totalImpressions
    
    // Weekly Follower Growth
    const currentWeek = followerAnalytics[followerAnalytics.length - 1]
    const previousWeek = followerAnalytics[followerAnalytics.length - 2]
    const followerGrowth = currentWeek ? currentWeek.growth : 0
    const followerGrowthPercent = previousWeek && previousWeek.followerCount > 0
      ? ((followerGrowth / previousWeek.followerCount) * 100)
      : 0

    // Average Replies
    const avgReplies = summaryMetrics.totalPosts > 0
      ? summaryMetrics.totalReplies / summaryMetrics.totalPosts
      : 0

    return {
      engagementRate: {
        value: `${engagementRate.toFixed(2)}%`,
        change: summaryMetrics.averageEngagementRate > 0 ? `+${summaryMetrics.averageEngagementRate.toFixed(2)}%` : "0%",
        trend: engagementRate > 0 ? "up" as const : "neutral" as const
      },
      totalReach: {
        value: formatNumber(totalReach),
        change: "0%", // TODO: Calculate change vs previous period
        trend: "up" as const
      },
      followerGrowth: {
        value: followerGrowth >= 0 ? `+${followerGrowth}` : `${followerGrowth}`,
        change: `${followerGrowthPercent >= 0 ? '+' : ''}${followerGrowthPercent.toFixed(1)}%`,
        trend: followerGrowth >= 0 ? "up" as const : "down" as const
      },
      avgReplies: {
        value: avgReplies.toFixed(1),
        change: "0%", // TODO: Calculate change vs previous period
        trend: "up" as const
      }
    }
  }

  // Format number with K/M suffixes
  const formatNumber = (num: number): string => {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`
    }
    if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`
    }
    return num.toString()
  }

  // Transform post analytics into daily engagement data
  const transformEngagementData = (): EngagementDataPoint[] => {
    if (!postAnalytics || postAnalytics.length === 0) {
      return []
    }

    // Group by date
    const dailyMap = new Map<string, { likes: number; retweets: number; replies: number; impressions: number }>()
    
    postAnalytics.forEach(post => {
      if (post.latest) {
        const date = new Date(post.postedAt).toISOString().split('T')[0]
        const existing = dailyMap.get(date) || { likes: 0, retweets: 0, replies: 0, impressions: 0 }
        
        dailyMap.set(date, {
          likes: existing.likes + (post.latest.likes || 0),
          retweets: existing.retweets + (post.latest.retweets || 0),
          replies: existing.replies + (post.latest.replies || 0),
          impressions: existing.impressions + (post.latest.impressions || 0)
        })
      }
    })

    // Convert to array and sort by date
    return Array.from(dailyMap.entries())
      .map(([date, data]) => ({
        date: formatDate(date),
        ...data
      }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  }

  // Transform follower analytics for chart
  const transformFollowerData = () => {
    return followerAnalytics.map((week, index) => ({
      date: `Week ${index + 1}`,
      followers: week.followerCount
    }))
  }

  // Format date for display
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  // Filter posts by content type
  const filterByContentType = (posts: PostAnalyticsData[], type: string): PostAnalyticsData[] => {
    if (type === 'all') return posts
    
    return posts.filter(post => {
      const hasMedia = post.mediaUrls && post.mediaUrls.length > 0
      if (type === 'text') return !hasMedia
      if (type === 'media') return hasMedia
      return true
    })
  }

  // Filter posts by length
  const filterByLength = (posts: PostAnalyticsData[], length: string): PostAnalyticsData[] => {
    if (length === 'all') return posts
    
    return posts.filter(post => {
      const contentLength = post.content.length
      if (length === 'short') return contentLength <= 100
      if (length === 'medium') return contentLength > 100 && contentLength <= 200
      if (length === 'long') return contentLength > 200
      return true
    })
  }

  // Apply all filters
  const filteredPosts = useMemo(() => {
    let filtered = postAnalytics
    filtered = filterByContentType(filtered, contentTypeFilter)
    filtered = filterByLength(filtered, lengthFilter)
    return filtered
  }, [postAnalytics, contentTypeFilter, lengthFilter])

  // Get top performing posts
  const getTopPosts = () => {
    if (!filteredPosts || filteredPosts.length === 0) {
      return []
    }

    return filteredPosts
      .filter(post => post.latest)
      .map(post => {
        const latest = post.latest!
        const totalEngagement = latest.likes + latest.retweets + latest.replies
        const engagementRate = latest.impressions && latest.impressions > 0
          ? (totalEngagement / latest.impressions) * 100
          : 0

        return {
          id: post.postId,
          content: post.content.substring(0, 100) + (post.content.length > 100 ? '...' : ''),
          engagement: {
            likes: latest.likes,
            retweets: latest.retweets,
            replies: latest.replies
          },
          impressions: latest.impressions || 0,
          date: formatDate(post.postedAt),
          engagementRate
        }
      })
      .sort((a, b) => {
        const aEngagement = a.engagement.likes + a.engagement.retweets + a.engagement.replies
        const bEngagement = b.engagement.likes + b.engagement.retweets + b.engagement.replies
        return bEngagement - aEngagement
      })
      .slice(0, 3)
  }

  const metrics = calculateMetrics()
  const engagementData = transformEngagementData()
  const followerGrowth = transformFollowerData()
  const topPosts = getTopPosts()

  const kpiMetrics = [
    {
      title: "Total Reach",
      value: metrics.totalReach.value,
      change: metrics.totalReach.change,
      trend: metrics.totalReach.trend,
      icon: TrendingUp
    },
    {
      title: "Engagement Rate",
      value: metrics.engagementRate.value,
      change: metrics.engagementRate.change,
      trend: metrics.engagementRate.trend,
      icon: Heart
    },
    {
      title: "Follower Growth",
      value: metrics.followerGrowth.value,
      change: metrics.followerGrowth.change,
      trend: metrics.followerGrowth.trend,
      icon: Users
    },
    {
      title: "Avg. Replies",
      value: metrics.avgReplies.value,
      change: metrics.avgReplies.change,
      trend: metrics.avgReplies.trend,
      icon: MessageSquare
    }
  ]

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex items-center justify-between">
        <DateRangeSelector
          dateRange={dateRange}
          onDateRangeChange={setDateRange}
        />
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={fetchAllData}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button 
            variant="outline"
            onClick={handleExport}
            disabled={exporting || !dateRange?.from || !dateRange?.to}
          >
            <Download className={`h-4 w-4 mr-2 ${exporting ? 'animate-pulse' : ''}`} />
            {exporting ? 'Exporting...' : 'Export Report'}
          </Button>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <p className="text-sm text-red-800">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Key Metrics */}
      {loading && !summaryMetrics ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div className="h-4 w-24 bg-gray-200 rounded animate-pulse" />
                <div className="h-4 w-4 bg-gray-200 rounded animate-pulse" />
              </CardHeader>
              <CardContent>
                <div className="h-8 w-20 bg-gray-200 rounded animate-pulse mb-2" />
                <div className="h-4 w-32 bg-gray-200 rounded animate-pulse" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {kpiMetrics.map((metric, index) => (
            <Card key={index}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{metric.title}</CardTitle>
                <metric.icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metric.value}</div>
                <div className="flex items-center gap-1 mt-1">
                  {metric.trend === "up" ? (
                    <TrendingUp className="h-3 w-3 text-green-600" />
                  ) : metric.trend === "down" ? (
                    <TrendingDown className="h-3 w-3 text-red-600" />
                  ) : null}
                  <span className={`text-xs ${
                    metric.trend === "up" ? "text-green-600" : 
                    metric.trend === "down" ? "text-red-600" : 
                    "text-muted-foreground"
                  }`}>
                    {metric.change}
                  </span>
                  {metric.trend !== "neutral" && (
                    <span className="text-xs text-muted-foreground">vs last period</span>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Engagement Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Daily Engagement</CardTitle>
            <CardDescription>Likes, retweets, and replies over time</CardDescription>
          </CardHeader>
          <CardContent>
            {loading && engagementData.length === 0 ? (
              <div className="h-[300px] flex items-center justify-center">
                <div className="text-sm text-muted-foreground">Loading engagement data...</div>
              </div>
            ) : engagementData.length === 0 ? (
              <div className="h-[300px] flex items-center justify-center">
                <div className="text-sm text-muted-foreground">No engagement data available for this period</div>
              </div>
            ) : (
              <ChartContainer
                config={{
                  likes: { label: "Likes", color: "hsl(var(--chart-1))" },
                  retweets: { label: "Retweets", color: "hsl(var(--chart-2))" },
                  replies: { label: "Replies", color: "hsl(var(--chart-3))" }
                }}
                className="h-[300px]"
              >
                <LineChart data={engagementData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Line type="monotone" dataKey="likes" stroke="var(--color-likes)" strokeWidth={2} />
                  <Line type="monotone" dataKey="retweets" stroke="var(--color-retweets)" strokeWidth={2} />
                  <Line type="monotone" dataKey="replies" stroke="var(--color-replies)" strokeWidth={2} />
                </LineChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        {/* Follower Growth */}
        <Card>
          <CardHeader>
            <CardTitle>Follower Growth</CardTitle>
            <CardDescription>Weekly follower count progression</CardDescription>
          </CardHeader>
          <CardContent>
            {loading && followerGrowth.length === 0 ? (
              <div className="h-[300px] flex items-center justify-center">
                <div className="text-sm text-muted-foreground">Loading follower data...</div>
              </div>
            ) : followerGrowth.length === 0 ? (
              <div className="h-[300px] flex items-center justify-center">
                <div className="text-sm text-muted-foreground">No follower data available. Sync follower analytics first.</div>
              </div>
            ) : (
              <ChartContainer
                config={{
                  followers: { label: "Followers", color: "hsl(var(--chart-1))" }
                }}
                className="h-[300px]"
              >
                <BarChart data={followerGrowth}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="followers" fill="var(--color-followers)" radius={4} />
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top Performing Posts */}
      <Card>
        <CardHeader>
          <CardTitle>Top Performing Posts</CardTitle>
          <CardDescription>Your most engaging content this period</CardDescription>
        </CardHeader>
        <CardContent>
          {loading && topPosts.length === 0 ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-start gap-4 p-4 border rounded-lg">
                  <div className="h-8 w-8 bg-gray-200 rounded-full animate-pulse" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-full bg-gray-200 rounded animate-pulse" />
                    <div className="h-3 w-3/4 bg-gray-200 rounded animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
          ) : topPosts.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              No posts with analytics data available for this period
            </div>
          ) : (
            <div className="space-y-4">
              {topPosts.map((post, index) => (
                <div key={post.id} className="flex items-start gap-4 p-4 border rounded-lg">
                  <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                    <span className="text-sm font-bold text-blue-600">#{index + 1}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-900 mb-2">{post.content}</p>
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <div className="flex items-center gap-1">
                        <Heart className="h-3 w-3" />
                        {post.engagement.likes}
                      </div>
                      <div className="flex items-center gap-1">
                        <Repeat2 className="h-3 w-3" />
                        {post.engagement.retweets}
                      </div>
                      <div className="flex items-center gap-1">
                        <MessageSquare className="h-3 w-3" />
                        {post.engagement.replies}
                      </div>
                      <span>•</span>
                      <span>{post.impressions.toLocaleString()} impressions</span>
                      <span>•</span>
                      <span>{post.date}</span>
                    </div>
                  </div>
                  <Badge variant="secondary">
                    {post.impressions > 0 
                      ? `${post.engagementRate.toFixed(1)}% ER`
                      : 'N/A'
                    }
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Post-Level Analytics */}
      <Card>
        <CardHeader>
          <CardTitle>Post-Level Analytics</CardTitle>
          <CardDescription>Detailed breakdown of individual post performance</CardDescription>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex flex-wrap gap-4 mb-6">
            <Select value={contentTypeFilter} onValueChange={setContentTypeFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Content Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Content Types</SelectItem>
                <SelectItem value="text">Text Only</SelectItem>
                <SelectItem value="media">Media Posts</SelectItem>
              </SelectContent>
            </Select>
            <Select value={lengthFilter} onValueChange={setLengthFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Post Length" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Lengths</SelectItem>
                <SelectItem value="short">Short (0-100 chars)</SelectItem>
                <SelectItem value="medium">Medium (101-200 chars)</SelectItem>
                <SelectItem value="long">Long (201+ chars)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Post Analytics Table */}
          <PostAnalyticsTable data={filteredPosts} loading={loading} />

          {/* Charts Grid */}
          <div className="mt-6">
            <ContentTypeAnalytics data={filteredPosts} loading={loading} />
          </div>

          {/* Performance Heatmap */}
          <div className="mt-6">
            <PerformanceHeatmap data={filteredPosts} loading={loading} />
          </div>
        </CardContent>
      </Card>

      {/* AI-Driven Posting Recommendations */}
      <div className="mt-6">
        <PostingRecommendations />
      </div>
    </div>
  )
}
