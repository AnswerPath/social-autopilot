"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { RichTextEditor } from "@/components/ui/rich-text-editor"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { X, Calendar, Send, Save, Users } from 'lucide-react'
import { Switch } from "@/components/ui/switch"
import { MediaUpload } from "@/components/ui/media-upload"
import { useToast } from "@/hooks/use-toast"
import type { MediaAttachment } from "@/lib/media-validation"

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
  const [mediaAttachments, setMediaAttachments] = useState<MediaAttachment[]>([])
  const [uploadedMediaIds, setUploadedMediaIds] = useState<string[]>([])
  const { toast } = useToast()

  const maxCharacters = 280

  const handleSubmit = async () => {
    if (!content.trim()) return
    
    setIsPosting(true)
    try {
      const payload = {
        text: content,
        mediaIds: uploadedMediaIds,
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
        toast({
          title: "Success",
          description: "Post published successfully!",
        })
        onClose()
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to publish post",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error('Error posting tweet:', error)
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      })
    } finally {
      setIsPosting(false)
    }
  }

  const handleMediaUploadStart = () => {
    // Optional: Show loading state or disable form
  }

  const handleMediaUploadComplete = (mediaId: string) => {
    setUploadedMediaIds(prev => [...prev, mediaId])
    toast({
      title: "Success",
      description: "Media uploaded successfully!",
    })
  }

  const handleMediaUploadError = (error: string) => {
    toast({
      title: "Upload Error",
      description: error,
      variant: "destructive",
    })
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
            <RichTextEditor
              placeholder="What's happening?"
              onContentChange={(text) => setContent(text)}
              maxCharacters={maxCharacters}
              initialContent={content}
            />
          </div>

          {/* Media Upload */}
          <div className="space-y-2">
            <Label>Media Attachments</Label>
            <MediaUpload
              platform="twitter"
              attachments={mediaAttachments}
              onAttachmentsChange={setMediaAttachments}
              onUploadStart={handleMediaUploadStart}
              onUploadComplete={handleMediaUploadComplete}
              onUploadError={handleMediaUploadError}
              disabled={isPosting}
            />
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
