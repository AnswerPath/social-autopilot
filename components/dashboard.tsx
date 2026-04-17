"use client"

import { useState, useEffect, useMemo, Suspense } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CalendarDays, MessageSquare, TrendingUp, Users, Plus, Bell, Settings, BarChart3, Calendar, Edit3, AlertTriangle, RefreshCw, Info, ExternalLink } from 'lucide-react'
import { PostComposer } from "./post-composer"
import { CalendarView } from "./calendar-view"
import { AnalyticsDashboard } from "./analytics-dashboard"
import { TeamManagement } from "./team-management"
import { EngagementMonitor } from "./engagement-monitor"
import { AutoReplyRules } from "./engagement/auto-reply-rules"
import { AutoReplyAnalytics } from "./engagement/auto-reply-analytics"
import { FlaggedMentions } from "./engagement/flagged-mentions"
import { Sidebar } from "./sidebar"
import { SettingsPage } from "./settings-page"
import { UserInfoCard } from "./auth/user-info-card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ManagerApprovalDashboard } from "./approval/manager-dashboard"
import { NotificationCenter } from "./notifications/notification-center"
import { UserMenu } from "./auth/user-menu"
import { FeatureTour } from "./tutorial/feature-tour"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { ContextualHelp } from "./help/contextual-help"
import { HelpMenu } from "./help/help-menu"
import { GettingStartedCard } from "./onboarding/getting-started-card"
import { cn } from "@/lib/utils"

const STAT_STAGGER = ["delay-stagger-1", "delay-stagger-2", "delay-stagger-3", "delay-stagger-4"] as const

export function Dashboard() {
  const [activeTab, setActiveTab] = useState("dashboard")
  const [showComposer, setShowComposer] = useState(false)
  const [showTooltips, setShowTooltips] = useState(true)

  const [twitterProfile, setTwitterProfile] = useState<any>(null)
  const [recentTweets, setRecentTweets] = useState<any[]>([])
  const [mentions, setMentions] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)
  const [dataSource, setDataSource] = useState<'real' | 'error' | 'loading'>('loading')
  const [apiNotes, setApiNotes] = useState<string[]>([])
  const [followerTrendBadge, setFollowerTrendBadge] = useState<string | null>(null)

  useEffect(() => {
    fetchTwitterData()
  }, [])

  useEffect(() => {
    fetch('/api/onboarding', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : {}))
      .then((d) => {
        if (typeof d.showContextualTooltips === 'boolean') setShowTooltips(d.showContextualTooltips)
      })
      .catch(() => {})
  }, [])

  const fetchTwitterData = async () => {
    setIsLoading(true)
    setDataSource('loading')
    setApiNotes([])
    setFollowerTrendBadge(null)
    console.log('🔄 Dashboard: Starting data fetch...')
    
    try {
      const errors: string[] = []
      const notes: string[] = []

      // Fetch user profile
      try {
        console.log('📡 Dashboard: Fetching profile...')
        const profileResponse = await fetch('/api/twitter/profile', { credentials: 'include' })
        const profileData = await profileResponse.json()
        
        if (profileData.success && profileData.profile) {
          setTwitterProfile(profileData.profile)
          console.log('✅ Dashboard: Profile loaded:', profileData.profile.username)

          if (profileData.note) {
            notes.push('Profile: ' + profileData.note)
          }
        } else if (profileData.success && profileData.requiresSetup) {
          setTwitterProfile(null)
          if (profileData.note) {
            notes.push('Profile: ' + profileData.note)
          }
        } else {
          setTwitterProfile(null)
          errors.push('Profile: ' + (profileData.error || 'Unknown error'))
        }
      } catch (error) {
        console.error('❌ Dashboard: Profile fetch error:', error)
        setTwitterProfile(null)
        errors.push('Profile: Network error')
      }

      // Fetch recent tweets
      try {
        console.log('📡 Dashboard: Fetching tweets...')
        const tweetsResponse = await fetch('/api/twitter/tweets?maxResults=5', { credentials: 'include' })
        const tweetsData = await tweetsResponse.json()
        
        if (tweetsData.success && !tweetsData.requiresSetup) {
          setRecentTweets(tweetsData.tweets || [])
          console.log('✅ Dashboard: Tweets loaded:', tweetsData.tweets?.length || 0, 'tweets')

          if (tweetsData.note) {
            notes.push('Tweets: ' + tweetsData.note)
          }
        } else {
          setRecentTweets([])
          errors.push(
            'Tweets: ' +
              (tweetsData.error ||
                (tweetsData.requiresSetup ? 'Credentials not configured' : 'Unknown error'))
          )
        }
      } catch (error) {
        console.error('❌ Dashboard: Tweets fetch error:', error)
        setRecentTweets([])
        errors.push('Tweets: Network error')
      }

      // Fetch mentions
      try {
        console.log('📡 Dashboard: Fetching mentions...')
        const mentionsResponse = await fetch('/api/twitter/mentions?maxResults=10', { credentials: 'include' })
        const mentionsData = await mentionsResponse.json()
        
        if (mentionsData.success) {
          setMentions(mentionsData.mentions || [])
          console.log('✅ Dashboard: Mentions loaded:', mentionsData.mentions?.length || 0, 'mentions')

          if (mentionsData.note) {
            notes.push('Mentions: ' + mentionsData.note)
          }
        } else {
          setMentions([])
          errors.push('Mentions: ' + (mentionsData.error || 'Unknown error'))
        }
      } catch (error) {
        console.error('❌ Dashboard: Mentions fetch error:', error)
        setMentions([])
        errors.push('Mentions: Network error')
      }

      try {
        const fr = await fetch('/api/analytics/followers', { credentials: 'include' })
        const fd = await fr.json()
        let trend: string | null = null
        if (fd.success && Array.isArray(fd.data) && fd.data.length >= 2) {
          const last = fd.data[fd.data.length - 1] as {
            growth?: number
            growthPercent?: number
          }
          const g = last.growth ?? 0
          const gp = last.growthPercent ?? 0
          if (g !== 0 || (gp !== 0 && Number.isFinite(gp))) {
            const parts: string[] = []
            if (g !== 0) parts.push(`${g > 0 ? '+' : ''}${g} followers`)
            if (gp !== 0 && Number.isFinite(gp)) parts.push(`${gp > 0 ? '+' : ''}${gp}% vs prior week`)
            trend = parts.join(' · ')
          }
        }
        setFollowerTrendBadge(trend)
      } catch {
        setFollowerTrendBadge(null)
      }

      if (errors.length > 0) {
        setDataSource('error')
        console.warn('⚠️ Dashboard: Some data fetch errors:', errors)
      } else {
        setDataSource('real')
        console.log('✅ Dashboard: Data fetch completed')
      }

      setApiNotes(notes)
      setLastRefresh(new Date())
    } catch (error) {
      console.error('❌ Dashboard: General fetch error:', error)
      setDataSource('error')
    } finally {
      setIsLoading(false)
    }
  }

  const stats = useMemo(() => {
    const avgPerTweet =
      recentTweets.length > 0
        ? Math.round(
            recentTweets.reduce(
              (acc, tweet) =>
                acc + (tweet.public_metrics?.like_count || 0) + (tweet.public_metrics?.retweet_count || 0),
              0
            ) / recentTweets.length
          )
        : 0

    return [
      {
        title: "Followers",
        value: twitterProfile?.public_metrics?.followers_count?.toLocaleString() || "0",
        description: "Total followers",
        icon: Users,
        trend: followerTrendBadge,
      },
      {
        title: "Recent Tweets",
        value: recentTweets.length.toString(),
        description: "Last 5 tweets",
        icon: CalendarDays,
        trend: recentTweets.length > 0 ? `${recentTweets.length} loaded` : null,
      },
      {
        title: "New Mentions",
        value: mentions.length.toString(),
        description: "Unread mentions",
        icon: MessageSquare,
        trend:
          mentions.length > 0
            ? `${mentions.filter((m) => m.sentiment === 'negative').length} urgent`
            : null,
      },
      {
        title: "Avg Engagement",
        value: recentTweets.length > 0 ? String(avgPerTweet) : "0",
        description: "Likes + reposts per tweet",
        icon: TrendingUp,
        trend: null,
      },
    ]
  }, [twitterProfile, recentTweets, mentions, followerTrendBadge])

  const recentPostsData = recentTweets.map(tweet => ({
    id: tweet.id,
    content: tweet.text,
    status: "published",
    publishedAt: new Date(tweet.created_at).toLocaleDateString(),
    engagement: {
      likes: tweet.public_metrics?.like_count || 0,
      retweets: tweet.public_metrics?.retweet_count || 0,
      replies: tweet.public_metrics?.reply_count || 0
    }
  }))

  const urgentMentionsData = mentions
    .filter(mention => mention.sentiment === 'negative' || mention.public_metrics?.followers_count > 1000)
    .slice(0, 5)
    .map(mention => ({
      id: mention.id,
      user: `@${mention.username}`,
      content: mention.text,
      sentiment: mention.sentiment,
      time: new Date(mention.created_at).toLocaleString()
    }))

  if (showComposer) {
    return <PostComposer onClose={() => setShowComposer(false)} />
  }

  return (
    <TooltipProvider delayDuration={300}>
    <div className="flex h-screen min-h-0 bg-transparent">
      <Sidebar activeTab={activeTab} onTabChange={setActiveTab} showTooltips={showTooltips} />
      
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {/* Header */}
        <header className="border-b border-border bg-card/85 px-6 py-4 shadow-sm-soft backdrop-blur-md">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="animate-fade-up font-heading text-2xl font-bold text-foreground">
                  {activeTab === "dashboard" && "Dashboard"}
                  {activeTab === "calendar" && "Content Calendar"}
                  {activeTab === "approvals" && "Approvals"}
                  {activeTab === "analytics" && "Analytics"}
                  {activeTab === "team" && "Team Management"}
                  {activeTab === "engagement" && "Engagement Monitor"}
                  {activeTab === "settings" && "Settings"}
                </h1>
                <ContextualHelp sectionId={activeTab} />
              </div>
              <p className="animate-fade-up text-muted-foreground delay-stagger-2">
                {activeTab === "dashboard" && "Overview of your social media performance"}
                {activeTab === "calendar" && "Manage and schedule your content"}
                {activeTab === "approvals" && "Manage multi-step approval workflows"}
                {activeTab === "analytics" && "Insights and performance metrics"}
                {activeTab === "team" && "Manage team members and permissions"}
                {activeTab === "engagement" && "Monitor mentions and engagement"}
                {activeTab === "settings" && "Manage your integrations and preferences"}
              </p>
            </div>
            <div className="flex items-center gap-4">
              <HelpMenu />
              <Button variant="outline" size="sm" onClick={fetchTwitterData} disabled={isLoading}>
                <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                {isLoading ? 'Loading...' : 'Refresh'}
              </Button>
              <NotificationCenter />
              {showTooltips ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button onClick={() => setShowComposer(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Create Post
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Compose and schedule a new post</TooltipContent>
                </Tooltip>
              ) : (
                <Button onClick={() => setShowComposer(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Post
                </Button>
              )}
              <UserMenu />
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-auto p-6">
          {activeTab === "dashboard" && (
            <div className="space-y-6">
              {/* User Info Card + Getting Started */}
              <div className="grid grid-cols-1 gap-6 animate-fade-up delay-stagger-1 lg:grid-cols-3">
                <div className="space-y-4 lg:col-span-1">
                  <UserInfoCard />
                  <GettingStartedCard />
                </div>
                <div className="lg:col-span-2">
                  {/* Data Source Indicator */}
                  <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <Badge 
                    variant={
                      dataSource === 'real' ? 'default' : 
                      dataSource === 'loading' ? 'secondary' : 
                      'destructive'
                    }
                  >
                    {dataSource === 'real' && 'Live data'}
                    {dataSource === 'loading' && 'Loading…'}
                    {dataSource === 'error' && 'Some sources unavailable'}
                  </Badge>
                  {twitterProfile && (
                    <div className="flex items-center gap-2">
                      <Avatar className="h-6 w-6">
                        <AvatarImage src={twitterProfile.profile_image_url || "/placeholder.svg"} />
                        <AvatarFallback>{twitterProfile.name?.[0] || 'U'}</AvatarFallback>
                      </Avatar>
                      <span className="text-sm font-medium">@{twitterProfile.username}</span>
                    </div>
                  )}
                </div>
                <span className="text-xs text-muted-foreground" suppressHydrationWarning>
                  {lastRefresh ? `Last updated: ${lastRefresh.toLocaleTimeString()}` : ''}
                </span>
              </div>
                </div>
              </div>

              {/* API Notes */}
              {apiNotes.length > 0 && (
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    <p className="font-medium mb-2">API Status:</p>
                    <ul className="list-disc list-inside text-sm space-y-1">
                      {apiNotes.map((note, index) => (
                        <li key={index}>{note}</li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}

              {/* Stats Grid */}
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
                {stats.map((stat, index) => (
                  <Card
                    key={index}
                    className={cn(
                      "animate-fade-up",
                      STAT_STAGGER[Math.min(index, STAT_STAGGER.length - 1)]
                    )}
                  >
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
                      <stat.icon className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{stat.value}</div>
                      <p className="text-xs text-muted-foreground">
                        {stat.description}
                      </p>
                      {stat.trend ? (
                        <Badge variant="secondary" className="mt-2">
                          {stat.trend}
                        </Badge>
                      ) : null}
                    </CardContent>
                  </Card>
                ))}
              </div>

              <div className="grid grid-cols-1 gap-6 animate-fade-up delay-stagger-3 lg:grid-cols-2">
                {/* Recent Posts */}
                <Card>
                  <CardHeader>
                    <CardTitle>Recent Posts</CardTitle>
                    <CardDescription>
                      Your latest content activity
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {recentPostsData.length > 0 ? (
                      recentPostsData.map((post) => (
                        <div key={post.id} className="flex items-start space-x-3 p-3 border rounded-lg">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={twitterProfile?.profile_image_url || "/placeholder.svg"} />
                            <AvatarFallback>{twitterProfile?.name?.[0] || 'SA'}</AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="line-clamp-2 text-sm text-foreground">{post.content}</p>
                            <div className="flex items-center gap-2 mt-2">
                              <Badge 
                                variant={post.status === "published" ? "default" : post.status === "approved" ? "secondary" : "outline"}
                              >
                                {post.status}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {post.publishedAt}
                              </span>
                            </div>
                            <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
                              <span>{post.engagement.likes} likes</span>
                              <span>{post.engagement.retweets} retweets</span>
                              <span>{post.engagement.replies} replies</span>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="py-8 text-center text-muted-foreground">
                        <MessageSquare className="mx-auto mb-4 h-12 w-12 opacity-50" />
                        <p>No recent tweets found</p>
                        <p className="text-sm">Create your first post to get started!</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Urgent Mentions */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-orange-500" />
                      Urgent Mentions
                    </CardTitle>
                    <CardDescription>
                      Mentions requiring immediate attention
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {urgentMentionsData.length > 0 ? (
                      urgentMentionsData.map((mention) => (
                        <div key={mention.id} className="flex items-start space-x-3 p-3 border rounded-lg">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback>{mention.user[1]?.toUpperCase() || 'U'}</AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm">{mention.user}</span>
                              <Badge 
                                variant={mention.sentiment === "positive" ? "default" : mention.sentiment === "negative" ? "destructive" : "secondary"}
                                className="text-xs"
                              >
                                {mention.sentiment}
                              </Badge>
                            </div>
                            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{mention.content}</p>
                            <span className="text-xs text-muted-foreground">{mention.time}</span>
                          </div>
                          <Button size="sm" variant="outline">
                            Reply
                          </Button>
                        </div>
                      ))
                    ) : (
                      <div className="py-8 text-center text-muted-foreground">
                        <Bell className="mx-auto mb-4 h-12 w-12 opacity-50" />
                        <p>No urgent mentions</p>
                        <p className="text-sm">All caught up!</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {activeTab === "calendar" && <CalendarView />}
          {activeTab === "approvals" && <ManagerApprovalDashboard />}
          {activeTab === "analytics" && <AnalyticsDashboard />}
          {activeTab === "team" && <TeamManagement />}
          {activeTab === "engagement" && (
            <div className="animate-fade-up space-y-6 delay-stagger-1">
              <EngagementMonitor />
              <Tabs defaultValue="rules" className="w-full">
                <TabsList>
                  <TabsTrigger value="rules">Auto-Reply Rules</TabsTrigger>
                  <TabsTrigger value="flagged">Flagged Mentions</TabsTrigger>
                  <TabsTrigger value="analytics">Analytics</TabsTrigger>
                </TabsList>
                <TabsContent value="rules">
                  <AutoReplyRules />
                </TabsContent>
                <TabsContent value="flagged">
                  <FlaggedMentions />
                </TabsContent>
                <TabsContent value="analytics">
                  <AutoReplyAnalytics />
                </TabsContent>
              </Tabs>
            </div>
          )}
          {activeTab === "settings" && <SettingsPage />}
        </main>
      </div>
      <Suspense fallback={null}>
        <FeatureTour />
      </Suspense>
    </div>
    </TooltipProvider>
  )
}
