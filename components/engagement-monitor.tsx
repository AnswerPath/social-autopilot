"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { MessageSquare, AlertTriangle, TrendingUp, Settings, Reply, ExternalLink, Clock, RefreshCw } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { AutoReplyRules } from '@/components/engagement/auto-reply-rules'

export function EngagementMonitor() {
  const [realMentions, setRealMentions] = useState<any[]>([])
  const [isLoadingMentions, setIsLoadingMentions] = useState(true)
  const [isMonitoring, setIsMonitoring] = useState(false)
  const [filterValue, setFilterValue] = useState('all')
  const [isStopping, setIsStopping] = useState(false)
  const [stats, setStats] = useState<{
    newMentions: number
    avgResponseTime: string
    sentimentScore: number
    autoReplies: number
    newMentionsToday: number
    responseTimeChange: string | null
    sentimentChange: number | null
    autoRepliesPercent: number
  }>({
    newMentions: 0,
    avgResponseTime: '0m',
    sentimentScore: 0,
    autoReplies: 0,
    newMentionsToday: 0,
    responseTimeChange: null,
    sentimentChange: null,
    autoRepliesPercent: 0,
  })
  const { toast } = useToast()

  // Calculate stats from mentions data (poll only while monitoring is on)
  useEffect(() => {
    const calculateStats = async () => {
      try {
        // Fetch mentions for stats calculation
        const mentionsResponse = await fetch('/api/twitter/mentions?maxResults=100', {
          credentials: 'include',
        })
        if (!mentionsResponse.ok) return
        
        const mentionsData = await mentionsResponse.json()
        const allMentions = mentionsData.mentions || []
        
        // Calculate new mentions (last 24 hours)
        const now = new Date()
        const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000)
        const newMentions = allMentions.filter((m: any) => {
          const createdAt = new Date(m.created_at || m.createdAt || 0)
          return createdAt >= yesterday
        })
        const newMentionsToday = newMentions.length
        
        // Calculate average response time
        const repliedMentions = allMentions.filter((m: any) => m.is_replied || m.replied)
        let avgResponseTime = 0
        if (repliedMentions.length > 0) {
          const responseTimes = repliedMentions
            .map((m: any) => {
              const created = new Date(m.created_at || m.createdAt || 0)
              const replied = m.processed_at ? new Date(m.processed_at) : null
              if (!replied) return null
              return (replied.getTime() - created.getTime()) / (1000 * 60) // minutes
            })
            .filter((t: number | null) => t !== null) as number[]
          
          if (responseTimes.length > 0) {
            avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
          }
        }
        const avgResponseTimeFormatted = avgResponseTime < 60 
          ? `${Math.round(avgResponseTime)}m` 
          : `${Math.round(avgResponseTime / 60)}h`
        
        // Calculate sentiment score (weighted: positive=1, neutral=0.5, negative=0)
        const sentimentCounts = allMentions.reduce((acc: Record<string, number>, m: any) => {
          const sent = m.sentiment || 'neutral'
          acc[sent] = (acc[sent] || 0) + 1
          return acc
        }, {} as Record<string, number>)
        const total = allMentions.length
        const sentimentScore = total > 0
          ? ((sentimentCounts.positive || 0) * 1 + (sentimentCounts.neutral || 0) * 0.5 + (sentimentCounts.negative || 0) * 0) / total * 10
          : 0
        
        // Calculate auto replies
        const autoReplies = repliedMentions.length
        const autoRepliesPercent = total > 0 ? Math.round((autoReplies / total) * 100) : 0
        
        // Fetch auto-reply logs for match counting
        const logsResponse = await fetch('/api/auto-reply/logs', {
          credentials: 'include',
        })
        let autoRepliesFromLogs = autoReplies
        if (logsResponse.ok) {
          const logsData = await logsResponse.json()
          if (logsData.success && logsData.count !== undefined) {
            autoRepliesFromLogs = logsData.count
          }
        }
        
        setStats({
          newMentions: total,
          avgResponseTime: avgResponseTimeFormatted,
          sentimentScore: Math.round(sentimentScore * 10) / 10,
          autoReplies: autoRepliesFromLogs,
          newMentionsToday: newMentionsToday,
          responseTimeChange: null,
          sentimentChange: null,
          autoRepliesPercent,
        })
      } catch (error) {
        console.error('[EngagementMonitor] Error calculating stats:', error)
      }
    }
    
    void calculateStats()
    if (!isMonitoring) return
    const interval = setInterval(() => void calculateStats(), 30000)
    return () => clearInterval(interval)
  }, [isMonitoring])

  useEffect(() => {
    const fetchMentions = async () => {
      setIsLoadingMentions(true)
      try {
        const response = await fetch('/api/twitter/mentions?maxResults=50', {
          credentials: 'include',
        })
        if (response.ok) {
          const data = await response.json()
          console.log('[EngagementMonitor] Fetched mentions on mount/refresh:', data.mentions?.length || 0, data)
          
          // Log sentiment distribution from fetched mentions
          if (data.mentions && data.mentions.length > 0) {
            const sentimentCounts = data.mentions.reduce((acc: Record<string, number>, m: any) => {
              const sent = m.sentiment || 'null/undefined'
              acc[sent] = (acc[sent] || 0) + 1
              return acc
            }, {} as Record<string, number>)
            console.log('[EngagementMonitor] Sentiment distribution on mount:', sentimentCounts)
          }
          
          setRealMentions(data.mentions || [])
          // Trigger stats recalculation when mentions update
          if (data.mentions && data.mentions.length > 0) {
            // Stats will auto-update via the stats useEffect
          }
        } else {
          console.error('[EngagementMonitor] Failed to fetch mentions:', response.status, await response.text())
        }
      } catch (error) {
        console.error('[EngagementMonitor] Error fetching mentions:', error)
      } finally {
        setIsLoadingMentions(false)
      }
    }

    fetchMentions()

    // While monitoring, poll for new mentions periodically
    if (isMonitoring) {
      const interval = setInterval(fetchMentions, 30000)
      return () => clearInterval(interval)
    }
  }, [isMonitoring])

  const handleStartMonitoring = async () => {
    try {
      const response = await fetch('/api/mentions/stream', {
        method: 'GET',
        credentials: 'include',
      })
      const data = await response.json().catch(() => ({}))
      if (response.ok && data.success) {
        setIsMonitoring(true)
      } else {
        toast({
          title: 'Cannot start monitoring',
          description: typeof data.error === 'string' ? data.error : `Request failed (${response.status})`,
          variant: 'destructive',
        })
      }
    } catch (error) {
      console.error('Error starting monitoring:', error)
      toast({
        title: 'Cannot start monitoring',
        description: error instanceof Error ? error.message : 'Request failed',
        variant: 'destructive',
      })
    }
  }

  const handleStopMonitoring = async () => {
    if (isStopping) return; // Prevent double-clicks
    
    setIsStopping(true)
    try {
      const response = await fetch('/api/mentions/stream', {
        method: 'DELETE',
        credentials: 'include',
      })
      const data = await response.json()
      if (data.success) {
        setIsMonitoring(false)
        // Refresh mentions list after stopping
        const mentionsResponse = await fetch('/api/twitter/mentions?maxResults=50', {
          credentials: 'include',
        })
        if (mentionsResponse.ok) {
          const mentionsData = await mentionsResponse.json()
          setRealMentions(mentionsData.mentions || [])
        }
      } else {
        console.error('Failed to stop monitoring:', data.error)
        // Still update state even if API call fails
        setIsMonitoring(false)
      }
    } catch (error) {
      console.error('Error stopping monitoring:', error)
      // Still set monitoring to false even if request fails
      setIsMonitoring(false)
    } finally {
      setIsStopping(false)
    }
  }

  const handleReply = async (tweetId: string, replyText: string) => {
    try {
      const response = await fetch('/api/twitter/reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tweetId, replyText })
      })

      if (response.ok) {
        // Refresh mentions after successful reply
        const mentionsResponse = await fetch('/api/twitter/mentions?maxResults=50')
        if (mentionsResponse.ok) {
          const data = await mentionsResponse.json()
          setRealMentions(data.mentions || [])
        }
      }
    } catch (error) {
      console.error('Error replying to tweet:', error)
    }
  }

  const displayMentions = realMentions.map((mention, index) => {
    // Handle both API format and database format
    const username = mention.username || mention.author_username || 'unknown'
    const text = mention.text || mention.content || ''
    const createdAt = mention.created_at || mention.createdAt || new Date().toISOString()
    const sentiment = mention.sentiment || 'neutral'
    const followers = mention.public_metrics?.followers_count ?? 0

    // Determine priority based on sentiment and other factors
    let priority = 'low'
    if (sentiment === 'negative') {
      priority = 'high'
    } else if (followers > 1000 || sentiment === 'positive') {
      priority = 'medium'
    }

    return {
      id: mention.id || mention.tweet_id || `mention-${index}`,
      user: `@${username}`,
      content: text,
      sentiment: sentiment,
      time: new Date(createdAt).toLocaleString(),
      platform: "twitter",
      followers: followers,
      replied: mention.is_replied || mention.replied || false,
      priority: priority
    }
  })

  // Calculate sentiment stats dynamically from actual mentions
  const sentimentStats = (() => {
    if (displayMentions.length === 0) {
      return { positive: 0, neutral: 0, negative: 0 }
    }
    
    const counts = displayMentions.reduce((acc, mention) => {
      const sentiment = mention.sentiment || 'neutral'
      acc[sentiment] = (acc[sentiment] || 0) + 1
      return acc
    }, {} as Record<string, number>)
    
    const total = displayMentions.length
    const stats = {
      positive: Math.round((counts.positive || 0) / total * 100),
      neutral: Math.round((counts.neutral || 0) / total * 100),
      negative: Math.round((counts.negative || 0) / total * 100),
    }
    
    // Log for debugging
    console.log('[EngagementMonitor] Sentiment stats calculated:', {
      total,
      counts,
      percentages: stats,
      sampleMentions: displayMentions.slice(0, 5).map(m => ({ text: m.content.substring(0, 30) + '...', sentiment: m.sentiment }))
    })
    
    return stats
  })()

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment) {
      case "positive": return "text-green-600 bg-green-50"
      case "negative": return "text-red-600 bg-red-50"
      case "neutral": return "text-muted-foreground bg-muted/50"
      default: return "text-muted-foreground bg-muted/50"
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high": return "border-red-500 bg-red-50"
      case "medium": return "border-yellow-500 bg-yellow-50"
      case "low": return "border-green-500 bg-green-50"
      default: return "border-border"
    }
  }

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">New Mentions</p>
                <p className="text-2xl font-bold">{stats.newMentions}</p>
              </div>
              <MessageSquare className="h-8 w-8 text-blue-600" />
            </div>
            <Badge variant="secondary" className="mt-2">+{stats.newMentionsToday} today</Badge>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Avg Response Time</p>
                <p className="text-2xl font-bold">{stats.avgResponseTime}</p>
              </div>
              <Clock className="h-8 w-8 text-green-600" />
            </div>
            {stats.responseTimeChange != null ? (
              <Badge variant="secondary" className="mt-2">{stats.responseTimeChange}</Badge>
            ) : (
              <p className="text-xs text-muted-foreground mt-2">No trend data yet</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Sentiment Score</p>
                <p className="text-2xl font-bold">{stats.sentimentScore.toFixed(1)}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-600" />
            </div>
            {stats.sentimentChange != null ? (
              <Badge variant="secondary" className="mt-2">+{stats.sentimentChange.toFixed(1)} this week</Badge>
            ) : (
              <p className="text-xs text-muted-foreground mt-2">No trend data yet</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Auto Replies</p>
                <p className="text-2xl font-bold">{stats.autoReplies}</p>
              </div>
              <Settings className="h-8 w-8 text-purple-600" />
            </div>
            <Badge variant="secondary" className="mt-2">{stats.autoRepliesPercent}% automated</Badge>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="mentions" className="space-y-4">
        <TabsList>
          <TabsTrigger value="mentions">Live Mentions</TabsTrigger>
          <TabsTrigger value="automation">Auto-Reply Rules</TabsTrigger>
          <TabsTrigger value="sentiment">Sentiment Analysis</TabsTrigger>
        </TabsList>

        <TabsContent value="mentions" className="space-y-4">
          {/* Monitoring Controls */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {!isMonitoring ? (
                <Button onClick={handleStartMonitoring} disabled={isLoadingMentions || isStopping}>
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Start Monitoring
                </Button>
              ) : (
                <Button 
                  variant="destructive" 
                  onClick={handleStopMonitoring}
                  disabled={isLoadingMentions || isStopping}
                >
                  <MessageSquare className="h-4 w-4 mr-2" />
                  {isStopping ? 'Stopping...' : 'Stop Monitoring'}
                </Button>
              )}
              {isMonitoring && (
                <Badge variant="default" className="bg-green-500">
                  Monitoring Active
                </Badge>
              )}
            </div>
            {/* Filters */}
            <div className="flex items-center gap-4">
              <Select value={filterValue} onValueChange={setFilterValue}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Mentions</SelectItem>
                  <SelectItem value="unread">Unread Only</SelectItem>
                  <SelectItem value="high">High Priority</SelectItem>
                  <SelectItem value="negative">Negative Sentiment</SelectItem>
                  <SelectItem value="positive">Positive Sentiment</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  setIsLoadingMentions(true)
                  try {
                    const response = await fetch('/api/twitter/mentions?maxResults=50', {
                      credentials: 'include',
                    })
                    if (response.ok) {
                      const data = await response.json()
                      console.log('[EngagementMonitor] Manual refresh - mentions:', data.mentions?.length || 0, data)
                      
                      // Log sentiment distribution
                      if (data.mentions && data.mentions.length > 0) {
                        const sentimentCounts = data.mentions.reduce((acc: Record<string, number>, m: any) => {
                          const sent = m.sentiment || 'null/undefined'
                          acc[sent] = (acc[sent] || 0) + 1
                          return acc
                        }, {} as Record<string, number>)
                        console.log('[EngagementMonitor] Sentiment distribution on manual refresh:', sentimentCounts)
                        console.log('[EngagementMonitor] First 5 mentions:', data.mentions.slice(0, 5).map((m: any) => ({
                          text: (m.text || '').substring(0, 40) + '...',
                          sentiment: m.sentiment || 'MISSING'
                        })))
                      }
                      
                      setRealMentions(data.mentions || [])
                    } else {
                      console.error('[EngagementMonitor] Refresh failed:', response.status)
                    }
                  } catch (error) {
                    console.error('[EngagementMonitor] Refresh error:', error)
                  } finally {
                    setIsLoadingMentions(false)
                  }
                }}
                disabled={isLoadingMentions}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isLoadingMentions ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </div>

          {/* Mentions List */}
          <div className="space-y-4">
            {isLoadingMentions ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <p className="text-muted-foreground">Loading mentions...</p>
                </CardContent>
              </Card>
            ) : displayMentions.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-muted-foreground mb-2">No mentions found</p>
                  <p className="text-sm text-muted-foreground mb-4">
                    {isMonitoring
                      ? 'Monitoring is active. Mentions will appear here when they are captured.'
                      : 'Configure X API credentials in Settings, start monitoring, then use Refresh to load the latest mentions.'}
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      setIsLoadingMentions(true)
                      const response = await fetch('/api/twitter/mentions?maxResults=50', {
                        credentials: 'include',
                      })
                      if (response.ok) {
                        const data = await response.json()
                        console.log('[EngagementMonitor] Manual refresh - mentions:', data.mentions?.length || 0)
                        setRealMentions(data.mentions || [])
                      }
                      setIsLoadingMentions(false)
                    }}
                  >
                    Refresh Mentions
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <>
                {displayMentions
                  .filter((mention) => {
                    if (filterValue === 'all') return true
                    if (filterValue === 'unread') return !mention.replied
                    if (filterValue === 'high') return mention.priority === 'high'
                    if (filterValue === 'negative') return mention.sentiment === 'negative'
                    if (filterValue === 'positive') return mention.sentiment === 'positive'
                    return true
                  })
                  .map((mention) => (
                    <Card key={mention.id} className={`${getPriorityColor(mention.priority)}`}>
                      <CardContent className="p-4">
                        <div className="flex items-start gap-4">
                          <Avatar className="h-10 w-10">
                            <AvatarFallback>{mention.user[1].toUpperCase()}</AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="font-medium">{mention.user}</span>
                              <Badge className={getSentimentColor(mention.sentiment)}>
                                {mention.sentiment}
                              </Badge>
                              <Badge variant="outline">
                                {mention.priority} priority
                              </Badge>
                              <span className="text-sm text-muted-foreground">{mention.followers.toLocaleString()} followers</span>
                            </div>
                            <p className="text-foreground mb-2">{mention.content}</p>
                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                              <span>{mention.time}</span>
                              {mention.replied && (
                                <Badge variant="outline" className="text-green-600">
                                  ✓ Replied
                                </Badge>
                              )}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline">
                              <ExternalLink className="h-4 w-4 mr-2" />
                              View
                            </Button>
                            {!mention.replied && (
                              <Button size="sm">
                                <Reply className="h-4 w-4 mr-2" />
                                Reply
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
              </>
            )}
          </div>
        </TabsContent>

        <TabsContent value="automation" className="space-y-4">
          <AutoReplyRules />
        </TabsContent>

        <TabsContent value="sentiment" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-medium">Sentiment Analysis</h3>
              <p className="text-muted-foreground">Analyze sentiment of mentions</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                setIsLoadingMentions(true)
                try {
                  const response = await fetch('/api/mentions/sentiment', {
                    method: 'PUT',
                    headers: {
                      'Content-Type': 'application/json',
                    },
                    credentials: 'include',
                    body: JSON.stringify({ analyzeAll: false, limit: 100 }),
                  })
                  if (response.ok) {
                    const data = await response.json()
                    console.log('[EngagementMonitor] Re-analyzed mentions:', data)
                    toast({
                      title: 'Sentiment Analysis Complete',
                      description: `Analyzed ${data.analyzed} mentions. Distribution: ${data.distribution.positive} positive, ${data.distribution.neutral} neutral, ${data.distribution.negative} negative`,
                    })
                    // Refresh mentions after re-analysis
                    setTimeout(async () => {
                      const refreshResponse = await fetch('/api/twitter/mentions?maxResults=50', {
                        credentials: 'include',
                      })
                      if (refreshResponse.ok) {
                        const refreshData = await refreshResponse.json()
                        setRealMentions(refreshData.mentions || [])
                      }
                    }, 500)
                  } else {
                    const errorData = await response.json().catch(() => ({}))
                    console.error('[EngagementMonitor] Re-analysis failed:', response.status, errorData)
                    toast({
                      title: 'Error',
                      description: errorData.error || 'Failed to re-analyze mentions',
                      variant: 'destructive',
                    })
                  }
                } catch (error) {
                  console.error('[EngagementMonitor] Re-analysis error:', error)
                  toast({
                    title: 'Error',
                    description: error instanceof Error ? error.message : 'Failed to re-analyze mentions',
                    variant: 'destructive',
                  })
                } finally {
                  setIsLoadingMentions(false)
                }
              }}
              disabled={isLoadingMentions}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoadingMentions ? 'animate-spin' : ''}`} />
              Re-analyze Sentiment
            </Button>
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Sentiment Distribution</CardTitle>
              <CardDescription>Overall sentiment of mentions over time</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">{sentimentStats.positive}%</div>
                  <div className="text-sm text-green-700">Positive</div>
                </div>
                <div className="text-center p-4 bg-muted/50 rounded-lg">
                  <div className="text-2xl font-bold text-muted-foreground">{sentimentStats.neutral}%</div>
                  <div className="text-sm text-foreground">Neutral</div>
                </div>
                <div className="text-center p-4 bg-red-50 rounded-lg">
                  <div className="text-2xl font-bold text-red-600">{sentimentStats.negative}%</div>
                  <div className="text-sm text-red-700">Negative</div>
                </div>
              </div>
              
              <div className="space-y-4">
                <h4 className="font-medium">Recent Sentiment Trends</h4>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>Customer Support Mentions</span>
                    <Badge className="bg-yellow-100 text-yellow-800">Mixed</Badge>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span>Product Feature Mentions</span>
                    <Badge className="bg-green-100 text-green-800">Positive</Badge>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span>General Brand Mentions</span>
                    <Badge className="bg-green-100 text-green-800">Positive</Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Urgent Attention Required</CardTitle>
              <CardDescription>Negative mentions that need immediate response</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {displayMentions.filter(m => m.sentiment === "negative" && !m.replied).map((mention) => (
                  <div key={mention.id} className="flex items-center justify-between p-3 border-l-4 border-red-500 bg-red-50 rounded">
                    <div>
                      <span className="font-medium">{mention.user}</span>
                      <p className="text-sm text-foreground mt-1">{mention.content}</p>
                      <span className="text-xs text-muted-foreground">{mention.time}</span>
                    </div>
                    <Button size="sm" variant="destructive">
                      <AlertTriangle className="h-4 w-4 mr-2" />
                      Respond Now
                    </Button>
                  </div>
                ))}
                {displayMentions.filter(m => m.sentiment === "negative" && !m.replied).length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">No negative mentions requiring urgent attention</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

    </div>
  )
}
