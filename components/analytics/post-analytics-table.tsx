"use client"

import { useState, useMemo } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'
import { Badge } from "@/components/ui/badge"
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"

interface PostAnalyticsData {
  postId: string
  tweetId: string
  content: string
  postedAt: string
  analytics: Array<{
    likes: number
    retweets: number
    replies: number
    impressions?: number
    collected_at: Date
  }>
  latest: {
    likes: number
    retweets: number
    replies: number
    impressions?: number
  } | null
  mediaUrls?: string[]
}

type SortField = 'content' | 'date' | 'engagementRate' | 'reach' | 'impressions' | 'likes' | 'retweets' | 'replies'
type SortDirection = 'asc' | 'desc' | null

interface PostAnalyticsTableProps {
  data: PostAnalyticsData[]
  loading?: boolean
}

interface TableRowData {
  postId: string
  content: string
  date: string
  engagementRate: number
  reach: number
  impressions: number
  likes: number
  retweets: number
  replies: number
}

export function PostAnalyticsTable({ data, loading = false }: PostAnalyticsTableProps) {
  const [sortField, setSortField] = useState<SortField | null>(null)
  const [sortDirection, setSortDirection] = useState<SortDirection>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const postsPerPage = 50

  // Format number with K/M suffixes
  const formatNumber = (num: number): string => {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`
    }
    if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`
    }
    return num.toString()
  }

  // Format date for display
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    })
  }

  // Transform data into table rows
  const tableData: TableRowData[] = useMemo(() => {
    return data
      .filter(post => post.latest)
      .map(post => {
        const latest = post.latest!
        const totalEngagement = latest.likes + latest.retweets + latest.replies
        const engagementRate = latest.impressions && latest.impressions > 0
          ? (totalEngagement / latest.impressions) * 100
          : 0

        return {
          postId: post.postId,
          content: post.content,
          date: post.postedAt,
          engagementRate,
          reach: latest.impressions || 0,
          impressions: latest.impressions || 0,
          likes: latest.likes,
          retweets: latest.retweets,
          replies: latest.replies,
        }
      })
  }, [data])

  // Sort data
  const sortedData = useMemo(() => {
    if (!sortField || !sortDirection) {
      return tableData
    }

    return [...tableData].sort((a, b) => {
      let aValue: number | string = a[sortField]
      let bValue: number | string = b[sortField]

      // Handle string comparison for content and date
      if (sortField === 'content') {
        aValue = a.content.toLowerCase()
        bValue = b.content.toLowerCase()
      } else if (sortField === 'date') {
        aValue = new Date(a.date).getTime()
        bValue = new Date(b.date).getTime()
      }

      if (sortDirection === 'asc') {
        return aValue > bValue ? 1 : aValue < bValue ? -1 : 0
      } else {
        return aValue < bValue ? 1 : aValue > bValue ? -1 : 0
      }
    })
  }, [tableData, sortField, sortDirection])

  // Paginate data
  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * postsPerPage
    const endIndex = startIndex + postsPerPage
    return sortedData.slice(startIndex, endIndex)
  }, [sortedData, currentPage])

  const totalPages = Math.ceil(sortedData.length / postsPerPage)

  // Handle column sort
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      // Cycle through: asc -> desc -> null
      if (sortDirection === 'asc') {
        setSortDirection('desc')
      } else if (sortDirection === 'desc') {
        setSortField(null)
        setSortDirection(null)
      }
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
    setCurrentPage(1) // Reset to first page on sort
  }

  // Sort button component
  const SortButton = ({ field, children }: { field: SortField; children: React.ReactNode }) => {
    const isActive = sortField === field
    return (
      <Button
        variant="ghost"
        size="sm"
        className="-ml-3 h-8 data-[state=open]:bg-accent"
        onClick={() => handleSort(field)}
      >
        {children}
        {isActive ? (
          sortDirection === 'asc' ? (
            <ArrowUp className="ml-2 h-4 w-4" />
          ) : (
            <ArrowDown className="ml-2 h-4 w-4" />
          )
        ) : (
          <ArrowUpDown className="ml-2 h-4 w-4 opacity-50" />
        )}
      </Button>
    )
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-12 bg-gray-200 rounded animate-pulse" />
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-16 bg-gray-200 rounded animate-pulse" />
        ))}
      </div>
    )
  }

  if (tableData.length === 0) {
    return (
      <div className="text-center py-8 text-sm text-muted-foreground">
        No post analytics data available
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[300px]">
                <SortButton field="content">Post Content</SortButton>
              </TableHead>
              <TableHead>
                <SortButton field="date">Posted Date</SortButton>
              </TableHead>
              <TableHead className="text-right">
                <SortButton field="engagementRate">Engagement Rate</SortButton>
              </TableHead>
              <TableHead className="text-right">
                <SortButton field="reach">Reach</SortButton>
              </TableHead>
              <TableHead className="text-right">
                <SortButton field="impressions">Impressions</SortButton>
              </TableHead>
              <TableHead className="text-right">
                <SortButton field="likes">Likes</SortButton>
              </TableHead>
              <TableHead className="text-right">
                <SortButton field="retweets">Retweets</SortButton>
              </TableHead>
              <TableHead className="text-right">
                <SortButton field="replies">Replies</SortButton>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedData.map((row) => (
              <TableRow key={row.postId}>
                <TableCell className="max-w-[300px]">
                  <p className="truncate text-sm" title={row.content}>
                    {row.content.substring(0, 100)}
                    {row.content.length > 100 && '...'}
                  </p>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {formatDate(row.date)}
                </TableCell>
                <TableCell className="text-right">
                  <Badge variant="secondary">
                    {row.impressions > 0 
                      ? `${row.engagementRate.toFixed(2)}%`
                      : 'N/A'
                    }
                  </Badge>
                </TableCell>
                <TableCell className="text-right text-sm">
                  {formatNumber(row.reach)}
                </TableCell>
                <TableCell className="text-right text-sm">
                  {formatNumber(row.impressions)}
                </TableCell>
                <TableCell className="text-right text-sm">
                  {formatNumber(row.likes)}
                </TableCell>
                <TableCell className="text-right text-sm">
                  {formatNumber(row.retweets)}
                </TableCell>
                <TableCell className="text-right text-sm">
                  {formatNumber(row.replies)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                href="#"
                onClick={(e) => {
                  e.preventDefault()
                  setCurrentPage(prev => Math.max(1, prev - 1))
                }}
                className={currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
              />
            </PaginationItem>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
              <PaginationItem key={page}>
                <PaginationLink
                  href="#"
                  onClick={(e) => {
                    e.preventDefault()
                    setCurrentPage(page)
                  }}
                  isActive={currentPage === page}
                  className="cursor-pointer"
                >
                  {page}
                </PaginationLink>
              </PaginationItem>
            ))}
            <PaginationItem>
              <PaginationNext
                href="#"
                onClick={(e) => {
                  e.preventDefault()
                  setCurrentPage(prev => Math.min(totalPages, prev + 1))
                }}
                className={currentPage === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}

      <div className="text-sm text-muted-foreground text-center">
        Showing {paginatedData.length} of {sortedData.length} posts
      </div>
    </div>
  )
}
