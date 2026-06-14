'use client'

import Link from 'next/link'
import Image from 'next/image'

const LINKS = [
  { label: 'App', href: '/app' },
  { label: 'Agents', href: '/agents' },
  { label: 'Register', href: '/register' },
  { label: 'Venice AI', href: 'https://venice.ai' },
]

const MARQUEE_TEXT = 'ARIA · AUTONOMOUS REASONING · VENICE AI · ZERO RETENTION · ERC-7710 · OPEN AGENTS · EARN USDC · ARIA · AUTONOMOUS REASONING · VENICE AI · ZERO RETENTION · ERC-7710 · OPEN AGENTS · EARN USDC · '

export function AriaFooter() {
  return (
    <footer style={{
      position: 'relative',
      background: '#000',
      borderTop: '1px solid #111',
      overflow: 'hidden',
      paddingTop: 0,
    }}>
      {/* Grid background */}
      <div style={{
        position: 'absolute',
        inset: 0,
        backgroundImage: `
          linear-gradient(rgba(255,107,53,0.03) 1px, transparent 1px),
          linear-gradient(90deg, rgba(255,107,53,0.03) 1px, transparent 1px)
        `,
        backgroundSize: '60px 60px',
        pointerEvents: 'none',
      }} />

      {/* Aurora glow */}
      <div style={{
        position: 'absolute',
        bottom: -80,
        left: '50%',
        transform: 'translateX(-50%)',
        width: 600,
        height: 200,
        background: 'radial-gradient(ellipse, rgba(255,107,53,0.12) 0%, transparent 70%)',
        pointerEvents: 'none',
        animation: 'breathe 6s ease-in-out infinite',
      }} />

      {/* Diagonal marquee band */}
      <div style={{
        position: 'relative',
        background: '#FF6B35',
        padding: '10px 0',
        overflow: 'hidden',
        transform: 'rotate(-1.5deg) scaleX(1.1)',
        marginTop: 0,
      }}>
        <div style={{
          display: 'flex',
          animation: 'marquee 30s linear infinite',
          whiteSpace: 'nowrap',
        }}>
          <span style={{
            fontFamily: 'var(--font-display)',
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.14em',
            color: '#000',
            textTransform: 'uppercase',
            paddingRight: 0,
          }}>
            {MARQUEE_TEXT}{MARQUEE_TEXT}
          </span>
        </div>
      </div>

      {/* Main content */}
      <div style={{ position: 'relative', padding: 'clamp(40px,8vw,64px) clamp(20px,5vw,48px) 48px', maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'clamp(32px,5vw,64px)', alignItems: 'flex-start' }}>
          {/* Left: Wordmark */}
          <div>
            <Link href="/" style={{ display: 'inline-block', marginBottom: 20, textDecoration: 'none' }}>
              <Image
                src="/Logo.png"
                alt="ARIA"
                width={100}
                height={38}
                style={{ objectFit: 'contain' }}
              />
            </Link>
            <p style={{
              fontFamily: 'var(--font-body)',
              fontSize: 13,
              color: '#444',
              lineHeight: 1.7,
              maxWidth: 320,
            }}>
              Any goal. The right agents. Zero data retained.
              The first AI coordination platform built on open agent standards.
            </p>
          </div>

          {/* Right: Nav + badges */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
            <nav style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {LINKS.map(({ label, href }) => (
                <Link
                  key={label}
                  href={href}
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: 12,
                    fontWeight: 600,
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    color: '#555',
                    textDecoration: 'none',
                    transition: 'color 150ms',
                  }}
                  onMouseEnter={(e) => { (e.target as HTMLElement).style.color = '#FF6B35' }}
                  onMouseLeave={(e) => { (e.target as HTMLElement).style.color = '#555' }}
                >
                  {label}
                </Link>
              ))}
            </nav>

            {/* Glass pill badges */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {['Venice AI', '1Shot', 'Base Sepolia', 'ERC-7710'].map((badge) => (
                <span key={badge} style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 9,
                  fontWeight: 700,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  color: '#888',
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid #222',
                  padding: '4px 12px',
                  borderRadius: 0,
                  backdropFilter: 'blur(4px)',
                }}>
                  {badge}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div style={{
          marginTop: 64,
          paddingTop: 24,
          borderTop: '1px solid #111',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 16,
        }}>
          <span style={{
            fontFamily: 'var(--font-display)',
            fontSize: 10,
            color: '#333',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
          }}>
            © 2025 ARIA
          </span>
          <span style={{
            fontFamily: 'var(--font-display)',
            fontSize: 10,
            color: '#333',
            letterSpacing: '0.08em',
          }}>
            POWERED BY VENICE AI · METAMASK SMART ACCOUNTS · 1SHOT
          </span>
        </div>
      </div>

      <style>{`
        @keyframes marquee {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
        @keyframes breathe {
          0%, 100% { opacity: 0.8; transform: translateX(-50%) scale(1); }
          50% { opacity: 1; transform: translateX(-50%) scale(1.15); }
        }
      `}</style>
    </footer>
  )
}
