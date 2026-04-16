import type { Metadata } from 'next'
import { Plus_Jakarta_Sans, DM_Sans, JetBrains_Mono } from 'next/font/google'
import { AuthProvider } from '@/hooks/use-auth'
import { GlobalTeamInviteDeepLink } from '@/components/auth/global-team-invite-deeplink'
import { Toaster } from 'sonner'
import './globals.css'

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-heading',
  display: 'swap',
})

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
})

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
    <html
      lang="en"
      className={`${plusJakarta.variable} ${dmSans.variable} ${jetbrainsMono.variable}`}
    >
      <body className={`${dmSans.className} font-sans`}>
        <AuthProvider>
          {children}
          <GlobalTeamInviteDeepLink />
          <Toaster />
        </AuthProvider>
      </body>
    </html>
  )
}
