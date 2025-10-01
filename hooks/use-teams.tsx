'use client';

import { useState, useCallback, useEffect } from 'react';
import { useAuth } from './use-auth';
import { 
  Team, 
  TeamMember, 
  TeamInvitation, 
  TeamContentSharing,
  TeamStats,
  CreateTeamRequest,
  UpdateTeamRequest,
  InviteMemberRequest,
  UpdateMemberRoleRequest,
  ShareContentRequest,
  TeamFilters,
  TeamMemberFilters,
  TeamRole,
  TeamPermissions,
  ContentType
} from '@/lib/team-types';

export interface TeamsState {
  teams: Team[];
  currentTeam: Team | null;
  teamMembers: TeamMember[];
  teamInvitations: TeamInvitation[];
  teamContent: TeamContentSharing[];
  teamStats: TeamStats | null;
  userPermissions: TeamPermissions | null;
  userRole: TeamRole | null;
  loading: boolean;
  error: string | null;
}

export function useTeams() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const [state, setState] = useState<TeamsState>({
    teams: [],
    currentTeam: null,
    teamMembers: [],
    teamInvitations: [],
    teamContent: [],
    teamStats: null,
    userPermissions: null,
    userRole: null,
    loading: false,
    error: null
  });

  // Set loading state
  const setLoading = useCallback((loading: boolean) => {
    setState(prev => ({ ...prev, loading }));
  }, []);

  // Set error state
  const setError = useCallback((error: string | null) => {
    setState(prev => ({ ...prev, error }));
  }, []);

  // Fetch user's teams
  const fetchUserTeams = useCallback(async () => {
    if (!user) {
      setError('User not authenticated.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/teams', {
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch teams: ${response.statusText}`);
      }

      const data = await response.json();
      setState(prev => ({ ...prev, teams: data.teams || [] }));

    } catch (err: any) {
      setError(err.message || 'Failed to fetch teams.');
      console.error('Error fetching teams:', err);
    } finally {
      setLoading(false);
    }
  }, [user, user, setLoading, setError]);

  // Create a new team
  const createTeam = useCallback(async (teamData: CreateTeamRequest): Promise<boolean> => {
    if (!user) {
      setError('User not authenticated.');
      return false;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/teams', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(teamData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || `Failed to create team: ${response.statusText}`);
      }

      const data = await response.json();
      
      // Add new team to the list
      setState(prev => ({ 
        ...prev, 
        teams: [...prev.teams, data.team],
        currentTeam: data.team 
      }));

      return true;

    } catch (err: any) {
      setError(err.message || 'Failed to create team.');
      console.error('Error creating team:', err);
      return false;
    } finally {
      setLoading(false);
    }
  }, [user, user, setLoading, setError]);

  // Switch to a different team
  const switchTeam = useCallback(async (teamId: string): Promise<boolean> => {
    if (!user || !user) {
      setError('User not authenticated.');
      return false;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/teams/${teamId}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch team: ${response.statusText}`);
      }

      const data = await response.json();
      
      // Update current team and related data
      setState(prev => ({ 
        ...prev, 
        currentTeam: data.team,
        teamStats: data.stats 
      }));

      // Fetch team members and content
      await Promise.all([
        fetchTeamMembers(teamId),
        fetchTeamContent(teamId)
      ]);

      return true;

    } catch (err: any) {
      setError(err.message || 'Failed to switch team.');
      console.error('Error switching team:', err);
      return false;
    } finally {
      setLoading(false);
    }
  }, [user, user, setLoading, setError]);

  // Update team
  const updateTeam = useCallback(async (teamId: string, updateData: UpdateTeamRequest): Promise<boolean> => {
    if (!user || !user) {
      setError('User not authenticated.');
      return false;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/teams/${teamId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || `Failed to update team: ${response.statusText}`);
      }

      const data = await response.json();
      
      // Update team in the list and current team
      setState(prev => ({
        ...prev,
        teams: prev.teams.map(team => 
          team.id === teamId ? data.team : team
        ),
        currentTeam: prev.currentTeam?.id === teamId ? data.team : prev.currentTeam
      }));

      return true;

    } catch (err: any) {
      setError(err.message || 'Failed to update team.');
      console.error('Error updating team:', err);
      return false;
    } finally {
      setLoading(false);
    }
  }, [user, user, setLoading, setError]);

  // Delete team
  const deleteTeam = useCallback(async (teamId: string): Promise<boolean> => {
    if (!user || !user) {
      setError('User not authenticated.');
      return false;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/teams/${teamId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || `Failed to delete team: ${response.statusText}`);
      }

      // Remove team from the list
      setState(prev => ({
        ...prev,
        teams: prev.teams.filter(team => team.id !== teamId),
        currentTeam: prev.currentTeam?.id === teamId ? null : prev.currentTeam
      }));

      return true;

    } catch (err: any) {
      setError(err.message || 'Failed to delete team.');
      console.error('Error deleting team:', err);
      return false;
    } finally {
      setLoading(false);
    }
  }, [user, user, setLoading, setError]);

  // Fetch team members
  const fetchTeamMembers = useCallback(async (teamId: string, filters?: TeamMemberFilters) => {
    if (!user || !user) {
      setError('User not authenticated.');
      return;
    }

    try {
      const params = new URLSearchParams();
      if (filters?.role) params.append('role', filters.role);
      if (filters?.status) params.append('status', filters.status);
      if (filters?.search) params.append('search', filters.search);
      if (filters?.joined_after) params.append('joined_after', filters.joined_after);
      if (filters?.joined_before) params.append('joined_before', filters.joined_before);

      const response = await fetch(`/api/teams/${teamId}/members?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch team members: ${response.statusText}`);
      }

      const data = await response.json();
      setState(prev => ({ ...prev, teamMembers: data.members || [] }));

    } catch (err: any) {
      setError(err.message || 'Failed to fetch team members.');
      console.error('Error fetching team members:', err);
    }
  }, [user, user, setError]);

  // Invite member to team
  const inviteMember = useCallback(async (teamId: string, invitationData: InviteMemberRequest): Promise<boolean> => {
    if (!user || !user) {
      setError('User not authenticated.');
      return false;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/teams/${teamId}/members`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(invitationData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || `Failed to invite member: ${response.statusText}`);
      }

      // Refresh team members
      await fetchTeamMembers(teamId);

      return true;

    } catch (err: any) {
      setError(err.message || 'Failed to invite member.');
      console.error('Error inviting member:', err);
      return false;
    } finally {
      setLoading(false);
    }
  }, [user, user, setLoading, setError, fetchTeamMembers]);

  // Update member role
  const updateMemberRole = useCallback(async (teamId: string, userId: string, roleData: UpdateMemberRoleRequest): Promise<boolean> => {
    if (!user || !user) {
      setError('User not authenticated.');
      return false;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/teams/${teamId}/members/${userId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(roleData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || `Failed to update member role: ${response.statusText}`);
      }

      // Refresh team members
      await fetchTeamMembers(teamId);

      return true;

    } catch (err: any) {
      setError(err.message || 'Failed to update member role.');
      console.error('Error updating member role:', err);
      return false;
    } finally {
      setLoading(false);
    }
  }, [user, user, setLoading, setError, fetchTeamMembers]);

  // Remove member from team
  const removeMember = useCallback(async (teamId: string, userId: string): Promise<boolean> => {
    if (!user || !user) {
      setError('User not authenticated.');
      return false;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/teams/${teamId}/members/${userId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || `Failed to remove member: ${response.statusText}`);
      }

      // Refresh team members
      await fetchTeamMembers(teamId);

      return true;

    } catch (err: any) {
      setError(err.message || 'Failed to remove member.');
      console.error('Error removing member:', err);
      return false;
    } finally {
      setLoading(false);
    }
  }, [user, user, setLoading, setError, fetchTeamMembers]);

  // Fetch team invitations
  const fetchTeamInvitations = useCallback(async () => {
    if (!user || !user) {
      setError('User not authenticated.');
      return;
    }

    try {
      const response = await fetch('/api/teams/invitations', {
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch invitations: ${response.statusText}`);
      }

      const data = await response.json();
      setState(prev => ({ ...prev, teamInvitations: data.invitations || [] }));

    } catch (err: any) {
      setError(err.message || 'Failed to fetch invitations.');
      console.error('Error fetching invitations:', err);
    }
  }, [user, user, setError]);

  // Accept team invitation
  const acceptInvitation = useCallback(async (invitationToken: string): Promise<boolean> => {
    if (!user || !user) {
      setError('User not authenticated.');
      return false;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/teams/invitations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ invitationToken }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || `Failed to accept invitation: ${response.statusText}`);
      }

      const data = await response.json();
      
      // Add team to user's teams and switch to it
      setState(prev => ({ 
        ...prev, 
        teams: [...prev.teams, data.team],
        currentTeam: data.team 
      }));

      // Refresh invitations
      await fetchTeamInvitations();

      return true;

    } catch (err: any) {
      setError(err.message || 'Failed to accept invitation.');
      console.error('Error accepting invitation:', err);
      return false;
    } finally {
      setLoading(false);
    }
  }, [user, user, setLoading, setError, fetchTeamInvitations]);

  // Fetch team shared content
  const fetchTeamContent = useCallback(async (teamId: string, contentType?: ContentType) => {
    if (!user || !user) {
      setError('User not authenticated.');
      return;
    }

    try {
      const params = new URLSearchParams();
      if (contentType) params.append('type', contentType);

      const response = await fetch(`/api/teams/${teamId}/content?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch team content: ${response.statusText}`);
      }

      const data = await response.json();
      setState(prev => ({ ...prev, teamContent: data.content || [] }));

    } catch (err: any) {
      setError(err.message || 'Failed to fetch team content.');
      console.error('Error fetching team content:', err);
    }
  }, [user, user, setError]);

  // Share content with team
  const shareContent = useCallback(async (teamId: string, contentData: ShareContentRequest): Promise<boolean> => {
    if (!user || !user) {
      setError('User not authenticated.');
      return false;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/teams/${teamId}/content`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(contentData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || `Failed to share content: ${response.statusText}`);
      }

      // Refresh team content
      await fetchTeamContent(teamId);

      return true;

    } catch (err: any) {
      setError(err.message || 'Failed to share content.');
      console.error('Error sharing content:', err);
      return false;
    } finally {
      setLoading(false);
    }
  }, [user, user, setLoading, setError, fetchTeamContent]);

  // Load initial data
  useEffect(() => {
    if (user && user) {
      fetchUserTeams();
      fetchTeamInvitations();
    }
  }, [user, user, fetchUserTeams, fetchTeamInvitations]);

  return {
    ...state,
    loading: state.loading || isAuthLoading,
    fetchUserTeams,
    createTeam,
    switchTeam,
    updateTeam,
    deleteTeam,
    fetchTeamMembers,
    inviteMember,
    updateMemberRole,
    removeMember,
    fetchTeamInvitations,
    acceptInvitation,
    fetchTeamContent,
    shareContent,
    user,
    user
  };
}
