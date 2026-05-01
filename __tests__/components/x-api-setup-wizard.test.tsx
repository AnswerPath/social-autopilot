import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { XApiSetupWizard } from '@/components/x-api-setup-wizard'

describe('XApiSetupWizard', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(global.fetch as jest.Mock).mockReset()
  })

  it('waits for the server-resolved callback URL before enabling copy', async () => {
    ;(global.fetch as jest.Mock).mockImplementation((url: string) => {
      if (url === '/api/auth/twitter/callback-url') {
        return new Promise(() => {})
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({
          success: true,
          hasCredentials: false,
          hasConsumerKeys: false,
          hasAccessTokens: false,
          needsOAuth: false,
        }),
      })
    })

    render(<XApiSetupWizard mode="settings" userId="user-1" />)

    expect(await screen.findByText('Loading server-resolved callback URL...')).not.toBeNull()
    expect(screen.queryByText('http://localhost/api/auth/twitter/callback')).toBeNull()
    expect(screen.getByRole('button', { name: 'Copy callback URL' }).hasAttribute('disabled')).toBe(true)
  })

  it('walks users through X developer setup, callback URL, and app URL variables', async () => {
    ;(global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          appOrigin: 'https://app.example.com',
          callbackUrl: 'https://app.example.com/api/auth/twitter/callback',
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          hasCredentials: false,
          hasConsumerKeys: false,
          hasAccessTokens: false,
          needsOAuth: false,
        }),
      })

    render(<XApiSetupWizard mode="settings" userId="user-1" />)

    expect(await screen.findByText('Create an X developer app')).not.toBeNull()
    expect(screen.getByText('Configure app permissions and callback')).not.toBeNull()
    expect(screen.getByText(/NEXT_PUBLIC_APP_URL/)).not.toBeNull()
    expect(screen.getByText(/NEXTAUTH_URL/)).not.toBeNull()
    expect(await screen.findByText('https://app.example.com/api/auth/twitter/callback')).not.toBeNull()
    expect(global.fetch).toHaveBeenCalledWith('/api/auth/twitter/callback-url')
    expect(screen.getByRole('link', { name: /X developer portal/i }).getAttribute('href')).toBe(
      'https://developer.twitter.com/'
    )
  })

  it('saves consumer keys and enables Connect with X after the saved status refreshes', async () => {
    const user = userEvent.setup()
    ;(global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          appOrigin: 'http://localhost',
          callbackUrl: 'http://localhost/api/auth/twitter/callback',
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          hasCredentials: false,
          hasConsumerKeys: false,
          hasAccessTokens: false,
          needsOAuth: false,
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          message: 'Consumer keys saved. Use Connect with X to authorize.',
          needsOAuth: true,
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          hasCredentials: true,
          hasConsumerKeys: true,
          hasAccessTokens: false,
          needsOAuth: true,
        }),
      })

    render(<XApiSetupWizard mode="settings" userId="user-1" />)

    const connectButton = await screen.findByRole('button', { name: /Connect with X/i })
    expect(connectButton.hasAttribute('disabled')).toBe(true)

    await user.type(screen.getByLabelText('API Key (consumer)'), 'consumer-key')
    await user.type(screen.getByLabelText('API Key Secret (consumer)'), 'consumer-secret')
    await user.click(screen.getByRole('button', { name: /Save consumer keys/i }))

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/settings/x-api-credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: 'consumer-key',
          apiKeySecret: 'consumer-secret',
        }),
      })
    })

    expect(await screen.findByText('OAuth pending')).not.toBeNull()
    expect(screen.getByRole('button', { name: /Connect with X/i }).hasAttribute('disabled')).toBe(false)
  })

  it('tests the saved X connection when access tokens are present', async () => {
    const user = userEvent.setup()
    ;(global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          appOrigin: 'http://localhost',
          callbackUrl: 'http://localhost/api/auth/twitter/callback',
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          hasCredentials: true,
          hasConsumerKeys: true,
          hasAccessTokens: true,
          needsOAuth: false,
          connectedXUsername: 'socialpilot',
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          message: 'X connection successful',
          user: { username: 'socialpilot' },
        }),
      })

    render(<XApiSetupWizard mode="settings" userId="user-1" />)

    expect(await screen.findByText('X API ready for posting')).not.toBeNull()
    expect(screen.getByText('@socialpilot')).not.toBeNull()

    await user.click(screen.getByRole('button', { name: /Test X API Connection/i }))

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/settings/test-x-api-connection-saved?userId=user-1',
        { method: 'POST' }
      )
    })
    await waitFor(() => {
      expect(screen.getAllByText('X connection successful').length).toBeGreaterThan(0)
    })
  })
})
