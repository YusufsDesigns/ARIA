import { NextRequest, NextResponse } from 'next/server'
import { getActiveAgents, getCapabilityGapsGraph } from '@/lib/graph'

// GET /api/agents?capability=market-intelligence
export async function GET(req: NextRequest) {
  const capability = req.nextUrl.searchParams.get('capability')
  const gaps = req.nextUrl.searchParams.get('gaps') === 'true'

  if (gaps) {
    const capGaps = await getCapabilityGapsGraph()
    return NextResponse.json(capGaps)
  }

  const agents = await getActiveAgents(capability ? [capability] : undefined)
  return NextResponse.json(agents)
}
