import type { Metadata, Viewport } from 'next'
import { Chakra_Petch, Hanken_Grotesk } from 'next/font/google'
import './globals.css'

const chakraPetch = Chakra_Petch({
  weight: ['300', '400', '500', '600', '700'],
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
})

const hankenGrotesk = Hanken_Grotesk({
  weight: ['300', '400', '500', '600', '700', '800'],
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap',
})

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
const TITLE = 'ARIA — Any goal. The right agents.'
const DESCRIPTION =
  'ARIA turns one prompt into a team of specialist AI agents — discovered, hired, and paid per task on-chain, with zero data retained. Private by design.'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: TITLE,
    template: '%s · ARIA',
  },
  description: DESCRIPTION,
  applicationName: 'ARIA',
  keywords: [
    'ARIA', 'AI agents', 'autonomous agents', 'AI agent marketplace', 'on-chain AI',
    'agent coordination', 'x402', 'MetaMask Smart Accounts', 'ERC-7715', 'ERC-7710',
    'Venice AI', 'Base', 'USDC micropayments', 'The Graph', '1Shot', 'crypto AI', 'web3 AI',
  ],
  authors: [{ name: 'ARIA' }],
  creator: 'ARIA',
  publisher: 'ARIA',
  category: 'technology',
  icons: {
    icon: '/Logo.png',
    shortcut: '/Logo.png',
    apple: '/Logo.png',
  },
  openGraph: {
    type: 'website',
    siteName: 'ARIA',
    title: TITLE,
    description: DESCRIPTION,
    url: SITE_URL,
    images: [{ url: '/Logo.png', width: 1200, height: 630, alt: 'ARIA — Any goal. The right agents.' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
    images: ['/Logo.png'],
  },
  robots: { index: true, follow: true },
  alternates: { canonical: '/' },
}

export const viewport: Viewport = {
  themeColor: '#FF6B35',
  colorScheme: 'dark',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`dark ${chakraPetch.variable} ${hankenGrotesk.variable}`}>
      <body style={{ fontFamily: 'var(--font-body)', background: '#000000', color: '#FFFFFF' }}>
        {children}
      </body>
    </html>
  )
}
