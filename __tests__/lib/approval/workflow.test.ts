import {
  advanceWorkflowStep,
  ensureWorkflowAssignment,
  getPendingApprovals,
  getApprovalStats,
  getApprovalDashboard
} from '@/lib/approval/workflow'
import { supabaseAdmin } from '@/lib/supabase'

// Mock supabase
jest.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: jest.fn()
  }
}))

// Mock notifications
jest.mock('@/lib/approval/notifications', () => ({
  queueApprovalNotifications: jest.fn().mockResolvedValue(undefined)
}))

describe('Approval Workflow', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('advanceWorkflowStep - action_details preservation', () => {
    const mockPostId = 'post-123'
    const mockActorId = 'actor-123'
    const mockWorkflowId = 'workflow-123'
    const mockStepId = 'step-123'

    const mockAssignment = {
      id: 'assignment-123',
      post_id: mockPostId,
      workflow_id: mockWorkflowId,
      current_step_id: mockStepId,
      status: 'pending' as const,
      step_history: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    const mockWorkflow = {
      id: mockWorkflowId,
      owner_id: 'owner-123',
      name: 'Test Workflow',
      description: null,
      scope: 'global' as const,
      scope_filters: null,
      is_active: true,
      created_by: 'owner-123',
      steps: [
        {
          id: mockStepId,
          workflow_id: mockWorkflowId,
          step_order: 1,
          step_name: 'Review',
          approver_type: 'user' as const,
          approver_reference: 'approver-123',
          min_approvals: 1,
          auto_escalate_after_hours: null,
          is_optional: false,
          sla_hours: null
        }
      ]
    }

    beforeEach(() => {
      // Mock getAssignment
      const assignmentQuery = {
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: mockAssignment,
          error: null
        })
      }

      // Mock loadWorkflow
      const workflowQuery = {
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: mockWorkflow,
          error: null
        })
      }

      // Mock update queries
      const updateQuery = {
        eq: jest.fn().mockReturnThis(),
        update: jest.fn().mockReturnThis()
      }

      const insertQuery = {
        insert: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis()
      }

      ;(supabaseAdmin.from as jest.Mock).mockImplementation((table: string) => {
        if (table === 'post_approval_assignments') {
          return {
            select: jest.fn().mockReturnValue(assignmentQuery),
            update: jest.fn().mockReturnValue(updateQuery),
            insert: jest.fn().mockReturnValue(insertQuery)
          }
        }
        if (table === 'approval_workflows') {
          return workflowQuery
        }
        if (table === 'approval_history') {
          return insertQuery
        }
        if (table === 'scheduled_posts') {
          return updateQuery
        }
        return {}
      })
    })

    it('should preserve rejection reason in action_details when no comment is provided', async () => {
      const reason = 'Content violates policy'
      let capturedActionDetails: any = null

      // Capture the action_details value from the insert call
      ;(supabaseAdmin.from as jest.Mock).mockImplementation((table: string) => {
        if (table === 'approval_history') {
          return {
            insert: jest.fn((data) => {
              capturedActionDetails = data.action_details
              return {
                then: (callback: any) => callback({ data: null, error: null })
              }
            })
          }
        }
        // Return other mocks as needed
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: mockAssignment,
              error: null
            })
          }),
          update: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({ error: null })
          })
        }
      })

      await advanceWorkflowStep(mockPostId, mockActorId, 'reject', {
        reason
      })

      expect(capturedActionDetails).not.toBeNull()
      expect(capturedActionDetails).toEqual({
        comment: null,
        reason
      })
    })

    it('should preserve comment in action_details when no reason is provided', async () => {
      const comment = 'Please revise this section'
      let capturedActionDetails: any = null

      ;(supabaseAdmin.from as jest.Mock).mockImplementation((table: string) => {
        if (table === 'approval_history') {
          return {
            insert: jest.fn((data) => {
              capturedActionDetails = data.action_details
              return {
                then: (callback: any) => callback({ data: null, error: null })
              }
            })
          }
        }
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: mockAssignment,
              error: null
            })
          }),
          update: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({ error: null })
          })
        }
      })

      await advanceWorkflowStep(mockPostId, mockActorId, 'request_changes', {
        comment
      })

      expect(capturedActionDetails).not.toBeNull()
      expect(capturedActionDetails).toEqual({
        comment,
        reason: null
      })
    })

    it('should preserve both comment and reason in action_details when both are provided', async () => {
      const comment = 'Please revise'
      const reason = 'Policy violation'
      let capturedActionDetails: any = null

      ;(supabaseAdmin.from as jest.Mock).mockImplementation((table: string) => {
        if (table === 'approval_history') {
          return {
            insert: jest.fn((data) => {
              capturedActionDetails = data.action_details
              return {
                then: (callback: any) => callback({ data: null, error: null })
              }
            })
          }
        }
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: mockAssignment,
              error: null
            })
          }),
          update: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({ error: null })
          })
        }
      })

      await advanceWorkflowStep(mockPostId, mockActorId, 'reject', {
        comment,
        reason
      })

      expect(capturedActionDetails).not.toBeNull()
      expect(capturedActionDetails).toEqual({
        comment,
        reason
      })
    })

    it('should set action_details to null when neither comment nor reason is provided', async () => {
      let capturedActionDetails: any = null

      ;(supabaseAdmin.from as jest.Mock).mockImplementation((table: string) => {
        if (table === 'approval_history') {
          return {
            insert: jest.fn((data) => {
              capturedActionDetails = data.action_details
              return {
                then: (callback: any) => callback({ data: null, error: null })
              }
            })
          }
        }
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: mockAssignment,
              error: null
            })
          }),
          update: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({ error: null })
          })
        }
      })

      await advanceWorkflowStep(mockPostId, mockActorId, 'approve', {})

      expect(capturedActionDetails).toBeNull()
    })
  })

  describe('CodeRabbit Fixes', () => {
    describe('Comment 10: Error check for existing assignment query', () => {
      const mockPostId = 'post-123'
      const mockOwnerId = 'owner-123'

      it('should throw error when assignment query fails', async () => {
        const assignmentQuery = {
          eq: jest.fn().mockReturnThis(),
          maybeSingle: jest.fn().mockResolvedValue({
            data: null,
            error: { message: 'Database connection failed' }
          })
        }

        ;(supabaseAdmin.from as jest.Mock).mockImplementation((table: string) => {
          if (table === 'post_approval_assignments') {
            return {
              select: jest.fn().mockReturnValue(assignmentQuery)
            }
          }
          return {}
        })

        await expect(
          ensureWorkflowAssignment(mockPostId, mockOwnerId)
        ).rejects.toThrow('Failed to check existing assignment')

        expect(assignmentQuery.maybeSingle).toHaveBeenCalled()
      })

      it('should handle query errors with contextual information', async () => {
        const assignmentQuery = {
          eq: jest.fn().mockReturnThis(),
          maybeSingle: jest.fn().mockResolvedValue({
            data: null,
            error: { message: 'Network error' }
          })
        }

        ;(supabaseAdmin.from as jest.Mock).mockImplementation((table: string) => {
          if (table === 'post_approval_assignments') {
            return {
              select: jest.fn().mockReturnValue(assignmentQuery)
            }
          }
          return {}
        })

        try {
          await ensureWorkflowAssignment(mockPostId, mockOwnerId)
          fail('Should have thrown an error')
        } catch (error: any) {
          expect(error.message).toContain('Failed to check existing assignment')
          expect(error.message).toContain('Network error')
        }
      })
    })

    describe('Comment 11: Dashboard query filtering', () => {
      const mockUserId = 'user-123'

      it('should return empty array when user has no assigned steps', async () => {
        let dashboardQueryCalled = false

        const approverStepsQuery = {
          eq: jest.fn().mockResolvedValue({
            data: [], // No assigned steps
            error: null
          })
        }

        const approverStepsSelect = jest.fn().mockReturnValue(approverStepsQuery)

        ;(supabaseAdmin.from as jest.Mock).mockImplementation((table: string) => {
          if (table === 'approval_workflow_steps') {
            return {
              select: approverStepsSelect
            }
          }
          if (table === 'approval_dashboard_summary') {
            dashboardQueryCalled = true
          }
          return {
            select: jest.fn().mockReturnThis(),
            order: jest.fn().mockReturnThis(),
            in: jest.fn().mockResolvedValue({ data: [], error: null })
          }
        })

        const result = await getApprovalDashboard(mockUserId)

        expect(result).toEqual([])
        expect(dashboardQueryCalled).toBe(false)
      })

      it('should filter dashboard by stepIds when user has assigned steps', async () => {
        const mockSteps = [
          { id: 'step-1' },
          { id: 'step-2' }
        ]

        const approverStepsQuery = {
          eq: jest.fn().mockResolvedValue({
            data: mockSteps,
            error: null
          })
        }

        const approverStepsSelect = jest.fn().mockReturnValue(approverStepsQuery)

        const mockInFn = jest.fn().mockResolvedValue({
          data: [],
          error: null
        })

        const dashboardQueryChain = {
          in: mockInFn
        }

        const dashboardOrder = jest.fn().mockReturnValue(dashboardQueryChain)
        const dashboardSelect = jest.fn().mockReturnValue({
          order: dashboardOrder
        })

        ;(supabaseAdmin.from as jest.Mock).mockImplementation((table: string) => {
          if (table === 'approval_workflow_steps') {
            return {
              select: approverStepsSelect
            }
          }
          if (table === 'approval_dashboard_summary') {
            return {
              select: dashboardSelect
            }
          }
          return {}
        })

        await getApprovalDashboard(mockUserId)

        expect(mockInFn).toHaveBeenCalledWith('current_step_id', ['step-1', 'step-2'])
      })
    })
  })
})

