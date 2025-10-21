"use client"

import { useState, useRef, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Image, Video, X, Upload, FileImage } from 'lucide-react'
import { cn } from '@/lib/utils'
import { 
  validateMediaFile, 
  createMediaAttachment, 
  type MediaAttachment 
} from '@/lib/media-validation'
import { formatFileSize } from '@/lib/media-config'

interface MediaUploadProps {
  platform: string
  attachments: MediaAttachment[]
  onAttachmentsChange: (attachments: MediaAttachment[]) => void
  onUploadStart?: () => void
  onUploadComplete?: (mediaId: string) => void
  onUploadError?: (error: string) => void
  disabled?: boolean
  className?: string
}

export function MediaUpload({
  platform,
  attachments,
  onAttachmentsChange,
  onUploadStart,
  onUploadComplete,
  onUploadError,
  disabled = false,
  className
}: MediaUploadProps) {
  const [isDragOver, setIsDragOver] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return

    const file = files[0] // Handle single file for now
    
    // Validate file
    const validation = validateMediaFile(file, attachments, platform)
    if (!validation.isValid) {
      onUploadError?.(validation.error!)
      return
    }

    let attachment: any = null
    try {
      // Create media attachment with thumbnail
      attachment = await createMediaAttachment(file)
      
      // Add to attachments
      onAttachmentsChange([...attachments, attachment])
      
      // Start upload process
      setIsUploading(true)
      setUploadProgress(0)
      onUploadStart?.()

      // Simulate upload progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval)
            return prev
          }
          return prev + 10
        })
      }, 200)

      // Upload to server
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/twitter/upload', {
        method: 'POST',
        body: formData
      })

      const result = await response.json()
      
      clearInterval(progressInterval)
      setUploadProgress(100)

      if (response.ok) {
        onUploadComplete?.(result.mediaId)
      } else {
        throw new Error(result.error || 'Upload failed')
      }
    } catch (error) {
      console.error('Upload error:', error)
      onUploadError?.(error instanceof Error ? error.message : 'Upload failed')
      
      // Remove the attachment if upload failed
      if (attachment) {
        onAttachmentsChange(attachments.filter(att => att.id !== attachment.id))
      }
    } finally {
      setIsUploading(false)
      setUploadProgress(0)
    }
  }, [attachments, platform, onAttachmentsChange, onUploadStart, onUploadComplete, onUploadError])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!disabled) {
      setIsDragOver(true)
    }
  }, [disabled])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
    
    if (disabled) return
    
    const files = e.dataTransfer.files
    handleFileSelect(files)
  }, [disabled, handleFileSelect])

  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    handleFileSelect(e.target.files)
    // Reset input value so same file can be selected again
    e.target.value = ''
  }, [handleFileSelect])

  const removeAttachment = useCallback((attachmentId: string) => {
    onAttachmentsChange(attachments.filter(att => att.id !== attachmentId))
  }, [attachments, onAttachmentsChange])

  const openFileDialog = useCallback(() => {
    if (!disabled) {
      fileInputRef.current?.click()
    }
  }, [disabled])

  return (
    <div className={cn("space-y-4", className)}>
      {/* Upload Area */}
      <Card
        className={cn(
          "border-2 border-dashed transition-colors cursor-pointer min-h-[120px] sm:min-h-[140px]",
          isDragOver && !disabled && "border-primary bg-primary/5",
          disabled && "opacity-50 cursor-not-allowed",
          !isDragOver && !disabled && "border-gray-300 hover:border-gray-400"
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={openFileDialog}
      >
        <div className="p-4 sm:p-6 text-center h-full flex items-center justify-center">
          <div className="flex flex-col items-center space-y-2">
            <Upload className="h-6 w-6 sm:h-8 sm:w-8 text-gray-400" />
            <div className="text-sm text-gray-600">
              <span className="font-medium">Tap to upload</span>
              <span className="hidden sm:inline"> or drag and drop</span>
            </div>
            <div className="text-xs text-gray-500 text-center px-2">
              <span className="block sm:inline">Images: JPG, PNG, GIF, WebP (max 5MB)</span>
              <span className="hidden sm:inline"> • </span>
              <span className="block sm:inline">Videos: MP4, MOV (max 512MB)</span>
            </div>
          </div>
        </div>
      </Card>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*"
        onChange={handleFileInputChange}
        style={{ display: 'none' }}
        disabled={disabled}
      />

      {/* Upload Progress */}
      {isUploading && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span>Uploading...</span>
            <span>{uploadProgress}%</span>
          </div>
          <Progress value={uploadProgress} className="h-2" />
        </div>
      )}

      {/* Media Attachments Grid */}
      {attachments.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {attachments.map((attachment) => (
            <div key={attachment.id} className="relative group">
              <Card className="overflow-hidden">
                <div className="aspect-square relative">
                  {attachment.type === 'image' ? (
                    <img
                      src={attachment.thumbnail}
                      alt={attachment.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                      <Video className="h-8 w-8 text-gray-400" />
                    </div>
                  )}
                  
                  {/* Remove button */}
                  <Button
                    variant="destructive"
                    size="sm"
                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 sm:group-hover:opacity-100 opacity-100 sm:opacity-0 transition-opacity h-8 w-8 p-0 min-h-[32px] min-w-[32px]"
                    onClick={(e) => {
                      e.stopPropagation()
                      removeAttachment(attachment.id)
                    }}
                    disabled={disabled}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                
                {/* File info */}
                <div className="p-2 space-y-1">
                  <div className="flex items-center space-x-1">
                    {attachment.type === 'image' ? (
                      <Image className="h-3 w-3 text-gray-500" />
                    ) : (
                      <Video className="h-3 w-3 text-gray-500" />
                    )}
                    <span className="text-xs text-gray-600 truncate">
                      {attachment.name}
                    </span>
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    {formatFileSize(attachment.size)}
                  </Badge>
                </div>
              </Card>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
