import { fetchAgentMetadata } from '../pinata'

// Process-lifetime IPFS manifest cache.
// Agent capabilities are immutable per contract design so manifests don't
// need TTL — a re-deploy (new CID) is the only mutation path.
const cache = new Map<string, any>()

export async function getManifestCached(cid: string): Promise<any> {
  if (cache.has(cid)) return cache.get(cid)!
  const manifest = await fetchAgentMetadata(cid)
  cache.set(cid, manifest)
  return manifest
}
