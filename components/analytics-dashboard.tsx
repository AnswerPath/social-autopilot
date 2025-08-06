"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { TrendingUp, TrendingDown, Users, MessageSquare, Heart, Repeat2, Download } from 'lucide-react'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { Line, LineChart, Bar, BarChart, CartesianGrid, XAxis, YAxis, ResponsiveContainer } from "recharts"

export function AnalyticsDashboard() {
  const engagementData = [
    { date: "Jan 1", likes: 45, retweets: 12, replies: 8, impressions: 1200 },
    { date: "Jan 2", likes: 52, retweets: 18, replies: 12, impressions: 1450 },
    { date: "Jan 3", likes: 38, retweets: 9, replies: 6, impressions: 980 },
    { date: "Jan 4", likes: 67, retweets: 24, replies: 15, impressions: 1800 },
    { date: "Jan 5", likes: 71, retweets: 28, replies: 18, impressions: 1950 },
    { date: "Jan 6", likes: 59, retweets: 21, replies: 14, impressions: 1650 },
    { date: "Jan 7", likes: 84, retweets: 35, replies: 22, impressions: 2200 }
  ]

  const followerGrowth = [
    { date: "Week 1", followers: 12100 },
    { date: "Week 2", followers: 12180 },
    { date: "Week 3", followers: 12250 },
    { date: "Week 4", followers: 12400 }
  ]

  const topPosts = [
    {
      id: 1,
      content: "Excited to announce our new product features! 🚀 #innovation #tech",
      engagement: { likes: 156, retweets: 42, replies: 28 },
      impressions: 3200,
      date: "Jan 5"
    },
    {
      id: 2,
      content: "Behind the scenes: Our development team working on amazing features",
      engagement: { likes: 89, retweets: 23, replies: 15 },
      impressions: 2100,
      date: "Jan 3"
    },
    {
      id: 3,
      content: "Thanks to everyone who joined our webinar today!",
      engagement: { likes: 67, retweets: 18, replies: 12 },
      impressions: 1800,
      date: "Jan 2"
    }
  ]

  const metrics = [
    {
      title: "Total Impressions",
      value: "45.2K",
      change: "+12.5%",
      trend: "up",
      icon: TrendingUp
    },
    {
      title: "Engagement Rate",
      value: "4.2%",
      change: "+0.8%",
      trend: "up",
      icon: Heart
    },
    {
      title: "Follower Growth",
      value: "+156",
      change: "+23%",
      trend: "up",
      icon: Users
    },
    {
      title: "Avg. Replies",
      value: "14.2",
      change: "-2.1%",
      trend: "down",
      icon: MessageSquare
    }
  ]

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex items-center justify-between">
        <Select defaultValue="7days">
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7days">Last 7 days</SelectItem>
            <SelectItem value="30days">Last 30 days</SelectItem>
            <SelectItem value="90days">Last 90 days</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline">
          <Download className="h-4 w-4 mr-2" />
          Export Report
        </Button>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {metrics.map((metric, index) => (
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
                ) : (
                  <TrendingDown className="h-3 w-3 text-red-600" />
                )}
                <span className={`text-xs ${metric.trend === "up" ? "text-green-600" : "text-red-600"}`}>
                  {metric.change}
                </span>
                <span className="text-xs text-muted-foreground">vs last period</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Engagement Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Daily Engagement</CardTitle>
            <CardDescription>Likes, retweets, and replies over time</CardDescription>
          </CardHeader>
          <CardContent>
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
          </CardContent>
        </Card>

        {/* Follower Growth */}
        <Card>
          <CardHeader>
            <CardTitle>Follower Growth</CardTitle>
            <CardDescription>Weekly follower count progression</CardDescription>
          </CardHeader>
          <CardContent>
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
                  {((post.engagement.likes + post.engagement.retweets + post.engagement.replies) / post.impressions * 100).toFixed(1)}% ER
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
