'use client'

import { ReactNode } from 'react'

export type DisplayCardItem = {
  title: string
  description: string
  date: string
  icon?: ReactNode
  iconClassName?: string
  titleClassName?: string
  className?: string
}

type DisplayCardsProps = {
  cards?: DisplayCardItem[]
  className?: string
}

const DEFAULT_CARDS: DisplayCardItem[] = [
  {
    title: 'Market Intelligence',
    description: 'Searches live web for market data and competitor analysis',
    date: '0.30 USDC / task',
  },
  {
    title: 'On-chain Analytics',
    description: 'Reads blockchain data: holders, TVL, contract patterns',
    date: '0.50 USDC / task',
  },
  {
    title: 'Visual Asset Generator',
    description: 'Creates launch banners and brand visuals via Venice AI',
    date: '0.40 USDC / task',
  },
]

function Card({
  card,
  offset,
  rotate,
  zIndex,
  opacity,
}: {
  card: DisplayCardItem
  offset: { x: number; y: number }
  rotate: number
  zIndex: number
  opacity: number
}) {
  return (
    <div
      style={{
        position: 'absolute',
        width: 280,
        transform: `translate(${offset.x}px, ${offset.y}px) rotate(${rotate}deg)`,
        zIndex,
        opacity,
        transition: 'transform 300ms ease, opacity 300ms ease',
      }}
    >
      <div style={{
        background: '#0D0D0D',
        border: '1px solid #2A2A2A',
        padding: '20px 24px',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Orange corner accent */}
        <div style={{
          position: 'absolute', top: 0, left: 0, width: 3, height: 40, background: '#FF6B35',
        }} />
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          {card.icon && (
            <div style={{
              width: 36, height: 36, border: '1px solid #2A2A2A',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, color: '#FF6B35',
            }} className={card.iconClassName}>
              {card.icon}
            </div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{
              fontFamily: 'var(--font-display)',
              fontSize: 13,
              fontWeight: 700,
              color: '#FF6B35',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              marginBottom: 4,
            }} className={card.titleClassName}>
              {card.title}
            </p>
            <p style={{
              fontFamily: 'var(--font-body)',
              fontSize: 12,
              color: '#777',
              lineHeight: 1.5,
              marginBottom: 10,
            }}>
              {card.description}
            </p>
            <span style={{
              fontFamily: 'var(--font-display)',
              fontSize: 11,
              color: '#22C55E',
              letterSpacing: '0.06em',
              background: '#22C55E15',
              border: '1px solid #22C55E30',
              padding: '2px 8px',
            }}>
              {card.date}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

export function DisplayCards({ cards = DEFAULT_CARDS, className }: DisplayCardsProps) {
  const positions = [
    { offset: { x: 0, y: 0 }, rotate: 0, zIndex: 3, opacity: 1 },
    { offset: { x: 28, y: -22 }, rotate: 4, zIndex: 2, opacity: 0.85 },
    { offset: { x: 52, y: -44 }, rotate: 8, zIndex: 1, opacity: 0.65 },
  ]

  return (
    <div className={className} style={{ position: 'relative', width: 340, height: 200 }}>
      {cards.slice(0, 3).map((card, i) => (
        <Card key={i} card={card} {...positions[i]} />
      ))}
    </div>
  )
}
