export const SECTION_HELP: Record<string, { title: string; body: string }> = {
  dashboard: {
    title: 'Dashboard',
    body: 'Your home base. Here you see recent posts, mentions, and quick actions. Use "Create Post" to compose a new post or open the Calendar to schedule one.',
  },
  calendar: {
    title: 'Content Calendar',
    body: 'Manage and schedule your content. Create posts, pick publish times, and see your content pipeline. Drag and drop to reschedule.',
  },
  approvals: {
    title: 'Approvals',
    body: 'Multi-step approval workflows. Review and approve posts before they go live. Manage pending and history here.',
  },
  analytics: {
    title: 'Analytics',
    body: 'Insights and performance metrics. View engagement, reach, and trends for your posts and account.',
  },
  engagement: {
    title: 'Engagement Monitor',
    body: 'Monitor mentions and set up auto-replies. Create rules to automatically respond to mentions and manage flagged content.',
  },
  team: {
    title: 'Team Management',
    body: 'Manage team members and permissions. Invite users, assign roles, and control access to content and features.',
  },
  settings: {
    title: 'Settings',
    body: 'Manage integrations (X API, Apify), notifications, and security. Connect your X account under Integrations.',
  },
}

export function getHelpForSection(sectionId: string): { title: string; body: string } | null {
  return SECTION_HELP[sectionId] ?? null
}
