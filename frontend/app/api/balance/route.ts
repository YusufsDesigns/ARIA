import { NextRequest, NextResponse } from 'next/server'
import { createPublicClient, http, formatUnits, erc20Abi, isAddress } from 'viem'
import { baseSepolia } from 'viem/chains'
import { prisma } from '@/lib/prisma'

// Read-only balance endpoint. Deliberately does NOT import lib/delegation (which
// requires the orchestrator private key) — a public balance read needs no signer.
const USDC = (process.env.NEXT_PUBLIC_USDC_ADDRESS ?? '0x036CbD53842c5426634e7929541eC2318f3dCF7e') as `0x${string}`

const publicClient = createPublicClient({
  chain: baseSepolia,
  transport: http(process.env.ALCHEMY_RPC_URL ?? 'https://sepolia.base.org'),
})

// GET /api/balance?address=0x... → USDC + ETH balance of the SPENDING account.
// The connected address may differ from the account that actually funds agent
// payments (the ERC-7715 grant's `from` = the user's smart account). We resolve
// that payer from the stored permission so the tracker shows the balance that
// actually matters for hiring agents.
export async function GET(req: NextRequest) {
  const connected = req.nextUrl.searchParams.get('address')
  if (!connected || !isAddress(connected)) {
    return NextResponse.json({ error: 'valid address required' }, { status: 400 })
  }

  // Resolve the real payer (smart account) from the stored grant, if any.
  let payer = connected as `0x${string}`
  try {
    const perm = await prisma.userPermission.findUnique({
      where: { userAddress: connected.toLowerCase() },
    })
    if (perm?.permissionFrom && isAddress(perm.permissionFrom)) {
      payer = perm.permissionFrom as `0x${string}`
    }
  } catch {
    /* no permission row — fall back to the connected address */
  }

  try {
    const [usdcRaw, ethRaw] = await Promise.all([
      publicClient.readContract({
        address: USDC,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [payer],
      }),
      publicClient.getBalance({ address: payer }),
    ])

    return NextResponse.json(
      {
        address: payer,
        isPayer: payer.toLowerCase() !== connected.toLowerCase(),
        usdc: Number(formatUnits(usdcRaw as bigint, 6)),
        eth: Number(formatUnits(ethRaw, 18)),
      },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 502 })
  }
}
