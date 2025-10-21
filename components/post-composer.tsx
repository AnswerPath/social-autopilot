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
import { X, Calendar, Send, Save, Users, FileText, Clock, Eye, Edit3, Smartphone, Monitor, Sun, Moon } from 'lucide-react'
import { Switch } from "@/components/ui/switch"
import { MediaUpload } from "@/components/ui/media-upload"
import { PostPreview } from "@/components/ui/post-preview"
import { useToast } from "@/hooks/use-toast"
import type { MediaAttachment } from "@/lib/media-validation"
import { DraftManager, type Draft, type DraftFormData } from "@/lib/draft-manager"
import { DraftManagerComponent } from "@/components/draft-manager"

interface PostComposerProps {
  onClose: () => void
  initialDraft?: Draft
}

export function PostComposer({ onClose, initialDraft }: PostComposerProps) {
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
  const [conflictResolution, setConflictResolution] = useState<any>(null)
  const [isPreviewMode, setIsPreviewMode] = useState(false)
  const [previewDeviceView, setPreviewDeviceView] = useState<'mobile' | 'desktop'>('desktop')
  const [previewTheme, setPreviewTheme] = useState<'light' | 'dark'>('light')
  const { toast } = useToast()
  const draftManager = DraftManager.getInstance()
  const hasUnsavedChanges = useRef(false)

  const maxCharacters = 280

  // Initialize with draft data if provided
  useEffect(() => {
    if (initialDraft) {
      setContent(initialDraft.content)
      setCurrentDraftId(initialDraft.id)
      if (initialDraft.media_urls) {
        setUploadedMediaIds(initialDraft.media_urls)
      }
    }
  }, [initialDraft])

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
          <div className="flex items-center gap-3">
            <CardTitle>Create New Post</CardTitle>
            {isAutoSaving && (
              <Badge variant="secondary" className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Auto-saving...
              </Badge>
            )}
            {lastAutoSave && !isAutoSaving && (
              <Badge variant="outline" className="text-xs">
                Saved {lastAutoSave.toLocaleTimeString()}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            {/* Preview Mode Toggle */}
            <div className="flex items-center gap-1">
              <Button
                variant={isPreviewMode ? "default" : "outline"}
                size="sm"
                onClick={() => setIsPreviewMode(!isPreviewMode)}
              >
                {isPreviewMode ? (
                  <>
                    <Edit3 className="h-4 w-4 mr-2" />
                    Edit
                  </>
                ) : (
                  <>
                    <Eye className="h-4 w-4 mr-2" />
                    Preview
                  </>
                )}
              </Button>
              
              {/* Preview Controls */}
              {isPreviewMode && (
                <div className="flex items-center gap-1 ml-2">
                  <Button
                    variant={previewDeviceView === 'mobile' ? "default" : "outline"}
                    size="sm"
                    onClick={() => setPreviewDeviceView('mobile')}
                    aria-label="Mobile view"
                  >
                    <Smartphone className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={previewDeviceView === 'desktop' ? "default" : "outline"}
                    size="sm"
                    onClick={() => setPreviewDeviceView('desktop')}
                    aria-label="Desktop view"
                  >
                    <Monitor className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={previewTheme === 'dark' ? "default" : "outline"}
                    size="sm"
                    onClick={() => setPreviewTheme(previewTheme === 'light' ? 'dark' : 'light')}
                    aria-label={previewTheme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
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
                <Button variant="outline" size="sm">
                  <FileText className="h-4 w-4 mr-2" />
                  Drafts
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[80vh]">
                <DialogHeader>
                  <DialogTitle>Manage Drafts</DialogTitle>
                </DialogHeader>
                <DraftManagerComponent 
                  onSelectDraft={handleSelectDraft}
                  onClose={() => setShowDraftManager(false)}
                />
              </DialogContent>
            </Dialog>
            <Button variant="ghost" size="sm" onClick={onClose}>
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
                <div className="flex-1">
                  <h3 className="text-sm font-medium text-yellow-800 mb-2">
                    Draft Conflict Detected
                  </h3>
                  <p className="text-sm text-yellow-700 mb-3">
                    This draft was modified on another device. Choose how to resolve the conflict:
                  </p>
                  <div className="flex gap-2">
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => handleResolveConflict('local')}
                    >
                      Use Local Version
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => handleResolveConflict('server')}
                    >
                      Use Server Version
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => handleResolveConflict('merge')}
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
            </>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            {!isPreviewMode && (
              <Button variant="outline" onClick={handleSaveDraft} disabled={!content.trim()}>
                <Save className="h-4 w-4 mr-2" />
                Save Draft
              </Button>
            )}
            {!isPreviewMode && (requiresApproval ? (
              <Button>
                <Users className="h-4 w-4 mr-2" />
                Submit for Approval
              </Button>
            ) : (
              <Button onClick={handleSubmit} disabled={isPosting || !content.trim() || !isContentValid}>
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
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
