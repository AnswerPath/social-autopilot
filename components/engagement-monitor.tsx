"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { MessageSquare, Heart, AlertTriangle, TrendingUp, Settings, Plus, Reply, ExternalLink, Clock } from 'lucide-react'

export function EngagementMonitor() {
  const [showAutoReplyForm, setShowAutoReplyForm] = useState(false)
  const [realMentions, setRealMentions] = useState<any[]>([])
  const [isLoadingMentions, setIsLoadingMentions] = useState(true)

  const mentions = [
    {
      id: 1,
      user: "@customer_jane",
      content: "Having issues with login, can someone help? @company",
      sentiment: "negative",
      time: "5 min ago",
      platform: "twitter",
      followers: 1200,
      replied: false,
      priority: "high"
    },
    {
      id: 2,
      user: "@happy_user",
      content: "Love the new update! Great work team @company 👏",
      sentiment: "positive",
      time: "12 min ago",
      platform: "twitter",
      followers: 850,
      replied: false,
      priority: "medium"
    },
    {
      id: 3,
      user: "@tech_reviewer",
      content: "Just tried @company's new feature. Impressed with the UX improvements!",
      sentiment: "positive",
      time: "1 hour ago",
      platform: "twitter",
      followers: 5600,
      replied: true,
      priority: "low"
    },
    {
      id: 4,
      user: "@confused_user",
      content: "How do I reset my password? @company",
      sentiment: "neutral",
      time: "2 hours ago",
      platform: "twitter",
      followers: 320,
      replied: false,
      priority: "medium"
    }
  ]

  const autoReplyRules = [
    {
      id: 1,
      name: "Password Reset Help",
      trigger: "password reset, forgot password, login issue",
      response: "Hi! For password reset help, please visit our support page: help.company.com/password-reset or DM us for personalized assistance. 🔐",
      enabled: true,
      matches: 12
    },
    {
      id: 2,
      name: "Positive Feedback",
      trigger: "love, great, awesome, amazing",
      response: "Thank you so much for the kind words! We're thrilled you're enjoying our product. 😊",
      enabled: true,
      matches: 28
    },
    {
      id: 3,
      name: "General Support",
      trigger: "help, support, issue, problem",
      response: "We're here to help! Please DM us with more details about your issue, or visit our support center: help.company.com 🛠️",
      enabled: false,
      matches: 45
    }
  ]

  const sentimentStats = {
    positive: 68,
    neutral: 24,
    negative: 8
  }

  useEffect(() => {
    const fetchMentions = async () => {
      setIsLoadingMentions(true)
      try {
        const response = await fetch('/api/twitter/mentions?maxResults=50')
        if (response.ok) {
          const data = await response.json()
          setRealMentions(data.mentions || [])
        }
      } catch (error) {
        console.error('Error fetching mentions:', error)
      } finally {
        setIsLoadingMentions(false)
      }
    }

    fetchMentions()
    
    // Refresh mentions every 5 minutes
    const interval = setInterval(fetchMentions, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

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

  const displayMentions = realMentions.map(mention => ({
    id: mention.id,
    user: `@${mention.username}`,
    content: mention.text,
    sentiment: mention.sentiment,
    time: new Date(mention.created_at).toLocaleString(),
    platform: "twitter",
    followers: mention.public_metrics?.followers_count || 0,
    replied: false, // You'd track this in your database
    priority: mention.sentiment === 'negative' ? 'high' : 
             mention.public_metrics?.followers_count > 1000 ? 'medium' : 'low'
  }))

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment) {
      case "positive": return "text-green-600 bg-green-50"
      case "negative": return "text-red-600 bg-red-50"
      case "neutral": return "text-gray-600 bg-gray-50"
      default: return "text-gray-600 bg-gray-50"
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high": return "border-red-500 bg-red-50"
      case "medium": return "border-yellow-500 bg-yellow-50"
      case "low": return "border-green-500 bg-green-50"
      default: return "border-gray-200"
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
                <p className="text-sm text-gray-600">New Mentions</p>
                <p className="text-2xl font-bold">24</p>
              </div>
              <MessageSquare className="h-8 w-8 text-blue-600" />
            </div>
            <Badge variant="secondary" className="mt-2">+12 today</Badge>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Avg Response Time</p>
                <p className="text-2xl font-bold">8m</p>
              </div>
              <Clock className="h-8 w-8 text-green-600" />
            </div>
            <Badge variant="secondary" className="mt-2">-2m improved</Badge>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Sentiment Score</p>
                <p className="text-2xl font-bold">8.2</p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-600" />
            </div>
            <Badge variant="secondary" className="mt-2">+0.3 this week</Badge>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Auto Replies</p>
                <p className="text-2xl font-bold">156</p>
              </div>
              <Settings className="h-8 w-8 text-purple-600" />
            </div>
            <Badge variant="secondary" className="mt-2">85% automated</Badge>
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
          {/* Filters */}
          <div className="flex items-center gap-4">
            <Select defaultValue="all">
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Mentions</SelectItem>
                <SelectItem value="unread">Unread Only</SelectItem>
                <SelectItem value="high">High Priority</SelectItem>
                <SelectItem value="negative">Negative Sentiment</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline">
              <Settings className="h-4 w-4 mr-2" />
              Filters
            </Button>
          </div>

          {/* Mentions List */}
          <div className="space-y-4">
            {displayMentions.map((mention) => (
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
                        <span className="text-sm text-gray-500">{mention.followers.toLocaleString()} followers</span>
                      </div>
                      <p className="text-gray-900 mb-2">{mention.content}</p>
                      <div className="flex items-center gap-4 text-sm text-gray-500">
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
          </div>
        </TabsContent>

        <TabsContent value="automation" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-medium">Auto-Reply Rules</h3>
              <p className="text-gray-600">Automatically respond to common questions and mentions</p>
            </div>
            <Button onClick={() => setShowAutoReplyForm(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Rule
            </Button>
          </div>

          <div className="space-y-4">
            {autoReplyRules.map((rule) => (
              <Card key={rule.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h4 className="font-medium">{rule.name}</h4>
                        <Switch checked={rule.enabled} />
                        <Badge variant="secondary">{rule.matches} matches</Badge>
                      </div>
                      <p className="text-sm text-gray-600 mb-2">
                        <strong>Triggers:</strong> {rule.trigger}
                      </p>
                      <p className="text-sm text-gray-900 bg-gray-50 p-2 rounded">
                        {rule.response}
                      </p>
                    </div>
                    <Button variant="outline" size="sm">
                      Edit
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="sentiment" className="space-y-4">
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
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <div className="text-2xl font-bold text-gray-600">{sentimentStats.neutral}%</div>
                  <div className="text-sm text-gray-700">Neutral</div>
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
                {mentions.filter(m => m.sentiment === "negative" && !m.replied).map((mention) => (
                  <div key={mention.id} className="flex items-center justify-between p-3 border-l-4 border-red-500 bg-red-50 rounded">
                    <div>
                      <span className="font-medium">{mention.user}</span>
                      <p className="text-sm text-gray-700 mt-1">{mention.content}</p>
                      <span className="text-xs text-gray-500">{mention.time}</span>
                    </div>
                    <Button size="sm" variant="destructive">
                      <AlertTriangle className="h-4 w-4 mr-2" />
                      Respond Now
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Auto-Reply Form Modal */}
      {showAutoReplyForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-2xl">
            <CardHeader>
              <CardTitle>Create Auto-Reply Rule</CardTitle>
              <CardDescription>Set up automated responses for common mentions</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="ruleName">Rule Name</Label>
                <Input id="ruleName" placeholder="e.g., Password Reset Help" />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="triggers">Trigger Keywords</Label>
                <Input id="triggers" placeholder="password, reset, login, help (comma separated)" />
                <p className="text-xs text-gray-500">Messages containing these keywords will trigger this auto-reply</p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="response">Auto-Reply Message</Label>
                <Textarea 
                  id="response" 
                  placeholder="Hi! For password reset help, please visit our support page..."
                  className="min-h-[100px]"
                />
                <p className="text-xs text-gray-500">Keep it helpful and on-brand. Include links to resources when possible.</p>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label>Enable Rule</Label>
                  <p className="text-sm text-gray-600">Start using this rule immediately</p>
                </div>
                <Switch defaultChecked />
              </div>
              
              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button variant="outline" onClick={() => setShowAutoReplyForm(false)}>
                  Cancel
                </Button>
                <Button>
                  Create Rule
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
