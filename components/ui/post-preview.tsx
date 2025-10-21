"use client"

import React from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Image, Video, Heart, MessageCircle, Repeat2, Share, MoreHorizontal } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { MediaAttachment } from '@/lib/media-validation'
import { calculateXCharacterCount } from '@/lib/x-character-counter'

interface PostPreviewProps {
  content: string
  mediaAttachments: MediaAttachment[]
  uploadedMediaIds: string[]
  deviceView?: 'mobile' | 'desktop'
  theme?: 'light' | 'dark'
  className?: string
}

// Helper function to parse and format text content
function formatPostContent(content: string) {
  // Split content into parts for different formatting
  const parts: Array<{ text: string; type: 'text' | 'mention' | 'hashtag' | 'url' }> = []
  
  // Regular expressions for different content types
  const mentionRegex = /@(\w+)/g
  const hashtagRegex = /#(\w+)/g
  const urlRegex = /(https?:\/\/[^\s]+)/g
  
  let lastIndex = 0
  let text = content
  
  // Find all mentions, hashtags, and URLs
  const matches: Array<{ match: string; type: 'mention' | 'hashtag' | 'url'; index: number }> = []
  
  // Find mentions
  let match
  while ((match = mentionRegex.exec(text)) !== null) {
    matches.push({ match: match[0], type: 'mention', index: match.index })
  }
  
  // Find hashtags
  while ((match = hashtagRegex.exec(text)) !== null) {
    matches.push({ match: match[0], type: 'hashtag', index: match.index })
  }
  
  // Find URLs
  while ((match = urlRegex.exec(text)) !== null) {
    matches.push({ match: match[0], type: 'url', index: match.index })
  }
  
  // Sort matches by index
  matches.sort((a, b) => a.index - b.index)
  
  // Build formatted parts
  matches.forEach(({ match, type, index }) => {
    // Add text before match
    if (index > lastIndex) {
      parts.push({ text: text.slice(lastIndex, index), type: 'text' })
    }
    
    // Add formatted match
    parts.push({ text: match, type })
    lastIndex = index + match.length
  })
  
  // Add remaining text
  if (lastIndex < text.length) {
    parts.push({ text: text.slice(lastIndex), type: 'text' })
  }
  
  return parts.length > 0 ? parts : [{ text: content, type: 'text' }]
}

// Media preview component
function MediaPreview({ 
  attachments, 
  uploadedMediaIds, 
  deviceView = 'desktop' 
}: { 
  attachments: MediaAttachment[]
  uploadedMediaIds: string[]
  deviceView?: 'mobile' | 'desktop'
}) {
  if (attachments.length === 0) return null
  
  const isMobile = deviceView === 'mobile'
  const maxImages = isMobile ? 2 : 4
  
  return (
    <div className={cn(
      "mt-3 rounded-2xl overflow-hidden",
      isMobile ? "max-w-[280px]" : "max-w-[500px]"
    )}>
      {attachments.length === 1 ? (
        // Single media
        <div className="relative">
          {attachments[0].type === 'image' ? (
            <img
              src={attachments[0].thumbnail}
              alt="Post media"
              className={cn(
                "w-full object-cover",
                isMobile ? "max-h-[200px]" : "max-h-[400px]"
              )}
            />
          ) : (
            <div className={cn(
              "bg-gray-100 flex items-center justify-center",
              isMobile ? "h-[200px]" : "h-[400px]"
            )}>
              <Video className="h-12 w-12 text-gray-400" />
            </div>
          )}
        </div>
      ) : attachments.length <= maxImages ? (
        // Multiple media - grid layout
        <div className={cn(
          "grid gap-1",
          attachments.length === 2 ? "grid-cols-2" :
          attachments.length === 3 ? "grid-cols-2" :
          "grid-cols-2"
        )}>
          {attachments.slice(0, maxImages).map((attachment, index) => (
            <div key={attachment.id} className="relative">
              {attachment.type === 'image' ? (
                <img
                  src={attachment.thumbnail}
                  alt="Post media"
                  className={cn(
                    "w-full h-full object-cover",
                    isMobile ? "h-[100px]" : "h-[150px]"
                  )}
                />
              ) : (
                <div className={cn(
                  "bg-gray-100 flex items-center justify-center",
                  isMobile ? "h-[100px]" : "h-[150px]"
                )}>
                  <Video className="h-6 w-6 text-gray-400" />
                </div>
              )}
              
              {/* Show "+X more" overlay for additional media */}
              {index === maxImages - 1 && attachments.length > maxImages && (
                <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                  <span className="text-white font-bold text-lg">
                    +{attachments.length - maxImages}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        // Fallback for too many media
        <div className={cn(
          "bg-gray-100 flex items-center justify-center",
          isMobile ? "h-[200px]" : "h-[300px]"
        )}>
          <div className="text-center">
            <Image className="h-8 w-8 text-gray-400 mx-auto mb-2" />
            <p className="text-sm text-gray-600">
              {attachments.length} media files
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

export function PostPreview({
  content,
  mediaAttachments,
  uploadedMediaIds,
  deviceView = 'desktop',
  theme = 'light',
  className
}: PostPreviewProps) {
  const formattedContent = formatPostContent(content)
  const characterCount = calculateXCharacterCount(content)
  const isMobile = deviceView === 'mobile'
  const isDark = theme === 'dark'
  
  // Simulate user data (in real app, this would come from user context)
  const userData = {
    name: "Your Account",
    username: "yourusername",
    avatar: "/placeholder-user.jpg",
    verified: false
  }
  
  return (
    <Card className={cn(
      "border-0 shadow-none",
      isDark ? "bg-black text-white" : "bg-white text-black",
      isMobile ? "max-w-[350px]" : "max-w-[600px]",
      className
    )}>
      <div className="p-4">
        {/* Header */}
        <div className="flex items-start space-x-3 mb-3">
          <img
            src={userData.avatar}
            alt={userData.name}
            className={cn(
              "rounded-full object-cover",
              isMobile ? "w-10 h-10" : "w-12 h-12"
            )}
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-1">
              <span className={cn(
                "font-bold truncate",
                isMobile ? "text-sm" : "text-base"
              )}>
                {userData.name}
              </span>
              {userData.verified && (
                <div className={cn(
                  "rounded-full bg-blue-500 flex items-center justify-center",
                  isMobile ? "w-4 h-4" : "w-5 h-5"
                )}>
                  <span className="text-white text-xs font-bold">✓</span>
                </div>
              )}
              <span className={cn(
                "text-gray-500 truncate",
                isMobile ? "text-xs" : "text-sm"
              )}>
                @{userData.username}
              </span>
              <span className="text-gray-500">·</span>
              <span className={cn(
                "text-gray-500",
                isMobile ? "text-xs" : "text-sm"
              )}>
                now
              </span>
            </div>
          </div>
          <Button variant="ghost" size="sm" className="text-gray-500 hover:text-gray-700">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </div>
        
        {/* Content */}
        <div className="mb-3">
          <p className={cn(
            "whitespace-pre-wrap break-words",
            isMobile ? "text-sm" : "text-base"
          )}>
            {formattedContent.map((part, index) => {
              if (part.type === 'mention') {
                return (
                  <span key={index} className="text-blue-500 font-medium">
                    {part.text}
                  </span>
                )
              } else if (part.type === 'hashtag') {
                return (
                  <span key={index} className="text-blue-500 font-medium">
                    {part.text}
                  </span>
                )
              } else if (part.type === 'url') {
                return (
                  <span key={index} className="text-blue-500 underline">
                    {part.text}
                  </span>
                )
              } else {
                return <span key={index}>{part.text}</span>
              }
            })}
          </p>
        </div>
        
        {/* Media Preview */}
        <MediaPreview 
          attachments={mediaAttachments}
          uploadedMediaIds={uploadedMediaIds}
          deviceView={deviceView}
        />
        
        {/* Character count indicator */}
        {characterCount > 250 && (
          <div className="mt-3 flex items-center justify-between">
            <div className="flex-1">
              <div className="w-full bg-gray-200 rounded-full h-1" role="progressbar" aria-valuenow={characterCount} aria-valuemin={0} aria-valuemax={280}>
                <div 
                  className={cn(
                    "h-1 rounded-full transition-all duration-200",
                    characterCount <= 280 * 0.7 ? "bg-green-500" :
                    characterCount <= 280 * 0.9 ? "bg-yellow-500" :
                    characterCount <= 280 ? "bg-orange-500" : "bg-red-500"
                  )}
                  style={{ width: `${Math.min((characterCount / 280) * 100, 100)}%` }}
                />
              </div>
            </div>
            <span className={cn(
              "ml-3 text-sm font-medium",
              characterCount <= 280 * 0.7 ? "text-gray-500" :
              characterCount <= 280 * 0.9 ? "text-yellow-600" :
              characterCount <= 280 ? "text-orange-600" : "text-red-600 font-bold"
            )}>
              {characterCount}/280
            </span>
          </div>
        )}
        
        {/* Actions */}
        <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-200">
          <div className="flex items-center space-x-6">
            <Button variant="ghost" size="sm" className="text-gray-500 hover:text-blue-500 hover:bg-blue-50" aria-label="Reply">
              <MessageCircle className="h-4 w-4" />
              <span className="ml-2 text-sm">0</span>
            </Button>
            <Button variant="ghost" size="sm" className="text-gray-500 hover:text-green-500 hover:bg-green-50" aria-label="Repost">
              <Repeat2 className="h-4 w-4" />
              <span className="ml-2 text-sm">0</span>
            </Button>
            <Button variant="ghost" size="sm" className="text-gray-500 hover:text-red-500 hover:bg-red-50" aria-label="Like">
              <Heart className="h-4 w-4" />
              <span className="ml-2 text-sm">0</span>
            </Button>
            <Button variant="ghost" size="sm" className="text-gray-500 hover:text-blue-500 hover:bg-blue-50" aria-label="Share">
              <Share className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </Card>
  )
}
