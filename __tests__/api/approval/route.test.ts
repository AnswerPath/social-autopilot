/**
 * Tests for Approval API route fixes from CodeRabbit review
 */

import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { bulkAdvanceWorkflow } from '@/lib/approval/workflow'
import { restoreRevision } from '@/lib/approval/revisions'

// Mock dependencies
jest.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: jest.fn()
  }
}))

jest.mock('@/lib/approval/workflow', () => ({
  advanceWorkflowStep: jest.fn().mockResolvedValue(undefined),
  bulkAdvanceWorkflow: jest.fn(),
  ensureWorkflowAssignment: jest.fn().mockResolvedValue(undefined),
  getApprovalDashboard: jest.fn().mockResolvedValue([]),
  getApprovalStats: jest.fn().mockResolvedValue(null),
  getPendingApprovals: jest.fn().mockResolvedValue([])
}))

jest.mock('@/lib/approval/notifications', () => ({
  getApprovalNotifications: jest.fn().mockResolvedValue([]),
  markNotificationsRead: jest.fn().mockResolvedValue(undefined)
}))

jest.mock('@/lib/approval/comments', () => ({
  createApprovalComment: jest.fn().mockResolvedValue(undefined),
  getApprovalComments: jest.fn().mockResolvedValue([]),
  resolveApprovalComment: jest.fn().mockResolvedValue(undefined)
}))

jest.mock('@/lib/approval/revisions', () => ({
  listRevisions: jest.fn().mockResolvedValue([]),
  recordRevision: jest.fn().mockResolvedValue({ id: 'rev-1' }),
  restoreRevision: jest.fn()
}))

describe('Approval API Route - CodeRabbit Fixes', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Comment 1: Bulk-approve decision validation', () => {
    it('should accept valid "approve" decision', async () => {
      const { POST } = require('@/app/api/approval/route')
      ;(bulkAdvanceWorkflow as jest.Mock).mockResolvedValue({
        success: ['post-1'],
        failed: []
      })

      const request = new NextRequest('http://localhost:3000/api/approval', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'bulk-approve',
          postIds: ['post-1'],
          decision: 'approve'
        })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(bulkAdvanceWorkflow).toHaveBeenCalledWith(['post-1'], 'manager-user', 'approve')
    })

    it('should accept valid "reject" decision', async () => {
      const { POST } = require('@/app/api/approval/route')
      ;(bulkAdvanceWorkflow as jest.Mock).mockResolvedValue({
        success: ['post-1'],
        failed: []
      })

      const request = new NextRequest('http://localhost:3000/api/approval', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'bulk-approve',
          postIds: ['post-1'],
          decision: 'reject'
        })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(bulkAdvanceWorkflow).toHaveBeenCalledWith(['post-1'], 'manager-user', 'reject')
    })

    it('should default to "approve" when decision is undefined', async () => {
      const { POST } = require('@/app/api/approval/route')
      ;(bulkAdvanceWorkflow as jest.Mock).mockResolvedValue({
        success: ['post-1'],
        failed: []
      })

      const request = new NextRequest('http://localhost:3000/api/approval', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'bulk-approve',
          postIds: ['post-1']
          // decision is undefined
        })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(bulkAdvanceWorkflow).toHaveBeenCalledWith(['post-1'], 'manager-user', 'approve')
    })

    it('should default to "approve" when decision is null', async () => {
      const { POST } = require('@/app/api/approval/route')
      ;(bulkAdvanceWorkflow as jest.Mock).mockResolvedValue({
        success: ['post-1'],
        failed: []
      })

      const request = new NextRequest('http://localhost:3000/api/approval', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'bulk-approve',
          postIds: ['post-1'],
          decision: null
        })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(bulkAdvanceWorkflow).toHaveBeenCalledWith(['post-1'], 'manager-user', 'approve')
    })

    it('should return 400 for invalid decision value', async () => {
      const { POST } = require('@/app/api/approval/route')

      const request = new NextRequest('http://localhost:3000/api/approval', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'bulk-approve',
          postIds: ['post-1'],
          decision: 'maybe' // Invalid value
        })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error).toContain('Invalid decision')
      expect(bulkAdvanceWorkflow).not.toHaveBeenCalled()
    })

    it('should return 400 for empty string decision', async () => {
      const { POST } = require('@/app/api/approval/route')

      const request = new NextRequest('http://localhost:3000/api/approval', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'bulk-approve',
          postIds: ['post-1'],
          decision: ''
        })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error).toContain('Invalid decision')
    })
  })

  describe('Comment 9: Revision restoration authorization', () => {
    it('should allow restoration when user owns the post', async () => {
      const { POST } = require('@/app/api/approval/route')
      // Note: restore-revision uses 'manager-user' as the userId per route logic
      const mockPost = { user_id: 'manager-user' }
      const mockRevision = {
        id: 'rev-1',
        snapshot: { content: 'Test content' }
      }

      // Mock post lookup
      const postQuery = {
        eq: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: mockPost,
          error: null
        })
      }

      // Mock revision restoration
      ;(restoreRevision as jest.Mock).mockResolvedValue(mockRevision)

      // Mock post update
      const updateQuery = {
        eq: jest.fn().mockResolvedValue({ error: null })
      }

      ;(supabaseAdmin.from as jest.Mock).mockImplementation((table: string) => {
        if (table === 'scheduled_posts') {
          return {
            select: jest.fn().mockReturnValue(postQuery),
            update: jest.fn().mockReturnValue(updateQuery)
          }
        }
        return {}
      })

      // Mock recordRevision
      const { recordRevision } = require('@/lib/approval/revisions')
      ;(recordRevision as jest.Mock).mockResolvedValue({ id: 'rev-2' })

      const request = new NextRequest('http://localhost:3000/api/approval', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'restore-revision',
          postId: 'post-1',
          revisionId: 'rev-1'
        })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(restoreRevision).toHaveBeenCalledWith('post-1', 'rev-1')
    })

    it('should return 403 when user does not own the post', async () => {
      const { POST } = require('@/app/api/approval/route')
      const mockPost = { user_id: 'other-user' } // Different user

      const postQuery = {
        eq: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: mockPost,
          error: null
        })
      }

      ;(supabaseAdmin.from as jest.Mock).mockImplementation((table: string) => {
        if (table === 'scheduled_posts') {
          return {
            select: jest.fn().mockReturnValue(postQuery)
          }
        }
        return {}
      })

      const request = new NextRequest('http://localhost:3000/api/approval', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'restore-revision',
          postId: 'post-1',
          revisionId: 'rev-1'
        })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(403)
      expect(data.success).toBe(false)
      expect(data.error).toBe('Unauthorized')
      expect(restoreRevision).not.toHaveBeenCalled()
    })

    it('should return 404 when post is not found', async () => {
      const { POST } = require('@/app/api/approval/route')

      const postQuery = {
        eq: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Not found' }
        })
      }

      ;(supabaseAdmin.from as jest.Mock).mockImplementation((table: string) => {
        if (table === 'scheduled_posts') {
          return {
            select: jest.fn().mockReturnValue(postQuery)
          }
        }
        return {}
      })

      const request = new NextRequest('http://localhost:3000/api/approval', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'restore-revision',
          postId: 'post-1',
          revisionId: 'rev-1'
        })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.success).toBe(false)
      expect(data.error).toBe('Post not found')
      expect(restoreRevision).not.toHaveBeenCalled()
    })

    it('should return 404 when revision is not found', async () => {
      const { POST } = require('@/app/api/approval/route')
      // Note: restore-revision uses 'manager-user' as the userId per route logic
      const mockPost = { user_id: 'manager-user' }

      const postQuery = {
        eq: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: mockPost,
          error: null
        })
      }

      ;(restoreRevision as jest.Mock).mockRejectedValue(new Error('Revision not found'))

      ;(supabaseAdmin.from as jest.Mock).mockImplementation((table: string) => {
        if (table === 'scheduled_posts') {
          return {
            select: jest.fn().mockReturnValue(postQuery)
          }
        }
        return {}
      })

      const request = new NextRequest('http://localhost:3000/api/approval', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'restore-revision',
          postId: 'post-1',
          revisionId: 'rev-1'
        })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.success).toBe(false)
      expect(data.error).toBe('Revision not found')
    })
  })
})

