import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/history?address=0x... — wallet-scoped task history for the sidebar.
export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get('address')
  if (!address) return NextResponse.json({ tasks: [] })

  const tasks = await prisma.task.findMany({
    where: { userAddress: address.toLowerCase() },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      input: true,
      status: true,
      totalSpent: true,
      parentTaskId: true,
      createdAt: true,
    },
    take: 50,
  })

  return NextResponse.json({ tasks })
}
