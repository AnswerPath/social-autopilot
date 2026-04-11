import { emailAdapter } from '@/lib/notifications/adapters/email'

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

export function buildTeamInviteUrl(token: string): string {
  return `${BASE_URL.replace(/\/$/, '')}/auth?teamInvite=${encodeURIComponent(token)}`
}

export async function sendTeamInvitationEmail(params: {
  to: string
  teamName: string
  role: string
  inviterLabel?: string
  message?: string | null
  expiresAt: Date
  inviteUrl: string
}): Promise<{ success: boolean; error?: string }> {
  const { to, teamName, role, inviterLabel, message, expiresAt, inviteUrl } = params
  const subject = `You're invited to join ${teamName} on Social Autopilot`
  const body = `${inviterLabel || 'A teammate'} invited you to join "${teamName}" on Social Autopilot as ${role}.

${message ? `Message from inviter:\n${message}\n\n` : ''}Open this link to sign in or register with this email address, then your invitation will be accepted automatically:

${inviteUrl}

This invitation expires on ${expiresAt.toUTCString()}.

If you did not expect this invitation, you can ignore this email.`

  return emailAdapter.send(to, subject, body)
}
