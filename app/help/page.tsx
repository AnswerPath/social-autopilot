'use client'

import { ProtectedRoute } from '@/components/auth/protected-route'
import { FAQSection } from '@/components/help/faq-section'

export default function HelpPage() {
  return (
    <ProtectedRoute>
      <FAQSection />
    </ProtectedRoute>
  )
}
