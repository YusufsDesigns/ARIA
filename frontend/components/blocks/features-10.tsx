import { ReactNode } from 'react'
import { AriaCard } from '@/components/ui/aria-card'

type Feature = {
  title: string
  description: string
  badge?: string
  content: ReactNode
  wide?: boolean
}

type Features10Props = {
  features: Feature[]
  className?: string
}

export function Features10({ features, className }: Features10Props) {
  return (
    <div className={className} style={{ display: 'grid', gap: 2 }}>
      {/* First row: up to 2 equal cards */}
      {features.length >= 2 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
          {features.slice(0, 2).map((f, i) => (
            <FeatureCard key={i} feature={f} />
          ))}
        </div>
      )}

      {/* Second row: remaining wide cards */}
      {features.slice(2).map((f, i) => (
        <FeatureCard key={i + 2} feature={f} wide />
      ))}
    </div>
  )
}

function FeatureCard({ feature, wide }: { feature: Feature; wide?: boolean }) {
  return (
    <AriaCard
      variant="default"
      style={{
        gridColumn: wide ? '1 / -1' : undefined,
        display: 'flex',
        flexDirection: wide ? 'row' : 'column',
        gap: 32,
        alignItems: wide ? 'center' : 'flex-start',
        padding: '40px',
        overflow: 'hidden',
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        {feature.badge && (
          <span style={{
            display: 'inline-block',
            fontFamily: 'var(--font-display)',
            fontSize: 9,
            fontWeight: 700,
            color: '#FF6B35',
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            background: '#FF6B3515',
            border: '1px solid #FF6B3535',
            padding: '2px 8px',
            marginBottom: 16,
          }}>
            {feature.badge}
          </span>
        )}
        <h3 style={{
          fontFamily: 'var(--font-display)',
          fontSize: 20,
          fontWeight: 700,
          color: '#fff',
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          marginBottom: 12,
          lineHeight: 1.2,
        }}>
          {feature.title}
        </h3>
        <p style={{
          fontFamily: 'var(--font-body)',
          fontSize: 14,
          color: '#666',
          lineHeight: 1.7,
          maxWidth: 420,
        }}>
          {feature.description}
        </p>
      </div>
      {feature.content && (
        <div style={{ flex: 1, minWidth: 0 }}>
          {feature.content}
        </div>
      )}
    </AriaCard>
  )
}
