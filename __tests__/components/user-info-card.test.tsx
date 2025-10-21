import React from 'react'
import { render, screen } from '@testing-library/react'
import { UserInfoCard } from '@/components/auth/user-info-card'

// Mock Next.js Link component
jest.mock('next/link', () => {
  return ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  )
})

// Mock the hooks to avoid complex setup
jest.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({
    user: {
      id: 'test-user-id',
      email: 'test@example.com',
      role: 'ADMIN',
      permissions: ['CREATE_POST', 'EDIT_POST', 'DELETE_POST', 'MANAGE_USERS']
    }
  })
}))

jest.mock('@/hooks/use-profile', () => ({
  useProfile: () => ({
    profile: {
      id: 'profile-id',
      user_id: 'test-user-id',
      display_name: 'Test User',
      first_name: 'Test',
      last_name: 'User',
      bio: 'Test bio',
      email_notifications: true,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z'
    },
    loading: false,
    error: null,
    getAvatarUrl: () => 'https://example.com/avatar.jpg',
    fetchProfile: jest.fn()
  })
}))

describe('UserInfoCard Component', () => {
  it('should render without crashing', () => {
    render(<UserInfoCard />)
    
    // Basic smoke test - component should render
    expect(screen.getByText('User Information')).toBeInTheDocument()
  })

  it('should display user information', () => {
    render(<UserInfoCard />)
    
    expect(screen.getByText('Test User')).toBeInTheDocument()
    expect(screen.getByText('test@example.com')).toBeInTheDocument()
    expect(screen.getByText('Admin')).toBeInTheDocument()
    expect(screen.getByText('4 permissions')).toBeInTheDocument()
  })

  it('should display Edit Profile button with correct link', () => {
    render(<UserInfoCard />)
    
    const editButton = screen.getByText('Edit Profile')
    expect(editButton).toBeInTheDocument()
    
    const link = editButton.closest('a')
    expect(link).toHaveAttribute('href', '/profile')
  })

  it('should display key permissions preview', () => {
    render(<UserInfoCard />)
    
    expect(screen.getByText('Key Permissions:')).toBeInTheDocument()
    expect(screen.getByText('CREATE POST')).toBeInTheDocument()
    expect(screen.getByText('EDIT POST')).toBeInTheDocument()
    expect(screen.getByText('DELETE POST')).toBeInTheDocument()
    expect(screen.getByText('MANAGE USERS')).toBeInTheDocument()
  })
})
