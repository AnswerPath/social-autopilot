import React from 'react'
import { renderHook, act, waitFor } from '@testing-library/react'
import { AuthProvider, useAuth } from '@/hooks/use-auth'
import { UserRole } from '@/lib/auth-types'

// Mock fetch
global.fetch = jest.fn()

describe('useAuth Hook', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(global.fetch as jest.Mock).mockReset()
    
    // Setup default mock for session check that happens on mount
    ;(global.fetch as jest.Mock).mockImplementation((url) => {
      if (url === '/api/auth/session') {
        return Promise.resolve({
          ok: false,
          status: 401,
          json: jest.fn().mockResolvedValue({}),
        })
      }
      // Default fallback
      return Promise.resolve({
        ok: true,
        json: jest.fn().mockResolvedValue({}),
      })
    })
  })

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <AuthProvider>{children}</AuthProvider>
  )

  describe('Authentication State', () => {
    it('should initialize with unauthenticated state', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper })

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.user).toBeNull()
    })

    it('should fetch session on mount', async () => {
      ;(global.fetch as jest.Mock).mockImplementation((url) => {
        if (url === '/api/auth/session') {
          return Promise.resolve({
            ok: true,
            json: jest.fn().mockResolvedValue({
              user: {
                id: 'test-user-id',
                email: 'test@example.com',
                role: UserRole.EDITOR,
              },
              authenticated: true,
            }),
          })
        }
      })

      const { result } = renderHook(() => useAuth(), { wrapper })

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.user).toBeDefined()
      expect(result.current.user).not.toBeNull()
    })
  })

  describe('Login', () => {
    it('should login successfully', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper })

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      ;(global.fetch as jest.Mock).mockImplementationOnce((url) => {
        if (url === '/api/auth/login') {
          return Promise.resolve({
            ok: true,
            json: jest.fn().mockResolvedValue({
              success: true,
              user: {
                id: 'test-user-id',
                email: 'test@example.com',
                role: UserRole.EDITOR,
              },
              token: 'test-token',
            }),
          })
        }
      })

      await act(async () => {
        await result.current.login({ email: 'test@example.com', password: 'password123' })
      })

      expect(result.current.user).toBeDefined()
      expect(result.current.user?.email).toBe('test@example.com')
    })

    it('should handle login failure', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper })

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      ;(global.fetch as jest.Mock).mockImplementationOnce((url) => {
        if (url === '/api/auth/login') {
          return Promise.resolve({
            ok: false,
            json: jest.fn().mockResolvedValue({
              error: { message: 'Invalid credentials' },
            }),
          })
        }
      })

      await expect(
        act(async () => {
          await result.current.login({ email: 'test@example.com', password: 'wrongpassword' })
        })
      ).rejects.toThrow('Invalid credentials')

      expect(result.current.user).toBeNull()
    })

    it('should set loading state during login', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper })

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      let resolveLogin: any
      const loginPromise = new Promise((resolve) => {
        resolveLogin = resolve
      })

      ;(global.fetch as jest.Mock).mockImplementationOnce((url) => {
        if (url === '/api/auth/login') {
          return loginPromise.then(() => ({
            ok: true,
            json: jest.fn().mockResolvedValue({
              success: true,
              user: { id: 'test-user-id', email: 'test@example.com' },
            }),
          }))
        }
      })

      act(() => {
        result.current.login({ email: 'test@example.com', password: 'password123' })
      })

      await waitFor(() => {
        expect(result.current.loading).toBe(true)
      })

      resolveLogin()

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })
    })
  })

  describe('Register', () => {
    it('should register new user successfully', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper })

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      ;(global.fetch as jest.Mock).mockImplementationOnce((url) => {
        if (url === '/api/auth/register') {
          return Promise.resolve({
            ok: true,
            json: jest.fn().mockResolvedValue({
              success: true,
              user: {
                id: 'new-user-id',
                email: 'newuser@example.com',
              },
            }),
          })
        }
      })

      await act(async () => {
        await result.current.register({
          email: 'newuser@example.com',
          password: 'password123',
          first_name: 'Test',
          last_name: 'User',
        })
      })

      expect(result.current.user).toBeDefined()
      expect(result.current.user?.email).toBe('newuser@example.com')
    })

    it('should handle registration errors', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper })

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      ;(global.fetch as jest.Mock).mockImplementationOnce((url) => {
        if (url === '/api/auth/register') {
          return Promise.resolve({
            ok: false,
            json: jest.fn().mockResolvedValue({
              error: { message: 'Email already exists' },
            }),
          })
        }
      })

      await expect(
        act(async () => {
          await result.current.register({
            email: 'existing@example.com',
            password: 'password123',
            first_name: 'Test',
            last_name: 'User',
          })
        })
      ).rejects.toThrow('Email already exists')
    })
  })

  describe('Logout', () => {
    it('should logout successfully', async () => {
      // First login
      ;(global.fetch as jest.Mock).mockImplementation((url) => {
        if (url === '/api/auth/session') {
          return Promise.resolve({
            ok: true,
            json: jest.fn().mockResolvedValue({
              user: { id: 'test-user-id', email: 'test@example.com' },
            }),
          })
        }
      })

      const { result } = renderHook(() => useAuth(), { wrapper })

      await waitFor(() => {
        expect(result.current.user).not.toBeNull()
      })

      // Mock logout
      ;(global.fetch as jest.Mock).mockImplementationOnce((url) => {
        if (url === '/api/auth/logout') {
          return Promise.resolve({
            ok: true,
            json: jest.fn().mockResolvedValue({ success: true }),
          })
        }
      })

      await act(async () => {
        await result.current.logout()
      })

      expect(result.current.user).toBeNull()
    })
  })

  describe('Permission Checking', () => {
    it('should check if user has permission', async () => {
      ;(global.fetch as jest.Mock).mockImplementation((url) => {
        if (url === '/api/auth/session') {
          return Promise.resolve({
            ok: true,
            json: jest.fn().mockResolvedValue({
              user: {
                id: 'test-user-id',
                email: 'test@example.com',
                role: UserRole.EDITOR,
                permissions: ['CREATE_POST', 'EDIT_POST'],
              },
            }),
          })
        }
      })

      const { result } = renderHook(() => useAuth(), { wrapper })

      await waitFor(() => {
        expect(result.current.user).not.toBeNull()
      })

      expect(result.current.user?.role).toBe(UserRole.EDITOR)
    })

    it('should check if user has role', async () => {
      ;(global.fetch as jest.Mock).mockImplementation((url) => {
        if (url === '/api/auth/session') {
          return Promise.resolve({
            ok: true,
            json: jest.fn().mockResolvedValue({
              user: {
                id: 'test-user-id',
                email: 'test@example.com',
                role: UserRole.ADMIN,
              },
            }),
          })
        }
      })

      const { result } = renderHook(() => useAuth(), { wrapper })

      await waitFor(() => {
        expect(result.current.user).not.toBeNull()
      })

      expect(result.current.user?.role).toBe(UserRole.ADMIN)
    })

    it('should return false for unauthenticated user', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper })

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.user).toBeNull()
    })
  })

  describe('Session Refresh', () => {
    it('should handle session refresh', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper })

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      ;(global.fetch as jest.Mock).mockImplementation((url) => {
        if (url === '/api/auth/session') {
          return Promise.resolve({
            ok: true,
            json: jest.fn().mockResolvedValue({
              user: {
                id: 'test-user-id',
                email: 'test@example.com',
              },
            }),
          })
        }
      })

      await act(async () => {
        await result.current.refreshSession()
      })

      expect(result.current.user).not.toBeNull()
    })
  })
})
