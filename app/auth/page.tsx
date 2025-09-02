import { AuthPage } from '@/components/auth/auth-page'
import { AuthProvider } from '@/hooks/use-auth'

export default function Auth() {
  return (
    <AuthProvider>
      <AuthPage />
    </AuthProvider>
  )
}
