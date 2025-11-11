"use client"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Edit, Trash2, Clock } from 'lucide-react'
import { CalendarPost, getStatusColor, getStatusBadgeVariant, formatPostTime } from "@/lib/calendar-utils"
import { 
  useDraggable,
  useDroppable,
} from '@dnd-kit/core'
import { cn } from "@/lib/utils"

interface CalendarDayProps {
  day: number | null
  posts: CalendarPost[]
  isToday: boolean
  onPostClick?: (post: CalendarPost) => void
  onPostEdit?: (post: CalendarPost) => void
  onPostDelete?: (post: CalendarPost) => void
  userTimezone?: string
}

interface CalendarPostItemProps {
  post: CalendarPost
  onEdit?: (post: CalendarPost) => void
  onDelete?: (post: CalendarPost) => void
  userTimezone?: string
}

function DraggablePostItem({ post, onEdit, onDelete, userTimezone }: CalendarPostItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = useDraggable({
    id: post.id,
    data: {
      post,
    },
  })

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
  } : undefined

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={cn(
        "text-xs p-2 rounded border-l-2 cursor-move hover:shadow-sm transition-shadow",
        getStatusColor(post.status),
        isDragging && "opacity-50 z-50"
      )}
    >
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          <span className="font-medium">{formatPostTime(post.scheduledAt, userTimezone)}</span>
        </div>
        <Badge 
          variant={getStatusBadgeVariant(post.status)}
          className="text-xs"
        >
          {post.status === "pending_approval" ? "Pending" : 
           post.status === 'published' ? 'Published' : 
           post.status === 'failed' ? 'Failed' :
           post.status === 'draft' ? 'Draft' : 
           'Scheduled'}
        </Badge>
      </div>
      <p className="line-clamp-2 text-gray-700 mb-2">{post.content}</p>
      <div className="flex items-center justify-between mt-1">
        <span className="text-gray-500 text-xs">You</span>
        <div className="flex gap-1">
          <Button 
            size="sm" 
            variant="ghost" 
            className="h-6 w-6 p-0"
            onClick={(e) => {
              e.stopPropagation()
              onEdit?.(post)
            }}
            aria-label="Edit post"
          >
            <Edit className="h-3 w-3" />
          </Button>
          <Button 
            size="sm" 
            variant="ghost" 
            className="h-6 w-6 p-0"
            onClick={(e) => {
              e.stopPropagation()
              onDelete?.(post)
            }}
            aria-label="Delete post"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </div>
  )
}

export function CalendarDay({ 
  day, 
  posts, 
  isToday, 
  onPostClick,
  onPostEdit,
  onPostDelete,
  userTimezone
}: CalendarDayProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: `day-${day}`,
    data: {
      day,
    },
    disabled: day === null,
  })

  if (day === null) {
    return (
      <div className="min-h-[120px] p-2 border rounded-lg bg-gray-50" />
    )
  }

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "min-h-[120px] p-2 border rounded-lg",
        "bg-white hover:bg-gray-50 transition-colors",
        isToday && "ring-2 ring-blue-500",
        isOver && "bg-blue-100 border-blue-400"
      )}
    >
      <div className={cn(
        "text-sm font-medium mb-2",
        isToday ? "text-blue-600" : "text-gray-900"
      )}>
        {day}
      </div>
      <div className="space-y-1 max-h-[80px] overflow-y-auto">
        {posts.map(post => (
          <div
            key={post.id}
            onClick={() => onPostClick?.(post)}
            className="cursor-pointer"
          >
            <DraggablePostItem
              post={post}
              onEdit={onPostEdit}
              onDelete={onPostDelete}
              userTimezone={userTimezone}
            />
          </div>
        ))}
      </div>
    </div>
  )
}

