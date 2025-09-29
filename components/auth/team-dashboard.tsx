'use client';

import React, { useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useTeams } from '@/hooks/use-teams';
import { 
  Team, 
  TeamRole, 
  TeamMember, 
  TeamInvitation, 
  TeamContentSharing,
  CreateTeamRequest,
  InviteMemberRequest,
  ShareContentRequest,
  ContentType
} from '@/lib/team-types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Loader2, 
  Plus, 
  Users, 
  UserPlus, 
  Share2, 
  Settings, 
  Trash2, 
  Edit, 
  Check, 
  X, 
  Building2, 
  Mail, 
  Crown, 
  Shield, 
  Eye,
  Calendar,
  FileText,
  Image,
  BarChart3,
  FileCode
} from 'lucide-react';
import { cn } from '@/lib/utils';

export function TeamDashboard() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const {
    teams,
    currentTeam,
    teamMembers,
    teamInvitations,
    teamContent,
    teamStats,
    loading,
    error,
    createTeam,
    switchTeam,
    updateTeam,
    deleteTeam,
    fetchTeamMembers,
    inviteMember,
    updateMemberRole,
    removeMember,
    acceptInvitation,
    shareContent
  } = useTeams();

  const [activeTab, setActiveTab] = useState('overview');
  const [showCreateTeam, setShowCreateTeam] = useState(false);
  const [showInviteMember, setShowInviteMember] = useState(false);
  const [showShareContent, setShowShareContent] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);

  // Form states
  const [newTeam, setNewTeam] = useState<CreateTeamRequest>({
    name: '',
    description: '',
    industry: '',
    size_category: undefined,
    website_url: ''
  });

  const [inviteData, setInviteData] = useState<InviteMemberRequest>({
    email: '',
    role: TeamRole.MEMBER,
    message: ''
  });

  const [shareData, setShareData] = useState<ShareContentRequest>({
    content_type: ContentType.POST,
    content_id: '',
    permissions: {},
    is_public: false
  });

  // Handle create team
  const handleCreateTeam = async () => {
    if (!newTeam.name.trim()) {
      alert('Team name is required');
      return;
    }

    if (isAuthLoading || loading) {
      alert('Please wait for authentication to complete');
      return;
    }

    if (!user) {
      alert('User not authenticated. Please refresh the page and try again.');
      return;
    }

    const success = await createTeam(newTeam);
    if (success) {
      setShowCreateTeam(false);
      setNewTeam({ name: '', description: '', industry: '', size_category: undefined, website_url: '' });
    }
  };

  // Handle invite member
  const handleInviteMember = async () => {
    if (!currentTeam || !inviteData.email.trim()) {
      alert('Email is required');
      return;
    }

    const success = await inviteMember(currentTeam.id, inviteData);
    if (success) {
      setShowInviteMember(false);
      setInviteData({ email: '', role: TeamRole.MEMBER, message: '' });
      await fetchTeamMembers(currentTeam.id);
    }
  };

  // Handle share content
  const handleShareContent = async () => {
    if (!currentTeam || !shareData.content_id.trim()) {
      alert('Content ID is required');
      return;
    }

    const success = await shareContent(currentTeam.id, shareData);
    if (success) {
      setShowShareContent(false);
      setShareData({ content_type: ContentType.POST, content_id: '', permissions: {}, is_public: false });
    }
  };

  // Handle accept invitation
  const handleAcceptInvitation = async (invitationToken: string) => {
    const success = await acceptInvitation(invitationToken);
    if (success) {
      // Team will be automatically switched to after acceptance
    }
  };

  // Handle team switch
  const handleTeamSwitch = async (team: Team) => {
    await switchTeam(team.id);
  };

  // Get role icon
  const getRoleIcon = (role: TeamRole) => {
    switch (role) {
      case TeamRole.OWNER:
        return <Crown className="h-4 w-4 text-yellow-500" />;
      case TeamRole.ADMIN:
        return <Shield className="h-4 w-4 text-blue-500" />;
      case TeamRole.EDITOR:
        return <Edit className="h-4 w-4 text-green-500" />;
      case TeamRole.MEMBER:
        return <Users className="h-4 w-4 text-gray-500" />;
      case TeamRole.VIEWER:
        return <Eye className="h-4 w-4 text-gray-400" />;
      default:
        return <Users className="h-4 w-4 text-gray-500" />;
    }
  };

  // Get content type icon
  const getContentTypeIcon = (type: ContentType) => {
    switch (type) {
      case ContentType.POST:
        return <FileText className="h-4 w-4" />;
      case ContentType.MEDIA:
        return <Image className="h-4 w-4" />;
      case ContentType.CAMPAIGN:
        return <BarChart3 className="h-4 w-4" />;
      case ContentType.TEMPLATE:
        return <FileCode className="h-4 w-4" />;
      case ContentType.ANALYTICS:
        return <BarChart3 className="h-4 w-4" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  if (!user) {
    return (
      <Card>
        <CardContent className="pt-6">
          <Alert>
            <AlertDescription>Please log in to access team features.</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Team Collaboration</h2>
          <p className="text-gray-600">Manage your teams and collaborate with members</p>
        </div>
        <Dialog open={showCreateTeam} onOpenChange={setShowCreateTeam}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Create Team
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Team</DialogTitle>
              <DialogDescription>
                Create a new team to collaborate with others
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="team-name">Team Name *</Label>
                <Input
                  id="team-name"
                  value={newTeam.name}
                  onChange={(e) => setNewTeam({ ...newTeam, name: e.target.value })}
                  placeholder="Enter team name"
                />
              </div>
              <div>
                <Label htmlFor="team-description">Description</Label>
                <Textarea
                  id="team-description"
                  value={newTeam.description || ''}
                  onChange={(e) => setNewTeam({ ...newTeam, description: e.target.value })}
                  placeholder="Describe your team"
                />
              </div>
              <div>
                <Label htmlFor="team-industry">Industry</Label>
                <Input
                  id="team-industry"
                  value={newTeam.industry || ''}
                  onChange={(e) => setNewTeam({ ...newTeam, industry: e.target.value })}
                  placeholder="e.g., Technology, Marketing"
                />
              </div>
              <div>
                <Label htmlFor="team-size">Team Size</Label>
                <Select value={newTeam.size_category} onValueChange={(value: any) => setNewTeam({ ...newTeam, size_category: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select team size" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="startup">Startup (1-10)</SelectItem>
                    <SelectItem value="small">Small (11-50)</SelectItem>
                    <SelectItem value="medium">Medium (51-200)</SelectItem>
                    <SelectItem value="enterprise">Enterprise (200+)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="team-website">Website</Label>
                <Input
                  id="team-website"
                  value={newTeam.website_url || ''}
                  onChange={(e) => setNewTeam({ ...newTeam, website_url: e.target.value })}
                  placeholder="https://example.com"
                />
              </div>
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setShowCreateTeam(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreateTeam} disabled={loading || isAuthLoading}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                  Create Team
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Error Display */}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Pending Invitations */}
      {teamInvitations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Mail className="mr-2 h-5 w-5" />
              Pending Invitations
            </CardTitle>
            <CardDescription>
              You have been invited to join these teams
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {teamInvitations.map((invitation) => (
                <div key={invitation.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center space-x-3">
                    <Building2 className="h-8 w-8 text-blue-500" />
                    <div>
                      <h4 className="font-medium">{invitation.team?.name}</h4>
                      <p className="text-sm text-gray-600">Invited as {invitation.role}</p>
                      {invitation.message && (
                        <p className="text-sm text-gray-500 mt-1">"{invitation.message}"</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      size="sm"
                      onClick={() => handleAcceptInvitation(invitation.invitation_token)}
                      disabled={loading}
                    >
                      <Check className="h-4 w-4 mr-1" />
                      Accept
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={loading}
                    >
                      <X className="h-4 w-4 mr-1" />
                      Decline
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Teams Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {teams.map((team) => (
          <Card 
            key={team.id} 
            className={cn(
              "cursor-pointer transition-all hover:shadow-md",
              currentTeam?.id === team.id && "ring-2 ring-blue-500"
            )}
            onClick={() => handleTeamSwitch(team)}
          >
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Building2 className="h-8 w-8 text-blue-500" />
                  <div>
                    <CardTitle className="text-lg">{team.name}</CardTitle>
                    <CardDescription className="text-sm">
                      {team.industry || 'No industry specified'}
                    </CardDescription>
                  </div>
                </div>
                {currentTeam?.id === team.id && (
                  <Badge variant="secondary">Active</Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {team.description && (
                <p className="text-sm text-gray-600 mb-3">{team.description}</p>
              )}
              <div className="flex items-center justify-between text-sm text-gray-500">
                <span>Created {formatDate(team.created_at)}</span>
                <Badge variant="outline">{team.size_category || 'Unknown'}</Badge>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Current Team Details */}
      {currentTeam && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Building2 className="h-6 w-6" />
                <span>{currentTeam.name}</span>
              </div>
              <div className="flex items-center space-x-2">
                <Dialog open={showInviteMember} onOpenChange={setShowInviteMember}>
                  <DialogTrigger asChild>
                    <Button size="sm">
                      <UserPlus className="h-4 w-4 mr-2" />
                      Invite Member
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Invite Team Member</DialogTitle>
                      <DialogDescription>
                        Send an invitation to join your team
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="invite-email">Email Address *</Label>
                        <Input
                          id="invite-email"
                          type="email"
                          value={inviteData.email}
                          onChange={(e) => setInviteData({ ...inviteData, email: e.target.value })}
                          placeholder="colleague@example.com"
                        />
                      </div>
                      <div>
                        <Label htmlFor="invite-role">Role</Label>
                        <Select value={inviteData.role} onValueChange={(value: TeamRole) => setInviteData({ ...inviteData, role: value })}>
                          <SelectTrigger>
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
                      <div>
                        <Label htmlFor="invite-message">Message (Optional)</Label>
                        <Textarea
                          id="invite-message"
                          value={inviteData.message || ''}
                          onChange={(e) => setInviteData({ ...inviteData, message: e.target.value })}
                          placeholder="Personal message for the invitation"
                        />
                      </div>
                      <div className="flex justify-end space-x-2">
                        <Button variant="outline" onClick={() => setShowInviteMember(false)}>
                          Cancel
                        </Button>
                        <Button onClick={handleInviteMember} disabled={loading}>
                          {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <UserPlus className="h-4 w-4 mr-2" />}
                          Send Invitation
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
                <Dialog open={showShareContent} onOpenChange={setShowShareContent}>
                  <DialogTrigger asChild>
                    <Button size="sm" variant="outline">
                      <Share2 className="h-4 w-4 mr-2" />
                      Share Content
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Share Content</DialogTitle>
                      <DialogDescription>
                        Share content with your team members
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="content-type">Content Type</Label>
                        <Select value={shareData.content_type} onValueChange={(value: ContentType) => setShareData({ ...shareData, content_type: value })}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={ContentType.POST}>Post</SelectItem>
                            <SelectItem value={ContentType.MEDIA}>Media</SelectItem>
                            <SelectItem value={ContentType.CAMPAIGN}>Campaign</SelectItem>
                            <SelectItem value={ContentType.TEMPLATE}>Template</SelectItem>
                            <SelectItem value={ContentType.ANALYTICS}>Analytics</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="content-id">Content ID *</Label>
                        <Input
                          id="content-id"
                          value={shareData.content_id}
                          onChange={(e) => setShareData({ ...shareData, content_id: e.target.value })}
                          placeholder="Enter content ID"
                        />
                      </div>
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id="is-public"
                          checked={shareData.is_public}
                          onChange={(e) => setShareData({ ...shareData, is_public: e.target.checked })}
                        />
                        <Label htmlFor="is-public">Make publicly accessible</Label>
                      </div>
                      <div className="flex justify-end space-x-2">
                        <Button variant="outline" onClick={() => setShowShareContent(false)}>
                          Cancel
                        </Button>
                        <Button onClick={handleShareContent} disabled={loading}>
                          {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Share2 className="h-4 w-4 mr-2" />}
                          Share Content
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </CardTitle>
            <CardDescription>{currentTeam.description}</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="members">Members</TabsTrigger>
                <TabsTrigger value="content">Content</TabsTrigger>
                <TabsTrigger value="settings">Settings</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="mt-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center space-x-2">
                        <Users className="h-4 w-4 text-blue-500" />
                        <div>
                          <p className="text-sm font-medium">Team Members</p>
                          <p className="text-2xl font-bold">{teamStats?.member_count || 0}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center space-x-2">
                        <Share2 className="h-4 w-4 text-green-500" />
                        <div>
                          <p className="text-sm font-medium">Shared Content</p>
                          <p className="text-2xl font-bold">{teamStats?.content_shared || 0}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center space-x-2">
                        <Calendar className="h-4 w-4 text-purple-500" />
                        <div>
                          <p className="text-sm font-medium">Last Activity</p>
                          <p className="text-sm">
                            {teamStats?.last_activity ? formatDate(teamStats.last_activity) : 'No recent activity'}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="members" className="mt-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Member</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Joined</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {teamMembers.map((member) => (
                      <TableRow key={member.id}>
                        <TableCell>
                          <div className="flex items-center space-x-3">
                            <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center">
                              <Users className="h-4 w-4" />
                            </div>
                            <div>
                              <p className="font-medium">{member.user?.display_name || 'Unknown User'}</p>
                              <p className="text-sm text-gray-500">{member.user?.email}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            {getRoleIcon(member.role)}
                            <span className="capitalize">{member.role}</span>
                          </div>
                        </TableCell>
                        <TableCell>{formatDate(member.joined_at)}</TableCell>
                        <TableCell>
                          <Badge variant={member.status === 'active' ? 'default' : 'secondary'}>
                            {member.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <Button size="sm" variant="outline">
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="outline">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TabsContent>

              <TabsContent value="content" className="mt-4">
                <div className="space-y-4">
                  {teamContent.map((content) => (
                    <Card key={content.id}>
                      <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            {getContentTypeIcon(content.content_type)}
                            <div>
                              <p className="font-medium">
                                {content.content_type} - {content.content_id}
                              </p>
                              <p className="text-sm text-gray-500">
                                Shared by {content.sharer?.display_name || 'Unknown'}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            {content.is_public && (
                              <Badge variant="secondary">Public</Badge>
                            )}
                            <span className="text-sm text-gray-500">
                              {formatDate(content.created_at)}
                            </span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                  {teamContent.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      No shared content yet
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="settings" className="mt-4">
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="team-description">Description</Label>
                    <Textarea
                      id="team-description"
                      value={currentTeam.description || ''}
                      placeholder="Describe your team"
                    />
                  </div>
                  <div>
                    <Label htmlFor="team-industry">Industry</Label>
                    <Input
                      id="team-industry"
                      value={currentTeam.industry || ''}
                      placeholder="e.g., Technology, Marketing"
                    />
                  </div>
                  <div>
                    <Label htmlFor="team-website">Website</Label>
                    <Input
                      id="team-website"
                      value={currentTeam.website_url || ''}
                      placeholder="https://example.com"
                    />
                  </div>
                  <div className="flex justify-end">
                    <Button>
                      <Settings className="h-4 w-4 mr-2" />
                      Save Changes
                    </Button>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}

      {/* No Teams State */}
      {teams.length === 0 && !loading && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <Building2 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No teams yet</h3>
              <p className="text-gray-600 mb-4">
                Create your first team to start collaborating with others
              </p>
              <Button onClick={() => setShowCreateTeam(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Your First Team
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
