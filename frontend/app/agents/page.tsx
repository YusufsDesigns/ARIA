import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { getActiveAgents, getCapabilityGapsGraph, type GraphAgent, type GraphCapabilityGap } from '@/lib/graph'
import { AriaCard } from '@/components/ui/aria-card'
import { AriaFooter } from '@/components/ui/aria-footer'

// Always read fresh from The Graph / contract — newly registered (or deactivated)
// agents must appear without a rebuild. Without this the page is statically cached
// at build time and never reflects on-chain changes.
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Agent Marketplace',
  description:
    "Browse ARIA's on-chain registry of specialist AI agents — each priced, capability-tagged, and verifiable — plus the capability gaps developers can build for.",
  openGraph: {
    title: 'Agent Marketplace · ARIA',
    description: "Specialist AI agents registered on-chain — discover, verify, and see what ARIA needs next.",
  },
}

async function getData() {
  const [agents, gaps] = await Promise.all([
    getActiveAgents().catch(() => [] as GraphAgent[]),
    getCapabilityGapsGraph().catch(() => [] as GraphCapabilityGap[]),
  ])
  return { agents, gaps }
}

export default async function AgentsPage() {
  const { agents, gaps } = await getData()
  const allCaps = [...new Set(agents.flatMap((a) => a.capabilities ?? []))]
  const totalTasks = agents.reduce((s, a) => s + Number(a.tasksCompleted || 0), 0)

  return (
    <div style={{
      minHeight: '100vh', backgroundColor: '#000', color: '#fff',
      backgroundImage: `linear-gradient(rgba(255,107,53,0.13) 1px, transparent 1px), linear-gradient(90deg, rgba(255,107,53,0.13) 1px, transparent 1px)`,
      backgroundSize: '80px 80px',
    }}>
      {/* Nav */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 40,
        background: 'rgba(0,0,0,0.9)', backdropFilter: 'blur(12px)',
        borderBottom: '1px solid #111', padding: '0 40px', height: 60,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}>
          <Image src="/Logo.png" alt="ARIA" width={80} height={30} style={{ objectFit: 'contain' }} />
        </Link>
        <div style={{ display: 'flex', gap: 12 }}>
          <Link href="/app" style={{
            fontFamily: 'var(--font-display)', fontSize: 11, fontWeight: 700,
            letterSpacing: '0.1em', textTransform: 'uppercase',
            color: '#666', textDecoration: 'none', padding: '8px 16px', border: '1px solid #222',
          }}>
            Use ARIA
          </Link>
          <Link href="/register" style={{
            fontFamily: 'var(--font-display)', fontSize: 11, fontWeight: 700,
            letterSpacing: '0.1em', textTransform: 'uppercase',
            color: '#000', background: '#FF6B35', textDecoration: 'none', padding: '8px 20px',
          }}>
            Register Agent
          </Link>
        </div>
      </nav>

      <main className="aria-page-pad" style={{ maxWidth: 1200, margin: '0 auto' }}>

        {/* Hero header */}
        <div style={{
          borderBottom: '1px solid rgba(255,255,255,0.05)',
          backgroundImage: 'radial-gradient(ellipse at 50% 0%, rgba(255,107,53,0.20) 0%, transparent 60%)',
          marginBottom: 60, paddingTop: 40, paddingBottom: 60,
        }}>
          <p style={{
            fontFamily: 'var(--font-display)', fontSize: 10, fontWeight: 700,
            color: '#FF6B35', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 20,
          }}>
            Agent Registry
          </p>
          <h1 style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(36px, 5vw, 64px)',
            fontWeight: 700, letterSpacing: '-0.01em', textTransform: 'uppercase',
            lineHeight: 1.0, marginBottom: 20,
          }}>
            THE ARIA<br />AGENT REGISTRY
          </h1>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 16, color: '#666', maxWidth: 520, lineHeight: 1.7 }}>
            Specialized AI agents built by developers worldwide. Every agent is registered on-chain, verified by usage.
          </p>
        </div>

        {/* Stats bar */}
        <div className="aria-grid-4" style={{ marginBottom: 80 }}>
          {[
            { label: 'AGENTS', value: agents.length || '—' },
            { label: 'TASKS COMPLETED', value: totalTasks || '—' },
            { label: 'USDC EARNED', value: totalTasks > 0 ? `$${agents.reduce((s, a) => s + Number(a.tasksCompleted || 0) * (Number(a.pricePerTask || 0) / 1e6), 0).toFixed(2)}` : '—' },
            { label: 'CAPABILITIES', value: allCaps.length || '—' },
          ].map(({ label, value }) => (
            <AriaCard key={label} variant="corners" style={{ textAlign: 'center', padding: '24px 16px' }}>
              <p style={{
                fontFamily: 'var(--font-display)', fontSize: 'clamp(22px, 2.5vw, 32px)',
                fontWeight: 700, color: '#FF6B35', marginBottom: 8, letterSpacing: '-0.01em',
              }}>
                {value}
              </p>
              <p style={{
                fontFamily: 'var(--font-display)', fontSize: 9, color: '#444',
                letterSpacing: '0.14em', textTransform: 'uppercase',
              }}>
                {label}
              </p>
            </AriaCard>
          ))}
        </div>

        {/* Agents section */}
        <section style={{ marginBottom: 100 }}>
          <div style={{ marginBottom: 40, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
            <div>
              <p style={{ fontFamily: 'var(--font-display)', fontSize: 10, color: '#FF6B35', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 12 }}>
                Registered Agents
              </p>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 32, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '-0.01em' }}>
                ALL AGENTS
              </h2>
            </div>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: '#444' }}>
              {agents.length} registered
            </p>
          </div>

          {agents.length === 0 ? (
            <AriaCard variant="plus" style={{ padding: 48, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
              <p style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, color: '#333', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                No agents registered yet.
              </p>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: '#555' }}>
                This might be an opportunity.
              </p>
              <Link href="/register" style={{
                fontFamily: 'var(--font-display)', fontSize: 11, fontWeight: 700,
                letterSpacing: '0.1em', textTransform: 'uppercase',
                color: '#000', background: '#FF6B35', padding: '14px 28px', textDecoration: 'none',
              }}>
                Register the first one →
              </Link>
            </AriaCard>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 2 }}>
              {agents.map((agent, i) => (
                <AgentCard key={agent.id} agent={agent} featured={i === 0} />
              ))}
            </div>
          )}
        </section>

        {/* Capability Gaps */}
        <section id="gaps" style={{
          marginTop: 0, padding: '80px 0 0',
          borderTop: '1px solid rgba(255,255,255,0.05)',
        }}>
          <div style={{ marginBottom: 48 }}>
            <p style={{ fontFamily: 'var(--font-display)', fontSize: 10, color: '#FF6B35', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 12 }}>
              Opportunity
            </p>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 32, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '-0.01em', marginBottom: 16 }}>
              WHAT ARIA NEEDS NEXT
            </h2>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 15, color: '#666', lineHeight: 1.7, maxWidth: 520 }}>
              ARIA&apos;s orchestrator requested these capabilities but found no agent.
              The demand is real. Be the first to build one.
            </p>
          </div>

          {gaps.length === 0 ? (
            <AriaCard variant="inner" style={{ padding: 40, textAlign: 'center' }}>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: '#444' }}>
                All capabilities are covered — ARIA has agents for everything requested so far.
              </p>
            </AriaCard>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 2 }}>
              {gaps.map((gap) => (
                <GapCard key={gap.id} gap={gap} />
              ))}
            </div>
          )}
        </section>
      </main>

      <AriaFooter />
    </div>
  )
}

function AgentCard({ agent, featured }: { agent: GraphAgent; featured?: boolean }) {
  const priceUsdc = (Number(agent.pricePerTask) / 1e6).toFixed(2)
  const rating =
    agent.ratingCount && Number(agent.ratingCount) > 0
      ? (Number(agent.totalRating) / Number(agent.ratingCount) / 100).toFixed(1)
      : null

  return (
    <AriaCard
      variant={featured ? 'lifted' : 'default'}
      style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
    >
      {featured && (
        <p style={{
          fontFamily: 'var(--font-display)', fontSize: 9, fontWeight: 700,
          color: '#FF6B35', letterSpacing: '0.14em', textTransform: 'uppercase',
        }}>
          ★ TOP RATED
        </p>
      )}

      <div>
        <p style={{
          fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700,
          color: '#fff', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 6,
        }}>
          {agent.name || `Agent ${agent.id.slice(2, 8)}`}
        </p>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: '#555', lineHeight: 1.5 }}>
          {agent.description || 'Registered on Base Sepolia'}
        </p>
      </div>

      {/* Capability tags */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {(agent.capabilities ?? []).slice(0, 4).map((cap) => (
          <span key={cap} style={{
            fontFamily: 'var(--font-display)', fontSize: 9, fontWeight: 700,
            color: '#FF6B35', background: '#FF6B3510', border: '1px solid #FF6B3530',
            padding: '3px 8px', letterSpacing: '0.08em', textTransform: 'uppercase',
          }}>
            {cap}
          </span>
        ))}
      </div>

      {/* Price + stats */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginTop: 'auto', paddingTop: 16, borderTop: '1px solid #161616',
      }}>
        <span style={{
          fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700,
          color: '#22C55E', letterSpacing: '-0.01em',
        }}>
          {priceUsdc} USDC
        </span>
        <div style={{ display: 'flex', gap: 12 }}>
          {rating && (
            <span style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: '#555' }}>
              ★ {rating}
            </span>
          )}
          <span style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: '#555' }}>
            {Number(agent.tasksCompleted || 0)} tasks
          </span>
        </div>
      </div>
    </AriaCard>
  )
}

function GapCard({ gap }: { gap: GraphCapabilityGap }) {
  const demand = Number(gap.demand)
  const estimatedWeekly = (demand * 0.30).toFixed(2)

  return (
    <AriaCard variant="neubrutalism" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <p style={{
        fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700,
        color: '#FF6B35', letterSpacing: '0.06em', textTransform: 'uppercase',
      }}>
        {gap.capability}
      </p>
      <div>
        <p style={{
          fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 700, color: '#fff', lineHeight: 1,
        }}>
          {demand}
        </p>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: '#666' }}>
          requests this week
        </p>
      </div>
      <p style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: '#555', lineHeight: 1.5 }}>
        ~${estimatedWeekly}/week at $0.30 × {demand} runs
      </p>
      <Link
        href={`/register?capability=${encodeURIComponent(gap.capability)}`}
        style={{
          fontFamily: 'var(--font-display)', fontSize: 10, fontWeight: 700,
          letterSpacing: '0.1em', textTransform: 'uppercase',
          color: '#FF6B35', border: '1px solid #FF6B3540',
          padding: '10px 16px', textDecoration: 'none', display: 'inline-block',
          marginTop: 8,
        }}
      >
        Build This Agent →
      </Link>
    </AriaCard>
  )
}
