"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus, Mail, MoreHorizontal, Shield, Edit, Trash2, UserPlus } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export function TeamManagement() {
  const [showInviteForm, setShowInviteForm] = useState(false)

  const teamMembers = [
    {
      id: 1,
      name: "Sarah Johnson",
      email: "sarah@company.com",
      role: "Admin",
      status: "active",
      lastActive: "2 hours ago",
      postsCreated: 24,
      avatar: "/placeholder-user.jpg"
    },
    {
      id: 2,
      name: "Carlos Rodriguez",
      email: "carlos@company.com",
      role: "Editor",
      status: "active",
      lastActive: "1 day ago",
      postsCreated: 18,
      avatar: "/placeholder-user.jpg"
    },
    {
      id: 3,
      name: "Priya Patel",
      email: "priya@company.com",
      role: "Creator",
      status: "active",
      lastActive: "3 hours ago",
      postsCreated: 32,
      avatar: "/placeholder-user.jpg"
    },
    {
      id: 4,
      name: "Mike Chen",
      email: "mike@company.com",
      role: "Viewer",
      status: "pending",
      lastActive: "Never",
      postsCreated: 0,
      avatar: "/placeholder-user.jpg"
    }
  ]

  const pendingApprovals = [
    {
      id: 1,
      author: "Priya Patel",
      content: "Excited to share our latest case study on improving customer engagement...",
      submittedAt: "2 hours ago",
      type: "post"
    },
    {
      id: 2,
      author: "Carlos Rodriguez",
      content: "Join us for our upcoming webinar on social media automation best practices",
      submittedAt: "4 hours ago",
      type: "post"
    }
  ]

  const rolePermissions = {
    Admin: ["Create posts", "Schedule posts", "Approve posts", "Manage team", "View analytics", "Export data"],
    Editor: ["Create posts", "Schedule posts", "Approve posts", "View analytics"],
    Creator: ["Create posts", "Submit for approval", "View analytics"],
    Viewer: ["View analytics", "View posts"]
  }

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case "Admin": return "default"
      case "Editor": return "secondary"
      case "Creator": return "outline"
      case "Viewer": return "outline"
      default: return "outline"
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Team Management</h2>
          <p className="text-gray-600">Manage team members and their permissions</p>
        </div>
        <Button onClick={() => setShowInviteForm(true)}>
          <UserPlus className="h-4 w-4 mr-2" />
          Invite Member
        </Button>
      </div>

      {/* Pending Approvals */}
      {pendingApprovals.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-orange-500" />
              Pending Approvals ({pendingApprovals.length})
            </CardTitle>
            <CardDescription>Posts waiting for your review</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {pendingApprovals.map((item) => (
                <div key={item.id} className="flex items-start gap-4 p-4 border rounded-lg">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback>{item.author[0]}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium">{item.author}</span>
                      <Badge variant="outline">Pending Review</Badge>
                    </div>
                    <p className="text-sm text-gray-600 mb-2 line-clamp-2">{item.content}</p>
                    <span className="text-xs text-gray-500">Submitted {item.submittedAt}</span>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline">
                      Reject
                    </Button>
                    <Button size="sm">
                      Approve
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Team Members */}
      <Card>
        <CardHeader>
          <CardTitle>Team Members</CardTitle>
          <CardDescription>Manage your team and their access levels</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {teamMembers.map((member) => (
              <div key={member.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-4">
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={member.avatar || "/placeholder.svg"} alt={member.name} />
                    <AvatarFallback>{member.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium">{member.name}</h3>
                      <Badge variant={getRoleBadgeVariant(member.role)}>
                        {member.role}
                      </Badge>
                      {member.status === "pending" && (
                        <Badge variant="outline" className="text-orange-600">
                          Pending
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-gray-600">{member.email}</p>
                    <div className="flex items-center gap-4 mt-1 text-xs text-gray-500">
                      <span>Last active: {member.lastActive}</span>
                      <span>•</span>
                      <span>{member.postsCreated} posts created</span>
                    </div>
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem>
                      <Edit className="h-4 w-4 mr-2" />
                      Edit Role
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <Mail className="h-4 w-4 mr-2" />
                      Resend Invite
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="text-red-600">
                      <Trash2 className="h-4 w-4 mr-2" />
                      Remove Member
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Role Permissions */}
      <Card>
        <CardHeader>
          <CardTitle>Role Permissions</CardTitle>
          <CardDescription>Overview of what each role can do</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {Object.entries(rolePermissions).map(([role, permissions]) => (
              <div key={role} className="p-4 border rounded-lg">
                <div className="flex items-center gap-2 mb-3">
                  <Badge variant={getRoleBadgeVariant(role)}>{role}</Badge>
                </div>
                <ul className="space-y-1 text-sm">
                  {permissions.map((permission, index) => (
                    <li key={index} className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                      {permission}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Invite Form Modal */}
      {showInviteForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Invite Team Member</CardTitle>
              <CardDescription>Send an invitation to join your team</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input id="email" type="email" placeholder="colleague@company.com" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="role">Role</Label>
                <Select defaultValue="creator">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="editor">Editor</SelectItem>
                    <SelectItem value="creator">Creator</SelectItem>
                    <SelectItem value="viewer">Viewer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <Button variant="outline" onClick={() => setShowInviteForm(false)}>
                  Cancel
                </Button>
                <Button>
                  <Mail className="h-4 w-4 mr-2" />
                  Send Invite
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
