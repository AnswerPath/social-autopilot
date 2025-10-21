import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MentionSuggestions } from '@/components/ui/mention-suggestions'

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
}
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
})

describe('MentionSuggestions', () => {
  const mockOnSelect = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
    localStorageMock.getItem.mockReturnValue(null)
  })

  it('renders mention suggestions when visible', () => {
    render(
      <MentionSuggestions
        query="john"
        isVisible={true}
        onSelect={mockOnSelect}
      />
    )

    expect(screen.getByText('John Doe')).toBeInTheDocument()
    expect(screen.getByText('@john_doe')).toBeInTheDocument()
  })

  it('does not render when not visible', () => {
    render(
      <MentionSuggestions
        query="john"
        isVisible={false}
        onSelect={mockOnSelect}
      />
    )

    expect(screen.queryByText('John Doe')).not.toBeInTheDocument()
  })

  it('filters users based on query', () => {
    render(
      <MentionSuggestions
        query="tech"
        isVisible={true}
        onSelect={mockOnSelect}
      />
    )

    expect(screen.getByText('Tech Guru')).toBeInTheDocument()
    expect(screen.queryByText('John Doe')).not.toBeInTheDocument()
  })

  it('shows user avatars and verification badges', () => {
    render(
      <MentionSuggestions
        query="john"
        isVisible={true}
        onSelect={mockOnSelect}
      />
    )

    // Check for avatar
    const avatar = screen.getByAltText('John Doe')
    expect(avatar).toBeInTheDocument()

    // Check for verification badge
    const verifiedBadge = screen.getByText('John Doe').closest('div')?.querySelector('[class*="text-blue-500"]')
    expect(verifiedBadge).toBeInTheDocument()
  })

  it('handles user selection', () => {
    render(
      <MentionSuggestions
        query="john"
        isVisible={true}
        onSelect={mockOnSelect}
      />
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
      type: 'connection'
    })
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      'recent-mentions',
      JSON.stringify(['john_doe'])
    )
  })

  it('loads recent mentions from localStorage', () => {
    localStorageMock.getItem.mockReturnValue(JSON.stringify(['john_doe', 'jane_smith']))

    render(
      <MentionSuggestions
        query=""
        isVisible={true}
        onSelect={mockOnSelect}
      />
    )

    expect(screen.getByText('Recent')).toBeInTheDocument()
    expect(screen.getByText('John Doe')).toBeInTheDocument()
    expect(screen.getByText('Jane Smith')).toBeInTheDocument()
  })

  it('shows follower counts', () => {
    render(
      <MentionSuggestions
        query="john"
        isVisible={true}
        onSelect={mockOnSelect}
      />
    )

    expect(screen.getByText('125K followers')).toBeInTheDocument()
  })

  it('shows different badge types', () => {
    render(
      <MentionSuggestions
        query=""
        isVisible={true}
        onSelect={mockOnSelect}
      />
    )

    // Should show "Following" badge for connections
    expect(screen.getByText('Following')).toBeInTheDocument()
    
    // Should show "Suggested" badge for suggested users
    expect(screen.getByText('Suggested')).toBeInTheDocument()
  })

  it('prioritizes connections over suggested users', () => {
    render(
      <MentionSuggestions
        query=""
        isVisible={true}
        onSelect={mockOnSelect}
      />
    )

    // Connections should appear first
    const followingBadges = screen.getAllByText('Following')
    const suggestedBadges = screen.getAllByText('Suggested')
    
    expect(followingBadges.length).toBeGreaterThan(0)
    expect(suggestedBadges.length).toBeGreaterThan(0)
  })

  it('shows avatar fallback when no image', () => {
    render(
      <MentionSuggestions
        query="john"
        isVisible={true}
        onSelect={mockOnSelect}
      />
    )

    // Should show initials fallback
    expect(screen.getByText('JD')).toBeInTheDocument()
  })

  it('limits suggestions to reasonable number', () => {
    render(
      <MentionSuggestions
        query=""
        isVisible={true}
        onSelect={mockOnSelect}
      />
    )

    // Should not show too many suggestions
    const userCards = screen.getAllByText(/@\w+/)
    expect(userCards.length).toBeLessThanOrEqual(8)
  })

  it('shows empty state when no matches', () => {
    render(
      <MentionSuggestions
        query="nonexistent"
        isVisible={true}
        onSelect={mockOnSelect}
      />
    )

    // Should not show any users
    expect(screen.queryByText(/@\w+/)).not.toBeInTheDocument()
  })

  it('formats follower counts correctly', () => {
    render(
      <MentionSuggestions
        query="john"
        isVisible={true}
        onSelect={mockOnSelect}
      />
    )

    // Test different follower count formats
    expect(screen.getByText('125K followers')).toBeInTheDocument()
    expect(screen.getByText('45K followers')).toBeInTheDocument()
  })
})
