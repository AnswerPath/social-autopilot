export const TOUR_ELEMENT_IDS = ['dashboard', 'calendar', 'engagement', 'analytics', 'settings'] as const

export const getTourSteps = () => [
  {
    element: '[data-tour="dashboard"]',
    popover: {
      title: 'Dashboard',
      description: 'Your home base. See recent activity, mentions, and quick actions here.',
      side: 'right' as const,
      align: 'start' as const,
    },
  },
  {
    element: '[data-tour="calendar"]',
    popover: {
      title: 'Schedule posts',
      description: 'Use the Calendar to create and schedule your first post. Pick a time and we\'ll publish for you.',
      side: 'right' as const,
      align: 'start' as const,
    },
  },
  {
    element: '[data-tour="engagement"]',
    popover: {
      title: 'Automation',
      description: 'Set up auto-replies and manage engagement. Automate responses to mentions and messages.',
      side: 'right' as const,
      align: 'start' as const,
    },
  },
  {
    element: '[data-tour="analytics"]',
    popover: {
      title: 'Analytics',
      description: 'View performance, engagement metrics, and insights for your posts.',
      side: 'right' as const,
      align: 'start' as const,
    },
  },
  {
    element: '[data-tour="settings"]',
    popover: {
      title: 'Settings',
      description: 'Connect X, manage integrations, and customize your account in Settings.',
      side: 'right' as const,
      align: 'start' as const,
    },
  },
]
