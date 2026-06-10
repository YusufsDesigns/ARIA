const PINATA_JWT = process.env.PINATA_JWT!
const rawGateway = process.env.NEXT_PUBLIC_PINATA_GATEWAY ?? 'gateway.pinata.cloud'
const PINATA_GATEWAY = rawGateway.startsWith('http') ? rawGateway : `https://${rawGateway}`

export async function uploadAgentMetadata(metadata: object): Promise<string> {
  const res = await fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${PINATA_JWT}`,
    },
    body: JSON.stringify({
      pinataContent: metadata,
      pinataMetadata: { name: `aria-agent-${Date.now()}` },
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Pinata upload failed: ${err}`)
  }

  const data = (await res.json()) as { IpfsHash: string }
  return data.IpfsHash
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function fetchAgentMetadata(cid: string): Promise<any> {
  const res = await fetch(`${PINATA_GATEWAY}/ipfs/${cid}`)
  if (!res.ok) throw new Error(`IPFS fetch failed for CID: ${cid}`)
  return res.json()
}
