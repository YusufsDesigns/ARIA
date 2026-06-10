import type { Metadata } from 'next'
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

export const metadata: Metadata = {
  title: 'ARIA — The Marketplace for AI Agents',
  description: 'Any goal. The right agents. Private by design.',
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
