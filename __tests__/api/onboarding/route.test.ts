/**
 * Unit tests for /api/onboarding route (GET and PATCH)
 */

import { NextRequest } from 'next/server'
import { ONBOARDING_STEPS } from '@/lib/onboarding'

jest.mock('@/lib/auth-utils', () => ({
  getCurrentUser: jest.fn(),
  createAuthError: jest.fn((type: string, message: string) => ({ type, message })),
}))

const mockFrom = jest.fn()
const mockSelect = jest.fn()
const mockEq = jest.fn()
const mockSingle = jest.fn()
const mockUpsert = jest.fn()

jest.mock('@/lib/supabase', () => ({
  getSupabaseAdmin: jest.fn(() => ({
    from: mockFrom,
  })),
}))

describe('Onboarding API', () => {
  const getCurrentUser = require('@/lib/auth-utils').getCurrentUser as jest.Mock

  beforeEach(() => {
    jest.clearAllMocks()
    mockFrom.mockReturnValue({
      select: mockSelect,
      upsert: mockUpsert,
    })
    mockSelect.mockReturnValue({ eq: mockEq })
    mockEq.mockReturnValue({ single: mockSingle })
    mockUpsert.mockResolvedValue({ error: null })
  })

  describe('GET /api/onboarding', () => {
    it('returns 401 when user is not authenticated', async () => {
      getCurrentUser.mockResolvedValue(null)

      const { GET } = await import('@/app/api/onboarding/route')
      const request = new NextRequest('http://localhost:3000/api/onboarding')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBeDefined()
      expect(data.error.message).toContain('Authentication')
      expect(mockFrom).not.toHaveBeenCalled()
    })

    it('returns onboarding progress when user has profile', async () => {
      getCurrentUser.mockResolvedValue({ id: 'user-1' })
      mockSingle.mockResolvedValue({
        data: {
          onboarding_step: 1,
          onboarding_completed_at: null,
          tutorial_completed_at: '2025-01-15T12:00:00Z',
          show_contextual_tooltips: true,
        },
        error: null,
      })

      const { GET } = await import('@/app/api/onboarding/route')
      const request = new NextRequest('http://localhost:3000/api/onboarding')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(mockFrom).toHaveBeenCalledWith('user_profiles')
      expect(mockSelect).toHaveBeenCalledWith(
        'onboarding_step, onboarding_completed_at, tutorial_completed_at, show_contextual_tooltips'
      )
      expect(mockEq).toHaveBeenCalledWith('user_id', 'user-1')
      expect(data.currentStep).toBe(1)
      expect(data.completed).toBe(false)
      expect(data.completedSteps).toEqual([0])
      expect(data.tutorialCompleted).toBe(true)
      expect(data.tutorialCompletedAt).toBe('2025-01-15T12:00:00Z')
      expect(data.showContextualTooltips).toBe(true)
    })

    it('returns completed state when onboarding_completed_at is set', async () => {
      getCurrentUser.mockResolvedValue({ id: 'user-1' })
      mockSingle.mockResolvedValue({
        data: {
          onboarding_step: ONBOARDING_STEPS.COMPLETE,
          onboarding_completed_at: '2025-01-20T10:00:00Z',
          tutorial_completed_at: '2025-01-20T10:00:00Z',
          show_contextual_tooltips: false,
        },
        error: null,
      })

      const { GET } = await import('@/app/api/onboarding/route')
      const request = new NextRequest('http://localhost:3000/api/onboarding')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.currentStep).toBe(ONBOARDING_STEPS.COMPLETE)
      expect(data.completed).toBe(true)
      expect(data.completedSteps).toEqual([0, 1, 2, 3])
      expect(data.completedAt).toBe('2025-01-20T10:00:00Z')
      expect(data.showContextualTooltips).toBe(false)
    })

    it('returns defaults when profile is missing (PGRST116)', async () => {
      getCurrentUser.mockResolvedValue({ id: 'user-1' })
      mockSingle.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116' },
      })

      const { GET } = await import('@/app/api/onboarding/route')
      const request = new NextRequest('http://localhost:3000/api/onboarding')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.currentStep).toBe(0)
      expect(data.completed).toBe(false)
      expect(data.completedSteps).toEqual([])
      expect(data.showContextualTooltips).toBe(true)
    })

    it('returns 500 when profile fetch fails with non-PGRST116 error', async () => {
      getCurrentUser.mockResolvedValue({ id: 'user-1' })
      mockSingle.mockResolvedValue({
        data: null,
        error: { code: 'OTHER', message: 'DB error' },
      })

      const { GET } = await import('@/app/api/onboarding/route')
      const request = new NextRequest('http://localhost:3000/api/onboarding')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Failed to fetch onboarding progress')
    })
  })

  describe('PATCH /api/onboarding', () => {
    it('returns 401 when user is not authenticated', async () => {
      getCurrentUser.mockResolvedValue(null)

      const { PATCH } = await import('@/app/api/onboarding/route')
      const request = new NextRequest('http://localhost:3000/api/onboarding', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step: 1 }),
      })
      const response = await PATCH(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBeDefined()
      expect(mockFrom).not.toHaveBeenCalled()
    })

    it('updates step and returns success', async () => {
      getCurrentUser.mockResolvedValue({ id: 'user-1' })

      const { PATCH } = await import('@/app/api/onboarding/route')
      const request = new NextRequest('http://localhost:3000/api/onboarding', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step: 2 }),
      })
      const response = await PATCH(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(mockFrom).toHaveBeenCalledWith('user_profiles')
      expect(mockUpsert).toHaveBeenCalledWith(
        expect.objectContaining({ user_id: 'user-1', onboarding_step: 2 }),
        { onConflict: 'user_id' }
      )
    })

    it('sets complete and onboarding_completed_at when complete: true', async () => {
      getCurrentUser.mockResolvedValue({ id: 'user-1' })

      const { PATCH } = await import('@/app/api/onboarding/route')
      const request = new NextRequest('http://localhost:3000/api/onboarding', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ complete: true }),
      })
      const response = await PATCH(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      const upsertPayload = mockUpsert.mock.calls[0][0]
      expect(upsertPayload.onboarding_step).toBe(ONBOARDING_STEPS.COMPLETE)
      expect(upsertPayload.onboarding_completed_at).toBeDefined()
      expect(mockUpsert).toHaveBeenCalledWith(expect.any(Object), { onConflict: 'user_id' })
    })

    it('sets tutorial_completed_at when tutorialCompleted: true', async () => {
      getCurrentUser.mockResolvedValue({ id: 'user-1' })

      const { PATCH } = await import('@/app/api/onboarding/route')
      const request = new NextRequest('http://localhost:3000/api/onboarding', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tutorialCompleted: true }),
      })
      const response = await PATCH(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      const upsertPayload = mockUpsert.mock.calls[0][0]
      expect(upsertPayload.tutorial_completed_at).toBeDefined()
      expect(mockUpsert).toHaveBeenCalledWith(expect.any(Object), { onConflict: 'user_id' })
    })

    it('resets tutorial when resetTutorial: true', async () => {
      getCurrentUser.mockResolvedValue({ id: 'user-1' })

      const { PATCH } = await import('@/app/api/onboarding/route')
      const request = new NextRequest('http://localhost:3000/api/onboarding', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resetTutorial: true }),
      })
      const response = await PATCH(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.tutorialCompleted).toBe(false)
      expect(mockUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'user-1',
          tutorial_completed_at: null,
        }),
        { onConflict: 'user_id' }
      )
    })

    it('updates show_contextual_tooltips when showContextualTooltips is boolean', async () => {
      getCurrentUser.mockResolvedValue({ id: 'user-1' })

      const { PATCH } = await import('@/app/api/onboarding/route')
      const request = new NextRequest('http://localhost:3000/api/onboarding', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ showContextualTooltips: false }),
      })
      const response = await PATCH(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      const upsertPayload = mockUpsert.mock.calls[0][0]
      expect(upsertPayload.show_contextual_tooltips).toBe(false)
      expect(mockUpsert).toHaveBeenCalledWith(expect.any(Object), { onConflict: 'user_id' })
    })

    it('returns success for empty body when no updates', async () => {
      getCurrentUser.mockResolvedValue({ id: 'user-1' })

      const { PATCH } = await import('@/app/api/onboarding/route')
      const request = new NextRequest('http://localhost:3000/api/onboarding', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const response = await PATCH(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
    })

    it('ignores invalid step values and returns success without updating', async () => {
      getCurrentUser.mockResolvedValue({ id: 'user-1' })

      const { PATCH } = await import('@/app/api/onboarding/route')
      const request = new NextRequest('http://localhost:3000/api/onboarding', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step: 99 }),
      })
      const response = await PATCH(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(mockFrom).not.toHaveBeenCalled()
    })

    it('returns 500 when update fails', async () => {
      getCurrentUser.mockResolvedValue({ id: 'user-1' })
      mockUpsert.mockResolvedValue({ error: { message: 'DB error' } })

      const { PATCH } = await import('@/app/api/onboarding/route')
      const request = new NextRequest('http://localhost:3000/api/onboarding', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step: 1 }),
      })
      const response = await PATCH(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Failed to update onboarding progress')
    })
  })
})
