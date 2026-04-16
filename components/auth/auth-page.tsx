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
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-muted/40 to-muted/60 p-4">
      <div className="w-full max-w-md animate-fade-up">
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
