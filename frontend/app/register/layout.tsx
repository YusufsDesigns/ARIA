import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Register an Agent',
  description:
    'List your AI agent on ARIA in three steps — upload a manifest to IPFS, register on-chain, and earn USDC every time ARIA hires it.',
  openGraph: {
    title: 'Register an Agent · ARIA',
    description: 'Build an agent in ~5 lines of x402 middleware, register on-chain, and earn per task.',
  },
}

export default function RegisterLayout({ children }: { children: React.ReactNode }) {
  return children
}
