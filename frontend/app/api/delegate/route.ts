import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// POST /api/delegate — store user permission context after ERC-7715 grant
export async function POST(req: NextRequest) {
  const { userAddress, permissionContext, permissionFrom, expiresAt, periodAmountUsdc } =
    (await req.json()) as {
      userAddress: string
      permissionContext: string
      permissionFrom?: string
      expiresAt: string
      periodAmountUsdc: number
    }

  if (!userAddress || !permissionContext) {
    return NextResponse.json(
      { error: 'userAddress and permissionContext required' },
      { status: 400 }
    )
  }

  const permission = await prisma.userPermission.upsert({
    where: { userAddress },
    update: {
      permissionContext,
      permissionFrom: permissionFrom ?? null,
      expiresAt: new Date(expiresAt),
      periodAmountUsdc,
    },
    create: {
      userAddress,
      permissionContext,
      permissionFrom: permissionFrom ?? null,
      expiresAt: new Date(expiresAt),
      periodAmountUsdc,
    },
  })

  return NextResponse.json({ ok: true, userAddress: permission.userAddress })
}

// GET /api/delegate?address=xxx — retrieve stored permission
export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get('address')
  if (!address) return NextResponse.json({ error: 'address required' }, { status: 400 })

  const permission = await prisma.userPermission.findUnique({
    where: { userAddress: address },
  })

  if (!permission) return NextResponse.json({ error: 'not found' }, { status: 404 })

  // Check expiry
  if (new Date(permission.expiresAt) < new Date()) {
    return NextResponse.json({ error: 'permission expired' }, { status: 410 })
  }

  return NextResponse.json(permission)
}
