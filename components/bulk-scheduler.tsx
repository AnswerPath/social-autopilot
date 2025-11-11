"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { X, Calendar, Clock, Upload, CheckCircle2, AlertCircle } from 'lucide-react'
import { useToast } from "@/hooks/use-toast"
import { calculateBulkSchedule, validateBulkScheduleConfig, type Frequency, type PostToSchedule } from "@/lib/bulk-scheduling"
import { getUserTimezone, getCommonTimezones } from "@/lib/timezone-utils"

interface BulkSchedulerProps {
  posts?: PostToSchedule[]
  onSuccess?: () => void
  onClose?: () => void
}

export function BulkScheduler({ posts: initialPosts = [], onSuccess, onClose }: BulkSchedulerProps) {
  const [startDate, setStartDate] = useState("")
  const [startTime, setStartTime] = useState("09:00")
  const [endDate, setEndDate] = useState("")
  const [endTime, setEndTime] = useState("17:00")
  const [frequency, setFrequency] = useState<Frequency>("even")
  const [customInterval, setCustomInterval] = useState<string>("60")
  const [timezone, setTimezone] = useState(getUserTimezone())
  const [selectedPosts, setSelectedPosts] = useState<PostToSchedule[]>(initialPosts)
  const [newPostContent, setNewPostContent] = useState("")
  const [preview, setPreview] = useState<Array<{ post: PostToSchedule; scheduledDate: string; scheduledTime: string }>>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errors, setErrors] = useState<string[]>([])
  const { toast } = useToast()

  useEffect(() => {
    // Set default dates (today and 7 days from now)
    const today = new Date()
    const weekFromNow = new Date()
    weekFromNow.setDate(today.getDate() + 7)

    setStartDate(today.toISOString().split('T')[0])
    setEndDate(weekFromNow.toISOString().split('T')[0])
  }, [])

  const handleAddPost = () => {
    if (!newPostContent.trim()) return

    setSelectedPosts(prev => [...prev, { content: newPostContent.trim() }])
    setNewPostContent("")
  }

  const handleRemovePost = (index: number) => {
    setSelectedPosts(prev => prev.filter((_, i) => i !== index))
  }

  const handleGeneratePreview = () => {
    if (selectedPosts.length === 0) {
      setPreview([])
      return
    }

    const config = {
      startDate,
      startTime,
      endDate,
      endTime,
      frequency,
      customIntervalMinutes: frequency === 'custom' ? parseInt(customInterval) : undefined,
      timezone
    }

    const validation = validateBulkScheduleConfig(config, selectedPosts.length)
    if (!validation.valid) {
      setErrors([validation.error || 'Invalid configuration'])
      setPreview([])
      return
    }

    setErrors([])
    const schedule = calculateBulkSchedule(selectedPosts, config)
    setPreview(schedule)
  }

  useEffect(() => {
    // Auto-generate preview when configuration changes
    if (startDate && endDate && selectedPosts.length > 0) {
      handleGeneratePreview()
    }
  }, [startDate, startTime, endDate, endTime, frequency, customInterval, selectedPosts])

  const handleSubmit = async () => {
    if (selectedPosts.length === 0) {
      toast({
        title: "Error",
        description: "Please add at least one post to schedule",
        variant: "destructive",
      })
      return
    }

    if (preview.length === 0) {
      toast({
        title: "Error",
        description: "No valid schedule generated. Please check your configuration.",
        variant: "destructive",
      })
      return
    }

    setIsSubmitting(true)
    setErrors([])

    try {
      const response = await fetch('/api/scheduled-posts/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          posts: preview.map(item => ({
            content: item.post.content,
            mediaUrls: item.post.mediaUrls,
            scheduledDate: item.scheduledDate,
            scheduledTime: item.scheduledTime,
            timezone
          }))
        })
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to schedule posts')
      }

      toast({
        title: "Success",
        description: `Successfully scheduled ${result.successCount} of ${preview.length} posts`,
      })

      if (result.failures && result.failures.length > 0) {
        setErrors(result.failures.map((f: any) => f.error))
      }

      onSuccess?.()
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to schedule posts",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Bulk Schedule Posts</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Date Range */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startDate">Start Date</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="startTime">Start Time</Label>
              <Input
                id="startTime"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate">End Date</Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endTime">End Time</Label>
              <Input
                id="endTime"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>
          </div>

          {/* Frequency */}
          <div className="space-y-2">
            <Label htmlFor="frequency">Frequency</Label>
            <Select value={frequency} onValueChange={(value) => setFrequency(value as Frequency)}>
              <SelectTrigger id="frequency">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="even">Even Distribution</SelectItem>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="custom">Custom Interval</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Custom Interval */}
          {frequency === 'custom' && (
            <div className="space-y-2">
              <Label htmlFor="customInterval">Interval (minutes)</Label>
              <Input
                id="customInterval"
                type="number"
                min="5"
                value={customInterval}
                onChange={(e) => setCustomInterval(e.target.value)}
                placeholder="60"
              />
            </div>
          )}

          {/* Timezone */}
          <div className="space-y-2">
            <Label htmlFor="timezone">Timezone</Label>
            <Select value={timezone} onValueChange={setTimezone}>
              <SelectTrigger id="timezone">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {getCommonTimezones().map(tz => (
                  <SelectItem key={tz.value} value={tz.value}>
                    {tz.label} ({tz.offset})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Add Posts */}
          <div className="space-y-2">
            <Label>Posts to Schedule ({selectedPosts.length})</Label>
            <div className="flex gap-2">
              <Input
                placeholder="Enter post content..."
                value={newPostContent}
                onChange={(e) => setNewPostContent(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleAddPost()
                  }
                }}
              />
              <Button onClick={handleAddPost} disabled={!newPostContent.trim()}>
                Add
              </Button>
            </div>
            
            {/* Post List */}
            <div className="space-y-2 max-h-40 overflow-y-auto border rounded-md p-2">
              {selectedPosts.map((post, index) => (
                <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                  <span className="text-sm line-clamp-1 flex-1">{post.content}</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleRemovePost(index)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          {/* Errors */}
          {errors.length > 0 && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <ul className="list-disc list-inside">
                  {errors.map((error, index) => (
                    <li key={index}>{error}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {/* Preview */}
          {preview.length > 0 && (
            <div className="space-y-2">
              <Label>Preview ({preview.length} posts will be scheduled)</Label>
              <div className="max-h-60 overflow-y-auto border rounded-md p-4 space-y-2">
                {preview.map((item, index) => (
                  <div key={index} className="flex items-center justify-between p-2 bg-blue-50 rounded text-sm">
                    <span className="flex-1 line-clamp-1">{item.post.content}</span>
                    <Badge variant="outline">
                      {item.scheduledDate} {item.scheduledTime}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2">
            {onClose && (
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
            )}
            <Button 
              onClick={handleSubmit}
              disabled={isSubmitting || preview.length === 0 || selectedPosts.length === 0}
            >
              {isSubmitting ? 'Scheduling...' : `Schedule ${preview.length} Posts`}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

