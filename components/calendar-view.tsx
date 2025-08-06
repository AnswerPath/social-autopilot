"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { ChevronLeft, ChevronRight, Plus, Edit, Trash2 } from 'lucide-react'
import { PostComposer } from "./post-composer"

export function CalendarView() {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [showComposer, setShowComposer] = useState(false)

  // Mock data for scheduled posts
  const scheduledPosts = [
    {
      id: 1,
      date: "2024-01-15",
      time: "10:00",
      content: "Excited to announce our new product features! 🚀 #innovation #tech",
      status: "scheduled",
      author: "Marketing Team"
    },
    {
      id: 2,
      date: "2024-01-15",
      time: "14:00",
      content: "Join us for our weekly tech talk at 3 PM EST today!",
      status: "scheduled",
      author: "Social Media Lead"
    },
    {
      id: 3,
      date: "2024-01-16",
      time: "09:00",
      content: "Monday motivation: Success is not final, failure is not fatal...",
      status: "scheduled",
      author: "Content Creator"
    },
    {
      id: 4,
      date: "2024-01-16",
      time: "16:00",
      content: "Behind the scenes: Our development team working on amazing features",
      status: "pending_approval",
      author: "Content Creator"
    }
  ]

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear()
    const month = date.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const daysInMonth = lastDay.getDate()
    const startingDayOfWeek = firstDay.getDay()

    const days = []
    
    // Add empty cells for days before the first day of the month
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null)
    }
    
    // Add days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(day)
    }
    
    return days
  }

  const getPostsForDate = (day: number) => {
    if (!day) return []
    const dateStr = `2024-01-${day.toString().padStart(2, '0')}`
    return scheduledPosts.filter(post => post.date === dateStr)
  }

  const navigateMonth = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate)
    if (direction === 'prev') {
      newDate.setMonth(newDate.getMonth() - 1)
    } else {
      newDate.setMonth(newDate.getMonth() + 1)
    }
    setCurrentDate(newDate)
  }

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ]

  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

  if (showComposer) {
    return <PostComposer onClose={() => setShowComposer(false)} />
  }

  return (
    <div className="space-y-6">
      {/* Calendar Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={() => navigateMonth('prev')}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h2 className="text-2xl font-bold">
            {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
          </h2>
          <Button variant="outline" size="sm" onClick={() => navigateMonth('next')}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <Button onClick={() => setShowComposer(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Schedule Post
        </Button>
      </div>

      {/* Calendar Grid */}
      <Card>
        <CardContent className="p-6">
          <div className="grid grid-cols-7 gap-4">
            {/* Day headers */}
            {dayNames.map(day => (
              <div key={day} className="text-center font-medium text-gray-500 py-2">
                {day}
              </div>
            ))}
            
            {/* Calendar days */}
            {getDaysInMonth(currentDate).map((day, index) => {
              const posts = getPostsForDate(day)
              const isToday = day === new Date().getDate() && 
                            currentDate.getMonth() === new Date().getMonth() &&
                            currentDate.getFullYear() === new Date().getFullYear()
              
              return (
                <div
                  key={index}
                  className={`min-h-[120px] p-2 border rounded-lg ${
                    day ? 'bg-white hover:bg-gray-50' : 'bg-gray-50'
                  } ${isToday ? 'ring-2 ring-blue-500' : ''}`}
                >
                  {day && (
                    <>
                      <div className={`text-sm font-medium mb-2 ${isToday ? 'text-blue-600' : 'text-gray-900'}`}>
                        {day}
                      </div>
                      <div className="space-y-1">
                        {posts.map(post => (
                          <div
                            key={post.id}
                            className="text-xs p-2 rounded bg-blue-50 border-l-2 border-blue-400 cursor-pointer hover:bg-blue-100"
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-medium">{post.time}</span>
                              <Badge 
                                variant={post.status === "scheduled" ? "default" : "secondary"}
                                className="text-xs"
                              >
                                {post.status === "pending_approval" ? "Pending" : "Scheduled"}
                              </Badge>
                            </div>
                            <p className="line-clamp-2 text-gray-700">{post.content}</p>
                            <div className="flex items-center justify-between mt-1">
                              <span className="text-gray-500">{post.author}</span>
                              <div className="flex gap-1">
                                <Button size="sm" variant="ghost" className="h-6 w-6 p-0">
                                  <Edit className="h-3 w-3" />
                                </Button>
                                <Button size="sm" variant="ghost" className="h-6 w-6 p-0">
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Upcoming Posts Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Upcoming Posts</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {scheduledPosts.slice(0, 5).map(post => (
              <div key={post.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback>{post.author[0]}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-medium line-clamp-1">{post.content}</p>
                    <p className="text-xs text-gray-500">{post.date} at {post.time} • {post.author}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={post.status === "scheduled" ? "default" : "secondary"}>
                    {post.status === "pending_approval" ? "Pending Approval" : "Scheduled"}
                  </Badge>
                  <Button size="sm" variant="outline">
                    Edit
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
