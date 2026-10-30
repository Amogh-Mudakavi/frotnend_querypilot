import { Analytics } from '@vercel/analytics/next'
import { Geist, Geist_Mono } from 'next/font/google'
import type { Metadata, Viewport } from 'next'
import './globals.css'

const geist = Geist({ subsets: ['latin'], variable: '--font-geist' })
const geistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-geist-mono' })

export const metadata: Metadata = {
  title: 'QueryPilot-Understand Your Data',
  description:
    'Bring scattered information together, uncover meaningful insights, and get answers grounded in your documents.',
  generator: 'QueryPilot',
  icons: {
    icon: '/querypilot-logo.svg',
    shortcut: '/querypilot-logo.svg',
    apple: '/querypilot-logo.svg',
  },
}

export const viewport: Viewport = { colorScheme: 'light', themeColor: '#ffffff', userScalable: false }

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" className="bg-background"><body className={`${geist.variable} ${geistMono.variable} antialiased`}>{children}{process.env.NODE_ENV === 'production' && <Analytics />}</body></html>
}
