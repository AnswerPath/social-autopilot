"use client"

import { useState, useEffect } from "react"
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
import { ApprovalNotificationCenter } from "./approval/notification-center"
import { UserMenu } from "./auth/user-menu"

export function Dashboard() {
  const [activeTab, setActiveTab] = useState("dashboard")
  const [showComposer, setShowComposer] = useState(false)

  const [twitterProfile, setTwitterProfile] = useState<any>(null)
  const [recentTweets, setRecentTweets] = useState<any[]>([])
  const [mentions, setMentions] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)
  const [dataSource, setDataSource] = useState<'real' | 'mock' | 'demo' | 'error'>('demo')
  const [profileIsMock, setProfileIsMock] = useState<boolean | null>(null)
  const [tweetsAreMock, setTweetsAreMock] = useState<boolean | null>(null)
  const [mentionsAreMock, setMentionsAreMock] = useState<boolean | null>(null)
  const [apiNotes, setApiNotes] = useState<string[]>([])

  useEffect(() => {
    fetchTwitterData()
  }, [])

  const fetchTwitterData = async () => {
    setIsLoading(true)
    setApiNotes([])
    console.log('🔄 Dashboard: Starting data fetch...')
    
    try {
      let hasRealData = false
      let errors: string[] = []
      let notes: string[] = []

      // Fetch user profile
      try {
        console.log('📡 Dashboard: Fetching profile...')
        const profileResponse = await fetch('/api/twitter/profile')
        const profileData = await profileResponse.json()
        
        if (profileData.success && profileData.profile) {
          setTwitterProfile(profileData.profile)
          console.log('✅ Dashboard: Profile loaded:', profileData.profile.username)
          
          // Use API-provided mock flag when available
          setProfileIsMock(!!profileData.mock)
          if (profileData.mock === false) {
            hasRealData = true
          } else if (profileData.profile.username !== 'demo_user' && profileData.profile.username !== 'your_account') {
            // Fallback heuristic if mock flag not provided
            hasRealData = true
          }
          
          if (profileData.note) {
            notes.push('Profile: ' + profileData.note)
          }
        } else {
          errors.push('Profile: ' + (profileData.error || 'Unknown error'))
        }
      } catch (error) {
        console.error('❌ Dashboard: Profile fetch error:', error)
        errors.push('Profile: Network error')
      }

      // Fetch recent tweets
      try {
        console.log('📡 Dashboard: Fetching tweets...')
        const tweetsResponse = await fetch('/api/twitter/tweets?maxResults=5')
        const tweetsData = await tweetsResponse.json()
        
        if (tweetsData.success) {
          setRecentTweets(tweetsData.tweets || [])
          console.log('✅ Dashboard: Tweets loaded:', tweetsData.tweets?.length || 0, 'tweets')
          
          setTweetsAreMock(!!tweetsData.mock)
          if (tweetsData.mock === false) {
            hasRealData = true
          }

          if (tweetsData.note) {
            notes.push('Tweets: ' + tweetsData.note)
          }
        } else {
          errors.push('Tweets: ' + (tweetsData.error || 'Unknown error'))
        }
      } catch (error) {
        console.error('❌ Dashboard: Tweets fetch error:', error)
        errors.push('Tweets: Network error')
      }

      // Fetch mentions
      try {
        console.log('📡 Dashboard: Fetching mentions...')
        const mentionsResponse = await fetch('/api/twitter/mentions?maxResults=10')
        const mentionsData = await mentionsResponse.json()
        
        if (mentionsData.success) {
          setMentions(mentionsData.mentions || [])
          console.log('✅ Dashboard: Mentions loaded:', mentionsData.mentions?.length || 0, 'mentions')
          
          setMentionsAreMock(!!mentionsData.mock)
          if (mentionsData.mock === false) {
            hasRealData = true
          }

          if (mentionsData.note) {
            notes.push('Mentions: ' + mentionsData.note)
          }
        } else {
          errors.push('Mentions: ' + (mentionsData.error || 'Unknown error'))
        }
      } catch (error) {
        console.error('❌ Dashboard: Mentions fetch error:', error)
        errors.push('Mentions: Network error')
      }

      // Determine data source
      if (errors.length > 0) {
        setDataSource('error')
        console.warn('⚠️ Dashboard: Some data fetch errors:', errors)
      } else if (hasRealData) {
        setDataSource('real')
        console.log('✅ Dashboard: Using real Twitter data')
      } else if (profileIsMock === false || tweetsAreMock === false || mentionsAreMock === false) {
        // Any real segment indicates partial real data
        setDataSource('real')
        console.log('✅ Dashboard: Using partially real Twitter data')
      } else if (twitterProfile?.username === 'your_account') {
        setDataSource('mock')
        console.log('📊 Dashboard: Using realistic mock data (real credentials)')
      } else {
        setDataSource('demo')
        console.log('🎭 Dashboard: Using demo data')
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

  const stats = [
    {
      title: "Followers",
      value: twitterProfile?.public_metrics?.followers_count?.toLocaleString() || "0",
      description: "Total followers",
      icon: Users,
      trend: "+156"
    },
    {
      title: "Recent Tweets",
      value: recentTweets.length.toString(),
      description: "Last 5 tweets",
      icon: CalendarDays,
      trend: `${recentTweets.length} posted`
    },
    {
      title: "New Mentions",
      value: mentions.length.toString(),
      description: "Unread mentions",
      icon: MessageSquare,
      trend: `${mentions.filter(m => m.sentiment === 'negative').length} urgent`
    },
    {
      title: "Avg Engagement",
      value: recentTweets.length > 0 
        ? Math.round(recentTweets.reduce((acc, tweet) => 
            acc + (tweet.public_metrics?.like_count || 0) + (tweet.public_metrics?.retweet_count || 0), 0
          ) / recentTweets.length).toString()
        : "0",
      description: "Per tweet",
      icon: TrendingUp,
      trend: "+12%"
    }
  ]

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
    <div className="flex h-screen bg-gray-50">
      <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {activeTab === "dashboard" && "Dashboard"}
                {activeTab === "calendar" && "Content Calendar"}
                {activeTab === "approvals" && "Approvals"}
                {activeTab === "analytics" && "Analytics"}
                {activeTab === "team" && "Team Management"}
                {activeTab === "engagement" && "Engagement Monitor"}
                {activeTab === "settings" && "Settings"}
              </h1>
              <p className="text-gray-600">
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
              <Button variant="outline" size="sm" onClick={fetchTwitterData} disabled={isLoading}>
                <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                {isLoading ? 'Loading...' : 'Refresh'}
              </Button>
              <ApprovalNotificationCenter />
              <Button onClick={() => setShowComposer(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Post
              </Button>
              <UserMenu />
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-auto p-6">
          {activeTab === "dashboard" && (
            <div className="space-y-6">
              {/* User Info Card */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-1">
                  <UserInfoCard />
                </div>
                <div className="lg:col-span-2">
                  {/* Data Source Indicator */}
                  <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <Badge 
                    variant={
                      dataSource === 'real' ? 'default' : 
                      dataSource === 'mock' ? 'secondary' : 
                      dataSource === 'demo' ? 'outline' : 
                      'destructive'
                    }
                  >
                    {dataSource === 'real' && '🔴 Live Data'}
                    {dataSource === 'mock' && '📊 Enhanced Mock Data'}
                    {dataSource === 'demo' && '🎭 Demo Data'}
                    {dataSource === 'error' && '⚠️ Error'}
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
                <span className="text-xs text-gray-500" suppressHydrationWarning>
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
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {stats.map((stat, index) => (
                  <Card key={index}>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
                      <stat.icon className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{stat.value}</div>
                      <p className="text-xs text-muted-foreground">
                        {stat.description}
                      </p>
                      <Badge variant="secondary" className="mt-2">
                        {stat.trend}
                      </Badge>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Recent Posts */}
                <Card>
                  <CardHeader>
                    <CardTitle>Recent Posts</CardTitle>
                    <CardDescription>
                      Your latest content activity
                      {dataSource === 'mock' && (
                        <Badge variant="outline" className="ml-2">Enhanced Mock Data</Badge>
                      )}
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
                            <p className="text-sm text-gray-900 line-clamp-2">{post.content}</p>
                            <div className="flex items-center gap-2 mt-2">
                              <Badge 
                                variant={post.status === "published" ? "default" : post.status === "approved" ? "secondary" : "outline"}
                              >
                                {post.status}
                              </Badge>
                              <span className="text-xs text-gray-500">
                                {post.publishedAt}
                              </span>
                            </div>
                            <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                              <span>{post.engagement.likes} likes</span>
                              <span>{post.engagement.retweets} retweets</span>
                              <span>{post.engagement.replies} replies</span>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-8 text-gray-500">
                        <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
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
                      {dataSource === 'mock' && (
                        <Badge variant="outline" className="ml-2">Enhanced Mock Data</Badge>
                      )}
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
                            <p className="text-sm text-gray-600 mt-1 line-clamp-2">{mention.content}</p>
                            <span className="text-xs text-gray-500">{mention.time}</span>
                          </div>
                          <Button size="sm" variant="outline">
                            Reply
                          </Button>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-8 text-gray-500">
                        <Bell className="h-12 w-12 mx-auto mb-4 opacity-50" />
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
            <div className="space-y-6">
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
    </div>
  )
}
