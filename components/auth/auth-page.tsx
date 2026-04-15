'use client'

import React, { useState } from 'react'
import { LoginForm } from './login-form'
import { RegisterForm } from './register-form'
import { useAuth } from '@/hooks/use-auth'
import { Loader2 } from 'lucide-react'

type AuthMode = 'login' | 'register'

export function AuthPage() {
  const [mode, setMode] = useState<AuthMode>('login')
  const { loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex items-center space-x-2">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span>Loading...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="w-full max-w-md">
        {mode === 'login' ? (
          <LoginForm
            onSwitchToRegister={() => setMode('register')}
          />
        ) : (
          <RegisterForm
            onSwitchToLogin={() => setMode('login')}
          />
        )}
      </div>
    </div>
  )
}
