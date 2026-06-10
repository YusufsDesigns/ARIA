import { gql, request } from 'graphql-request'
import { getAllActiveAgents, getAgent, getCapabilityGaps } from './registry'

const GRAPH_URL = process.env.NEXT_PUBLIC_GRAPH_URL ?? ''

const GET_AGENTS = gql`
  query GetAgents($capabilities: [String!]) {
    agents(
      where: { isActive: true, capabilities_contains: $capabilities }
      orderBy: tasksCompleted
      orderDirection: desc
    ) {
      id
      owner
      name
      capabilities
      pricePerTask
      ipfsCID
      tasksCompleted
      totalRating
      ratingCount
      registeredAt
    }
  }
`

const GET_GAPS = gql`
  query GetGaps {
    capabilityRequests(orderBy: demand, orderDirection: desc, first: 20) {
      id
      capability
      demand
      lastRequestedAt
    }
  }
`

export type GraphAgent = {
  id: string
  owner: string
  name: string
  capabilities: string[]
  pricePerTask: string
  ipfsCID: string
  tasksCompleted: string
  totalRating: string
  ratingCount: string
  registeredAt: string
}

export type GraphCapabilityGap = {
  id: string
  capability: string
  demand: string
  lastRequestedAt: string
}

// Auto-switches: Graph if deployed, contract reads as fallback
export const getActiveAgents = async (capabilities?: string[]): Promise<GraphAgent[]> => {
  if (GRAPH_URL) {
    try {
      const data = await request<{ agents: GraphAgent[] }>(
        GRAPH_URL,
        GET_AGENTS,
        { capabilities: capabilities ?? null },
      )
      return data.agents
    } catch {
      // Graph not reachable or subgraph not deployed — fall through
    }
  }

  // Fallback: direct contract reads via viem
  const agentIds = (await getAllActiveAgents()) as `0x${string}`[]
  const agents = await Promise.all(
    agentIds.map(async (id) => {
      const a = await getAgent(id)
      return {
        id,
        owner: a.owner,
        name: '',
        capabilities: a.capabilities,
        pricePerTask: a.pricePerTask.toString(),
        ipfsCID: a.ipfsCID,
        tasksCompleted: a.tasksCompleted.toString(),
        totalRating: a.totalRatingX100.toString(),
        ratingCount: a.ratingCount.toString(),
        registeredAt: a.registeredAt.toString(),
      }
    })
  )

  if (capabilities && capabilities.length > 0) {
    return agents.filter((a) =>
      capabilities.some((cap) => a.capabilities.includes(cap))
    )
  }
  return agents
}

export const getCapabilityGapsGraph = async (): Promise<GraphCapabilityGap[]> => {
  if (GRAPH_URL) {
    try {
      const data = await request<{ capabilityRequests: GraphCapabilityGap[] }>(
        GRAPH_URL,
        GET_GAPS,
      )
      return data.capabilityRequests
    } catch {
      // Fall through to contract reads
    }
  }

  const [caps, demands] = await getCapabilityGaps()
  return (caps as string[])
    .map((cap, i) => ({
      id: cap,
      capability: cap,
      demand: (demands as bigint[])[i].toString(),
      lastRequestedAt: '0',
    }))
    .sort((a, b) => Number(b.demand) - Number(a.demand))
}

export const getAgentsByCapabilityGraph = async (capability: string): Promise<GraphAgent[]> => {
  return getActiveAgents([capability])
}
