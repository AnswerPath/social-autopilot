import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { DraftManagerComponent } from '@/components/draft-manager'
import { DraftManager } from '@/lib/draft-manager'

// Mock the DraftManager
jest.mock('@/lib/draft-manager')
const MockedDraftManager = DraftManager as jest.MockedClass<typeof DraftManager>

// Mock date-fns
jest.mock('date-fns', () => ({
  formatDistanceToNow: jest.fn(() => '2 hours ago')
}))

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
  length: 0,
  key: jest.fn()
}
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
})

// Mock navigator.onLine
Object.defineProperty(navigator, 'onLine', {
  writable: true,
  value: true
})

describe('DraftManagerComponent', () => {
  const mockOnSelectDraft = jest.fn()
  const mockOnClose = jest.fn()
  let mockDraftManagerInstance: any

  beforeEach(() => {
    jest.clearAllMocks()
    localStorageMock.clear()
    
    mockDraftManagerInstance = {
      getDrafts: jest.fn(),
      deleteDraft: jest.fn(),
      removeFromLocalStorage: jest.fn(),
      getAllLocalDrafts: jest.fn(),
      cleanupOldLocalDrafts: jest.fn()
    }

    MockedDraftManager.getInstance.mockReturnValue(mockDraftManagerInstance)
  })

  it('should render loading state initially', () => {
    mockDraftManagerInstance.getDrafts.mockImplementation(() => new Promise(() => {})) // Never resolves
    
    render(
      <DraftManagerComponent 
        onSelectDraft={mockOnSelectDraft} 
        onClose={mockOnClose} 
      />
    )

    expect(screen.getByText('Loading drafts...')).toBeInTheDocument()
  })

  it('should render empty state when no drafts exist', async () => {
    mockDraftManagerInstance.getDrafts.mockResolvedValue({
      drafts: [],
      pagination: { limit: 50, offset: 0, hasMore: false }
    })
    mockDraftManagerInstance.getAllLocalDrafts.mockReturnValue([])

    render(
      <DraftManagerComponent 
        onSelectDraft={mockOnSelectDraft} 
        onClose={mockOnClose} 
      />
    )

    await waitFor(() => {
      expect(screen.getByText('No drafts found')).toBeInTheDocument()
      expect(screen.getByText('Start writing a post to create your first draft. Drafts will be automatically saved as you type.')).toBeInTheDocument()
    })
  })

  it('should render server drafts', async () => {
    const mockDrafts = [
      {
        id: '1',
        content: 'First draft content',
        media_urls: ['media-1'],
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:01:00Z',
        auto_saved: true,
        user_id: 'user-1'
      },
      {
        id: '2',
        content: 'Second draft content',
        media_urls: null,
        created_at: '2023-01-01T00:02:00Z',
        updated_at: '2023-01-01T00:03:00Z',
        auto_saved: false,
        user_id: 'user-1'
      }
    ]

    mockDraftManagerInstance.getDrafts.mockResolvedValue({
      drafts: mockDrafts,
      pagination: { limit: 50, offset: 0, hasMore: false }
    })
    mockDraftManagerInstance.getAllLocalDrafts.mockReturnValue([])

    render(
      <DraftManagerComponent 
        onSelectDraft={mockOnSelectDraft} 
        onClose={mockOnClose} 
      />
    )

    await waitFor(() => {
      expect(screen.getByText('Cloud Drafts')).toBeInTheDocument()
      expect(screen.getByText('First draft content')).toBeInTheDocument()
      expect(screen.getByText('Second draft content')).toBeInTheDocument()
      expect(screen.getByText('Auto-saved')).toBeInTheDocument()
      expect(screen.getByText('1 media')).toBeInTheDocument()
    })
  })

  it('should render local drafts', async () => {
    const mockLocalDrafts = [
      {
        key: 'local-1',
        data: {
          content: 'Local draft content',
          uploadedMediaIds: ['media-1', 'media-2']
        },
        timestamp: Date.now() - 3600000 // 1 hour ago
      }
    ]

    mockDraftManagerInstance.getDrafts.mockResolvedValue({
      drafts: [],
      pagination: { limit: 50, offset: 0, hasMore: false }
    })
    mockDraftManagerInstance.getAllLocalDrafts.mockReturnValue(mockLocalDrafts)

    render(
      <DraftManagerComponent 
        onSelectDraft={mockOnSelectDraft} 
        onClose={mockOnClose} 
      />
    )

    await waitFor(() => {
      expect(screen.getByText('Local Drafts')).toBeInTheDocument()
      expect(screen.getByText('Local draft content')).toBeInTheDocument()
      expect(screen.getByText('Local')).toBeInTheDocument()
      expect(screen.getByText('2 media')).toBeInTheDocument()
    })
  })

  it('should handle draft selection', async () => {
    const mockDraft = {
      id: '1',
      content: 'Test draft',
      media_urls: ['media-1'],
      created_at: '2023-01-01T00:00:00Z',
      updated_at: '2023-01-01T00:01:00Z',
      auto_saved: false,
      user_id: 'user-1'
    }

    mockDraftManagerInstance.getDrafts.mockResolvedValue({
      drafts: [mockDraft],
      pagination: { limit: 50, offset: 0, hasMore: false }
    })
    mockDraftManagerInstance.getAllLocalDrafts.mockReturnValue([])

    render(
      <DraftManagerComponent 
        onSelectDraft={mockOnSelectDraft} 
        onClose={mockOnClose} 
      />
    )

    await waitFor(() => {
      const draftCard = screen.getByText('Test draft').closest('.cursor-pointer')
      fireEvent.click(draftCard!)
    })

    expect(mockOnSelectDraft).toHaveBeenCalledWith(mockDraft)
    expect(mockOnClose).toHaveBeenCalled()
  })

  it('should handle local draft selection', async () => {
    const mockLocalDraft = {
      key: 'local-1',
      data: {
        content: 'Local draft',
        uploadedMediaIds: ['media-1']
      },
      timestamp: Date.now()
    }

    mockDraftManagerInstance.getDrafts.mockResolvedValue({
      drafts: [],
      pagination: { limit: 50, offset: 0, hasMore: false }
    })
    mockDraftManagerInstance.getAllLocalDrafts.mockReturnValue([mockLocalDraft])

    render(
      <DraftManagerComponent 
        onSelectDraft={mockOnSelectDraft} 
        onClose={mockOnClose} 
      />
    )

    await waitFor(() => {
      const draftCard = screen.getByText('Local draft').closest('.cursor-pointer')
      fireEvent.click(draftCard!)
    })

    expect(mockOnSelectDraft).toHaveBeenCalledWith({
      id: 'local_local-1',
      content: 'Local draft',
      media_urls: ['media-1'],
      created_at: expect.any(String),
      updated_at: expect.any(String),
      auto_saved: true,
      user_id: 'local'
    })
    expect(mockOnClose).toHaveBeenCalled()
  })

  it('should handle draft deletion', async () => {
    const mockDraft = {
      id: '1',
      content: 'Test draft',
      media_urls: null,
      created_at: '2023-01-01T00:00:00Z',
      updated_at: '2023-01-01T00:01:00Z',
      auto_saved: false,
      user_id: 'user-1'
    }

    mockDraftManagerInstance.getDrafts.mockResolvedValue({
      drafts: [mockDraft],
      pagination: { limit: 50, offset: 0, hasMore: false }
    })
    mockDraftManagerInstance.getAllLocalDrafts.mockReturnValue([])
    mockDraftManagerInstance.deleteDraft.mockResolvedValue(undefined)

    render(
      <DraftManagerComponent 
        onSelectDraft={mockOnSelectDraft} 
        onClose={mockOnClose} 
      />
    )

    await waitFor(() => {
      const moreButton = screen.getByRole('button', { name: /more/i })
      fireEvent.click(moreButton)
    })

    const deleteButton = screen.getByText('Delete')
    fireEvent.click(deleteButton)

    await waitFor(() => {
      expect(mockDraftManagerInstance.deleteDraft).toHaveBeenCalledWith('1')
    })
  })

  it('should handle local draft deletion', async () => {
    const mockLocalDraft = {
      key: 'local-1',
      data: {
        content: 'Local draft',
        uploadedMediaIds: []
      },
      timestamp: Date.now()
    }

    mockDraftManagerInstance.getDrafts.mockResolvedValue({
      drafts: [],
      pagination: { limit: 50, offset: 0, hasMore: false }
    })
    mockDraftManagerInstance.getAllLocalDrafts.mockReturnValue([mockLocalDraft])

    render(
      <DraftManagerComponent 
        onSelectDraft={mockOnSelectDraft} 
        onClose={mockOnClose} 
      />
    )

    await waitFor(() => {
      const moreButton = screen.getByRole('button', { name: /more/i })
      fireEvent.click(moreButton)
    })

    const deleteButton = screen.getByText('Delete')
    fireEvent.click(deleteButton)

    expect(mockDraftManagerInstance.removeFromLocalStorage).toHaveBeenCalledWith('local-1')
  })

  it('should show offline status when offline', () => {
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: false
    })

    mockDraftManagerInstance.getDrafts.mockResolvedValue({
      drafts: [],
      pagination: { limit: 50, offset: 0, hasMore: false }
    })
    mockDraftManagerInstance.getAllLocalDrafts.mockReturnValue([])

    render(
      <DraftManagerComponent 
        onSelectDraft={mockOnSelectDraft} 
        onClose={mockOnClose} 
      />
    )

    expect(screen.getByText('Offline')).toBeInTheDocument()
  })

  it('should show online status when online', async () => {
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: true
    })

    mockDraftManagerInstance.getDrafts.mockResolvedValue({
      drafts: [],
      pagination: { limit: 50, offset: 0, hasMore: false }
    })
    mockDraftManagerInstance.getAllLocalDrafts.mockReturnValue([])

    render(
      <DraftManagerComponent 
        onSelectDraft={mockOnSelectDraft} 
        onClose={mockOnClose} 
      />
    )

    await waitFor(() => {
      expect(screen.getByText('Online')).toBeInTheDocument()
    })
  })

  it('should handle errors gracefully', async () => {
    mockDraftManagerInstance.getDrafts.mockRejectedValue(new Error('Network error'))
    mockDraftManagerInstance.getAllLocalDrafts.mockReturnValue([])

    // Mock console.error to avoid noise in test output
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation()

    render(
      <DraftManagerComponent 
        onSelectDraft={mockOnSelectDraft} 
        onClose={mockOnClose} 
      />
    )

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith('Failed to load drafts:', expect.any(Error))
    })

    consoleSpy.mockRestore()
  })
})
