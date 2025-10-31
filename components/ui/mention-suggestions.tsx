"use client"

import React, { useState, useEffect, useMemo } from 'react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Users, Clock, CheckCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface User {
  id: string
  username: string
  displayName: string
  avatar?: string
  verified?: boolean
  followerCount?: number
  type?: 'recent' | 'connection' | 'suggested'
}

interface MentionSuggestionsProps {
  query: string
  isVisible: boolean
  onSelect: (user: User) => void
  className?: string
}

// Mock user data (in real app, this would come from API)
const CONNECTIONS: User[] = [
  { id: '1', username: 'john_doe', displayName: 'John Doe', avatar: '/placeholder-user.jpg', verified: true, followerCount: 125000, type: 'connection' },
  { id: '2', username: 'jane_smith', displayName: 'Jane Smith', avatar: '/placeholder-user.jpg', verified: false, followerCount: 45000, type: 'connection' },
  { id: '3', username: 'tech_guru', displayName: 'Tech Guru', avatar: '/placeholder-user.jpg', verified: true, followerCount: 89000, type: 'connection' },
  { id: '4', username: 'startup_founder', displayName: 'Startup Founder', avatar: '/placeholder-user.jpg', verified: false, followerCount: 23000, type: 'connection' },
  { id: '5', username: 'dev_lead', displayName: 'Dev Lead', avatar: '/placeholder-user.jpg', verified: false, followerCount: 15600, type: 'connection' }
]

const SUGGESTED_USERS: User[] = [
  { id: '6', username: 'ai_researcher', displayName: 'AI Researcher', avatar: '/placeholder-user.jpg', verified: true, followerCount: 67000, type: 'suggested' },
  { id: '7', username: 'design_expert', displayName: 'Design Expert', avatar: '/placeholder-user.jpg', verified: false, followerCount: 34000, type: 'suggested' },
  { id: '8', username: 'marketing_pro', displayName: 'Marketing Pro', avatar: '/placeholder-user.jpg', verified: false, followerCount: 28000, type: 'suggested' }
]

// Get recent mentions from localStorage
const getRecentMentions = (): User[] => {
  const saved = localStorage.getItem('recent-mentions')
  if (saved) {
    const recentUsernames = JSON.parse(saved)
    return recentUsernames.map((username: string) => {
      const user = [...CONNECTIONS, ...SUGGESTED_USERS].find(u => u.username === username)
      return user ? { ...user, type: 'recent' as const } : null
    }).filter(Boolean) as User[]
  }
  return []
}

// Save mention to recent
const saveRecentMention = (username: string) => {
  const recent = getRecentMentions().map(u => u.username)
  const newRecent = [username, ...recent.filter(u => u !== username)].slice(0, 5)
  localStorage.setItem('recent-mentions', JSON.stringify(newRecent))
}

// Format follower count
const formatFollowerCount = (count?: number): string => {
  if (!count) return ''
  if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`
  if (count >= 1000) return `${(count / 1000).toFixed(1)}K`
  return count.toString()
}

export function MentionSuggestions({ query, isVisible, onSelect, className }: MentionSuggestionsProps) {
  const [suggestions, setSuggestions] = useState<User[]>([])

  // Filter users based on query
  const filteredUsers = useMemo(() => {
    if (!query.trim()) return []

    const lowercaseQuery = query.toLowerCase()
    const allUsers = [...CONNECTIONS, ...SUGGESTED_USERS]
    
    return allUsers.filter(user => 
      user.username.toLowerCase().includes(lowercaseQuery) ||
      user.displayName.toLowerCase().includes(lowercaseQuery)
    )
  }, [query])

  // Generate suggestions with priority
  useEffect(() => {
    if (!isVisible) {
      setSuggestions([])
      return
    }

    const recent = getRecentMentions()
    const connections = CONNECTIONS
    const suggested = SUGGESTED_USERS
    const filtered = filteredUsers

    let combined: User[] = []

    if (query.trim()) {
      // If there's a query, prioritize filtered results
      combined = [
        ...filtered.filter(u => connections.some(c => c.id === u.id)), // Connections first
        ...filtered.filter(u => suggested.some(s => s.id === u.id)),   // Then suggested
        ...filtered.filter(u => !combined.some(c => c.id === u.id))    // Then others
      ]
    } else {
      // If no query, show recent mentions first, then connections
      combined = [
        ...recent,
        ...connections.filter(c => !recent.some(r => r.id === c.id))
      ]
    }

    setSuggestions(combined.slice(0, 8)) // Limit to 8 suggestions
  }, [query, isVisible, filteredUsers])

  // Handle user selection
  const handleSelect = (user: User) => {
    saveRecentMention(user.username)
    onSelect(user)
  }

  if (!isVisible || suggestions.length === 0) {
    return null
  }

  return (
    <div className={cn("absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg z-50 mt-1", className)}>
      <div className="p-2">
        {suggestions.map((user, index) => (
          <div
            key={`${user.id}-${index}`}
            className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 cursor-pointer"
            onClick={() => handleSelect(user)}
          >
            <Avatar className="h-8 w-8">
              <AvatarImage src={user.avatar} alt={user.displayName} />
              <AvatarFallback>
                {user.displayName.split(' ').map(n => n[0]).join('').toUpperCase()}
              </AvatarFallback>
            </Avatar>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm truncate">
                  {user.displayName}
                </span>
                {user.verified && (
                  <CheckCircle className="h-4 w-4 text-blue-500 flex-shrink-0" />
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500 truncate">
                  @{user.username}
                </span>
                {user.followerCount && (
                  <span className="text-xs text-gray-400">
                    {formatFollowerCount(user.followerCount)} followers
                  </span>
                )}
              </div>
            </div>

            <div className="flex-shrink-0">
              {user.type === 'recent' && (
                <Badge variant="outline" className="text-xs">
                  <Clock className="h-3 w-3 mr-1" />
                  Recent
                </Badge>
              )}
              {user.type === 'connection' && (
                <Badge variant="secondary" className="text-xs">
                  <Users className="h-3 w-3 mr-1" />
                  Following
                </Badge>
              )}
              {user.type === 'suggested' && (
                <Badge variant="outline" className="text-xs text-blue-600 border-blue-200">
                  Suggested
                </Badge>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="px-3 py-2 border-t border-gray-100">
        <p className="text-xs text-gray-500">
          Click a user to mention them in your post
        </p>
      </div>
    </div>
  )
}
