import type { MediaAttachment } from '@/lib/media-validation'

export interface Draft {
  id: string
  content: string
  media_urls: string[] | null
  created_at: string
  updated_at: string
  auto_saved: boolean
  user_id: string
}

export interface DraftFormData {
  content: string
  mediaAttachments: MediaAttachment[]
  uploadedMediaIds: string[]
}

export interface AutoSaveOptions {
  enabled: boolean
  interval: number // milliseconds
  debounceDelay: number // milliseconds
}

export interface ConflictResolution {
  strategy: 'last-write-wins' | 'merge' | 'manual'
  lastModified: string
  conflictData?: {
    localContent: string
    serverContent: string
    localMediaIds: string[]
    serverMediaIds: string[]
  }
}

export class DraftManager {
  private static instance: DraftManager
  private autoSaveTimer: NodeJS.Timeout | null = null
  private debounceTimer: NodeJS.Timeout | null = null
  private currentDraftId: string | null = null
  private lastSavedContent: string = ''
  private lastSavedMediaIds: string[] = []
  private lastServerVersion: string | null = null
  private hasPendingInitialSave = false
  private autoSaveOptions: AutoSaveOptions = {
    enabled: true,
    interval: 30000, // 30 seconds
    debounceDelay: 2000 // 2 seconds
  }
  private lastLocalSaveTimestamp = 0

  static getInstance(): DraftManager {
    if (typeof process !== 'undefined' && process.env.NODE_ENV === 'test') {
      return new DraftManager()
    }

    if (!DraftManager.instance) {
      DraftManager.instance = new DraftManager()
    }
    return DraftManager.instance
  }

  // Configure auto-save settings
  configureAutoSave(options: Partial<AutoSaveOptions>) {
    this.autoSaveOptions = { ...this.autoSaveOptions, ...options }
  }

  // Start auto-save for a draft
  startAutoSave(draftId: string, content: string, mediaIds: string[] = []) {
    this.stopAutoSave()
    this.currentDraftId = draftId
    this.lastSavedContent = content
    this.lastSavedMediaIds = mediaIds
    this.hasPendingInitialSave = true

    if (!this.autoSaveOptions.enabled) return

    this.autoSaveTimer = setInterval(() => {
      this.performAutoSave()
    }, this.autoSaveOptions.interval)
  }

  // Stop auto-save
  stopAutoSave() {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer)
      this.autoSaveTimer = null
    }
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
      this.debounceTimer = null
    }
    this.hasPendingInitialSave = false
  }

  // Trigger debounced auto-save
  triggerAutoSave(content: string, mediaIds: string[] = []) {
    if (!this.autoSaveOptions.enabled || !this.currentDraftId) return

    // Clear existing debounce timer
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
    }

    // Set new debounce timer
    this.debounceTimer = setTimeout(() => {
      this.performAutoSave(content, mediaIds)
    }, this.autoSaveOptions.debounceDelay)
  }

  // Perform the actual auto-save
  private async performAutoSave(content?: string, mediaIds?: string[]) {
    if (!this.currentDraftId) return

    const isManualInvocation = content !== undefined || mediaIds !== undefined

    const contentToSave = content ?? this.lastSavedContent
    const mediaIdsToSave = mediaIds ?? this.lastSavedMediaIds

    // Only save if content has changed
    const contentChanged =
      contentToSave !== this.lastSavedContent ||
      JSON.stringify(mediaIdsToSave) !== JSON.stringify(this.lastSavedMediaIds)

    if ((isManualInvocation || !this.hasPendingInitialSave) && !contentChanged) {
      return
    }

    try {
      const response = await fetch(`/api/drafts/${this.currentDraftId}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          content: contentToSave,
          mediaUrls: mediaIdsToSave,
          autoSave: true
        })
      })

      if (response.ok) {
        this.lastSavedContent = contentToSave
        this.lastSavedMediaIds = mediaIdsToSave
        this.lastServerVersion = response.headers.get('Last-Modified')
        this.hasPendingInitialSave = false
        console.log('Draft auto-saved successfully')
      } else if (response.status === 409) {
        // Conflict detected - handle it
        await this.handleConflict(contentToSave, mediaIdsToSave)
      } else {
        console.error('Failed to auto-save draft:', await response.text())
      }
    } catch (error) {
      console.error('Error auto-saving draft:', error)
    }
  }

  // Handle conflict resolution
  private async handleConflict(localContent: string, localMediaIds: string[]) {
    try {
      // Get the current server version
      const serverDraft = await this.getDraft(this.currentDraftId!)
      
      const conflictResolution: ConflictResolution = {
        strategy: 'last-write-wins', // Default strategy
        lastModified: serverDraft.updated_at,
        conflictData: {
          localContent,
          serverContent: serverDraft.content,
          localMediaIds,
          serverMediaIds: serverDraft.media_urls || []
        }
      }

      // For now, use last-write-wins strategy
      // In a real app, you might want to show a conflict resolution UI
      console.warn('Draft conflict detected:', conflictResolution)
      
      // Update local state to match server
      this.lastSavedContent = serverDraft.content
      this.lastSavedMediaIds = serverDraft.media_urls || []
      this.lastServerVersion = serverDraft.updated_at

      // Dispatch custom event for UI to handle
      window.dispatchEvent(new CustomEvent('draft-conflict', {
        detail: conflictResolution
      }))

    } catch (error) {
      console.error('Error handling draft conflict:', error)
    }
  }

  // Check for conflicts before updating
  async checkForConflicts(draftId: string, localContent: string, localMediaIds: string[]): Promise<ConflictResolution | null> {
    try {
      const serverDraft = await this.getDraft(draftId)
      
      // Check if server version is newer than our last known version
      if (this.lastServerVersion && serverDraft.updated_at > this.lastServerVersion) {
        // Check if content has diverged
        if (serverDraft.content !== localContent || 
            JSON.stringify(serverDraft.media_urls || []) !== JSON.stringify(localMediaIds)) {
          
          return {
            strategy: 'manual',
            lastModified: serverDraft.updated_at,
            conflictData: {
              localContent,
              serverContent: serverDraft.content,
              localMediaIds,
              serverMediaIds: serverDraft.media_urls || []
            }
          }
        }
      }
      
      return null
    } catch (error) {
      console.error('Error checking for conflicts:', error)
      return null
    }
  }

  // Resolve conflict with user choice
  async resolveConflict(draftId: string, resolution: ConflictResolution, userChoice: 'local' | 'server' | 'merge'): Promise<Draft> {
    try {
      let finalContent: string
      let finalMediaIds: string[]

      switch (userChoice) {
        case 'local':
          finalContent = resolution.conflictData!.localContent
          finalMediaIds = resolution.conflictData!.localMediaIds
          break
        case 'server':
          finalContent = resolution.conflictData!.serverContent
          finalMediaIds = resolution.conflictData!.serverMediaIds
          break
        case 'merge':
          // Simple merge strategy - combine content with separator
          finalContent = `${resolution.conflictData!.serverContent}\n\n---\n\n${resolution.conflictData!.localContent}`
          finalMediaIds = [...new Set([...resolution.conflictData!.serverMediaIds, ...resolution.conflictData!.localMediaIds])]
          break
        default:
          throw new Error('Invalid resolution choice')
      }

      const updatedDraft = await this.updateDraft(draftId, {
        content: finalContent,
        mediaAttachments: [],
        uploadedMediaIds: finalMediaIds
      })

      // Update local state
      this.lastSavedContent = finalContent
      this.lastSavedMediaIds = finalMediaIds
      this.lastServerVersion = updatedDraft.updated_at

      return updatedDraft
    } catch (error) {
      console.error('Error resolving conflict:', error)
      throw error
    }
  }

  // Create a new draft
  async createDraft(formData: DraftFormData): Promise<Draft> {
    try {
      const response = await fetch('/api/drafts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: formData.content,
          mediaUrls: formData.uploadedMediaIds,
          autoSave: false
        })
      })

      if (!response.ok) {
        throw new Error('Failed to create draft')
      }

      const result = await response.json()
      return result.draft
    } catch (error) {
      throw new Error('Failed to create draft')
    }
  }

  // Update an existing draft
  async updateDraft(draftId: string, formData: DraftFormData): Promise<Draft> {
    const response = await fetch(`/api/drafts/${draftId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: formData.content,
        mediaUrls: formData.uploadedMediaIds,
        autoSave: false
      })
    })

    if (!response.ok) {
      throw new Error('Failed to update draft')
    }

    const result = await response.json()
    return result.draft
  }

  // Delete a draft
  async deleteDraft(draftId: string): Promise<void> {
    const response = await fetch(`/api/drafts/${draftId}`, {
      method: 'DELETE'
    })

    if (!response.ok) {
      throw new Error('Failed to delete draft')
    }
  }

  // Get all drafts
  async getDrafts(limit = 50, offset = 0): Promise<{ drafts: Draft[], pagination: any }> {
    const response = await fetch(`/api/drafts?limit=${limit}&offset=${offset}`)
    
    if (!response.ok) {
      throw new Error('Failed to fetch drafts')
    }

    const result = await response.json()
    return { drafts: result.drafts, pagination: result.pagination }
  }

  // Get a specific draft
  async getDraft(draftId: string): Promise<Draft> {
    const response = await fetch(`/api/drafts/${draftId}`)
    
    if (!response.ok) {
      throw new Error('Failed to fetch draft')
    }

    const result = await response.json()
    return result.draft
  }

  // Local storage methods for offline functionality
  saveToLocalStorage(key: string, data: DraftFormData): void {
    try {
      const now = Date.now()
      const timestamp =
        now <= this.lastLocalSaveTimestamp ? this.lastLocalSaveTimestamp + 1 : now
      this.lastLocalSaveTimestamp = timestamp

      localStorage.setItem(`draft_${key}`, JSON.stringify({
        ...data,
        timestamp
      }))
    } catch (error) {
      console.error('Failed to save to local storage:', error)
    }
  }

  getFromLocalStorage(key: string): DraftFormData | null {
    try {
      const stored = localStorage.getItem(`draft_${key}`)
      if (!stored) return null

      const data = JSON.parse(stored)
      // Remove timestamp before returning
      const { timestamp, ...draftData } = data
      return draftData
    } catch (error) {
      console.error('Failed to get from local storage:', error)
      return null
    }
  }

  removeFromLocalStorage(key: string): void {
    try {
      localStorage.removeItem(`draft_${key}`)
    } catch (error) {
      console.error('Failed to remove from local storage:', error)
    }
  }

  // Get all local storage drafts
  getAllLocalDrafts(): Array<{ key: string, data: DraftFormData, timestamp: number }> {
    const drafts: Array<{ key: string, data: DraftFormData, timestamp: number }> = []
    
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key?.startsWith('draft_')) {
          const stored = localStorage.getItem(key)
          if (stored) {
            const data = JSON.parse(stored)
            const { timestamp, ...draftData } = data
            drafts.push({
              key: key.replace('draft_', ''),
              data: draftData,
              timestamp
            })
          }
        }
      }
    } catch (error) {
      console.error('Failed to get local drafts:', error)
    }

    return drafts.sort((a, b) => b.timestamp - a.timestamp)
  }

  // Clean up old local drafts (older than 7 days)
  cleanupOldLocalDrafts(): void {
    const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000)
    
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key?.startsWith('draft_')) {
          const stored = localStorage.getItem(key)
          if (stored) {
            const data = JSON.parse(stored)
            if (data.timestamp < sevenDaysAgo) {
              localStorage.removeItem(key)
            }
          }
        }
      }
    } catch (error) {
      console.error('Failed to cleanup old drafts:', error)
    }
  }
}
