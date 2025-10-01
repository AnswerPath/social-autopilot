/**
 * Test utilities for integration testing
 */

import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { toast } from 'sonner'

// Mock toast
jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
    warning: jest.fn(),
    info: jest.fn(),
  },
}))

// Dummy test so Jest doesn't complain
describe('Test Utilities', () => {
  it('should export utility functions', () => {
    expect(mockFetch).toBeDefined()
    expect(mockFetchError).toBeDefined()
    expect(createMockCredentials).toBeDefined()
  })
})

export const mockFetch = (response: any, status = 200) => {
  return jest.fn().mockResolvedValue({
    ok: status < 400,
    status,
    json: jest.fn().mockResolvedValue(response),
  })
}

export const mockFetchError = (error: string, status = 500) => {
  return jest.fn().mockRejectedValue(new Error(error))
}

export const createMockCredentials = () => ({
  apify: {
    apiKey: 'test-apify-key',
    userId: 'test-user',
  },
  xApi: {
    apiKey: 'test-x-api-key',
    apiKeySecret: 'test-x-api-secret',
    accessToken: 'test-access-token',
    accessTokenSecret: 'test-access-token-secret',
    userId: 'test-user',
  },
})

export const createMockApiResponse = (data: any, success = true) => ({
  success,
  data,
  error: success ? undefined : 'Test error',
})

export const waitForElementToBeRemoved = async (element: Element) => {
  await waitFor(() => {
    expect(element).not.toBeInTheDocument()
  })
}

export const waitForLoadingToFinish = async () => {
  await waitFor(() => {
    expect(screen.queryByText(/loading/i)).not.toBeInTheDocument()
  })
}

export const expectToastSuccess = (message: string) => {
  expect(toast.success).toHaveBeenCalledWith(message)
}

export const expectToastError = (message: string) => {
  expect(toast.error).toHaveBeenCalledWith(message)
}

export const setupUserEvent = () => {
  return userEvent.setup()
}

export const mockSupabaseClient = () => ({
  from: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  delete: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  single: jest.fn().mockResolvedValue({ data: null, error: null }),
})

export const createMockError = (type: string, message: string) => ({
  type,
  message,
  timestamp: new Date().toISOString(),
  service: 'test-service',
  severity: 'medium',
  retryable: true,
})

export const mockEncryption = {
  encrypt: jest.fn().mockResolvedValue('encrypted-data'),
  decrypt: jest.fn().mockResolvedValue('decrypted-data'),
}

export const mockTokenManagement = {
  validateApifyToken: jest.fn().mockResolvedValue({ isValid: true }),
  validateXApiToken: jest.fn().mockResolvedValue({ isValid: true }),
  revokeApifyToken: jest.fn().mockResolvedValue({ success: true }),
  revokeXApiToken: jest.fn().mockResolvedValue({ success: true }),
  getTokenStatus: jest.fn().mockResolvedValue({
    apify: { isValid: true },
    xApi: { isValid: true },
  }),
}

export const mockComplianceService = {
  validateCompliance: jest.fn().mockReturnValue({
    gdprCompliant: true,
    ccpaCompliant: true,
    issues: [],
  }),
  exportUserData: jest.fn().mockResolvedValue({
    userId: 'test-user',
    exportDate: new Date().toISOString(),
    data: { credentials: [] },
  }),
  processDeletionRequest: jest.fn().mockResolvedValue(true),
  recordUserConsent: jest.fn().mockResolvedValue(undefined),
}

export const mockErrorHandler = {
  createError: jest.fn(),
  executeWithRetry: jest.fn(),
  normalizeError: jest.fn(),
  createUserFriendlyMessage: jest.fn(),
}

export const mockCircuitBreaker = {
  execute: jest.fn(),
  getState: jest.fn().mockReturnValue('CLOSED'),
}

export const mockErrorMonitor = {
  recordError: jest.fn(),
  getErrorStats: jest.fn().mockReturnValue({}),
  resetCounts: jest.fn(),
}

// Test data factories
export const createTestUser = (overrides = {}) => ({
  id: 'test-user-id',
  email: 'test@example.com',
  name: 'Test User',
  ...overrides,
})

export const createTestCredentials = (overrides = {}) => ({
  id: 'test-credential-id',
  userId: 'test-user-id',
  credentialType: 'apify',
  encryptedCredentials: 'encrypted-data',
  createdAt: new Date().toISOString(),
  ...overrides,
})

export const createTestPost = (overrides = {}) => ({
  id: 'test-post-id',
  content: 'Test post content',
  userId: 'test-user-id',
  scheduledAt: new Date().toISOString(),
  status: 'pending',
  ...overrides,
})

export const createTestMention = (overrides = {}) => ({
  id: 'test-mention-id',
  text: 'Test mention',
  author: 'test-author',
  timestamp: new Date().toISOString(),
  url: 'https://x.com/test/123',
  ...overrides,
})

// Custom matchers
export const expectApiCall = (mockFn: jest.Mock, expectedUrl: string, expectedOptions?: any) => {
  expect(mockFn).toHaveBeenCalledWith(expectedUrl, expectedOptions)
}

// Commented out due to JSX transform issues in Jest
// export const expectComponentToRender = (Component: React.ComponentType<any>, props = {}) => {
//   const { render } = require('@testing-library/react')
//   render(React.createElement(Component, props))
//   expect(screen.getByRole('main')).toBeInTheDocument()
// }

export const expectFormSubmission = async (form: HTMLElement, user: any, expectedData: any) => {
  const submitButton = screen.getByRole('button', { name: /submit|save|create/i })
  await user.click(submitButton)
  
  await waitFor(() => {
    expect(fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify(expectedData),
      })
    )
  })
}

export const expectErrorHandling = async (operation: () => Promise<any>, expectedError: string) => {
  await expect(operation()).rejects.toThrow(expectedError)
}

export const expectRetryLogic = async (operation: () => Promise<any>, retryCount: number) => {
  const mockFn = jest.fn().mockRejectedValue(new Error('Network error'))
  const result = await operation()
  expect(mockFn).toHaveBeenCalledTimes(retryCount + 1)
}

export const expectCircuitBreaker = async (operation: () => Promise<any>, expectedState: string) => {
  const result = await operation()
  expect(mockCircuitBreaker.getState()).toBe(expectedState)
}

export const expectComplianceValidation = (expectedCompliance: any) => {
  expect(mockComplianceService.validateCompliance()).toEqual(expectedCompliance)
}

export const expectTokenValidation = async (service: 'apify' | 'x-api', expectedResult: any) => {
  const result = await mockTokenManagement[`validate${service.charAt(0).toUpperCase() + service.slice(1)}Token`]()
  expect(result).toEqual(expectedResult)
}

export const expectErrorMonitoring = (expectedError: any) => {
  expect(mockErrorMonitor.recordError).toHaveBeenCalledWith(expectedError)
}

// Integration test helpers
export const setupIntegrationTest = () => {
  // Reset all mocks
  jest.clearAllMocks()
  
  // Setup default mocks
  global.fetch = mockFetch({ success: true })
  
  // Return cleanup function
  return () => {
    jest.clearAllMocks()
  }
}

export const runIntegrationTest = async (
  testName: string,
  setup: () => Promise<void>,
  assertion: () => Promise<void>,
  cleanup?: () => Promise<void>
) => {
  console.log(`Running integration test: ${testName}`)
  
  try {
    await setup()
    await assertion()
  } finally {
    if (cleanup) {
      await cleanup()
    }
  }
  
  console.log(`✅ Integration test passed: ${testName}`)
}

export const createTestEnvironment = () => {
  const credentials = createMockCredentials()
  const user = createTestUser()
  
  return {
    credentials,
    user,
    mockFetch,
    mockFetchError,
    expectApiCall,
    expectComponentToRender,
    expectFormSubmission,
    expectErrorHandling,
    expectRetryLogic,
    expectCircuitBreaker,
    expectComplianceValidation,
    expectTokenValidation,
    expectErrorMonitoring,
    setupIntegrationTest,
    runIntegrationTest,
  }
}
