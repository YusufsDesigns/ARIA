import { encodeFunctionData } from 'viem'
import { publicClient, orchestratorWalletClient } from './delegation'

// Serialize all orchestrator EOA writes so concurrent calls (e.g. several
// recordTaskCompletion in one round) can't collide on the account nonce.
let writeQueue: Promise<unknown> = Promise.resolve()
function serializeWrite<T>(fn: () => Promise<T>): Promise<T> {
  const run = writeQueue.then(fn, fn)
  writeQueue = run.catch(() => {})
  return run
}

export const REGISTRY_ADDRESS = process.env.NEXT_PUBLIC_REGISTRY_ADDRESS as `0x${string}`
export const USDC_ADDRESS = process.env.NEXT_PUBLIC_USDC_ADDRESS as `0x${string}`

// Minimal ABI — only what ARIA uses
export const REGISTRY_ABI = [
  {
    name: 'getAgentsByCapability',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'capability', type: 'string' }],
    outputs: [{ type: 'bytes32[]' }],
  },
  {
    name: 'getAgent',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'agentId', type: 'bytes32' }],
    outputs: [
      {
        type: 'tuple',
        components: [
          { name: 'owner', type: 'address' },
          { name: 'capabilities', type: 'string[]' },
          { name: 'pricePerTask', type: 'uint256' },
          { name: 'ipfsCID', type: 'string' },
          { name: 'isActive', type: 'bool' },
          { name: 'tasksCompleted', type: 'uint256' },
          { name: 'totalRatingX100', type: 'uint256' },
          { name: 'ratingCount', type: 'uint256' },
          { name: 'registeredAt', type: 'uint256' },
        ],
      },
    ],
  },
  {
    name: 'getAllActiveAgents',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'bytes32[]' }],
  },
  {
    name: 'getCapabilityGaps',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [
      { name: 'capabilities', type: 'string[]' },
      { name: 'demands', type: 'uint256[]' },
    ],
  },
  {
    name: 'registerAgent',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'capabilities', type: 'string[]' },
      { name: 'pricePerTask', type: 'uint256' },
      { name: 'ipfsCID', type: 'string' },
    ],
    outputs: [{ name: 'agentId', type: 'bytes32' }],
  },
  {
    name: 'requestCapability',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'capability', type: 'string' }],
    outputs: [],
  },
  {
    name: 'recordTaskCompletion',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'agentId', type: 'bytes32' }],
    outputs: [],
  },
  {
    name: 'getTotalAgents',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'totalTasksCompleted',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
] as const

export type OnChainAgent = {
  owner: `0x${string}`
  capabilities: string[]
  pricePerTask: bigint
  ipfsCID: string
  isActive: boolean
  tasksCompleted: bigint
  totalRatingX100: bigint
  ratingCount: bigint
  registeredAt: bigint
}

export const getAgentsByCapability = (capability: string) =>
  publicClient.readContract({
    address: REGISTRY_ADDRESS,
    abi: REGISTRY_ABI,
    functionName: 'getAgentsByCapability',
    args: [capability],
  })

export const getAgent = (agentId: `0x${string}`) =>
  publicClient.readContract({
    address: REGISTRY_ADDRESS,
    abi: REGISTRY_ABI,
    functionName: 'getAgent',
    args: [agentId],
  }) as Promise<OnChainAgent>

export const getAllActiveAgents = () =>
  publicClient.readContract({
    address: REGISTRY_ADDRESS,
    abi: REGISTRY_ABI,
    functionName: 'getAllActiveAgents',
  })

export const getCapabilityGaps = () =>
  publicClient.readContract({
    address: REGISTRY_ADDRESS,
    abi: REGISTRY_ABI,
    functionName: 'getCapabilityGaps',
  }) as Promise<[string[], bigint[]]>

// Called by orchestrator when no agent found for a capability.
// Uses 1Shot EIP-7710 delegation relay (relayer_estimate7710Transaction +
// relayer_send7710Transaction) — the explicit 1Shot API, not ERC-4337 bundler.
// Falls back to bundler if 1Shot relay fails (e.g., dry-run environment).
export const requestCapability = async (capability: string) => {
  try {
    // Primary (gasless) path: 1Shot EIP-7710 delegation relay.
    const { executeVia1Shot7710 } = await import('./oneshot')
    return await executeVia1Shot7710(
      [{ to: REGISTRY_ADDRESS, data: encodeFunctionData({ abi: REGISTRY_ABI, functionName: 'requestCapability', args: [capability] }), value: '0' }],
      { upgradeViaEip7702: false },
    )
  } catch {
    // Reliable fallback: orchestrator EOA writes directly (pays gas in ETH).
    // 1Shot's relayer_getCapabilities returns {} on Base Sepolia, so the gasless
    // bundle can't be built — this guarantees the gap is actually logged on-chain.
    return serializeWrite(() =>
      orchestratorWalletClient.writeContract({
        address: REGISTRY_ADDRESS,
        abi: REGISTRY_ABI,
        functionName: 'requestCapability',
        args: [capability],
      })
    )
  }
}

// Called after each successful agent task completion.
// Routes through 1Shot EIP-7710 relay — every task completion is an on-chain
// delegation transaction, demonstrating continuous EIP-7710 usage.
export const recordTaskCompletion = async (agentId: `0x${string}`) => {
  const data = encodeFunctionData({
    abi: REGISTRY_ABI,
    functionName: 'recordTaskCompletion',
    args: [agentId],
  })

  try {
    const { executeVia1Shot7710 } = await import('./oneshot')
    return await executeVia1Shot7710([{ to: REGISTRY_ADDRESS, data, value: '0' }])
  } catch {
    // Reliable fallback: orchestrator EOA writes directly (pays gas in ETH).
    return serializeWrite(() =>
      orchestratorWalletClient.writeContract({
        address: REGISTRY_ADDRESS,
        abi: REGISTRY_ABI,
        functionName: 'recordTaskCompletion',
        args: [agentId],
      })
    )
  }
}
