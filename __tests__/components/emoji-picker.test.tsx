import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { EmojiPicker } from '@/components/ui/emoji-picker'

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

describe('EmojiPicker', () => {
  const mockOnEmojiSelect = jest.fn()
  const mockOnClose = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
    localStorageMock.getItem.mockReturnValue(null)
  })

  it('renders emoji picker when open', () => {
    render(
      <EmojiPicker
        isOpen={true}
        onClose={mockOnClose}
        onEmojiSelect={mockOnEmojiSelect}
      />
    )

    expect(screen.getByText('Choose an emoji')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Search emojis...')).toBeInTheDocument()
  })

  it('does not render when closed', () => {
    render(
      <EmojiPicker
        isOpen={false}
        onClose={mockOnClose}
        onEmojiSelect={mockOnEmojiSelect}
      />
    )

    expect(screen.queryByText('Choose an emoji')).not.toBeInTheDocument()
  })

  it('shows category tabs', () => {
    render(
      <EmojiPicker
        isOpen={true}
        onClose={mockOnClose}
        onEmojiSelect={mockOnEmojiSelect}
      />
    )

    // Check for category buttons (people, animals, food, etc.)
    expect(screen.getByTitle('People')).toBeInTheDocument()
    expect(screen.getByTitle('Animals')).toBeInTheDocument()
    expect(screen.getByTitle('Food')).toBeInTheDocument()
  })

  it('displays emojis for selected category', () => {
    render(
      <EmojiPicker
        isOpen={true}
        onClose={mockOnClose}
        onEmojiSelect={mockOnEmojiSelect}
      />
    )

    // Should show people emojis by default
    expect(screen.getByTitle('😀')).toBeInTheDocument()
    expect(screen.getByTitle('😃')).toBeInTheDocument()
  })

  it('handles emoji selection', () => {
    render(
      <EmojiPicker
        isOpen={true}
        onClose={mockOnClose}
        onEmojiSelect={mockOnEmojiSelect}
      />
    )

    const emojiButton = screen.getByTitle('😀')
    fireEvent.click(emojiButton)

    expect(mockOnEmojiSelect).toHaveBeenCalledWith('😀')
    expect(mockOnClose).toHaveBeenCalled()
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      'recent-emojis',
      JSON.stringify(['😀'])
    )
  })

  it('filters emojis based on search query', async () => {
    render(
      <EmojiPicker
        isOpen={true}
        onClose={mockOnClose}
        onEmojiSelect={mockOnEmojiSelect}
      />
    )

    const searchInput = screen.getByPlaceholderText('Search emojis...')
    fireEvent.change(searchInput, { target: { value: 'smile' } })

    // Wait for search results to update
    await waitFor(() => {
      expect(screen.queryByTitle('😀')).toBeInTheDocument()
    })
  })

  it('loads recent emojis from localStorage', () => {
    localStorageMock.getItem.mockReturnValue(JSON.stringify(['😀', '😃']))

    render(
      <EmojiPicker
        isOpen={true}
        onClose={mockOnClose}
        onEmojiSelect={mockOnEmojiSelect}
      />
    )

    expect(localStorageMock.getItem).toHaveBeenCalledWith('recent-emojis')
  })

  it('shows empty state when no emojis found', async () => {
    render(
      <EmojiPicker
        isOpen={true}
        onClose={mockOnClose}
        onEmojiSelect={mockOnEmojiSelect}
      />
    )

    const searchInput = screen.getByPlaceholderText('Search emojis...')
    fireEvent.change(searchInput, { target: { value: 'nonexistent' } })

    await waitFor(() => {
      expect(screen.getByText('No emojis found for "nonexistent"')).toBeInTheDocument()
    })
  })

  it('switches categories correctly', () => {
    render(
      <EmojiPicker
        isOpen={true}
        onClose={mockOnClose}
        onEmojiSelect={mockOnEmojiSelect}
      />
    )

    const animalsButton = screen.getByTitle('Animals')
    fireEvent.click(animalsButton)

    // Should show animal emojis
    expect(screen.getByTitle('🐶')).toBeInTheDocument()
    expect(screen.getByTitle('🐱')).toBeInTheDocument()
  })

  it('handles keyboard navigation', () => {
    render(
      <EmojiPicker
        isOpen={true}
        onClose={mockOnClose}
        onEmojiSelect={mockOnEmojiSelect}
      />
    )

    const searchInput = screen.getByPlaceholderText('Search emojis...')
    fireEvent.keyDown(searchInput, { key: 'Escape' })

    expect(mockOnClose).toHaveBeenCalled()
  })
})
