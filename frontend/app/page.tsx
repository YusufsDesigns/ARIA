'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { SmokeBackground } from '@/components/ui/smoke-background'
import { AgentPlanDemo, type PlanTask } from '@/components/ui/agent-plan'
import { DisplayCards } from '@/components/ui/display-cards'
import { AriaCard } from '@/components/ui/aria-card'
import { AriaFooter } from '@/components/ui/aria-footer'
import { ConnectButton } from '@/components/wallet/ConnectButton'
import { useRouter } from 'next/navigation'

// ─── Demo data ────────────────────────────────────────────────────────────────
const DEMO_TASKS: PlanTask[] = [
  {
    id: '1', title: 'Orchestrator Reasoning', status: 'completed',
    description: 'Venice AI analyses your goal and identifies required capabilities',
    tools: ['Venice AI — llama-3.3-70b'],
    subtasks: [
      { id: '1.1', title: 'Analyse task requirements', status: 'completed', tools: ['Venice text'] },
      { id: '1.2', title: 'Query on-chain agent registry', status: 'completed', tools: ['AgentRegistry'] },
      { id: '1.3', title: 'Plan execution sequence', status: 'completed', tools: ['Venice reasoning'] },
    ],
  },
  {
    id: '2', title: 'Market Intelligence Agent', status: 'in-progress',
    description: 'Searches live web for competitor data — paid 0.30 USDC',
    tools: ['Venice web-search', 'x402 Payment'],
    subtasks: [
      { id: '2.1', title: 'Web search: competitor tokens', status: 'completed', tools: ['Venice search'] },
      { id: '2.2', title: 'Analyse market positioning', status: 'in-progress', tools: ['Venice text'] },
      { id: '2.3', title: 'Return findings to orchestrator', status: 'pending' },
    ],
  },
  {
    id: '3', title: 'On-chain Analytics Agent', status: 'pending',
    description: 'Reads blockchain data via Etherscan — paid 0.50 USDC',
    tools: ['Etherscan API', 'Venice analysis', 'x402 Payment'],
  },
  {
    id: '4', title: 'Visual Asset Agent', status: 'pending',
    description: 'Generates launch banner + TTS audio — paid 0.40 USDC',
    tools: ['Venice image', 'Venice TTS', 'x402 Payment'],
  },
]

const DISPLAY_CARD_DATA = [
  { title: 'Market Intelligence', description: 'Searches live web for market data and competitor analysis', date: '0.30 USDC / task' },
  { title: 'On-chain Analytics', description: 'Reads blockchain data: holders, TVL, contract patterns', date: '0.50 USDC / task' },
  { title: 'Visual Asset Generator', description: 'Creates launch banners and brand visuals via Venice AI', date: '0.40 USDC / task' },
]

const QUICK_PROMPTS = [
  'Launch a memecoin called MOONCAT on Base',
  'Research the top DeFi protocols by TVL',
  'Analyse Uniswap v4 competition',
  'Create a Web3 gaming campaign',
]

// Gap cards show example capabilities — real demand tracked on-chain via AgentRegistry
const GAP_CARDS = [
  { cap: 'video-generation', desc: 'Generate video content and animations from text or image prompts' },
  { cap: 'legal-analysis', desc: 'Review smart contracts and on-chain agreements for legal risk' },
  { cap: 'defi-risk-scoring', desc: 'Score DeFi protocol risk based on TVL, audits, and on-chain signals' },
]

const CAPABILITY_TAGS = [
  'market-intelligence', 'web-search', 'image-generation', 'onchain-analytics',
  'copywriting', 'tts', 'strategy', 'video-production', 'competitor-analysis',
  'smart-contract-analysis', 'brand-assets', 'positioning',
]

// ─── Sticky nav ───────────────────────────────────────────────────────────────
function Nav() {
  const router = useRouter()
  const handleConnect = (addr: string) => {
    sessionStorage.setItem('aria_address', addr)
    router.push('/app')
  }

  return (
    <nav style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
      background: 'rgba(0,0,0,0.0)',
      padding: '0 32px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      height: 64,
      transition: 'background 300ms',
    }}>
      <Image src="/Logo.png" alt="ARIA" width={72} height={28} style={{ objectFit: 'contain' }} priority />
      <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
        <div className="aria-nav-links">
          {[{ label: 'Agents', href: '/agents' }, { label: 'Build', href: '/register' }].map(({ label, href }) => (
            <Link key={label} href={href} style={{
              fontFamily: 'var(--font-display)', fontSize: 11, fontWeight: 600,
              letterSpacing: '0.1em', textTransform: 'uppercase',
              color: 'rgba(255,255,255,0.5)', textDecoration: 'none',
            }}>
              {label}
            </Link>
          ))}
        </div>
        <ConnectButton onConnected={handleConnect} budgetUsdc={10}>
          TRY ARIA →
        </ConnectButton>
      </div>
    </nav>
  )
}

// ─── Section helpers ──────────────────────────────────────────────────────────
function Label({ children }: { children: string }) {
  return (
    <p style={{
      fontFamily: 'var(--font-display)', fontSize: 10, fontWeight: 700,
      color: '#FF6B35', letterSpacing: '0.22em', textTransform: 'uppercase', marginBottom: 18,
    }}>
      {children}
    </p>
  )
}

function SectionHeading({ children, center }: { children: React.ReactNode; center?: boolean }) {
  return (
    <h2 style={{
      fontFamily: 'var(--font-display)',
      fontSize: 'clamp(28px, 3.5vw, 44px)',
      fontWeight: 700, letterSpacing: '-0.01em', textTransform: 'uppercase',
      lineHeight: 1.05, color: '#fff', marginBottom: 14,
      textAlign: center ? 'center' : 'left',
    }}>
      {children}
    </h2>
  )
}

// ─── Section 1: Hero (full-viewport, Claude-style centered prompt) ─────────────
function Hero() {
  const [prompt, setPrompt] = useState('')
  const [focused, setFocused] = useState(false)
  const router = useRouter()

  const handleConnect = (addr: string) => {
    sessionStorage.setItem('aria_address', addr)
    router.push('/app')
  }

  return (
    <section style={{
      position: 'relative',
      width: '100%',
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    }}>
      {/* Full-viewport smoke */}
      <SmokeBackground smokeColor="#FF6B35" />

      {/* Centered content — Claude/ChatGPT layout */}
      <div style={{
        position: 'relative',
        zIndex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 0,
        width: '100%',
        maxWidth: 680,
        padding: '0 24px',
        textAlign: 'center',
      }}>
        {/* ARIA logo */}
        <Image
          src="/Logo.png"
          alt="ARIA"
          width={120}
          height={46}
          style={{ objectFit: 'contain', marginBottom: 32, filter: 'brightness(0) invert(1)' }}
          priority
        />

        {/* Headline — supporting, not dominant */}
        <p style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'clamp(16px, 2.2vw, 22px)',
          fontWeight: 600,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          color: 'rgba(255,255,255,0.55)',
          marginBottom: 36,
          lineHeight: 1.4,
        }}>
          Any goal. The right agents.
        </p>

        {/* Prompt box — wide, centered, Claude-style */}
        <div style={{
          width: '100%',
          background: 'rgba(10,10,10,0.82)',
          backdropFilter: 'blur(20px)',
          border: `1px solid ${focused ? 'rgba(255,107,53,0.6)' : 'rgba(255,255,255,0.08)'}`,
          padding: '4px 4px 4px 0',
          transition: 'border-color 200ms',
          marginBottom: 16,
        }}>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder="What do you want to accomplish today?"
            rows={3}
            style={{
              width: '100%', background: 'transparent', border: 'none', outline: 'none',
              fontFamily: 'var(--font-body)', fontSize: 15, color: '#fff',
              padding: '16px 20px', resize: 'none', lineHeight: 1.6,
              caretColor: '#FF6B35',
            }}
          />
        </div>

        {/* Quick prompts */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 28 }}>
          {QUICK_PROMPTS.map((q) => (
            <button
              key={q}
              onClick={() => setPrompt(q)}
              style={{
                fontFamily: 'var(--font-body)', fontSize: 12,
                color: 'rgba(255,255,255,0.4)',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                padding: '5px 12px', cursor: 'pointer',
                transition: 'all 150ms',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = '#FF6B35'; e.currentTarget.style.borderColor = 'rgba(255,107,53,0.4)' }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.4)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)' }}
            >
              {q}
            </button>
          ))}
        </div>

        {/* CTA */}
        <ConnectButton onConnected={handleConnect} budgetUsdc={10} />

        <p style={{
          fontFamily: 'var(--font-body)', fontSize: 11,
          color: 'rgba(255,255,255,0.25)', marginTop: 20, letterSpacing: '0.04em',
        }}>
          Powered by Venice AI · Zero data retention · ERC-7710 micropayments
        </p>
      </div>

      {/* Scroll cue */}
      <div style={{
        position: 'absolute', bottom: 32, left: '50%', transform: 'translateX(-50%)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
        animation: 'bounce 2s ease-in-out infinite',
      }}>
        <p style={{ fontFamily: 'var(--font-display)', fontSize: 9, color: 'rgba(255,255,255,0.2)', letterSpacing: '0.18em', textTransform: 'uppercase' }}>
          Scroll
        </p>
        <svg width="12" height="8" viewBox="0 0 12 8" fill="none">
          <path d="M1 1l5 5 5-5" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </div>

      <style>{`@keyframes bounce { 0%,100%{transform:translateX(-50%) translateY(0)} 50%{transform:translateX(-50%) translateY(6px)} }`}</style>
    </section>
  )
}

// ─── Shared section background variants ──────────────────────────────────────
// Use backgroundColor + backgroundImage separately to avoid CSS shorthand conflicts
const BG_GRID: React.CSSProperties = {
  backgroundColor: '#020202',
  backgroundImage: `linear-gradient(rgba(255,107,53,0.13) 1px, transparent 1px),
                    linear-gradient(90deg, rgba(255,107,53,0.13) 1px, transparent 1px)`,
  backgroundSize: '72px 72px',
}
const BG_DOTS: React.CSSProperties = {
  backgroundColor: '#000',
  backgroundImage: `radial-gradient(rgba(255,107,53,0.28) 1px, transparent 1px)`,
  backgroundSize: '36px 36px',
}
const BG_GLOW_LEFT: React.CSSProperties = {
  backgroundColor: '#050505',
  backgroundImage: `radial-gradient(ellipse 70% 60% at 0% 40%, rgba(255,107,53,0.24) 0%, transparent 60%)`,
}
const BG_GLOW_RIGHT: React.CSSProperties = {
  backgroundColor: '#050505',
  backgroundImage: `radial-gradient(ellipse 70% 60% at 100% 70%, rgba(255,107,53,0.24) 0%, transparent 60%)`,
}
const BG_GLOW_CENTER: React.CSSProperties = {
  backgroundColor: '#050505',
  backgroundImage: `radial-gradient(ellipse 80% 60% at 50% 50%, rgba(255,107,53,0.20) 0%, transparent 65%)`,
}

// ─── Section 2: Stats + How It Works ──────────────────────────────────────────
function HowItWorks() {
  const [stats, setStats] = useState({ agents: 0, tasks: 0, usdc: '0', caps: 0 })

  useEffect(() => {
    fetch('/api/agents')
      .then((r) => r.json())
      .then((agents: { capabilities?: string[]; tasksCompleted?: unknown }[]) => {
        const totalTasks = agents.reduce((a, ag: any) => a + (Number(ag.tasksCompleted) || 0), 0)
        const totalUsdcRaw = agents.reduce((a: number, ag: any) => {
          const price = Number(ag.pricePerTask) / 1e6
          return a + (Number(ag.tasksCompleted) || 0) * (price || 0)
        }, 0)
        setStats({
          agents: agents.length,
          tasks: totalTasks,
          usdc: totalTasks > 0 ? totalUsdcRaw.toFixed(2) : '0',
          caps: new Set(agents.flatMap((a) => a.capabilities ?? [])).size,
        })
      })
      .catch(() => {})
  }, [])

  const steps = [
    {
      n: '01', title: 'DESCRIBE', body: 'Type your goal in plain language. ARIA handles the rest — no prompting skills, no technical knowledge required.',
      sub: ['Natural language input', 'No API keys needed', 'Works for any domain'],
    },
    {
      n: '02', title: 'ARIA ASSEMBLES', body: 'Venice AI reasons about your task using ReAct — Reason → Search → Act → Observe. Non-linear. Adaptive.',
      sub: ['On-chain agent discovery', 'x402 micropayments', 'ERC-7710 delegation chain'],
    },
    {
      n: '03', title: 'RESULTS, PRIVATELY', body: 'Every AI inference goes through Venice. Zero data retained. Zero logged. Your strategy stays yours.',
      sub: ['Venice zero-retention', 'Privacy receipt per task', 'No training on your data'],
    },
  ]

  return (
    <section className="aria-section" style={{ ...BG_GRID, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
      <div style={{ maxWidth: 1160, margin: '0 auto' }}>

        {/* Stats row — real on-chain data */}
        <div className="aria-grid-4" style={{ marginBottom: 80 }}>
          {[
            { label: 'AGENTS REGISTERED', value: stats.agents },
            { label: 'TASKS COMPLETED', value: stats.tasks },
            { label: 'USDC PAID OUT', value: `$${stats.usdc}` },
            { label: 'CAPABILITIES', value: stats.caps },
          ].map(({ label, value }) => (
            <AriaCard key={label} variant="corners" style={{ textAlign: 'center', padding: '28px 16px' }}>
              <p style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(26px,3vw,40px)', fontWeight: 700, color: '#FF6B35', marginBottom: 10, letterSpacing: '-0.02em' }}>
                {value}
              </p>
              <p style={{ fontFamily: 'var(--font-display)', fontSize: 9, color: '#333', letterSpacing: '0.16em', textTransform: 'uppercase' }}>
                {label}
              </p>
            </AriaCard>
          ))}
        </div>

        {/* How it works */}
        <div style={{ textAlign: 'center', marginBottom: 56 }}>
          <Label>How It Works</Label>
          <SectionHeading center>THREE STEPS TO RESULTS</SectionHeading>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 15, color: '#555', maxWidth: 480, margin: '0 auto', lineHeight: 1.7 }}>
            ARIA replaces the complexity of hiring, managing, and paying AI specialists with a single prompt.
          </p>
        </div>

        <div className="aria-grid-3">
          {steps.map((s) => (
            <AriaCard key={s.n} variant="plus" style={{ position: 'relative', overflow: 'hidden', padding: 36 }}>
              <div style={{
                position: 'absolute', top: 12, right: 16,
                fontFamily: 'var(--font-display)', fontSize: 72, fontWeight: 700,
                color: '#0D0D0D', lineHeight: 1, userSelect: 'none',
              }}>
                {s.n}
              </div>
              <p style={{ fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 700, color: '#FF6B35', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 16 }}>
                {s.title}
              </p>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: '#777', lineHeight: 1.7, marginBottom: 20 }}>
                {s.body}
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {s.sub.map((item) => (
                  <div key={item} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ width: 4, height: 4, background: '#FF6B35', flexShrink: 0 }} />
                    <span style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: '#555' }}>{item}</span>
                  </div>
                ))}
              </div>
            </AriaCard>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── Section 3: Live Coordination ─────────────────────────────────────────────
function LiveCoordination() {
  return (
    <section className="aria-section" style={{ ...BG_GLOW_LEFT, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
      <div style={{ maxWidth: 1160, margin: '0 auto' }}>
        <div className="aria-grid-2-wide" style={{ marginBottom: 48 }}>
          <div>
            <Label>Watch ARIA Work</Label>
            <SectionHeading>LIVE AGENT COORDINATION</SectionHeading>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 15, color: '#555', lineHeight: 1.8, marginBottom: 28 }}>
              ARIA's orchestrator uses the ReAct pattern — Reason → Act → Observe — to dynamically hire the right agents for each step.
              The plan evolves based on what each agent finds. Non-linear. Adaptive.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                { icon: '⬡', label: 'On-chain agent registry', desc: 'AgentRegistry.sol on Base Sepolia' },
                { icon: '⬡', label: 'x402 micropayments', desc: '0.20–0.60 USDC per agent call' },
                { icon: '⬡', label: 'ERC-7710 delegation', desc: 'Secure sub-delegation chain' },
                { icon: '⬡', label: 'Venice AI reasoning', desc: 'llama-3.3-70b orchestrator brain' },
              ].map(({ icon, label, desc }) => (
                <div key={label} style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                  <span style={{ color: '#FF6B35', fontSize: 10, flexShrink: 0, paddingTop: 4 }}>{icon}</span>
                  <div>
                    <p style={{ fontFamily: 'var(--font-display)', fontSize: 11, fontWeight: 700, color: '#ccc', letterSpacing: '0.08em', textTransform: 'uppercase' }}>{label}</p>
                    <p style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: '#444' }}>{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div>
            <AgentPlanDemo tasks={DEMO_TASKS} />
          </div>
        </div>
      </div>
    </section>
  )
}

// ─── Section 4: Agent Economy ──────────────────────────────────────────────────
function AgentEconomy() {
  return (
    <section className="aria-section" style={{ ...BG_DOTS, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
      <div style={{ maxWidth: 1160, margin: '0 auto' }}>
        <div className="aria-grid-2-wide">
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <DisplayCards cards={DISPLAY_CARD_DATA} />
          </div>
          <div>
            <Label>Agent Economy</Label>
            <SectionHeading>AN OPEN ECONOMY OF SPECIALISTS</SectionHeading>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 15, color: '#555', lineHeight: 1.8, marginBottom: 32 }}>
              Any developer can list a specialist agent and earn USDC every time it runs.
              Agents compete on quality and price — best performer wins.
            </p>
            <div className="aria-grid-2" style={{ marginBottom: 32 }}>
              {[
                { label: 'Market Intelligence', price: '0.30', cap: 'web-search' },
                { label: 'On-chain Analytics', price: '0.50', cap: 'blockchain-data' },
                { label: 'Strategy & Positioning', price: '0.20', cap: 'copywriting' },
                { label: 'Visual Asset Generator', price: '0.40', cap: 'image-generation' },
              ].map(({ label, price, cap }) => (
                <AriaCard key={label} variant="inner" style={{ padding: '16px 20px' }}>
                  <p style={{ fontFamily: 'var(--font-display)', fontSize: 11, fontWeight: 700, color: '#fff', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 4 }}>{label}</p>
                  <p style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: '#444', marginBottom: 10 }}>{cap}</p>
                  <p style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, color: '#22C55E' }}>{price} USDC</p>
                </AriaCard>
              ))}
            </div>
            <Link href="/agents" style={{
              fontFamily: 'var(--font-display)', fontSize: 11, fontWeight: 700,
              letterSpacing: '0.12em', textTransform: 'uppercase',
              color: '#FF6B35', border: '1px solid #FF6B35',
              padding: '12px 24px', textDecoration: 'none', display: 'inline-block',
            }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#FF6B35'; e.currentTarget.style.color = '#000' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#FF6B35' }}
            >
              Browse All Agents →
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}

// ─── Section 5: Privacy ────────────────────────────────────────────────────────
function PrivacySection() {
  return (
    <section className="aria-section" style={{ ...BG_GLOW_RIGHT, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
      <div style={{ maxWidth: 1160, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 64 }}>
          <Label>Privacy by Architecture</Label>
          <SectionHeading center>ZERO RETENTION. BY DESIGN.</SectionHeading>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 15, color: '#555', maxWidth: 500, margin: '0 auto', lineHeight: 1.7 }}>
            Venice AI processes every inference privately. Your task content is never stored, never logged, never used for training.
          </p>
        </div>

        <div className="aria-grid-2" style={{ marginBottom: 40 }}>
          <AriaCard variant="gradient" style={{ padding: 44 }}>
            <p style={{ fontFamily: 'var(--font-display)', fontSize: 11, fontWeight: 700, color: '#333', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 28 }}>
              Standard AI Platforms
            </p>
            {[
              ['Your prompts logged', 'Stored indefinitely on company servers'],
              ['Data used for training', 'Your strategy improves their next model'],
              ['Competitor data exposed', 'Sensitive research visible to platform'],
              ['Business strategy at risk', 'Pre-launch plans may surface in AI outputs'],
            ].map(([title, desc]) => (
              <div key={title} style={{ display: 'flex', gap: 14, marginBottom: 18, alignItems: 'flex-start' }}>
                <span style={{ color: '#EF4444', fontSize: 13, flexShrink: 0, marginTop: 2 }}>✕</span>
                <div>
                  <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: '#444', marginBottom: 2 }}>{title}</p>
                  <p style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: '#333' }}>{desc}</p>
                </div>
              </div>
            ))}
          </AriaCard>

          <AriaCard variant="neubrutalism" style={{ padding: 44 }}>
            <p style={{ fontFamily: 'var(--font-display)', fontSize: 11, fontWeight: 700, color: '#FF6B35', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 28 }}>
              ARIA × Venice AI
            </p>
            {[
              ['Zero data retention', 'Inference results purged immediately after delivery'],
              ['Zero training on your data', 'Venice uses open weights — no proprietary training'],
              ['Private by architecture', 'Not a policy choice — a technical guarantee'],
              ['Privacy receipt per task', 'Cryptographic proof of zero retention after every run'],
            ].map(([title, desc]) => (
              <div key={title} style={{ display: 'flex', gap: 14, marginBottom: 18, alignItems: 'flex-start' }}>
                <span style={{ color: '#22C55E', fontSize: 13, flexShrink: 0, marginTop: 2 }}>✓</span>
                <div>
                  <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: '#fff', marginBottom: 2 }}>{title}</p>
                  <p style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: '#555' }}>{desc}</p>
                </div>
              </div>
            ))}
          </AriaCard>
        </div>

        {/* Venice badge */}
        <AriaCard variant="inner" style={{ padding: '20px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <p style={{ fontFamily: 'var(--font-display)', fontSize: 12, fontWeight: 700, color: '#FF6B35', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            Powered by Venice — Privacy-First AI Infrastructure
          </p>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: '#444' }}>
            All 5 Venice modalities: text · web search · web scraping · image generation · TTS
          </p>
        </AriaCard>
      </div>
    </section>
  )
}

// ─── Section 6: Features ──────────────────────────────────────────────────────
function FeaturesSection() {
  return (
    <section className="aria-section" style={{ ...BG_GRID, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
      <div style={{ maxWidth: 1160, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 64 }}>
          <Label>Under the Hood</Label>
          <SectionHeading center>BUILT ON OPEN STANDARDS</SectionHeading>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 15, color: '#555', maxWidth: 480, margin: '0 auto', lineHeight: 1.7 }}>
            Every payment, permission, and agent interaction is verifiable on-chain. No black boxes.
          </p>
        </div>

        <div className="aria-grid-2" style={{ marginBottom: 2 }}>
          {/* Smart Permissions */}
          <AriaCard variant="default" style={{ padding: 40 }}>
            <p style={{ fontFamily: 'var(--font-display)', fontSize: 10, color: '#FF6B35', letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 16 }}>ERC-7710 / ERC-7715</p>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, textTransform: 'uppercase', marginBottom: 14, lineHeight: 1.2 }}>
              SET IT ONCE.<br />ARIA HANDLES THE REST.
            </h3>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: '#555', lineHeight: 1.7, marginBottom: 28 }}>
              Grant budget permissions via MetaMask Smart Accounts. One MetaMask popup. Agents work within your limits — enforced on-chain, not by trust.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[
                { node: 'Your MetaMask Wallet', note: 'signs once', color: '#FF6B35' },
                { node: 'ARIA Orchestrator', note: 'manages budget', color: '#fff' },
                { node: 'Agent 1 · Agent 2 · Agent 3', note: 'sub-delegations', color: '#555' },
              ].map(({ node, note, color }, i) => (
                <div key={node}>
                  {i > 0 && <div style={{ width: 1, height: 14, background: '#222', marginLeft: 14, marginBottom: 6 }} />}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{
                      fontFamily: 'var(--font-display)', fontSize: 10, fontWeight: 700,
                      letterSpacing: '0.08em', textTransform: 'uppercase',
                      color, background: '#111', border: '1px solid #222', padding: '5px 12px',
                    }}>
                      {node}
                    </span>
                    <span style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: '#333' }}>{note}</span>
                  </div>
                </div>
              ))}
            </div>
          </AriaCard>

          {/* Micropayments */}
          <AriaCard variant="lifted" style={{ padding: 40 }}>
            <p style={{ fontFamily: 'var(--font-display)', fontSize: 10, color: '#FF6B35', letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 16 }}>x402 MICROPAYMENTS</p>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, textTransform: 'uppercase', marginBottom: 14, lineHeight: 1.2 }}>
              PAY ONLY FOR<br />WHAT&apos;S USED.
            </h3>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: '#555', lineHeight: 1.7, marginBottom: 28 }}>
              Every agent call is an exact USDC micropayment via x402. No subscriptions. No monthly bills. Pure pay-per-use — relayed by 1Shot with no ETH needed.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[
                { name: 'Market Intelligence', amt: '0.30 USDC', ok: true },
                { name: 'Competitive Technical', amt: '0.50 USDC', ok: true },
                { name: 'Visual Asset Generator', amt: '0.40 USDC', ok: false },
              ].map((p) => (
                <div key={p.name} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  background: '#0D0D0D', border: '1px solid #1A1A1A', padding: '8px 14px',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', flexShrink: 0, background: p.ok ? '#22C55E' : '#FF6B35' }} />
                    <span style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: '#777' }}>{p.name}</span>
                  </div>
                  <span style={{ fontFamily: 'var(--font-display)', fontSize: 11, fontWeight: 700, color: '#22C55E', letterSpacing: '0.06em' }}>
                    {p.amt}
                  </span>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 14px', borderTop: '1px solid #1A1A1A', marginTop: 4 }}>
                <span style={{ fontFamily: 'var(--font-display)', fontSize: 10, color: '#444', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Total paid</span>
                <span style={{ fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 700, color: '#FF6B35' }}>1.20 USDC</span>
              </div>
            </div>
          </AriaCard>
        </div>

        {/* Capabilities wide card */}
        <AriaCard variant="dots" style={{ padding: 40 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
            <div>
              <p style={{ fontFamily: 'var(--font-display)', fontSize: 10, color: '#FF6B35', letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 8 }}>On-chain Economy</p>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                CAPABILITIES GROW WITH THE NETWORK
              </h3>
            </div>
            <Link href="/agents" style={{ fontFamily: 'var(--font-display)', fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#FF6B35', textDecoration: 'none', border: '1px solid #FF6B3540', padding: '8px 16px' }}>
              Browse Registry →
            </Link>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {CAPABILITY_TAGS.map((c) => (
              <span key={c} style={{
                fontFamily: 'var(--font-display)', fontSize: 10, fontWeight: 700,
                color: '#FF6B35', border: '1px solid #FF6B3430',
                background: '#FF6B3408', padding: '6px 12px', letterSpacing: '0.08em', textTransform: 'uppercase',
              }}>
                {c}
              </span>
            ))}
          </div>
        </AriaCard>
      </div>
    </section>
  )
}

// ─── Section 7: Developer CTA ─────────────────────────────────────────────────
function DevCTA() {
  const code = `// 1. Add x402 middleware (5 lines)
app.use(paymentMiddleware({
  'POST /execute': {
    accepts: [{ scheme: 'exact', price: '$0.30',
      network: 'eip155:84532',
      payTo: '0xYourWallet' }]
  }
}, resourceServer))

// 2. Return standard AgentResponse
app.post('/execute', async (req, res) => {
  const { task, context } = req.body
  const result = await yourAgentLogic(task, context)
  res.json({ status: 'success', output: result,
    outputType: 'text', contentType: 'text/plain',
    executionTime: 1.2 })
})`

  return (
    <section className="aria-section" style={{ ...BG_GLOW_CENTER, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
      <div style={{ maxWidth: 1160, margin: '0 auto' }}>
        <AriaCard variant="dots" style={{ padding: '64px 56px' }}>
          <div className="aria-grid-2-mid">
            <div>
              <Label>For Developers</Label>
              <SectionHeading>BUILD AN AGENT.<br />EARN EVERY RUN.</SectionHeading>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: 15, color: '#555', lineHeight: 1.8, marginBottom: 32 }}>
                Any language. Any AI. 5 lines of x402 middleware. Register on-chain with MetaMask. Your agent earns USDC every time ARIA hires it.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 36 }}>
                {[
                  '1. Build your agent service (any language, any AI)',
                  '2. Add 5 lines of x402 payment middleware',
                  '3. Upload metadata to IPFS via Pinata',
                  '4. Register on-chain — MetaMask signs once',
                  '5. ARIA discovers and hires it automatically',
                ].map((step) => (
                  <div key={step} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                    <span style={{ width: 4, height: 4, background: '#FF6B35', flexShrink: 0, marginTop: 8 }} />
                    <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: '#555', lineHeight: 1.5 }}>{step}</p>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <Link href="/register" style={{ fontFamily: 'var(--font-display)', fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#000', background: '#FF6B35', padding: '14px 24px', textDecoration: 'none', display: 'inline-block' }}>
                  Register Your Agent →
                </Link>
                <Link href="/agents" style={{ fontFamily: 'var(--font-display)', fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#fff', border: '1px solid #333', padding: '14px 24px', textDecoration: 'none', display: 'inline-block' }}>
                  Browse Existing
                </Link>
              </div>
            </div>
            <AriaCard variant="inner" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ background: '#080808', borderBottom: '1px solid #111', padding: '10px 16px', display: 'flex', gap: 6 }}>
                {['#EF4444', '#F59E0B', '#22C55E'].map((c) => (
                  <span key={c} style={{ width: 10, height: 10, borderRadius: '50%', background: c }} />
                ))}
                <span style={{ fontFamily: 'var(--font-display)', fontSize: 9, color: '#333', letterSpacing: '0.1em', marginLeft: 8 }}>AGENT SERVER — x402</span>
              </div>
              <pre style={{ padding: '24px', fontFamily: 'monospace', fontSize: 12, color: '#667', lineHeight: 1.8, overflowX: 'auto', margin: 0 }}>
                <span style={{ color: '#555' }}>{`// 1. Add x402 middleware (5 lines)\n`}</span>
                <span style={{ color: '#aaa' }}>{`app.use(paymentMiddleware({\n`}</span>
                <span style={{ color: '#aaa' }}>{`  'POST /execute': {\n`}</span>
                <span style={{ color: '#aaa' }}>{`    accepts: [{ scheme: `}</span><span style={{ color: '#FF6B35' }}>{`'exact'`}</span><span style={{ color: '#aaa' }}>{`, price: `}</span><span style={{ color: '#22C55E' }}>{`'$0.30'`}</span><span style={{ color: '#aaa' }}>{`,\n`}</span>
                <span style={{ color: '#aaa' }}>{`      network: `}</span><span style={{ color: '#22C55E' }}>{`'eip155:84532'`}</span><span style={{ color: '#aaa' }}>{`,\n`}</span>
                <span style={{ color: '#aaa' }}>{`      payTo: `}</span><span style={{ color: '#22C55E' }}>{`'0xYourWallet'`}</span><span style={{ color: '#aaa' }}>{` }]\n`}</span>
                <span style={{ color: '#aaa' }}>{`  }\n}, resourceServer))\n\n`}</span>
                <span style={{ color: '#555' }}>{`// 2. Return standard AgentResponse\n`}</span>
                <span style={{ color: '#aaa' }}>{`app.post(`}</span><span style={{ color: '#22C55E' }}>{`'/execute'`}</span><span style={{ color: '#aaa' }}>{`, async (req, res) => {\n`}</span>
                <span style={{ color: '#aaa' }}>{`  const { task, context } = req.body\n`}</span>
                <span style={{ color: '#aaa' }}>{`  res.json({ status: `}</span><span style={{ color: '#22C55E' }}>{`'success'`}</span><span style={{ color: '#aaa' }}>{`, output })\n})`}</span>
              </pre>
            </AriaCard>
          </div>
        </AriaCard>
      </div>
    </section>
  )
}

// ─── Section 8: Capability Gaps ───────────────────────────────────────────────
function CapabilityGaps() {
  return (
    <section className="aria-section" style={{ ...BG_DOTS, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
      <div style={{ maxWidth: 1160, margin: '0 auto' }}>
        <div style={{ marginBottom: 56 }}>
          <Label>What ARIA Needs Next</Label>
          <SectionHeading>OPEN CAPABILITIES. YOUR OPPORTUNITY.</SectionHeading>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 15, color: '#555', lineHeight: 1.8, maxWidth: 560 }}>
            When ARIA&apos;s orchestrator searches for a capability and finds no registered agent, it logs that gap on-chain.
            These capability types have no agents yet — build one and be the first to earn.
          </p>
        </div>

        <div className="aria-grid-3" style={{ marginBottom: 32 }}>
          {GAP_CARDS.map((g) => (
            <AriaCard key={g.cap} variant="neubrutalism" style={{ padding: 32, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <p style={{
                fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700,
                color: '#FF6B35', letterSpacing: '0.08em', textTransform: 'uppercase',
              }}>
                {g.cap}
              </p>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: '#555', lineHeight: 1.6 }}>
                {g.desc}
              </p>
              <p style={{ fontFamily: 'var(--font-display)', fontSize: 10, color: '#333', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                No agent registered yet
              </p>
              <Link href={`/register?capability=${g.cap}`} style={{
                fontFamily: 'var(--font-display)', fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
                color: '#FF6B35', border: '1px solid #FF6B3440', padding: '8px 16px', textDecoration: 'none', display: 'inline-block', marginTop: 4,
              }}>
                Build This Agent →
              </Link>
            </AriaCard>
          ))}
        </div>

        <div style={{ textAlign: 'center' }}>
          <Link href="/agents#gaps" style={{
            fontFamily: 'var(--font-display)', fontSize: 11, color: '#444',
            letterSpacing: '0.12em', textTransform: 'uppercase', textDecoration: 'none',
          }}>
            See live capability gaps on the registry →
          </Link>
        </div>
      </div>
    </section>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function LandingPage() {
  return (
    <div style={{ minHeight: '100vh', background: '#000', color: '#fff' }}>
      <Nav />
      <Hero />
      <HowItWorks />
      <LiveCoordination />
      <AgentEconomy />
      <PrivacySection />
      <FeaturesSection />
      <DevCTA />
      <CapabilityGaps />
      <AriaFooter />
    </div>
  )
}
