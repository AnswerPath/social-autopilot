"use client"

import { useCallback, useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Loader2, Mail, MoreHorizontal, Plus, Shield, Edit, Trash2, UserPlus } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from "@/hooks/use-auth"
import { useTeams } from "@/hooks/use-teams"
import { CreateTeamRequest, InviteMemberRequest, TeamRole, TeamSizeCategory } from "@/lib/team-types"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

function formatRoleLabel(role: string) {
  return role.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

export function TeamManagement() {
  const { user, isLoading: isAuthLoading } = useAuth()
  const {
    teams,
    currentTeam,
    teamMembers,
    outgoingInvitations,
    outgoingInvitationsError,
    loading,
    error,
    switchTeam,
    createTeam,
    inviteMember,
    resendTeamInvitation,
    fetchOutgoingInvitations,
    resetOutgoingInvitations,
    fetchTeamMembers,
  } = useTeams()

  const [showInviteForm, setShowInviteForm] = useState(false)
  const [showCreateTeam, setShowCreateTeam] = useState(false)
  const [inviteData, setInviteData] = useState<InviteMemberRequest>({
    email: '',
    role: TeamRole.MEMBER,
    message: '',
  })
  const [newTeam, setNewTeam] = useState<CreateTeamRequest>({
    name: '',
    description: '',
    industry: '',
    size_category: undefined,
    website_url: '',
  })

  useEffect(() => {
    if (!user || !teams.length || currentTeam) return
    if (teams.length === 1) {
      void switchTeam(teams[0].id)
    }
  }, [user, teams, currentTeam, switchTeam])

  useEffect(() => {
    if (!currentTeam?.id) return
    resetOutgoingInvitations()
    void fetchOutgoingInvitations(currentTeam.id)
  }, [currentTeam?.id, fetchOutgoingInvitations, resetOutgoingInvitations])

  const handleCreateTeam = async () => {
    if (!newTeam.name.trim()) {
      toast.error('Team name is required')
      return
    }
    if (isAuthLoading || loading) {
      toast.error('Please wait a moment and try again.')
      return
    }

    const created = await createTeam(newTeam)
    if (created) {
      setShowCreateTeam(false)
      setNewTeam({
        name: '',
        description: '',
        industry: '',
        size_category: undefined,
        website_url: '',
      })
      await fetchTeamMembers(created.id)
      await fetchOutgoingInvitations(created.id)
      toast.success('Team created.')
    }
  }

  const handleInviteMember = async () => {
    if (!currentTeam || !inviteData.email.trim()) {
      toast.error('Email is required')
      return
    }

    const result = await inviteMember(currentTeam.id, inviteData)
    if (result.ok) {
      setShowInviteForm(false)
      setInviteData({ email: '', role: TeamRole.MEMBER, message: '' })
      await fetchTeamMembers(currentTeam.id)
      await fetchOutgoingInvitations(currentTeam.id)
      if (result.emailSent) {
        toast.success('Invitation email sent.')
      } else {
        toast.warning(
          result.emailError ||
            'Invitation saved, but the email could not be sent. Check Resend and server logs.'
        )
      }
    }
  }

  const handleResendOutgoing = useCallback(
    async (invitationId: string) => {
      if (!currentTeam) return
      const result = await resendTeamInvitation(currentTeam.id, invitationId)
      if (result.ok) {
        if (result.emailSent) {
          toast.success('Invitation email resent.')
        } else {
          toast.warning(
            result.emailError ||
              'Invitation updated, but the email could not be sent. Check Resend and server logs.'
          )
        }
      }
    },
    [currentTeam, resendTeamInvitation]
  )

  const pendingApprovals: Array<{
    id: number
    author: string
    content: string
    submittedAt: string
    type: string
  }> = []

  const rolePermissions = {
    Admin: ["Create posts", "Schedule posts", "Approve posts", "Manage team", "View analytics", "Export data"],
    Editor: ["Create posts", "Schedule posts", "Approve posts", "View analytics"],
    Creator: ["Create posts", "Submit for approval", "View analytics"],
    Viewer: ["View analytics", "View posts"]
  }

  const getRoleBadgeVariant = (role: string) => {
    const r = role.toLowerCase()
    switch (r) {
      case "owner":
      case "admin":
        return "default"
      case "editor":
        return "secondary"
      case "member":
      case "viewer":
        return "outline"
      default:
        return "outline"
    }
  }

  if (isAuthLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />
        Loading…
      </div>
    )
  }

  if (!user) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-muted-foreground">Sign in to manage your team.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold">Team Management</h2>
          <p className="text-muted-foreground">Manage team members and their permissions</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          {teams.length > 1 && (
            <div className="space-y-1">
              <Label htmlFor="active-team" className="text-xs text-muted-foreground">
                Active team
              </Label>
              <Select
                value={currentTeam?.id ?? ''}
                onValueChange={(id) => void switchTeam(id)}
              >
                <SelectTrigger id="active-team" className="w-[220px]">
                  <SelectValue placeholder="Select a team" />
                </SelectTrigger>
                <SelectContent>
                  {teams.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {teams.length === 0 && (
            <Button type="button" onClick={() => setShowCreateTeam(true)} disabled={loading}>
              <Plus className="h-4 w-4 mr-2" />
              Create team
            </Button>
          )}
          <Button
            onClick={() => {
              if (!currentTeam) {
                if (teams.length === 0) {
                  setShowCreateTeam(true)
                  return
                }
                toast.error('Select a team using the dropdown above.')
                return
              }
              setShowInviteForm(true)
            }}
            disabled={!currentTeam || loading}
          >
            <UserPlus className="h-4 w-4 mr-2" />
            Invite Member
          </Button>
        </div>
      </div>

      {error && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="pt-4 text-sm text-destructive">{error}</CardContent>
        </Card>
      )}

      {!loading && teams.length === 0 && (
        <Card>
          <CardContent className="pt-6 space-y-4">
            <p className="text-muted-foreground">
              You do not have a team yet. Create one to invite members and manage permissions.
            </p>
            <Button type="button" onClick={() => setShowCreateTeam(true)} disabled={loading}>
              <Plus className="h-4 w-4 mr-2" />
              Create team
            </Button>
          </CardContent>
        </Card>
      )}

      {teams.length > 1 && !currentTeam && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground">Select which team to manage using the dropdown above.</p>
          </CardContent>
        </Card>
      )}

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
                    <p className="text-sm text-muted-foreground mb-2 line-clamp-2">{item.content}</p>
                    <span className="text-xs text-muted-foreground">Submitted {item.submittedAt}</span>
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

      {currentTeam && (outgoingInvitationsError || outgoingInvitations.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Pending invitations (email)
            </CardTitle>
            <CardDescription>Invites waiting for the recipient to accept</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {outgoingInvitationsError && (
              <p className="text-sm text-destructive rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2">
                Failed to load invitations: {outgoingInvitationsError}
              </p>
            )}
            {outgoingInvitations.length > 0 ? (
              <ul className="space-y-2">
                {outgoingInvitations.map((inv) => (
                  <li
                    key={inv.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm"
                  >
                    <span>
                      <span className="font-medium">{inv.email}</span>
                      <span className="text-muted-foreground"> · {inv.role}</span>
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={loading}
                      onClick={() => void handleResendOutgoing(inv.id)}
                    >
                      Resend email
                    </Button>
                  </li>
                ))}
              </ul>
            ) : !outgoingInvitationsError ? (
              <p className="text-sm text-muted-foreground">No pending invitations.</p>
            ) : null}
          </CardContent>
        </Card>
      )}

      {/* Team Members */}
      <Card>
        <CardHeader>
          <CardTitle>Team Members</CardTitle>
          <CardDescription>
            {currentTeam
              ? `Members of ${currentTeam.name}`
              : 'Select a team to see members'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {!currentTeam && (
              <p className="text-sm text-muted-foreground">Choose a team to load members.</p>
            )}
            {currentTeam && teamMembers.length === 0 && !loading && (
              <p className="text-sm text-muted-foreground">No members loaded yet.</p>
            )}
            {currentTeam &&
              !loading &&
              teamMembers.map((member) => {
              const displayName =
                member.user?.display_name?.trim() ||
                member.user?.email ||
                'Team member'
              const email = member.user?.email || ''
              const initials = displayName
                .split(/\s+/)
                .map((n) => n[0])
                .join('')
                .slice(0, 2)
                .toUpperCase()
              return (
              <div key={member.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-4">
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={member.user?.avatar_url || "/placeholder.svg"} alt={displayName} />
                    <AvatarFallback>{initials || '?'}</AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium">{displayName}</h3>
                      <Badge variant={getRoleBadgeVariant(member.role)}>
                        {formatRoleLabel(member.role)}
                      </Badge>
                      {member.status === "pending" && (
                        <Badge variant="outline" className="text-orange-600">
                          Pending
                        </Badge>
                      )}
                    </div>
                    {email ? (
                      <p className="text-sm text-muted-foreground">{email}</p>
                    ) : null}
                    <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                      <span>
                        Last active:{' '}
                        {member.last_active_at
                          ? new Date(member.last_active_at).toLocaleString()
                          : '—'}
                      </span>
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
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="text-red-600">
                      <Trash2 className="h-4 w-4 mr-2" />
                      Remove Member
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              )
            })}
            {currentTeam && loading && (
              <p className="text-sm text-muted-foreground">Loading members…</p>
            )}
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

      <Dialog open={showCreateTeam} onOpenChange={setShowCreateTeam}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create team</DialogTitle>
            <DialogDescription>
              Create a team to collaborate with others. You can invite members after it is created.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="tm-create-name">Team name</Label>
              <Input
                id="tm-create-name"
                value={newTeam.name}
                onChange={(e) => setNewTeam({ ...newTeam, name: e.target.value })}
                placeholder="Enter team name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tm-create-description">Description (optional)</Label>
              <Textarea
                id="tm-create-description"
                value={newTeam.description || ''}
                onChange={(e) => setNewTeam({ ...newTeam, description: e.target.value })}
                placeholder="Describe your team"
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tm-create-industry">Industry (optional)</Label>
              <Input
                id="tm-create-industry"
                value={newTeam.industry || ''}
                onChange={(e) => setNewTeam({ ...newTeam, industry: e.target.value })}
                placeholder="e.g. Technology, Marketing"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tm-create-size">Team size (optional)</Label>
              <Select
                value={newTeam.size_category}
                onValueChange={(value) =>
                  setNewTeam({
                    ...newTeam,
                    size_category: value as TeamSizeCategory,
                  })
                }
              >
                <SelectTrigger id="tm-create-size">
                  <SelectValue placeholder="Select team size" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={TeamSizeCategory.STARTUP}>Startup (1–10)</SelectItem>
                  <SelectItem value={TeamSizeCategory.SMALL}>Small (11–50)</SelectItem>
                  <SelectItem value={TeamSizeCategory.MEDIUM}>Medium (51–200)</SelectItem>
                  <SelectItem value={TeamSizeCategory.ENTERPRISE}>Enterprise (200+)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="tm-create-website">Website (optional)</Label>
              <Input
                id="tm-create-website"
                value={newTeam.website_url || ''}
                onChange={(e) => setNewTeam({ ...newTeam, website_url: e.target.value })}
                placeholder="https://example.com"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowCreateTeam(false)}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button type="button" onClick={() => void handleCreateTeam()} disabled={loading || isAuthLoading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create team'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showInviteForm && !!currentTeam} onOpenChange={setShowInviteForm}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Invite Team Member</DialogTitle>
            <DialogDescription>
              Send an invitation to join{' '}
              <strong>{currentTeam?.name ?? 'this team'}</strong>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="tm-invite-email">Email Address</Label>
              <Input
                id="tm-invite-email"
                type="email"
                placeholder="colleague@company.com"
                value={inviteData.email}
                onChange={(e) => setInviteData({ ...inviteData, email: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tm-invite-role">Role</Label>
              <Select
                value={inviteData.role}
                onValueChange={(value: TeamRole) =>
                  setInviteData({ ...inviteData, role: value })
                }
              >
                <SelectTrigger id="tm-invite-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={TeamRole.VIEWER}>Viewer</SelectItem>
                  <SelectItem value={TeamRole.MEMBER}>Member</SelectItem>
                  <SelectItem value={TeamRole.EDITOR}>Editor</SelectItem>
                  <SelectItem value={TeamRole.ADMIN}>Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="tm-invite-message">Message (optional)</Label>
              <Textarea
                id="tm-invite-message"
                placeholder="Personal note for the invitation"
                value={inviteData.message || ''}
                onChange={(e) => setInviteData({ ...inviteData, message: e.target.value })}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={loading}>
                Cancel
              </Button>
            </DialogClose>
            <Button type="button" onClick={() => void handleInviteMember()} disabled={loading}>
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Mail className="h-4 w-4 mr-2" />
              )}
              Send Invite
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
