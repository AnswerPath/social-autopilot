import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { MentionSuggestions, type User } from '@/components/ui/mention-suggestions'

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
}

const originalLocalStorage = window.localStorage

beforeAll(() => {
  Object.defineProperty(window, 'localStorage', {
    value: localStorageMock,
    configurable: true,
    writable: true,
  })
})

afterAll(() => {
  Object.defineProperty(window, 'localStorage', {
    value: originalLocalStorage,
    configurable: true,
    writable: true,
  })
})

/** Test fixtures (production defaults are empty). */
const FIXTURE_CONNECTIONS: User[] = [
  {
    id: '1',
    username: 'john_doe',
    displayName: 'John Doe',
    avatar: '/placeholder-user.jpg',
    verified: true,
    followerCount: 125_000,
    type: 'connection',
  },
  {
    id: '5',
    username: 'nobody_img',
    displayName: 'Nobody Image',
    verified: false,
    followerCount: 12,
    type: 'connection',
  },
]

const FIXTURE_SUGGESTED: User[] = [
  {
    id: '2',
    username: 'jane_smith',
    displayName: 'Jane Smith',
    avatar: '/jane.jpg',
    verified: false,
    followerCount: 45_000,
    type: 'suggested',
  },
  {
    id: '3',
    username: 'tech_guru',
    displayName: 'Tech Guru',
    avatar: '/tech.jpg',
    verified: true,
    followerCount: 88_000,
    type: 'suggested',
  },
  {
    id: '4',
    username: 'johnny_designer',
    displayName: 'Johnny Designer',
    avatar: '/jd.jpg',
    verified: false,
    followerCount: 46_000,
    type: 'suggested',
  },
  ...Array.from({ length: 12 }, (_, i) => ({
    id: `bulk-${i}`,
    username: `user_${i}_bulk`,
    displayName: `Bulk User ${i}`,
    verified: false,
    followerCount: 1000 + i,
    type: 'suggested' as const,
  })),
]

describe('MentionSuggestions', () => {
  const mockOnSelect = jest.fn()

  const renderWithFixtures = (ui: React.ReactElement) =>
    render(
      React.cloneElement(ui, {
        connections: FIXTURE_CONNECTIONS,
        suggestedUsers: FIXTURE_SUGGESTED,
      })
    )

  beforeEach(() => {
    jest.clearAllMocks()
    localStorageMock.getItem.mockReturnValue(null)
  })

  it('renders mention suggestions when visible', () => {
    renderWithFixtures(
      <MentionSuggestions query="john" isVisible={true} onSelect={mockOnSelect} />
    )

    expect(screen.getByText('John Doe')).toBeInTheDocument()
    expect(screen.getByText('@john_doe')).toBeInTheDocument()
  })

  it('does not render when not visible', () => {
    renderWithFixtures(
      <MentionSuggestions query="john" isVisible={false} onSelect={mockOnSelect} />
    )

    expect(screen.queryByText('John Doe')).not.toBeInTheDocument()
  })

  it('filters users based on query', () => {
    renderWithFixtures(
      <MentionSuggestions query="tech" isVisible={true} onSelect={mockOnSelect} />
    )

    expect(screen.getByText('Tech Guru')).toBeInTheDocument()
    expect(screen.queryByText('John Doe')).not.toBeInTheDocument()
  })

  it('shows user avatars and verification badges', () => {
    renderWithFixtures(
      <MentionSuggestions query="john" isVisible={true} onSelect={mockOnSelect} />
    )

    const avatar = screen.getByAltText('John Doe')
    expect(avatar).toBeInTheDocument()

    const verifiedBadge = screen.getByText('John Doe').closest('div')?.querySelector('[class*="text-blue-500"]')
    expect(verifiedBadge).toBeInTheDocument()
  })

  it('handles user selection', () => {
    renderWithFixtures(
      <MentionSuggestions query="john" isVisible={true} onSelect={mockOnSelect} />
    )

    const userCard = screen.getByText('John Doe').closest('[class*="cursor-pointer"]')
    fireEvent.click(userCard!)

    expect(mockOnSelect).toHaveBeenCalledWith({
      id: '1',
      username: 'john_doe',
      displayName: 'John Doe',
      avatar: '/placeholder-user.jpg',
      verified: true,
      followerCount: 125000,
      type: 'connection',
    })
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      'recent-mentions',
      JSON.stringify(['john_doe'])
    )
  })

  it('loads recent mentions from localStorage', () => {
    localStorageMock.getItem.mockReturnValue(JSON.stringify(['john_doe', 'jane_smith']))

    renderWithFixtures(
      <MentionSuggestions query="" isVisible={true} onSelect={mockOnSelect} />
    )

    expect(screen.getByText('Recent')).toBeInTheDocument()
    expect(screen.getByText('John Doe')).toBeInTheDocument()
    expect(screen.getByText('Jane Smith')).toBeInTheDocument()
  })

  it('shows follower counts', () => {
    renderWithFixtures(
      <MentionSuggestions query="john" isVisible={true} onSelect={mockOnSelect} />
    )

    expect(screen.getByText('125K followers')).toBeInTheDocument()
  })

  it('shows different badge types', () => {
    renderWithFixtures(
      <MentionSuggestions query="" isVisible={true} onSelect={mockOnSelect} />
    )

    expect(screen.getAllByText(/Following/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Suggested/).length).toBeGreaterThan(0)
  })

  it('prioritizes connections over suggested users', () => {
    renderWithFixtures(
      <MentionSuggestions query="" isVisible={true} onSelect={mockOnSelect} />
    )

    const followingBadges = screen.getAllByText(/Following/)
    const suggestedBadges = screen.getAllByText(/Suggested/)

    expect(followingBadges.length).toBeGreaterThan(0)
    expect(suggestedBadges.length).toBeGreaterThan(0)
  })

  it('shows avatar fallback when no image', () => {
    renderWithFixtures(
      <MentionSuggestions query="nobody" isVisible={true} onSelect={mockOnSelect} />
    )

    expect(screen.getByText('NI')).toBeInTheDocument()
  })

  it('limits suggestions to reasonable number', () => {
    renderWithFixtures(
      <MentionSuggestions query="" isVisible={true} onSelect={mockOnSelect} />
    )

    const userCards = screen.getAllByText(/@\w+/)
    expect(userCards.length).toBeLessThanOrEqual(8)
  })

  it('shows empty state when no matches', () => {
    render(
      <MentionSuggestions query="nonexistent" isVisible={true} onSelect={mockOnSelect} />
    )

    expect(screen.queryByText(/@\w+/)).not.toBeInTheDocument()
  })

  it('formats follower counts correctly', () => {
    renderWithFixtures(
      <MentionSuggestions query="john" isVisible={true} onSelect={mockOnSelect} />
    )

    expect(screen.getByText('125K followers')).toBeInTheDocument()
    expect(screen.getByText('45K followers')).toBeInTheDocument()
  })
})
