"use client"

import * as React from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Clock, TrendingUp, Loader2, Calendar } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { useAuth } from "@/hooks/use-auth"
import { PostingTimeHeatmap } from "./posting-time-heatmap"

interface PostingTimeRecommendation {
  hour: number
  dayOfWeek: number
  confidence: number
  reasoning: string
  averageEngagementRate: number
  postCount: number
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export function PostingRecommendations() {
  const [recommendations, setRecommendations] = React.useState<PostingTimeRecommendation[]>([])
  const [heatmapData, setHeatmapData] = React.useState<number[][] | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  const { user } = useAuth()
  const userId = user?.id || 'demo-user'

  React.useEffect(() => {
    fetchRecommendations()
    fetchHeatmap()
  }, [])

  const fetchRecommendations = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch('/api/analytics/recommendations', {
        headers: { 'x-user-id': userId },
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        const errorMessage = result.error || 'Failed to fetch recommendations'
        setError(errorMessage)
        setRecommendations([])
        setLoading(false)
        return
      }

      const raw = (result.recommendations || []) as (Omit<PostingTimeRecommendation, 'postCount'> & { postCount?: number })[]
      setRecommendations(raw.map((r) => ({ ...r, postCount: r.postCount ?? 0 })))
      setError(null)
    } catch (err) {
      console.error('Error fetching recommendations:', err)
      setError(err instanceof Error ? err.message : 'Failed to load recommendations')
    } finally {
      setLoading(false)
    }
  }

  const fetchHeatmap = async () => {
    try {
      const response = await fetch('/api/analytics/recommendations/heatmap', {
        headers: { 'x-user-id': userId },
      })

      const result = await response.json()

      if (response.ok && result.success) {
        setHeatmapData(result.heatmap || null)
      }
    } catch (err) {
      console.error('Error fetching heatmap:', err)
      // Don't set error state for heatmap failures, it's optional
    }
  }

  const formatTime = (hour: number): string => {
    const period = hour >= 12 ? 'PM' : 'AM'
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
    return `${displayHour}:00 ${period}`
  }

  const getConfidenceColor = (confidence: number): string => {
    if (confidence >= 0.7) return 'bg-green-100 text-green-800'
    if (confidence >= 0.4) return 'bg-yellow-100 text-yellow-800'
    return 'bg-gray-100 text-gray-800'
  }

  const getConfidenceLabel = (confidence: number): string => {
    if (confidence >= 0.7) return 'High'
    if (confidence >= 0.4) return 'Medium'
    return 'Low'
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Posting Time Recommendations</CardTitle>
          <CardDescription>AI-powered suggestions for optimal posting times</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Posting Time Recommendations</CardTitle>
          <CardDescription>AI-powered suggestions for optimal posting times</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center text-destructive py-4">
            <p className="font-semibold">Error loading recommendations</p>
            <p className="text-sm mt-2">{error}</p>
            <Button onClick={fetchRecommendations} className="mt-4" variant="outline" size="sm">
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (recommendations.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Posting Time Recommendations</CardTitle>
          <CardDescription>AI-powered suggestions for optimal posting times</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground py-8">
            <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="font-medium">Insufficient data for recommendations</p>
            <p className="text-sm mt-2">
              We need at least 5 posts with analytics data (impressions &gt; 0) to generate recommendations.
            </p>
            {error && (
              <p className="text-xs mt-3 text-muted-foreground/80 max-w-md mx-auto">
                {error}
              </p>
            )}
            <p className="text-sm mt-3">
              Keep posting and check back later! Analytics data is collected automatically after posts are published.
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Recommendations List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Posting Time Recommendations</CardTitle>
              <CardDescription>AI-powered suggestions based on your historical performance</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => {
              fetchRecommendations()
              fetchHeatmap()
            }}>
              <TrendingUp className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {recommendations.map((rec, index) => (
              <div
                key={`${rec.dayOfWeek}-${rec.hour}`}
                className="flex items-start gap-4 p-4 border rounded-lg hover:bg-accent transition-colors"
              >
                <div className="flex-shrink-0 w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                  <span className="text-sm font-bold text-blue-600">#{index + 1}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="font-semibold">
                      {DAY_NAMES[rec.dayOfWeek]} at {formatTime(rec.hour)}
                    </span>
                    <Badge variant="secondary" className={getConfidenceColor(rec.confidence)}>
                      {getConfidenceLabel(rec.confidence)} Confidence
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">{rec.reasoning}</p>
                  <div className="flex items-center gap-4 text-xs">
                    <span className="text-muted-foreground">
                      Avg. Engagement Rate: <span className="font-semibold text-foreground">
                        {rec.averageEngagementRate.toFixed(2)}
                      </span>
                    </span>
                    <span className="text-muted-foreground">
                      Based on {rec.postCount} post{rec.postCount !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    // TODO: Open scheduling modal with pre-filled time
                    console.log('Schedule at:', rec.dayOfWeek, rec.hour)
                  }}
                >
                  Schedule
                </Button>
              </div>
            ))}
          </div>
          <div className="mt-6 p-4 bg-muted rounded-lg">
            <p className="text-sm text-muted-foreground">
              <strong>Note:</strong> Recommendations are based on your historical post performance.
              They improve as you collect more analytics data. Consider your audience's timezone
              when scheduling posts.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Heatmap Visualization */}
      {heatmapData && (
        <PostingTimeHeatmap data={heatmapData} loading={false} />
      )}
    </div>
  )
}
