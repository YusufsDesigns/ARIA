import { HTMLAttributes, ReactNode } from 'react'

export type AriaCardVariant =
  | 'default'
  | 'dots'
  | 'gradient'
  | 'plus'
  | 'neubrutalism'
  | 'inner'
  | 'lifted'
  | 'corners'

type AriaCardProps = HTMLAttributes<HTMLDivElement> & {
  variant?: AriaCardVariant
  children?: ReactNode
  className?: string
}

const DOT_BG = `radial-gradient(circle, #222 1px, transparent 1px)`
const PLUS_BG = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24'%3E%3Cpath d='M11 4h2v16h-2zM4 11h16v2H4z' fill='%23222'/%3E%3C/svg%3E")`

const BASE: React.CSSProperties = {
  boxSizing: 'border-box',
  position: 'relative',
}

function getStyle(variant: AriaCardVariant): React.CSSProperties {
  switch (variant) {
    case 'default':
      return { ...BASE, background: '#0D0D0D', border: '1px solid #1E1E1E', padding: '24px' }
    case 'dots':
      return { ...BASE, background: '#080808', backgroundImage: DOT_BG, backgroundSize: '16px 16px', border: '1px solid #1E1E1E', padding: '24px' }
    case 'gradient':
      return { ...BASE, background: 'linear-gradient(135deg, #0D0D0D 0%, #111 100%)', border: '1px solid #2A2A2A', padding: '24px' }
    case 'plus':
      return { ...BASE, background: '#080808', backgroundImage: PLUS_BG, backgroundSize: '24px 24px', border: '1px solid #1E1E1E', padding: '28px' }
    case 'neubrutalism':
      return { ...BASE, background: '#0D0D0D', border: '2px solid #FF6B35', boxShadow: '4px 4px 0px #FF6B35', padding: '24px' }
    case 'inner':
      return { ...BASE, background: '#050505', border: '1px solid #161616', padding: '20px' }
    case 'lifted':
      return { ...BASE, background: '#0D0D0D', border: '1px solid #2A2A2A', boxShadow: '0 8px 32px rgba(255,107,53,0.08), 0 2px 8px rgba(0,0,0,0.8)', padding: '24px' }
    case 'corners':
      return { ...BASE, background: '#0D0D0D', border: 'none', padding: '24px' }
  }
}

const CORNER: React.CSSProperties = {
  position: 'absolute',
  width: 12,
  height: 12,
  borderColor: '#FF6B35',
  borderStyle: 'solid',
}

export function AriaCard({ variant = 'default', children, className, style, ...rest }: AriaCardProps) {
  return (
    <div {...rest} className={className} style={{ ...getStyle(variant), ...(style ?? {}) }}>
      {variant === 'corners' && (
        <>
          <span style={{ ...CORNER, top: 0, left: 0, borderWidth: '1px 0 0 1px' }} />
          <span style={{ ...CORNER, top: 0, right: 0, borderWidth: '1px 1px 0 0' }} />
          <span style={{ ...CORNER, bottom: 0, left: 0, borderWidth: '0 0 1px 1px' }} />
          <span style={{ ...CORNER, bottom: 0, right: 0, borderWidth: '0 1px 1px 0' }} />
        </>
      )}
      {children}
    </div>
  )
}

export function AriaCardTitle({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <h3
      className={className}
      style={{
        fontFamily: 'var(--font-display)',
        fontSize: 15,
        fontWeight: 700,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        color: '#fff',
        marginBottom: 8,
      }}
    >
      {children}
    </h3>
  )
}

export function AriaCardDescription({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p
      className={className}
      style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: '#777', lineHeight: 1.6 }}
    >
      {children}
    </p>
  )
}
