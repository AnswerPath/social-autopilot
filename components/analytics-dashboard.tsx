"use client"

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
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
import { useAuth } from "@/hooks/use-auth"

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
  const { user, loading: authLoading } = useAuth()
  
  // Don't use demo-user fallback - require actual authentication
  if (authLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <p className="text-gray-600">Loading analytics...</p>
      </div>
    )
  }
  
  if (!user || !user.id) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <p className="text-lg font-semibold text-gray-900">Authentication Required</p>
          <p className="text-gray-600 mt-2">Please log in to view analytics.</p>
        </div>
      </div>
    )
  }

  return <AnalyticsDashboardContent user={user} />
}

function AnalyticsDashboardContent({ user }: { user: { id: string } }) {
  // Memoize userId to prevent unnecessary recreations - use ref to track if it actually changed
  const userIdRef = useRef<string | null>(null)
  const userId = useMemo(() => {
    const newUserId = user.id
    if (userIdRef.current !== newUserId) {
      userIdRef.current = newUserId
    }
    return newUserId
  }, [user.id])
  
  // Track render count to debug re-renders
  const renderCountRef = useRef(0)
  renderCountRef.current += 1
  if (renderCountRef.current > 1 && renderCountRef.current % 10 === 0) {
    console.warn(`⚠️ AnalyticsDashboard re-rendered ${renderCountRef.current} times - this may indicate a performance issue`)
  }
  
  const [summaryMetrics, setSummaryMetrics] = useState<SummaryMetrics | null>(null)
  const [postAnalytics, setPostAnalytics] = useState<PostAnalyticsData[]>([])
  const [followerAnalytics, setFollowerAnalytics] = useState<FollowerAnalyticsData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)
  // Initialize date range with useMemo to prevent recreation on every render
  const initialDateRange = useMemo(() => {
    const endDate = new Date()
    endDate.setHours(23, 59, 59, 999)
    const startDate = new Date()
    startDate.setDate(endDate.getDate() - 7)
    startDate.setHours(0, 0, 0, 0)
    return { from: startDate, to: endDate }
  }, [])
  
  const [dateRange, setDateRange] = useState<DateRange | undefined>(initialDateRange)
  const [contentTypeFilter, setContentTypeFilter] = useState<string>('all')
  const [lengthFilter, setLengthFilter] = useState<string>('all')
  const { toast } = useToast()
  
  // Memoized handler to prevent unnecessary date range updates
  // Use a ref to track the last set date range to prevent unnecessary updates
  const lastSetDateRangeRef = useRef<{ from: number | null; to: number | null }>({ from: null, to: null })
  
  const handleDateRangeChange = useCallback((range: DateRange | undefined) => {
    if (!range?.from || !range?.to) {
      // Only update if we're actually clearing the range (not just receiving undefined temporarily)
      if (!range && dateRange) {
        console.log('📅 Clearing date range')
        lastSetDateRangeRef.current = { from: null, to: null }
        setDateRange(range)
      }
      return
    }
    
    // Only update if the actual dates have changed from what we last set
    const newFromTime = range.from.getTime()
    const newToTime = range.to.getTime()
    const lastFromTime = lastSetDateRangeRef.current.from
    const lastToTime = lastSetDateRangeRef.current.to
    
    // Compare with what we last SET, not what's in state (to avoid unnecessary updates)
    if (newFromTime !== lastFromTime || newToTime !== lastToTime) {
      console.log('📅 Date range updated by user:', { 
        newFromTime, 
        newToTime, 
        lastFromTime, 
        lastToTime
      })
      lastSetDateRangeRef.current = { from: newFromTime, to: newToTime }
      setDateRange(range)
    } else {
      // Dates are the same as what we last set, don't update state
      console.log('⏭️ Date range unchanged from last set, skipping state update')
    }
  }, [dateRange])

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
      // Removed console.log to reduce noise
      const response = await fetch(
        `/api/analytics/summary?startDate=${startDate}&endDate=${endDate}`,
        {
          credentials: 'include', // Include cookies for authentication
          headers: {
            'x-user-id': userId
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
  }, [userId])

  // Fetch post analytics
  const fetchPostAnalytics = useCallback(async (startDate: string, endDate: string, fetchFromApi: boolean = false) => {
    try {
      setError(null)
      // Removed console.log to reduce noise
      const url = `/api/analytics/posts?startDate=${startDate}&endDate=${endDate}${fetchFromApi ? '&fetchFromApi=true' : ''}`
      const response = await fetch(url, {
        credentials: 'include', // Include cookies for authentication
        headers: {
          'x-user-id': userId
        }
      })
      
      const data = await response.json()
      if (data.success) {
        setPostAnalytics(data.data || [])
        
        // Display warnings if present
        if (data.warning) {
          const warningMessage = data.warning
          setError(warningMessage)
          
          // Show toast for important warnings
          if (warningMessage.includes('Rate limit') || warningMessage.includes('credentials')) {
            toast({
              title: 'Analytics Fetch Warning',
              description: warningMessage,
              variant: 'destructive'
            })
          } else if (data.fetchedFromApi) {
            const source = data.source || 'x-api'
            const sourceName = source === 'apify' ? 'Apify' : 'X API'
            toast({
              title: 'Analytics Updated',
              description: `Fetched ${data.data?.length || 0} posts from ${sourceName}`,
            })
          }
        } else if (data.fetchedFromApi && data.data && data.data.length > 0) {
          // Successfully fetched from API
          const source = data.source || 'x-api'
          const sourceName = source === 'apify' ? 'Apify' : 'X API'
          toast({
            title: 'Analytics Fetched',
            description: `Successfully fetched ${data.data.length} posts from ${sourceName}`,
          })
          
          // Show helpful tip if using X API
          if (source === 'x-api') {
            toast({
              title: '💡 Tip',
              description: 'Configure Apify credentials in Settings to use Apify for analytics and avoid X API rate limits.',
              duration: 5000,
            })
          }
        }
      } else {
        // If there's stored data, show it even if there's an error
        setPostAnalytics(data.data || [])
        const errorMessage = data.error || 'Failed to fetch post analytics'
        
        // Only show as error if there's no data at all
        if (!data.data || data.data.length === 0) {
          setError(errorMessage)
          toast({
            title: 'Error',
            description: errorMessage,
            variant: 'destructive'
          })
        } else {
          // If we have data, show warning instead
          setError(data.warning || errorMessage)
          if (data.warning) {
            toast({
              title: 'Warning',
              description: data.warning,
              variant: 'default'
            })
          }
        }
      }
    } catch (err) {
      console.error('Error fetching post analytics:', err)
      setPostAnalytics([])
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch post analytics'
      setError(errorMessage)
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive'
      })
    }
  }, [toast, userId])

  // Fetch follower analytics
  const fetchFollowerAnalytics = useCallback(async (startDate: string, endDate: string) => {
    try {
      const response = await fetch(
        `/api/analytics/followers?startDate=${startDate}&endDate=${endDate}`,
        {
          headers: {
            'x-user-id': userId
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
  }, [userId])

  // Fetch all data - use ref to track if we're already fetching to prevent loops
  const isFetchingRef = useRef(false)
  // Store fetch functions in refs to avoid dependency issues
  const fetchFunctionsRef = useRef<{
    fetchSummaryMetrics: typeof fetchSummaryMetrics
    fetchPostAnalytics: typeof fetchPostAnalytics
    fetchFollowerAnalytics: typeof fetchFollowerAnalytics
    getDateRangeStrings: typeof getDateRangeStrings
  }>()
  
  // Store current dateRange in a ref to avoid dependency on dateRange object
  const dateRangeRef = useRef(dateRange)
  useEffect(() => {
    dateRangeRef.current = dateRange
  }, [dateRange])
  
  // Update refs when functions change
  useEffect(() => {
    fetchFunctionsRef.current = {
      fetchSummaryMetrics,
      fetchPostAnalytics,
      fetchFollowerAnalytics,
      getDateRangeStrings
    }
  }, [fetchSummaryMetrics, fetchPostAnalytics, fetchFollowerAnalytics, getDateRangeStrings])
  
  const fetchAllData = useCallback(async (fetchFromApi: boolean = false, customDateRange?: DateRange) => {
    // Prevent concurrent fetches
    if (isFetchingRef.current) {
      console.log('⏸️ Fetch already in progress, skipping...')
      return
    }
    
    const functions = fetchFunctionsRef.current
    if (!functions) {
      console.error('Fetch functions not ready')
      return
    }
    
    try {
      isFetchingRef.current = true
      setError(null)
      setLoading(true)
      // Use customDateRange if provided, otherwise use ref to avoid dependency
      const rangeToUse = customDateRange ?? dateRangeRef.current
      const { startDate, endDate } = functions.getDateRangeStrings(rangeToUse)
      
      console.log('🔄 Fetching analytics data...', { fetchFromApi, startDate, endDate, timestamp: new Date().toISOString() })
      
      await Promise.all([
        functions.fetchSummaryMetrics(startDate, endDate),
        functions.fetchPostAnalytics(startDate, endDate, fetchFromApi),
        functions.fetchFollowerAnalytics(startDate, endDate)
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
      isFetchingRef.current = false
    }
  }, [toast]) // Removed dateRange dependency - use ref instead

  // Update fetchAllDataRef after fetchAllData is defined
  useEffect(() => {
    fetchAllDataRef.current = fetchAllData
  }, [fetchAllData])

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
            'x-user-id': userId
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

  // Track if initial fetch has been done
  const hasInitialFetch = useRef(false)
  
  // Track previous date range values to prevent unnecessary re-fetches
  const prevDateRangeRef = useRef<{ from: number | null; to: number | null }>({ from: null, to: null })
  
  // Track if we're in the middle of a fetch to prevent loops
  const isFetchingInEffect = useRef(false)
  
  // Track last fetch time to prevent rapid successive fetches
  const lastFetchTimeRef = useRef<number>(0)
  const MIN_FETCH_INTERVAL = 60000 // Minimum 60 seconds (1 minute) between automatic fetches
  
  // Store the latest fetchAllData function in a ref to avoid dependency issues
  // Initialize as null and update in useEffect after fetchAllData is defined
  const fetchAllDataRef = useRef<typeof fetchAllData | null>(null)
  
  // Initial fetch ONLY - no automatic reloading
  // Use a separate ref to track if we've done the initial fetch to prevent re-runs
  const initialFetchDoneRef = useRef(false)
  
  useEffect(() => {
    // Only fetch once on initial mount - use ref to ensure this
    if (initialFetchDoneRef.current) {
      return
    }
    
    if (!dateRange?.from || !dateRange?.to) {
      return
    }
    
    // Mark as done IMMEDIATELY to prevent any re-runs
    initialFetchDoneRef.current = true
    hasInitialFetch.current = true
    
    const fromTime = dateRange.from.getTime()
    const toTime = dateRange.to.getTime()
    prevDateRangeRef.current = { from: fromTime, to: toTime }
    lastFetchTimeRef.current = Date.now()
    
    // Set flag to prevent concurrent runs
    isFetchingInEffect.current = true
    
    // Use the ref to call fetchAllData
    const fetchFn = fetchAllDataRef.current
    if (!fetchFn) {
      // fetchAllData not ready yet, wait for next render
      initialFetchDoneRef.current = false
      hasInitialFetch.current = false
      isFetchingInEffect.current = false
      return
    }
    fetchFn(false, dateRange).finally(() => {
      isFetchingInEffect.current = false
    })
    
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // ONLY run on mount - never again automatically

  // Separate effect to handle date range changes (only when user explicitly changes it)
  useEffect(() => {
    // Skip if initial fetch hasn't happened yet
    if (!hasInitialFetch.current || !initialFetchDoneRef.current) {
      return
    }
    
    // Don't run if already fetching
    if (isFetchingInEffect.current) {
      return
    }
    
    if (!dateRange?.from || !dateRange?.to) {
      return
    }
    
    const fromTime = dateRange.from.getTime()
    const toTime = dateRange.to.getTime()
    
    // CRITICAL: Only fetch if dates have ACTUALLY changed from what we last fetched
    if (prevDateRangeRef.current.from === fromTime && prevDateRangeRef.current.to === toTime) {
      // Dates haven't changed, do nothing
      return
    }
    
    // Update the previous date range reference BEFORE fetching
    prevDateRangeRef.current = { from: fromTime, to: toTime }
    lastFetchTimeRef.current = Date.now()
    
    // Set flag to prevent concurrent runs
    isFetchingInEffect.current = true
    
    // Use the ref to call fetchAllData
    const fetchFn = fetchAllDataRef.current
    if (!fetchFn) {
      isFetchingInEffect.current = false
      return
    }
    fetchFn(false, dateRange).finally(() => {
      isFetchingInEffect.current = false
    })
    
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateRange?.from?.getTime(), dateRange?.to?.getTime()]) // Only when dates actually change

  // Calculate KPI metrics
  const calculateMetrics = () => {
    if (!summaryMetrics) {
      return {
        engagementRate: { value: "0", change: "0", trend: "neutral" as const },
        totalReach: { value: "0", change: "0%", trend: "neutral" as const },
        followerGrowth: { value: "0", change: "0%", trend: "neutral" as const },
        avgReplies: { value: "0", change: "0%", trend: "neutral" as const }
      }
    }

    // Engagement Rate: average likes per post (based on likes, not impressions)
    const engagementRate = summaryMetrics.totalPosts > 0
      ? summaryMetrics.totalLikes / summaryMetrics.totalPosts
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
        value: `${engagementRate.toFixed(2)}`,
        change: summaryMetrics.averageEngagementRate > 0 ? `+${summaryMetrics.averageEngagementRate.toFixed(2)}` : "0",
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

    // Convert to array, sort by original ISO date string (not formatted), then format for display
    return Array.from(dailyMap.entries())
      .map(([date, data]) => ({
        dateISO: date, // Keep original ISO date for sorting
        date: formatDate(date), // Format for display
        ...data
      }))
      .sort((a, b) => a.dateISO.localeCompare(b.dateISO)) // Sort by ISO date string (YYYY-MM-DD format)
      .map(({ dateISO, ...rest }) => rest) // Remove dateISO, keep only formatted date for display
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
        // Engagement rate is now based on likes only (average likes per post)
        const engagementRate = latest.likes || 0

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
          onDateRangeChange={handleDateRangeChange}
        />
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={() => fetchAllData(false, dateRange)}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button 
            variant="default" 
            onClick={() => fetchAllData(true, dateRange)}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh Analytics
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

      {/* Error/Warning State */}
      {error && (
        <Card className={error.includes('Rate limit') || error.includes('credentials') || error.includes('Failed') 
          ? "border-red-200 bg-red-50" 
          : "border-yellow-200 bg-yellow-50"}>
          <CardContent className="pt-6">
            <div className="flex items-start gap-2">
              {error.includes('Rate limit') || error.includes('credentials') || error.includes('Failed') ? (
                <span className="text-red-600">⚠️</span>
              ) : (
                <span className="text-yellow-600">ℹ️</span>
              )}
              <div className="flex-1">
                <p className={`text-sm font-medium ${
                  error.includes('Rate limit') || error.includes('credentials') || error.includes('Failed')
                    ? 'text-red-800' 
                    : 'text-yellow-800'
                }`}>
                  {error}
                </p>
                {error.includes('Rate limit') && (
                  <p className="text-xs text-red-600 mt-1">
                    Please wait a few minutes before trying again.
                  </p>
                )}
                {error.includes('credentials') && (
                  <p className="text-xs text-red-600 mt-1">
                    Please check your X API credentials in Settings.
                  </p>
                )}
              </div>
            </div>
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
                    {post.engagementRate.toFixed(1)} ER
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

