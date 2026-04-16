import type { Metadata } from 'next'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import { AuthProvider } from '@/hooks/use-auth'
import { GlobalTeamInviteDeepLink } from '@/components/auth/global-team-invite-deeplink'
import { Toaster } from 'sonner'
import './globals.css'

export const metadata: Metadata = {
  title: 'Social AutoPilot',
  description: 'Automated social media management platform',
  generator: 'v0.dev',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className={GeistSans.className}>
        <AuthProvider>
          {children}
          <GlobalTeamInviteDeepLink />
          <Toaster />
        </AuthProvider>
      </body>
    </html>
  )
}
