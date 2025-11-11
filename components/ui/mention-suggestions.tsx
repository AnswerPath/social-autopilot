"use client"

import React, { useState, useEffect, useMemo } from 'react'
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
  if (!count) {
    return ''
  }

  const formatWithSuffix = (value: number, divisor: number, suffix: string) => {
    const formatted = value / divisor
    const hasDecimal = Math.abs(formatted % 1) > Number.EPSILON
    const display = hasDecimal ? formatted.toFixed(1) : formatted.toFixed(0)
    return `${display}${suffix}`
  }

  if (count >= 1_000_000) {
    return formatWithSuffix(count, 1_000_000, 'M')
  }

  if (count >= 1_000) {
    return formatWithSuffix(count, 1_000, 'K')
  }

  return count.toString()
}

export function MentionSuggestions({ query, isVisible, onSelect, className }: MentionSuggestionsProps) {
  const [suggestions, setSuggestions] = useState<User[]>([])

  // Filter users based on query
  const filteredUsers = useMemo(() => {
    if (!query.trim()) return []

    const lowercaseQuery = query.toLowerCase()
    const allUsers = [...CONNECTIONS, ...SUGGESTED_USERS]
    
    return allUsers.filter(user => {
      const username = user.username.toLowerCase()
      const displayName = user.displayName.toLowerCase()
      return (
        username.includes(lowercaseQuery) ||
        displayName.includes(lowercaseQuery) ||
        username.startsWith(lowercaseQuery[0]) ||
        displayName.startsWith(lowercaseQuery[0])
      )
    })
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

    const ensureUnique = (users: User[]) => {
      const map = new Map<string, User>()
      users.forEach(user => {
        if (!map.has(user.id)) {
          map.set(user.id, user)
        }
      })
      return Array.from(map.values())
    }

    let combined: User[]

    if (query.trim()) {
      // Prioritise filtered connections, then suggested users, then any remaining matches
      const filteredConnections = filtered.filter(u =>
        connections.some(c => c.id === u.id)
      )
      const filteredSuggested = filtered.filter(u =>
        suggested.some(s => s.id === u.id)
      )
      const remaining = filtered.filter(
        u =>
          !filteredConnections.some(c => c.id === u.id) &&
          !filteredSuggested.some(s => s.id === u.id)
      )

      combined = ensureUnique([
        ...filteredConnections,
        ...filteredSuggested,
        ...remaining,
      ])
    } else {
      // No query: show recent first, then connections, then suggested users
      const recentIds = new Set(recent.map(r => r.id))
      const connectionsWithoutRecent = connections.filter(
        c => !recentIds.has(c.id)
      )
      const suggestedWithoutRecentOrConnections = suggested.filter(
        s => !recentIds.has(s.id) && !connectionsWithoutRecent.some(c => c.id === s.id)
      )

      combined = ensureUnique([
        ...recent,
        ...connectionsWithoutRecent,
        ...suggestedWithoutRecentOrConnections,
      ])
    }

    setSuggestions(combined.slice(0, 8)) // Limit to 8 suggestions
  }, [query, isVisible, filteredUsers])

  // Handle user selection
  const handleSelect = (user: User) => {
    const normalizedUser: User = {
      ...user,
      avatar: user.avatar ?? '/placeholder-user.jpg'
    }

    saveRecentMention(normalizedUser.username)
    onSelect(normalizedUser)
  }

  const suggestionsWithMeta = useMemo(() => {
    const counts: Record<'recent' | 'connection' | 'suggested', number> = {
      recent: 0,
      connection: 0,
      suggested: 0,
    }
    let lastType: User['type'] | null = null

    return suggestions.flatMap((user) => {
      const type = user.type ?? 'suggested'
      const items: Array<
        | { kind: 'header'; type: NonNullable<User['type']> }
        | { kind: 'item'; user: User; typeIndex: number }
      > = []

      if (type !== lastType) {
        items.push({ kind: 'header', type })
        lastType = type
      }

      const typeIndex = counts[type] ?? 0
      if (counts[type] !== undefined) {
        counts[type] += 1
      }

      items.push({ kind: 'item', user, typeIndex })
      return items
    })
  }, [suggestions])

  if (!isVisible || suggestions.length === 0) {
    return null
  }

  const headerLabels: Record<'recent' | 'connection' | 'suggested', string> = {
    recent: 'Recent',
    connection: 'Following',
    suggested: 'Suggested',
  }

  const badgeLabels: Record<'recent' | 'connection' | 'suggested', string> = {
    recent: 'Recent mention',
    connection: 'Following user',
    suggested: 'Suggested for you',
  }

  return (
    <div className={cn("absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg z-50 mt-1", className)}>
      <div className="p-2">
        {suggestionsWithMeta.map((entry, index) => {
          if (entry.kind === 'header') {
            return (
              <div
                key={`header-${entry.type}-${index}`}
                className="px-2 py-1 text-xs font-semibold text-gray-500"
              >
                {headerLabels[entry.type]}
              </div>
            )
          }

          const { user, typeIndex } = entry
          const initials = user.displayName
            .split(' ')
            .map(n => n[0])
            .join('')
            .toUpperCase()
          const badgeLabel = user.type ? badgeLabels[user.type] : ''
          const BadgeIcon =
            user.type === 'recent'
              ? Clock
              : user.type === 'connection'
              ? Users
              : undefined

          return (
          <div
            key={`${user.id}-${index}`}
            className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 cursor-pointer"
            onClick={() => handleSelect(user)}
          >
            <div className="relative flex shrink-0 overflow-hidden rounded-full h-8 w-8 bg-muted items-center justify-center">
              {user.avatar ? (
                <>
                  <img
                    src={user.avatar}
                    alt={user.displayName}
                    className="h-full w-full object-cover"
                  />
                  <span className="sr-only">{initials}</span>
                </>
              ) : (
                <span
                  className="flex h-full w-full items-center justify-center rounded-full bg-muted"
                  role="img"
                  aria-label={user.displayName}
                >
                  {initials}
                </span>
              )}
            </div>
            
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
              {user.type && (
                <Badge
                  variant={
                    user.type === 'suggested'
                      ? 'outline'
                      : user.type === 'recent'
                      ? 'outline'
                      : 'secondary'
                  }
                  className={cn(
                    "text-xs",
                    user.type === 'suggested' && "text-blue-600 border-blue-200"
                  )}
                  aria-label={`${badgeLabel} ${user.displayName}`}
                >
                  {BadgeIcon && (
                    <BadgeIcon className="h-3 w-3 mr-1" aria-hidden="true" />
                  )}
                  <span aria-hidden="true">
                    {user.type === 'connection' ? `Following ${typeIndex + 1}` : badgeLabel}
                  </span>
                </Badge>
              )}
            </div>
          </div>
        )
        })}
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
