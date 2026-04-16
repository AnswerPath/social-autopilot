import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { HashtagSuggestions } from '@/components/ui/hashtag-suggestions'

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
}
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
})

const FIXTURE_TRENDING = [
  { tag: 'AI', count: 125_000, type: 'trending' as const },
  { tag: 'TechNews', count: 89_000, type: 'trending' as const },
  { tag: 'Tag3', count: 50_000, type: 'trending' as const },
  { tag: 'Tag4', count: 40_000, type: 'trending' as const },
  { tag: 'Tag5', count: 30_000, type: 'trending' as const },
]

describe('HashtagSuggestions', () => {
  const mockOnSelect = jest.fn()

  const renderWithTrending = (ui: React.ReactElement) =>
    render(React.cloneElement(ui, { trendingHashtags: FIXTURE_TRENDING }))

  beforeEach(() => {
    jest.clearAllMocks()
    localStorageMock.getItem.mockReturnValue(null)
  })

  it('renders hashtag suggestions when visible', () => {
    renderWithTrending(
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
    renderWithTrending(
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

    expect(screen.getByText('#WebDev')).toBeInTheDocument()
    expect(screen.getByText('#Frontend')).toBeInTheDocument()
  })

  it('shows trending hashtags', () => {
    renderWithTrending(
      <HashtagSuggestions content="" isVisible={true} onSelect={mockOnSelect} />
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

    renderWithTrending(<HashtagSuggestions content="" isVisible={true} onSelect={mockOnSelect} />)

    expect(screen.getByText('Recent')).toBeInTheDocument()
    expect(screen.getByText('#WebDev')).toBeInTheDocument()
    expect(screen.getByText('#JavaScript')).toBeInTheDocument()
  })

  it('shows follower counts for trending hashtags', () => {
    renderWithTrending(<HashtagSuggestions content="" isVisible={true} onSelect={mockOnSelect} />)

    expect(screen.getByText('125k')).toBeInTheDocument()
    expect(screen.getByText('89k')).toBeInTheDocument()
  })

  it('prioritizes related hashtags over trending', () => {
    renderWithTrending(
      <HashtagSuggestions content="JavaScript programming" isVisible={true} onSelect={mockOnSelect} />
    )

    const relatedSection = screen.getByText('Related').closest('div')
    const trendingSection = screen.getByText('Trending').closest('div')

    expect(relatedSection?.compareDocumentPosition(trendingSection!)).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
  })

  it('shows different badge styles for different types', () => {
    renderWithTrending(<HashtagSuggestions content="" isVisible={true} onSelect={mockOnSelect} />)

    const trendingBadge = screen.getByText('#AI').closest('[class*="cursor-pointer"]')

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

    const hashtagBadges = screen.getAllByText(/^#[A-Za-z]/)
    expect(hashtagBadges.length).toBeLessThanOrEqual(12)
  })

  it('shows empty state when no content', () => {
    renderWithTrending(<HashtagSuggestions content="" isVisible={true} onSelect={mockOnSelect} />)

    expect(screen.getByText('Trending')).toBeInTheDocument()
  })
})
