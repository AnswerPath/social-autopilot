import { DraftManager, type DraftFormData } from '@/lib/draft-manager'

// Mock fetch for testing
global.fetch = jest.fn()

describe('DraftManager', () => {
  let draftManager: DraftManager

  beforeEach(() => {
    draftManager = DraftManager.getInstance()
    jest.clearAllMocks()
    localStorage.clear()
  })

  describe('Auto-save functionality', () => {
    beforeEach(() => {
      jest.useFakeTimers()
    })

    afterEach(() => {
      jest.useRealTimers()
    })

    it('should configure auto-save options', () => {
      draftManager.configureAutoSave({
        enabled: false,
        interval: 10000,
        debounceDelay: 1000
      })

      expect(draftManager['autoSaveOptions']).toEqual({
        enabled: false,
        interval: 10000,
        debounceDelay: 1000
      })
    })

    it('should start auto-save with correct interval', () => {
      const mockFetch = fetch as jest.MockedFunction<typeof fetch>
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, draft: { id: '1', content: 'test' } })
      } as Response)

      draftManager.startAutoSave('draft-1', 'test content', ['media-1'])

      // Fast-forward time to trigger auto-save
      jest.advanceTimersByTime(30000)

      expect(mockFetch).toHaveBeenCalledWith('/api/drafts/draft-1', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: 'test content',
          mediaUrls: ['media-1'],
          autoSave: true
        })
      })
    })

    it('should trigger debounced auto-save', () => {
      const mockFetch = fetch as jest.MockedFunction<typeof fetch>
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, draft: { id: '1', content: 'test' } })
      } as Response)

      draftManager.startAutoSave('draft-1', 'initial content')
      draftManager.triggerAutoSave('updated content', ['media-1'])

      // Fast-forward debounce delay
      jest.advanceTimersByTime(2000)

      expect(mockFetch).toHaveBeenCalledWith('/api/drafts/draft-1', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: 'updated content',
          mediaUrls: ['media-1'],
          autoSave: true
        })
      })
    })

    it('should not auto-save if content has not changed', () => {
      const mockFetch = fetch as jest.MockedFunction<typeof fetch>
      
      draftManager.startAutoSave('draft-1', 'test content', ['media-1'])
      draftManager.triggerAutoSave('test content', ['media-1'])

      jest.advanceTimersByTime(2000)

      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('should stop auto-save when stopAutoSave is called', () => {
      draftManager.startAutoSave('draft-1', 'test content')
      draftManager.stopAutoSave()

      jest.advanceTimersByTime(30000)

      expect(draftManager['autoSaveTimer']).toBeNull()
    })
  })

  describe('Draft CRUD operations', () => {
    it('should create a new draft', async () => {
      const mockFetch = fetch as jest.MockedFunction<typeof fetch>
      const mockDraft = {
        id: '1',
        content: 'test content',
        media_urls: ['media-1'],
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z',
        auto_saved: false,
        user_id: 'user-1'
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, draft: mockDraft })
      } as Response)

      const formData: DraftFormData = {
        content: 'test content',
        mediaAttachments: [],
        uploadedMediaIds: ['media-1']
      }

      const result = await draftManager.createDraft(formData)

      expect(mockFetch).toHaveBeenCalledWith('/api/drafts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: 'test content',
          mediaUrls: ['media-1'],
          autoSave: false
        })
      })
      expect(result).toEqual(mockDraft)
    })

    it('should update an existing draft', async () => {
      const mockFetch = fetch as jest.MockedFunction<typeof fetch>
      const mockDraft = {
        id: '1',
        content: 'updated content',
        media_urls: ['media-1', 'media-2'],
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:01:00Z',
        auto_saved: false,
        user_id: 'user-1'
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, draft: mockDraft })
      } as Response)

      const formData: DraftFormData = {
        content: 'updated content',
        mediaAttachments: [],
        uploadedMediaIds: ['media-1', 'media-2']
      }

      const result = await draftManager.updateDraft('1', formData)

      expect(mockFetch).toHaveBeenCalledWith('/api/drafts/1', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: 'updated content',
          mediaUrls: ['media-1', 'media-2'],
          autoSave: false
        })
      })
      expect(result).toEqual(mockDraft)
    })

    it('should delete a draft', async () => {
      const mockFetch = fetch as jest.MockedFunction<typeof fetch>
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, message: 'Draft deleted successfully' })
      } as Response)

      await draftManager.deleteDraft('1')

      expect(mockFetch).toHaveBeenCalledWith('/api/drafts/1', {
        method: 'DELETE'
      })
    })

    it('should get all drafts with pagination', async () => {
      const mockFetch = fetch as jest.MockedFunction<typeof fetch>
      const mockDrafts = [
        {
          id: '1',
          content: 'draft 1',
          media_urls: null,
          created_at: '2023-01-01T00:00:00Z',
          updated_at: '2023-01-01T00:00:00Z',
          auto_saved: false,
          user_id: 'user-1'
        },
        {
          id: '2',
          content: 'draft 2',
          media_urls: ['media-1'],
          created_at: '2023-01-01T00:01:00Z',
          updated_at: '2023-01-01T00:01:00Z',
          auto_saved: true,
          user_id: 'user-1'
        }
      ]

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          drafts: mockDrafts,
          pagination: { limit: 50, offset: 0, hasMore: false }
        })
      } as Response)

      const result = await draftManager.getDrafts(50, 0)

      expect(mockFetch).toHaveBeenCalledWith('/api/drafts?limit=50&offset=0')
      expect(result.drafts).toEqual(mockDrafts)
      expect(result.pagination).toEqual({ limit: 50, offset: 0, hasMore: false })
    })

    it('should get a specific draft', async () => {
      const mockFetch = fetch as jest.MockedFunction<typeof fetch>
      const mockDraft = {
        id: '1',
        content: 'test content',
        media_urls: ['media-1'],
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z',
        auto_saved: false,
        user_id: 'user-1'
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, draft: mockDraft })
      } as Response)

      const result = await draftManager.getDraft('1')

      expect(mockFetch).toHaveBeenCalledWith('/api/drafts/1')
      expect(result).toEqual(mockDraft)
    })
  })

  describe('Local storage functionality', () => {
    it('should save draft to local storage', () => {
      const formData: DraftFormData = {
        content: 'test content',
        mediaAttachments: [],
        uploadedMediaIds: ['media-1']
      }

      draftManager.saveToLocalStorage('test-key', formData)

      const stored = localStorage.getItem('draft_test-key')
      expect(stored).toBeTruthy()
      
      const parsed = JSON.parse(stored!)
      expect(parsed.content).toBe('test content')
      expect(parsed.uploadedMediaIds).toEqual(['media-1'])
      expect(parsed.timestamp).toBeDefined()
    })

    it('should retrieve draft from local storage', () => {
      const formData: DraftFormData = {
        content: 'test content',
        mediaAttachments: [],
        uploadedMediaIds: ['media-1']
      }

      draftManager.saveToLocalStorage('test-key', formData)
      const retrieved = draftManager.getFromLocalStorage('test-key')

      expect(retrieved).toEqual(formData)
    })

    it('should return null for non-existent local draft', () => {
      const retrieved = draftManager.getFromLocalStorage('non-existent')
      expect(retrieved).toBeNull()
    })

    it('should remove draft from local storage', () => {
      const formData: DraftFormData = {
        content: 'test content',
        mediaAttachments: [],
        uploadedMediaIds: []
      }

      draftManager.saveToLocalStorage('test-key', formData)
      expect(localStorage.getItem('draft_test-key')).toBeTruthy()

      draftManager.removeFromLocalStorage('test-key')
      expect(localStorage.getItem('draft_test-key')).toBeNull()
    })

    it('should get all local drafts', () => {
      const formData1: DraftFormData = {
        content: 'draft 1',
        mediaAttachments: [],
        uploadedMediaIds: []
      }
      const formData2: DraftFormData = {
        content: 'draft 2',
        mediaAttachments: [],
        uploadedMediaIds: ['media-1']
      }

      draftManager.saveToLocalStorage('key1', formData1)
      draftManager.saveToLocalStorage('key2', formData2)

      const allDrafts = draftManager.getAllLocalDrafts()
      expect(allDrafts).toHaveLength(2)
      expect(allDrafts[0].key).toBe('key2') // Should be sorted by timestamp (newest first)
      expect(allDrafts[1].key).toBe('key1')
    })

    it('should cleanup old local drafts', () => {
      const oldTimestamp = Date.now() - (8 * 24 * 60 * 60 * 1000) // 8 days ago
      const recentTimestamp = Date.now() - (3 * 24 * 60 * 60 * 1000) // 3 days ago

      // Manually set old draft
      localStorage.setItem('draft_old', JSON.stringify({
        content: 'old draft',
        timestamp: oldTimestamp
      }))

      // Set recent draft
      const formData: DraftFormData = {
        content: 'recent draft',
        mediaAttachments: [],
        uploadedMediaIds: []
      }
      draftManager.saveToLocalStorage('recent', formData)

      draftManager.cleanupOldLocalDrafts()

      expect(localStorage.getItem('draft_old')).toBeNull()
      expect(localStorage.getItem('draft_recent')).toBeTruthy()
    })
  })

  describe('Error handling', () => {
    it('should handle fetch errors gracefully', async () => {
      const mockFetch = fetch as jest.MockedFunction<typeof fetch>
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      const formData: DraftFormData = {
        content: 'test content',
        mediaAttachments: [],
        uploadedMediaIds: []
      }

      await expect(draftManager.createDraft(formData)).rejects.toThrow('Failed to create draft')
    })

    it('should handle non-ok responses', async () => {
      const mockFetch = fetch as jest.MockedFunction<typeof fetch>
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'Internal server error'
      } as Response)

      const formData: DraftFormData = {
        content: 'test content',
        mediaAttachments: [],
        uploadedMediaIds: []
      }

      await expect(draftManager.createDraft(formData)).rejects.toThrow('Failed to create draft')
    })
  })
})
