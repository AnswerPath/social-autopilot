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

/** Readable message for failed API responses (statusText is often empty over HTTP/2). */
async function parseApiErrorResponse(response: Response, fallbackPrefix: string): Promise<string> {
  const status = response.status
  const statusText = response.statusText?.trim()
  let detail = ''
  try {
    const text = await response.text()
    if (text) {
      try {
        const data = JSON.parse(text) as {
          error?: { message?: string } | string
          message?: string
        }
        detail =
          (typeof data.error === 'object' && data.error?.message) ||
          (typeof data.error === 'string' ? data.error : '') ||
          data.message ||
          ''
      } catch {
        detail = text.length > 300 ? `${text.slice(0, 300)}…` : text
      }
    }
  } catch {
    /* ignore */
  }
  const core = detail || statusText || 'Request failed'
  return `${fallbackPrefix}: ${core} (HTTP ${status})`
}

export interface TeamsState {
  teams: Team[];
  currentTeam: Team | null;
  teamMembers: TeamMember[];
  teamInvitations: TeamInvitation[];
  /** Pending invites sent for the active team (when fetched). */
  outgoingInvitations: TeamInvitation[];
  teamContent: TeamContentSharing[];
  teamStats: TeamStats | null;
  userPermissions: TeamPermissions | null;
  userRole: TeamRole | null;
  loading: boolean;
  error: string | null;
}

export function useTeams() {
  const { user, isLoading: isAuthLoading, refreshSession } = useAuth();
  const [state, setState] = useState<TeamsState>({
    teams: [],
    currentTeam: null,
    teamMembers: [],
    teamInvitations: [],
    outgoingInvitations: [],
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
      let response = await fetch('/api/teams', {
        credentials: 'include'
      });

      if (!response.ok && response.status === 401) {
        const refreshed = await refreshSession();
        if (refreshed) {
          response = await fetch('/api/teams', {
            credentials: 'include'
          });
        }
      }

      if (!response.ok) {
        throw new Error(await parseApiErrorResponse(response, 'Failed to fetch teams'));
      }

      const data = await response.json();
      setState(prev => ({ ...prev, teams: data.teams || [] }));

    } catch (err: any) {
      setError(err.message || 'Failed to fetch teams.');
      console.error('Error fetching teams:', err);
    } finally {
      setLoading(false);
    }
  }, [user, setLoading, setError, refreshSession]);

  // Create a new team
  const createTeam = useCallback(async (teamData: CreateTeamRequest): Promise<Team | null> => {
    if (!user) {
      setError('User not authenticated.');
      return null;
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
        throw new Error(await parseApiErrorResponse(response, 'Failed to create team'));
      }

      const data = await response.json();

      // Add new team to the list
      setState(prev => ({
        ...prev,
        teams: [...prev.teams, data.team],
        currentTeam: data.team,
      }));

      return data.team as Team;

    } catch (err: any) {
      setError(err.message || 'Failed to create team.');
      console.error('Error creating team:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, [user, setLoading, setError]);

  // Switch to a different team
  const switchTeam = useCallback(async (teamId: string): Promise<boolean> => {
    if (!user) {
      setError('User not authenticated.');
      return false;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/teams/${teamId}`);
      
      if (!response.ok) {
        throw new Error(await parseApiErrorResponse(response, 'Failed to fetch team'));
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
  }, [user, setLoading, setError]);

  // Update team
  const updateTeam = useCallback(async (teamId: string, updateData: UpdateTeamRequest): Promise<boolean> => {
    if (!user) {
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
        throw new Error(await parseApiErrorResponse(response, 'Failed to update team'));
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
  }, [user, setLoading, setError]);

  // Delete team
  const deleteTeam = useCallback(async (teamId: string): Promise<boolean> => {
    if (!user) {
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
        throw new Error(await parseApiErrorResponse(response, 'Failed to delete team'));
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
  }, [user, setLoading, setError]);

  // Fetch team members
  const fetchTeamMembers = useCallback(async (teamId: string, filters?: TeamMemberFilters) => {
    if (!user) {
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
        throw new Error(await parseApiErrorResponse(response, 'Failed to fetch team members'));
      }

      const data = await response.json();
      setState(prev => ({ ...prev, teamMembers: data.members || [] }));

    } catch (err: any) {
      setError(err.message || 'Failed to fetch team members.');
      console.error('Error fetching team members:', err);
    }
  }, [user, setError]);

  const fetchOutgoingInvitations = useCallback(async (teamId: string): Promise<void> => {
    if (!user) return;

    try {
      const response = await fetch(`/api/teams/${teamId}/invitations`, {
        credentials: 'include'
      });
      if (!response.ok) {
        setState((prev) => ({ ...prev, outgoingInvitations: [] }));
        return;
      }
      const data = await response.json();
      setState((prev) => ({ ...prev, outgoingInvitations: data.invitations || [] }));
    } catch (err) {
      console.error('Error fetching outgoing invitations:', err);
      setState((prev) => ({ ...prev, outgoingInvitations: [] }));
    }
  }, [user]);

  // Invite member to team
  const inviteMember = useCallback(async (teamId: string, invitationData: InviteMemberRequest): Promise<boolean> => {
    if (!user) {
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
        credentials: 'include',
        body: JSON.stringify(invitationData),
      });

      if (!response.ok) {
        throw new Error(await parseApiErrorResponse(response, 'Failed to invite member'));
      }

      // Refresh team members
      await fetchTeamMembers(teamId);

      await fetchOutgoingInvitations(teamId);

      return true;

    } catch (err: any) {
      setError(err.message || 'Failed to invite member.');
      console.error('Error inviting member:', err);
      return false;
    } finally {
      setLoading(false);
    }
  }, [user, setLoading, setError, fetchTeamMembers, fetchOutgoingInvitations]);

  const resendTeamInvitation = useCallback(
    async (teamId: string, invitationId: string): Promise<boolean> => {
      if (!user) {
        setError('User not authenticated.');
        return false;
      }

      setLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `/api/teams/${teamId}/invitations/${invitationId}/resend`,
          {
            method: 'POST',
            credentials: 'include'
          }
        );

        if (!response.ok) {
          throw new Error(await parseApiErrorResponse(response, 'Failed to resend invitation'));
        }

        await fetchOutgoingInvitations(teamId);
        return true;
      } catch (err: any) {
        setError(err.message || 'Failed to resend invitation.');
        console.error('Error resending invitation:', err);
        return false;
      } finally {
        setLoading(false);
      }
    },
    [user, setLoading, setError, fetchOutgoingInvitations]
  );

  // Update member role
  const updateMemberRole = useCallback(async (teamId: string, userId: string, roleData: UpdateMemberRoleRequest): Promise<boolean> => {
    if (!user) {
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
        throw new Error(await parseApiErrorResponse(response, 'Failed to update member role'));
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
  }, [user, setLoading, setError, fetchTeamMembers]);

  // Remove member from team
  const removeMember = useCallback(async (teamId: string, userId: string): Promise<boolean> => {
    if (!user) {
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
        throw new Error(await parseApiErrorResponse(response, 'Failed to remove member'));
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
  }, [user, setLoading, setError, fetchTeamMembers]);

  // Fetch team invitations
  const fetchTeamInvitations = useCallback(async () => {
    if (!user) {
      setError('User not authenticated.');
      return;
    }

    try {
      const response = await fetch('/api/teams/invitations', {
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error(await parseApiErrorResponse(response, 'Failed to fetch invitations'));
      }

      const data = await response.json();
      setState(prev => ({ ...prev, teamInvitations: data.invitations || [] }));

    } catch (err: any) {
      setError(err.message || 'Failed to fetch invitations.');
      console.error('Error fetching invitations:', err);
    }
  }, [user, setError]);

  // Accept team invitation
  const acceptInvitation = useCallback(async (invitationToken: string): Promise<boolean> => {
    if (!user) {
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
        throw new Error(await parseApiErrorResponse(response, 'Failed to accept invitation'));
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
  }, [user, setLoading, setError, fetchTeamInvitations]);

  // Fetch team shared content
  const fetchTeamContent = useCallback(async (teamId: string, contentType?: ContentType) => {
    if (!user) {
      setError('User not authenticated.');
      return;
    }

    try {
      const params = new URLSearchParams();
      if (contentType) params.append('type', contentType);

      const response = await fetch(`/api/teams/${teamId}/content?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error(await parseApiErrorResponse(response, 'Failed to fetch team content'));
      }

      const data = await response.json();
      setState(prev => ({ ...prev, teamContent: data.content || [] }));

    } catch (err: any) {
      setError(err.message || 'Failed to fetch team content.');
      console.error('Error fetching team content:', err);
    }
  }, [user, setError]);

  // Share content with team
  const shareContent = useCallback(async (teamId: string, contentData: ShareContentRequest): Promise<boolean> => {
    if (!user) {
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
        throw new Error(await parseApiErrorResponse(response, 'Failed to share content'));
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
  }, [user, setLoading, setError, fetchTeamContent]);

  // Load initial data
  useEffect(() => {
    if (user) {
      fetchUserTeams();
      fetchTeamInvitations();
    }
  }, [user, fetchUserTeams, fetchTeamInvitations]);

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
    fetchOutgoingInvitations,
    resendTeamInvitation,
    user
  };
}
