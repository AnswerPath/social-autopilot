"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { EnhancedRichTextEditor } from "@/components/ui/enhanced-rich-text-editor"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { X, Calendar, Send, Save, Users, FileText, Clock, Eye, Edit3, Smartphone, Monitor, Sun, Moon, FileImage } from 'lucide-react'
import { Switch } from "@/components/ui/switch"
import { MediaUpload } from "@/components/ui/media-upload"
import { PostPreview } from "@/components/ui/post-preview"
import { useToast } from "@/hooks/use-toast"
import type { MediaAttachment } from "@/lib/media-validation"
import { DraftManager, type Draft, type DraftFormData, type ConflictResolution } from "@/lib/draft-manager"
import { DraftManagerComponent } from "@/components/draft-manager"
import { getUserTimezone, convertFromUtc } from "@/lib/timezone-utils"
import type { CalendarPost } from "@/lib/calendar-utils"
import { ApprovalCommentPanel } from "@/components/approval/comment-panel"
import { VersionHistoryDialog } from "@/components/approval/version-history-dialog"

interface PostComposerProps {
  onClose: () => void
  initialDraft?: Draft
  editingPost?: CalendarPost | null
}

export function PostComposer({ onClose, initialDraft, editingPost }: PostComposerProps) {
  const [content, setContent] = useState("")
  const [scheduleDate, setScheduleDate] = useState("")
  const [scheduleTime, setScheduleTime] = useState("")
  const [requiresApproval, setRequiresApproval] = useState(false)
  const [postType, setPostType] = useState("now")
  const [isPosting, setIsPosting] = useState(false)
  const [mediaAttachments, setMediaAttachments] = useState<MediaAttachment[]>([])
  const [uploadedMediaIds, setUploadedMediaIds] = useState<string[]>([])
  const [isContentValid, setIsContentValid] = useState(true)
  const [currentDraftId, setCurrentDraftId] = useState<string | null>(null)
  const [isAutoSaving, setIsAutoSaving] = useState(false)
  const [lastAutoSave, setLastAutoSave] = useState<Date | null>(null)
  const [showDraftManager, setShowDraftManager] = useState(false)
  const [conflictResolution, setConflictResolution] = useState<ConflictResolution | null>(null)
  const [isPreviewMode, setIsPreviewMode] = useState(false)
  const [previewDeviceView, setPreviewDeviceView] = useState<'mobile' | 'desktop'>('desktop')
  const [previewTheme, setPreviewTheme] = useState<'light' | 'dark'>('light')
  const { toast } = useToast()
  const draftManager = DraftManager.getInstance()
  const hasUnsavedChanges = useRef(false)

  const maxCharacters = 280

  // Initialize with scheduled post data if editing (priority over draft)
  useEffect(() => {
    if (editingPost) {
      console.log('Initializing with editingPost:', editingPost)
      
      // Set content - handle null/undefined
      const postContent = editingPost.content || ''
      console.log('Setting content:', postContent)
      setContent(postContent)
      setCurrentDraftId(editingPost.id)
      
      // Set media URLs if available
      const mediaUrls = editingPost.mediaUrls || []
      console.log('Setting media URLs:', mediaUrls)
      if (mediaUrls.length > 0) {
        setUploadedMediaIds(mediaUrls)
      } else {
        setUploadedMediaIds([])
      }
      
      // Set post type to schedule
      setPostType("schedule")
      
      // Parse scheduled date/time from scheduledAt
      // scheduledAt is in UTC, but we need to display it in the user's timezone
      if (editingPost.scheduledAt) {
        const utcDate = new Date(editingPost.scheduledAt)
        const userTimezone = editingPost.timezone || getUserTimezone()
        
        // Convert UTC to user's timezone for display
        const localDate = convertFromUtc(utcDate, userTimezone)
        const year = localDate.getFullYear()
        const month = String(localDate.getMonth() + 1).padStart(2, '0')
        const day = String(localDate.getDate()).padStart(2, '0')
        const hours = String(localDate.getHours()).padStart(2, '0')
        const minutes = String(localDate.getMinutes()).padStart(2, '0')
        
        setScheduleDate(`${year}-${month}-${day}`)
        setScheduleTime(`${hours}:${minutes}`)
      }
      
      // Set approval requirement if needed
      if (editingPost.status === 'pending_approval') {
        setRequiresApproval(true)
      }
    } else if (initialDraft) {
      // Only initialize with draft if not editing a scheduled post
      setContent(initialDraft.content)
      setCurrentDraftId(initialDraft.id)
      if (initialDraft.media_urls) {
        setUploadedMediaIds(initialDraft.media_urls)
      }
    }
  }, [editingPost, initialDraft])

  // Auto-save functionality
  useEffect(() => {
    if (!content.trim() && uploadedMediaIds.length === 0) return

    const formData: DraftFormData = {
      content,
      mediaAttachments,
      uploadedMediaIds
    }

    // Save to local storage immediately for offline support
    const localKey = currentDraftId || 'temp'
    draftManager.saveToLocalStorage(localKey, formData)

    // Trigger auto-save if we have a draft ID
    if (currentDraftId && currentDraftId !== 'temp') {
      draftManager.triggerAutoSave(content, uploadedMediaIds)
      setIsAutoSaving(true)
      setLastAutoSave(new Date())
      
      // Reset auto-saving indicator after a short delay
      setTimeout(() => setIsAutoSaving(false), 1000)
    }

    hasUnsavedChanges.current = true
  }, [content, uploadedMediaIds, mediaAttachments, currentDraftId])

  // Cleanup on unmount
  useEffect(() => {
    const handleConflict = (event: CustomEvent) => {
      setConflictResolution(event.detail)
      toast({
        title: "Draft Conflict Detected",
        description: "This draft was modified on another device. Please choose how to resolve the conflict.",
        variant: "destructive",
      })
    }

    window.addEventListener('draft-conflict', handleConflict as EventListener)
    
    return () => {
      window.removeEventListener('draft-conflict', handleConflict as EventListener)
      draftManager.stopAutoSave()
    }
  }, [])

  // Handle content change with auto-save
  const handleContentChange = (newContent: string) => {
    setContent(newContent)
  }

  // Save draft manually
  const handleSaveDraft = async () => {
    try {
      const formData: DraftFormData = {
        content,
        mediaAttachments,
        uploadedMediaIds
      }

      let draft: Draft
      if (currentDraftId && currentDraftId !== 'temp') {
        draft = await draftManager.updateDraft(currentDraftId, formData)
      } else {
        draft = await draftManager.createDraft(formData)
        setCurrentDraftId(draft.id)
      }

      hasUnsavedChanges.current = false
      toast({
        title: "Success",
        description: "Draft saved successfully!",
      })
    } catch (error) {
      console.error('Failed to save draft:', error)
      toast({
        title: "Error",
        description: "Failed to save draft",
        variant: "destructive",
      })
    }
  }

  // Handle draft selection from manager
  const handleSelectDraft = (draft: Draft) => {
    setContent(draft.content)
    setCurrentDraftId(draft.id)
    if (draft.media_urls) {
      setUploadedMediaIds(draft.media_urls)
    }
    hasUnsavedChanges.current = false
  }

  // Handle conflict resolution
  const handleResolveConflict = async (choice: 'local' | 'server' | 'merge') => {
    if (!conflictResolution || !currentDraftId) return

    try {
      const resolvedDraft = await draftManager.resolveConflict(currentDraftId, conflictResolution, choice)
      
      setContent(resolvedDraft.content)
      if (resolvedDraft.media_urls) {
        setUploadedMediaIds(resolvedDraft.media_urls)
      }
      setConflictResolution(null)
      
      toast({
        title: "Conflict Resolved",
        description: `Draft updated using ${choice} version`,
      })
    } catch (error) {
      console.error('Failed to resolve conflict:', error)
      toast({
        title: "Error",
        description: "Failed to resolve conflict",
        variant: "destructive",
      })
    }
  }

  const handleSubmit = async (options?: { requiresApproval?: boolean }) => {
    if (!content.trim() && uploadedMediaIds.length === 0) return
    
    setIsPosting(true)
    try {
      // For scheduled posts, use the scheduled-posts endpoint with timezone support
      if (postType === "schedule" && scheduleDate && scheduleTime) {
        const timezone = getUserTimezone()
        const payload = {
          content: content.trim(),
          mediaUrls: uploadedMediaIds,
          scheduledDate: scheduleDate,
          scheduledTime: scheduleTime,
          timezone,
          submitForApproval: options?.requiresApproval === true || requiresApproval
        }

        console.log('Scheduling post with payload:', JSON.stringify(payload, null, 2))

        // If editing an existing scheduled post, use PATCH instead of POST
        const isEditing = editingPost && editingPost.id
        const endpoint = isEditing 
          ? `/api/scheduled-posts/${editingPost.id}`
          : '/api/scheduled-posts'
        const method = isEditing ? 'PATCH' : 'POST'

        const response = await fetch(endpoint, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        })

        // Try to parse JSON response, handle empty/invalid responses gracefully
        let result: any = {}
        try {
          const text = await response.text()
          if (text.trim()) {
            result = JSON.parse(text)
          }
        } catch (parseError) {
          console.error('Failed to parse response JSON:', parseError)
          result = { error: 'Invalid response from server' }
        }
        
        console.log('Schedule post response:', { 
          status: response.status, 
          ok: response.ok,
          result: JSON.stringify(result, null, 2)
        })
        
        if (!response.ok) {
          const errorMsg = result.error || result.details || response.statusText || `HTTP ${response.status}`
          console.error(
            `Schedule post failed: status=${response.status}, error=${result.error ?? 'none'}, details=${result.details ?? 'none'}. Full:`,
            result
          )
        }
        
        if (response.ok && result.success) {
          // Clean up draft if it exists (only if not editing a scheduled post)
          if (!isEditing && currentDraftId && currentDraftId !== 'temp') {
            try {
              await draftManager.deleteDraft(currentDraftId)
            } catch (error) {
              console.error('Failed to delete draft after scheduling:', error)
            }
          }
          
          // Clean up local storage (only if not editing a scheduled post)
          if (!isEditing) {
            draftManager.removeFromLocalStorage(currentDraftId || 'temp')
          }
          
          toast({
            title: "Success",
            description: result.message || (isEditing
              ? (result.requiresApproval 
                  ? "Post updated and submitted for approval!" 
                  : "Post updated successfully!")
              : (result.requiresApproval 
                  ? "Post submitted for approval successfully!" 
                  : "Post scheduled successfully!")),
          })
          onClose()
        } else {
          // Handle conflict errors specially
          if (response.status === 409 && result.conflictCheck) {
            toast({
              title: "Scheduling Conflict",
              description: result.error || "Another post is scheduled at a similar time.",
              variant: "destructive",
            })
          } else {
            // Provide meaningful error message even if result is empty
            const errorMessage = result.error || result.details || 
              (response.status === 500 ? 'Server error occurred' :
               response.status === 400 ? 'Invalid request' :
               response.status === 404 ? 'Endpoint not found' :
               response.status === 401 ? 'Unauthorized' :
               response.status === 403 ? 'Forbidden' :
               `Failed to schedule post (${response.status})`)
            toast({
              title: "Error",
              description: errorMessage,
              variant: "destructive",
            })
          }
        }
      } else {
        // For immediate posts, use the twitter/post endpoint
        const payload = {
          text: content,
          mediaIds: uploadedMediaIds,
          requiresApproval: options?.requiresApproval === true,
        }

        const response = await fetch('/api/twitter/post', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        })

        const result = await response.json()
        
        if (response.ok) {
          // Clean up draft if it exists
          if (currentDraftId && currentDraftId !== 'temp') {
            try {
              await draftManager.deleteDraft(currentDraftId)
            } catch (error) {
              console.error('Failed to delete draft after posting:', error)
            }
          }
          
          // Clean up local storage
          draftManager.removeFromLocalStorage(currentDraftId || 'temp')
          
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
      }
    } catch (error) {
      console.error('Error submitting post:', error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "An unexpected error occurred",
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-2 sm:p-4 z-50">
      <Card className="w-full max-w-sm sm:max-w-md md:max-w-lg lg:max-w-2xl max-h-[95vh] sm:max-h-[90vh] overflow-auto">
        <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
            <CardTitle className="text-lg sm:text-xl truncate">Create New Post</CardTitle>
            <div className="flex items-center gap-1 sm:gap-2">
              {isAutoSaving && (
                <Badge variant="secondary" className="flex items-center gap-1 text-xs">
                  <Clock className="h-3 w-3" />
                  <span className="hidden sm:inline">Auto-saving...</span>
                  <span className="sm:hidden">Saving...</span>
                </Badge>
              )}
              {lastAutoSave && !isAutoSaving && (
                <Badge variant="outline" className="text-xs">
                  <span className="hidden sm:inline">Saved {lastAutoSave.toLocaleTimeString()}</span>
                  <span className="sm:hidden">Saved</span>
                </Badge>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1 sm:gap-2 w-full sm:w-auto">
            {/* Preview Mode Toggle */}
            <div className="flex items-center gap-1">
              <Button
                variant={isPreviewMode ? "default" : "outline"}
                size="sm"
                onClick={() => setIsPreviewMode(!isPreviewMode)}
                className="min-h-[36px]"
              >
                {isPreviewMode ? (
                  <>
                    <Edit3 className="h-4 w-4 sm:mr-2" />
                    <span className="hidden sm:inline">Edit</span>
                  </>
                ) : (
                  <>
                    <Eye className="h-4 w-4 sm:mr-2" />
                    <span className="hidden sm:inline">Preview</span>
                  </>
                )}
              </Button>
              
              {/* Preview Controls */}
              {isPreviewMode && (
                <div className="flex items-center gap-1 ml-1 sm:ml-2">
                  <Button
                    variant={previewDeviceView === 'mobile' ? "default" : "outline"}
                    size="sm"
                    onClick={() => setPreviewDeviceView('mobile')}
                    aria-label="Mobile view"
                    className="min-h-[36px] px-2"
                  >
                    <Smartphone className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={previewDeviceView === 'desktop' ? "default" : "outline"}
                    size="sm"
                    onClick={() => setPreviewDeviceView('desktop')}
                    aria-label="Desktop view"
                    className="min-h-[36px] px-2"
                  >
                    <Monitor className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={previewTheme === 'dark' ? "default" : "outline"}
                    size="sm"
                    onClick={() => setPreviewTheme(previewTheme === 'light' ? 'dark' : 'light')}
                    aria-label={previewTheme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
                    className="min-h-[36px] px-2"
                  >
                    {previewTheme === 'light' ? (
                      <Moon className="h-4 w-4" />
                    ) : (
                      <Sun className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              )}
            </div>
            
            <Dialog open={showDraftManager} onOpenChange={setShowDraftManager}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="min-h-[36px]">
                  <FileText className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Drafts</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-sm sm:max-w-md md:max-w-lg lg:max-w-2xl max-h-[80vh] mx-2 sm:mx-4">
                <DialogHeader>
                  <DialogTitle>Manage Drafts</DialogTitle>
                </DialogHeader>
                <DraftManagerComponent 
                  onSelectDraft={handleSelectDraft}
                  onClose={() => setShowDraftManager(false)}
                />
              </DialogContent>
            </Dialog>
            <Button variant="ghost" size="sm" onClick={onClose} className="min-h-[36px] px-2">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Conflict Resolution Dialog */}
          {conflictResolution && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0">
                  <div className="w-6 h-6 bg-yellow-100 rounded-full flex items-center justify-center">
                    <span className="text-yellow-600 text-sm font-bold">!</span>
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-medium text-yellow-800 mb-2">
                    Draft Conflict Detected
                  </h3>
                  <p className="text-sm text-yellow-700 mb-3">
                    This draft was modified on another device. Choose how to resolve the conflict:
                  </p>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => handleResolveConflict('local')}
                      className="min-h-[36px]"
                    >
                      Use Local Version
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => handleResolveConflict('server')}
                      className="min-h-[36px]"
                    >
                      Use Server Version
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => handleResolveConflict('merge')}
                      className="min-h-[36px]"
                    >
                      Merge Both
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Main Content - Composer or Preview */}
          {isPreviewMode ? (
            <div className="space-y-4">
              <div className="text-center">
                <h3 className="text-lg font-semibold mb-2">Post Preview</h3>
                <p className="text-sm text-gray-600">
                  How your post will appear on X
                </p>
              </div>
              
              <div className="flex justify-center">
                <PostPreview
                  content={content}
                  mediaAttachments={mediaAttachments}
                  uploadedMediaIds={uploadedMediaIds}
                  deviceView={previewDeviceView}
                  theme={previewTheme}
                />
              </div>
            </div>
          ) : (
            <>
              {/* Post Content */}
              <div className="space-y-2">
                <Label htmlFor="content">Post Content</Label>
                <EnhancedRichTextEditor
                  placeholder="What's happening?"
                  onContentChange={handleContentChange}
                  maxCharacters={maxCharacters}
                  initialContent={content}
                  onValidationChange={setIsContentValid}
                />
              </div>

              {/* Media Upload */}
              <div className="space-y-2">
                <Label>Media Attachments</Label>
                
                {/* Display already uploaded media when editing */}
                {editingPost && uploadedMediaIds && uploadedMediaIds.length > 0 && (
                  <div className="mb-3 p-3 bg-gray-50 rounded-lg border">
                    <p className="text-sm font-medium mb-2">Already uploaded media:</p>
                    <div className="flex flex-wrap gap-2">
                      {uploadedMediaIds.map((mediaId, index) => (
                        <Badge key={index} variant="secondary" className="flex items-center gap-1">
                          <FileImage className="h-3 w-3" />
                          {mediaId}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="date">Date</Label>
                    <Input
                      id="date"
                      type="date"
                      value={scheduleDate}
                      onChange={(e) => setScheduleDate(e.target.value)}
                      className="min-h-[44px]"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="time">Time</Label>
                    <Input
                      id="time"
                      type="time"
                      value={scheduleTime}
                      onChange={(e) => setScheduleTime(e.target.value)}
                      className="min-h-[44px]"
                    />
                  </div>
                </div>
              )}

              {/* Approval Workflow */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-0">
                <div className="space-y-1">
                  <Label>Require Approval</Label>
                  <p className="text-sm text-gray-600">Send to manager for review before posting</p>
                </div>
                <Switch
                  checked={requiresApproval}
                  onCheckedChange={setRequiresApproval}
                  className="self-start sm:self-center"
                />
              </div>
            </>
          )}

          {editingPost?.id && (
            <div className="space-y-4 rounded-lg border bg-muted/30 p-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <Label className="text-sm">Current Status</Label>
                  <p className="text-sm text-gray-600">
                    {formatApprovalStatus(editingPost.status)}
                  </p>
                </div>
                <VersionHistoryDialog postId={editingPost.id} />
              </div>
              <ApprovalCommentPanel postId={editingPost.id} />
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={onClose} className="w-full sm:w-auto min-h-[44px]">
              Cancel
            </Button>
            {!isPreviewMode && (
              <Button variant="outline" onClick={handleSaveDraft} disabled={!content.trim()} className="w-full sm:w-auto min-h-[44px]">
                <Save className="h-4 w-4 mr-2" />
                Save Draft
              </Button>
            )}
            {!isPreviewMode && (requiresApproval ? (
              <Button className="w-full sm:w-auto min-h-[44px]" onClick={() => handleSubmit({ requiresApproval: true })}>
                <Users className="h-4 w-4 mr-2" />
                Submit for Approval
              </Button>
            ) : (
              <Button
                onClick={async () => {
                  if (postType === "draft") {
                    await handleSaveDraft()
                    onClose()
                    return
                  }
                  await handleSubmit()
                }}
                disabled={
                  isPosting
                  || (!content.trim() && uploadedMediaIds.length === 0)
                  || !isContentValid
                  || (postType === "schedule" && (!scheduleDate || !scheduleTime))
                }
                className="w-full sm:w-auto min-h-[44px]"
              >
                {postType === "now" ? (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    {isPosting ? 'Posting...' : 'Post Now'}
                  </>
                ) : postType === "schedule" ? (
                  <>
                    <Calendar className="h-4 w-4 mr-2" />
                    {isPosting ? 'Scheduling...' : 'Schedule Post'}
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Save Draft
                  </>
                )}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function formatApprovalStatus(status?: string | null) {
  switch (status) {
    case 'pending_approval':
      return 'Pending approval'
    case 'approved':
      return 'Approved and scheduled'
    case 'rejected':
      return 'Rejected - requires attention'
    case 'changes_requested':
      return 'Changes requested'
    case 'draft':
      return 'Draft'
    default:
      return status || 'Unknown'
  }
}
