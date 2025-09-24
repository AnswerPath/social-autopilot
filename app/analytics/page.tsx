'use client'

import React from 'react'
import { useAuth } from '@/hooks/use-auth'
import { ProtectedRoute } from '@/components/auth/protected-route'
import { CanViewAnalytics } from '@/components/auth/permission-gate'
import { AnalyticsDashboard } from '@/components/analytics-dashboard'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

function AnalyticsContent() {
  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="flex items-center gap-4 mb-2">
              <Link href="/dashboard">
                <Button variant="outline" size="sm">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to Dashboard
                </Button>
              </Link>
            </div>
            <h1 className="text-3xl font-bold text-gray-900">Analytics</h1>
            <p className="text-gray-600">Insights and performance metrics for your social media</p>
          </div>
        </div>

        <CanViewAnalytics
          fallback={
            <div className="text-center py-12">
              <div className="max-w-md mx-auto">
                <h2 className="text-xl font-semibold text-gray-900 mb-2">Access Restricted</h2>
                <p className="text-gray-600">
                  You don't have permission to view analytics. Contact your administrator to request access.
                </p>
                <Link href="/dashboard" className="mt-4 inline-block">
                  <Button>Return to Dashboard</Button>
                </Link>
              </div>
            </div>
          }
        >
          <AnalyticsDashboard />
        </CanViewAnalytics>
      </div>
    </div>
  )
}

export default function Analytics() {
  return (
    <ProtectedRoute>
      <AnalyticsContent />
    </ProtectedRoute>
  )
}
