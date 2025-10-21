import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { HashtagSuggestions } from '@/components/ui/hashtag-suggestions'

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

describe('HashtagSuggestions', () => {
  const mockOnSelect = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
    localStorageMock.getItem.mockReturnValue(null)
  })

  it('renders hashtag suggestions when visible', () => {
    render(
      <HashtagSuggestions
        content="I love JavaScript programming"
        isVisible={true}
        onSelect={mockOnSelect}
      />
    )

    expect(screen.getByText('Related')).toBeInTheDocument()
    expect(screen.getByText('Trending')).toBeInTheDocument()
  })

  it('does not render when not visible', () => {
    render(
      <HashtagSuggestions
        content="I love JavaScript programming"
        isVisible={false}
        onSelect={mockOnSelect}
      />
    )

    expect(screen.queryByText('Related')).not.toBeInTheDocument()
  })

  it('shows related hashtags based on content', () => {
    render(
      <HashtagSuggestions
        content="I love JavaScript programming"
        isVisible={true}
        onSelect={mockOnSelect}
      />
    )

    // Should show JavaScript-related hashtags
    expect(screen.getByText('#WebDev')).toBeInTheDocument()
    expect(screen.getByText('#Frontend')).toBeInTheDocument()
  })

  it('shows trending hashtags', () => {
    render(
      <HashtagSuggestions
        content=""
        isVisible={true}
        onSelect={mockOnSelect}
      />
    )

    expect(screen.getByText('#AI')).toBeInTheDocument()
    expect(screen.getByText('#TechNews')).toBeInTheDocument()
  })

  it('handles hashtag selection', () => {
    render(
      <HashtagSuggestions
        content="I love JavaScript programming"
        isVisible={true}
        onSelect={mockOnSelect}
      />
    )

    const hashtagBadge = screen.getByText('#WebDev')
    fireEvent.click(hashtagBadge)

    expect(mockOnSelect).toHaveBeenCalledWith('WebDev')
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      'recent-hashtags',
      JSON.stringify(['WebDev'])
    )
  })

  it('loads recent hashtags from localStorage', () => {
    localStorageMock.getItem.mockReturnValue(JSON.stringify(['WebDev', 'JavaScript']))

    render(
      <HashtagSuggestions
        content=""
        isVisible={true}
        onSelect={mockOnSelect}
      />
    )

    expect(screen.getByText('Recent')).toBeInTheDocument()
    expect(screen.getByText('#WebDev')).toBeInTheDocument()
    expect(screen.getByText('#JavaScript')).toBeInTheDocument()
  })

  it('shows follower counts for trending hashtags', () => {
    render(
      <HashtagSuggestions
        content=""
        isVisible={true}
        onSelect={mockOnSelect}
      />
    )

    // Check for follower count display
    expect(screen.getByText('125k')).toBeInTheDocument()
    expect(screen.getByText('89k')).toBeInTheDocument()
  })

  it('prioritizes related hashtags over trending', () => {
    render(
      <HashtagSuggestions
        content="JavaScript programming"
        isVisible={true}
        onSelect={mockOnSelect}
      />
    )

    // Related hashtags should appear first
    const relatedSection = screen.getByText('Related').closest('div')
    const trendingSection = screen.getByText('Trending').closest('div')
    
    expect(relatedSection?.compareDocumentPosition(trendingSection)).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
  })

  it('shows different badge styles for different types', () => {
    render(
      <HashtagSuggestions
        content=""
        isVisible={true}
        onSelect={mockOnSelect}
      />
    )

    const trendingBadge = screen.getByText('#AI').closest('[class*="cursor-pointer"]')
    const recentBadge = screen.getByText('Recent').closest('div')?.querySelector('[class*="cursor-pointer"]')

    expect(trendingBadge).toHaveClass('text-orange-700')
  })

  it('limits suggestions to reasonable number', () => {
    render(
      <HashtagSuggestions
        content="JavaScript React Node.js TypeScript programming development"
        isVisible={true}
        onSelect={mockOnSelect}
      />
    )

    // Should not show too many suggestions
    const hashtagBadges = screen.getAllByText(/^#[A-Za-z]/)
    expect(hashtagBadges.length).toBeLessThanOrEqual(12)
  })

  it('shows empty state when no content', () => {
    render(
      <HashtagSuggestions
        content=""
        isVisible={true}
        onSelect={mockOnSelect}
      />
    )

    // Should still show trending hashtags
    expect(screen.getByText('Trending')).toBeInTheDocument()
  })
})
