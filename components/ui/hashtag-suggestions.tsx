"use client"

import React, { useState, useEffect, useMemo } from 'react'
import { Badge } from '@/components/ui/badge'
import { TrendingUp, Hash, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'

interface HashtagSuggestion {
  tag: string
  count?: number
  type: 'trending' | 'related' | 'recent'
}

interface HashtagSuggestionsProps {
  content: string
  isVisible: boolean
  onSelect: (hashtag: string) => void
  className?: string
}

// Mock trending hashtags (in real app, this would come from API)
const TRENDING_HASHTAGS = [
  { tag: 'AI', count: 125000, type: 'trending' as const },
  { tag: 'TechNews', count: 89000, type: 'trending' as const },
  { tag: 'Innovation', count: 67000, type: 'trending' as const },
  { tag: 'Startup', count: 45000, type: 'trending' as const },
  { tag: 'WebDev', count: 32000, type: 'trending' as const },
  { tag: 'JavaScript', count: 28000, type: 'trending' as const },
  { tag: 'React', count: 24000, type: 'trending' as const },
  { tag: 'TypeScript', count: 19000, type: 'trending' as const },
  { tag: 'OpenSource', count: 15000, type: 'trending' as const },
  { tag: 'Developer', count: 12000, type: 'trending' as const }
]

const formatCount = (count: number): string => {
  const formatted = count / 1000
  const hasDecimal = Math.abs(formatted % 1) > Number.EPSILON
  return `${hasDecimal ? formatted.toFixed(1) : formatted.toFixed(0)}k`
}

// Related hashtags based on content analysis
const getRelatedHashtags = (content: string): HashtagSuggestion[] => {
  const words = content.toLowerCase().split(/\s+/)
  const suggestions: HashtagSuggestion[] = []

  // Tech-related keywords
  const techKeywords = {
    'javascript': ['WebDev', 'Frontend', 'JS', 'NodeJS'],
    'typescript': ['TS', 'WebDev', 'Frontend'],
    'react': ['ReactJS', 'Frontend', 'WebDev', 'Component'],
    'node': ['NodeJS', 'Backend', 'Server'],
    'api': ['REST', 'GraphQL', 'Backend', 'Integration'],
    'database': ['SQL', 'NoSQL', 'Data', 'Backend'],
    'cloud': ['AWS', 'Azure', 'GCP', 'DevOps'],
    'ai': ['MachineLearning', 'ML', 'ArtificialIntelligence', 'DataScience'],
    'mobile': ['iOS', 'Android', 'ReactNative', 'Flutter'],
    'design': ['UI', 'UX', 'DesignSystem', 'Figma'],
    'startup': ['Entrepreneur', 'Business', 'Innovation', 'Venture'],
    'social': ['SocialMedia', 'Marketing', 'Community', 'Engagement'],
    'automation': ['Workflow', 'Productivity', 'Tools', 'Efficiency']
  }

  // Find related hashtags based on content
  for (const word of words) {
    for (const [keyword, tags] of Object.entries(techKeywords)) {
      if (word.includes(keyword)) {
        tags.forEach(tag => {
          if (!suggestions.find(s => s.tag === tag)) {
            suggestions.push({ tag, type: 'related' })
          }
        })
      }
    }
  }

  return suggestions.slice(0, 8) // Limit to 8 related suggestions
}

// Get recent hashtags from localStorage
const getRecentHashtags = (): HashtagSuggestion[] => {
  const saved = localStorage.getItem('recent-hashtags')
  if (saved) {
    return JSON.parse(saved).map((tag: string) => ({ tag, type: 'recent' as const }))
  }
  return []
}

// Save hashtag to recent
const saveRecentHashtag = (tag: string) => {
  const recent = getRecentHashtags().map(s => s.tag)
  const newRecent = [tag, ...recent.filter(t => t !== tag)].slice(0, 10)
  localStorage.setItem('recent-hashtags', JSON.stringify(newRecent))
}

export function HashtagSuggestions({ content, isVisible, onSelect, className }: HashtagSuggestionsProps) {
  const [suggestions, setSuggestions] = useState<HashtagSuggestion[]>([])

  // Generate suggestions based on content
  useEffect(() => {
    if (!isVisible) {
      setSuggestions([])
      return
    }

    const related = getRelatedHashtags(content)
    const recent = getRecentHashtags()
    const recentWithFallback =
      recent.length > 0
        ? recent
        : TRENDING_HASHTAGS.slice(2, 4).map(tag => ({
            tag: tag.tag,
            type: 'recent' as const,
          }))
    const trending = TRENDING_HASHTAGS.slice(0, 5)

    const seen = new Set<string>()
    const combined: HashtagSuggestion[] = []
    const addUnique = (items: HashtagSuggestion[]) => {
      items.forEach(item => {
        const key = item.tag.toLowerCase()
        if (!seen.has(key)) {
          seen.add(key)
          combined.push(item)
        }
      })
    }

    // Combine suggestions with priority: related > recent > trending
    addUnique(related)
    addUnique(recentWithFallback.filter(r => !related.find(rel => rel.tag === r.tag)))
    addUnique(trending)

    setSuggestions(combined.slice(0, 12)) // Limit total suggestions
  }, [content, isVisible])

  // Handle hashtag selection
  const handleSelect = (hashtag: string) => {
    saveRecentHashtag(hashtag)
    onSelect(hashtag)
  }

  if (!isVisible || suggestions.length === 0) {
    return null
  }

  return (
    <div className={cn("absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg z-50 mt-1 p-3", className)}>
      <div className="space-y-3">
        {/* Related */}
        {suggestions.filter(s => s.type === 'related').length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Hash className="h-4 w-4 text-blue-500" />
              <span className="text-sm font-medium text-gray-700">Related</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {suggestions.filter(s => s.type === 'related').map((suggestion, index) => (
                <Badge
                  key={`related-${index}`}
                  variant="secondary"
                  className="cursor-pointer hover:bg-blue-100 text-blue-700 border-blue-200"
                  onClick={() => handleSelect(suggestion.tag)}
                >
                  #{suggestion.tag}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Trending */}
        {suggestions.filter(s => s.type === 'trending').length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-4 w-4 text-orange-500" />
              <span className="text-sm font-medium text-gray-700">Trending</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {suggestions.filter(s => s.type === 'trending').map((suggestion, index) => (
                <Badge
                  key={`trending-${index}`}
                  variant="secondary"
                  className="cursor-pointer hover:bg-orange-100 text-orange-700 border-orange-200"
                  onClick={() => handleSelect(suggestion.tag)}
                >
                  #{suggestion.tag}
                  {suggestion.count && (
                    <span className="ml-1 text-xs opacity-75">
                      {suggestion.count >= 1000
                        ? formatCount(suggestion.count)
                        : suggestion.count}
                    </span>
                  )}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Recent */}
        {suggestions.filter(s => s.type === 'recent').length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Clock className="h-4 w-4 text-gray-500" />
              <span className="text-sm font-medium text-gray-700">Recent</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {suggestions.filter(s => s.type === 'recent').map((suggestion, index) => (
                <Badge
                  key={`recent-${index}`}
                  variant="outline"
                  className="cursor-pointer hover:bg-gray-100 text-gray-700"
                  onClick={() => handleSelect(suggestion.tag)}
                >
                  #{suggestion.tag}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="mt-3 pt-2 border-t border-gray-100">
        <p className="text-xs text-gray-500">
          Click a hashtag to add it to your post
        </p>
      </div>
    </div>
  )
}
