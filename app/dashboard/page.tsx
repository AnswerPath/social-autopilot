'use client'

import React from 'react'
import { ProtectedRoute } from '@/components/auth/protected-route'
import { Dashboard } from '@/components/dashboard'

export default function DashboardPage() {
  return (
    <ProtectedRoute>
      <Dashboard />
    </ProtectedRoute>
  )
}
