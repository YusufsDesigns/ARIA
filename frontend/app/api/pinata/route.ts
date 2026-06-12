import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const jwt = process.env.PINATA_JWT
  if (!jwt) {
    return NextResponse.json({ error: 'PINATA_JWT not configured' }, { status: 500 })
  }

  const body = await req.json()

  const res = await fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${jwt}`,
    },
    body: JSON.stringify({
      pinataContent: body,
      pinataMetadata: { name: `aria-agent-${Date.now()}` },
    }),
  })

  const data = await res.text()

  if (!res.ok) {
    return NextResponse.json({ error: `Pinata upload failed: ${data}` }, { status: res.status })
  }

  const parsed = JSON.parse(data) as { IpfsHash: string }
  return NextResponse.json({ cid: parsed.IpfsHash })
}
