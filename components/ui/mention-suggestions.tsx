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
  /** Optional directory lists (defaults empty in production; tests may pass fixtures). */
  connections?: User[]
  suggestedUsers?: User[]
}

const EMPTY_CONNECTIONS: User[] = []
const EMPTY_SUGGESTED: User[] = []

function getRecentMentions(allUsers: User[]): User[] {
  const saved = localStorage.getItem('recent-mentions')
  if (!saved) return []
  let recentUsernames: unknown
  try {
    recentUsernames = JSON.parse(saved)
  } catch {
    return []
  }
  if (!Array.isArray(recentUsernames)) return []
  return recentUsernames
    .filter((u): u is string => typeof u === 'string')
    .map((username) => {
      const user = allUsers.find((u) => u.username === username)
      return user ? { ...user, type: 'recent' as const } : null
    })
    .filter(Boolean) as User[]
}

function saveRecentMention(username: string, allUsers: User[]) {
  const recent = getRecentMentions(allUsers).map((u) => u.username)
  const newRecent = [username, ...recent.filter((u) => u !== username)].slice(0, 5)
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

export function MentionSuggestions({
  query,
  isVisible,
  onSelect,
  className,
  connections: connectionsProp,
  suggestedUsers: suggestedUsersProp,
}: MentionSuggestionsProps) {
  const [suggestions, setSuggestions] = useState<User[]>([])
  const connections = connectionsProp ?? EMPTY_CONNECTIONS
  const suggestedUsers = suggestedUsersProp ?? EMPTY_SUGGESTED
  const allDirectoryUsers = useMemo(() => [...connections, ...suggestedUsers], [connections, suggestedUsers])

  // Filter users based on query
  const filteredUsers = useMemo(() => {
    if (!query.trim()) return []

    const lowercaseQuery = query.toLowerCase()
    const allUsers = allDirectoryUsers
    
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
  }, [query, allDirectoryUsers])

  // Generate suggestions with priority
  useEffect(() => {
    if (!isVisible) {
      setSuggestions([])
      return
    }

    const recent = getRecentMentions(allDirectoryUsers)
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
        suggestedUsers.some(s => s.id === u.id)
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
      const suggestedWithoutRecentOrConnections = suggestedUsers.filter(
        s => !recentIds.has(s.id) && !connectionsWithoutRecent.some(c => c.id === s.id)
      )

      combined = ensureUnique([
        ...recent,
        ...connectionsWithoutRecent,
        ...suggestedWithoutRecentOrConnections,
      ])
    }

    setSuggestions(combined.slice(0, 8)) // Limit to 8 suggestions
  }, [query, isVisible, filteredUsers, allDirectoryUsers, connections, suggestedUsers])

  // Handle user selection
  const handleSelect = (user: User) => {
    const normalizedUser: User = {
      ...user,
      avatar: user.avatar ?? '/placeholder-user.jpg'
    }

    saveRecentMention(normalizedUser.username, allDirectoryUsers)
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
    <div className={cn("absolute top-full left-0 right-0 bg-background border border-border rounded-lg shadow-lg z-50 mt-1", className)}>
      <div className="p-2">
        {suggestionsWithMeta.map((entry, index) => {
          if (entry.kind === 'header') {
            return (
              <div
                key={`header-${entry.type}-${index}`}
                className="px-2 py-1 text-xs font-semibold text-muted-foreground"
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
            className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer"
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
                <span className="text-sm text-muted-foreground truncate">
                  @{user.username}
                </span>
                {user.followerCount && (
                  <span className="text-xs text-muted-foreground">
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
      <div className="px-3 py-2 border-t border-border/80">
        <p className="text-xs text-muted-foreground">
          Click a user to mention them in your post
        </p>
      </div>
    </div>
  )
}
