"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { X, Image, Calendar, Send, Save, Users } from 'lucide-react'
import { Switch } from "@/components/ui/switch"

interface PostComposerProps {
  onClose: () => void
}

export function PostComposer({ onClose }: PostComposerProps) {
  const [content, setContent] = useState("")
  const [scheduleDate, setScheduleDate] = useState("")
  const [scheduleTime, setScheduleTime] = useState("")
  const [requiresApproval, setRequiresApproval] = useState(false)
  const [postType, setPostType] = useState("now")
  const [isPosting, setIsPosting] = useState(false)
  const [uploadedMedia, setUploadedMedia] = useState<string[]>([])
  const [isUploading, setIsUploading] = useState(false)

  const characterCount = content.length
  const maxCharacters = 280

  const handleSubmit = async () => {
    if (!content.trim()) return
    
    setIsPosting(true)
    try {
      const payload = {
        text: content,
        mediaIds: uploadedMedia,
        ...(postType === "schedule" && scheduleDate && scheduleTime && {
          scheduledTime: new Date(`${scheduleDate}T${scheduleTime}`).toISOString()
        })
      }

      const response = await fetch('/api/twitter/post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      const result = await response.json()
      
      if (response.ok) {
        // Success - close composer and refresh data
        onClose()
        // You could add a success toast here
      } else {
        console.error('Failed to post:', result.error)
        // You could add an error toast here
      }
    } catch (error) {
      console.error('Error posting tweet:', error)
    } finally {
      setIsPosting(false)
    }
  }

  const handleMediaUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setIsUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/twitter/upload', {
        method: 'POST',
        body: formData
      })

      const result = await response.json()
      
      if (response.ok) {
        setUploadedMedia(prev => [...prev, result.mediaId])
      } else {
        console.error('Failed to upload media:', result.error)
      }
    } catch (error) {
      console.error('Error uploading media:', error)
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-auto">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Create New Post</CardTitle>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Post Content */}
          <div className="space-y-2">
            <Label htmlFor="content">Post Content</Label>
            <Textarea
              id="content"
              placeholder="What's happening?"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="min-h-[120px] resize-none"
              maxLength={maxCharacters}
            />
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <input
                  type="file"
                  accept="image/*,video/*"
                  onChange={handleMediaUpload}
                  style={{ display: 'none' }}
                  id="media-upload"
                />
                <Button variant="outline" size="sm" asChild disabled={isUploading}>
                  <label htmlFor="media-upload">
                    <Image className="h-4 w-4 mr-2" />
                    {isUploading ? 'Uploading...' : 'Add Media'}
                  </label>
                </Button>
              </div>
              <Badge variant={characterCount > maxCharacters * 0.9 ? "destructive" : "secondary"}>
                {characterCount}/{maxCharacters}
              </Badge>
            </div>
          </div>

          {/* Post Type */}
          <div className="space-y-3">
            <Label>When to Post</Label>
            <Select value={postType} onValueChange={setPostType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="now">Post Now</SelectItem>
                <SelectItem value="schedule">Schedule for Later</SelectItem>
                <SelectItem value="draft">Save as Draft</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Schedule Options */}
          {postType === "schedule" && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="date">Date</Label>
                <Input
                  id="date"
                  type="date"
                  value={scheduleDate}
                  onChange={(e) => setScheduleDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="time">Time</Label>
                <Input
                  id="time"
                  type="time"
                  value={scheduleTime}
                  onChange={(e) => setScheduleTime(e.target.value)}
                />
              </div>
            </div>
          )}

          {/* Approval Workflow */}
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label>Require Approval</Label>
              <p className="text-sm text-gray-600">Send to manager for review before posting</p>
            </div>
            <Switch
              checked={requiresApproval}
              onCheckedChange={setRequiresApproval}
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            {postType === "draft" && (
              <Button variant="outline">
                <Save className="h-4 w-4 mr-2" />
                Save Draft
              </Button>
            )}
            {requiresApproval ? (
              <Button>
                <Users className="h-4 w-4 mr-2" />
                Submit for Approval
              </Button>
            ) : (
              <Button onClick={handleSubmit} disabled={isPosting || !content.trim()}>
                {postType === "now" ? (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    {isPosting ? 'Posting...' : 'Post Now'}
                  </>
                ) : (
                  <>
                    <Calendar className="h-4 w-4 mr-2" />
                    {isPosting ? 'Scheduling...' : 'Schedule Post'}
                  </>
                )}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
