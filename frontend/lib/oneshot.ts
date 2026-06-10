import { encodeFunctionData, toHex } from 'viem'

const ONE_SHOT_RPC = process.env.ONE_SHOT_RPC ?? 'https://relayer.1shotapi.com/relayers'
const CHAIN_ID = '84532' // Base Sepolia
const USDC_ADDRESS = (process.env.NEXT_PUBLIC_USDC_ADDRESS ?? '0x036CbD53842c5426634e7929541eC2318f3dCF7e') as `0x${string}`

const ERC20_TRANSFER_ABI = [
  {
    name: 'transfer',
    type: 'function' as const,
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
  },
] as const

type JsonRpcResult<T> = { result: T; error?: { code: number; message: string } }

async function rpc<T>(method: string, params: unknown): Promise<T> {
  const res = await fetch(ONE_SHOT_RPC, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  })
  const json = (await res.json()) as JsonRpcResult<T>
  if (json.error) throw new Error(`1Shot error: ${json.error.message}`)
  return json.result
}

export type OneShotCapabilities = {
  chainId: string
  paymentTokens: string[]
  feeCollector: string
  targetAddress: string
}

// Call first — source-of-truth for accepted tokens and feeCollector
export const getCapabilities = () =>
  rpc<OneShotCapabilities>('relayer_getCapabilities', [CHAIN_ID])

export type OneShotFeeData = {
  gasPrice: string
  rate: string
  minFee: string
  expiry: string
  context: string
}

export const getFeeData = (tokenAddress: string) =>
  rpc<OneShotFeeData>('relayer_getFeeData', { chainId: CHAIN_ID, token: tokenAddress })

export type OneShotEstimate = {
  success: boolean
  requiredPaymentAmount: string
  gasUsed: string
  context: string
}

export const estimateTransaction = (bundle: unknown) =>
  rpc<OneShotEstimate>('relayer_estimate7710Transaction', bundle)

export type OneShotTaskId = string

export const sendTransaction = (bundle: unknown) =>
  rpc<OneShotTaskId>('relayer_send7710Transaction', bundle)

export type OneShotStatus = {
  status: 'Pending' | 'Submitted' | 'Confirmed' | 'Rejected' | 'Reverted'
  txHash?: string
}

export const getStatus = (taskId: string) =>
  rpc<OneShotStatus>('relayer_getStatus', { taskId })

// Poll until terminal state (Confirmed | Rejected | Reverted)
export async function waitForConfirmation(
  taskId: string,
  timeoutMs = 60_000
): Promise<OneShotStatus> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const status = await getStatus(taskId)
    if (['Confirmed', 'Rejected', 'Reverted'].includes(status.status)) {
      return status
    }
    await new Promise((r) => setTimeout(r, 3000))
  }
  throw new Error(`1Shot task ${taskId} timed out after ${timeoutMs}ms`)
}

// ─── EIP-7710 + EIP-7702 relay via 1Shot's delegation API ────────────────────
//
// Flow (per 1Shot docs at 1shotapi.com/docs/quickstarts/gas-sponsorship-eip7710):
//   1. relayer_getCapabilities  → targetAddress, feeCollector, paymentTokens
//   2. relayer_getFeeData       → minFee (USDC floor for this transaction)
//   3. Build bundle: [fee transfer, ...work transactions]
//   4. Create EIP-7710 delegation: orchestrator → 1Shot targetAddress
//   5. Sign delegation with orchestrator smart account
//   6. relayer_estimate7710Transaction → validated context (price-lock, ~45s)
//   7. relayer_send7710Transaction     → taskId
//   8. relayer_getStatus polls to terminal state
//
// EIP-7702: On first use (upgradeViaEip7702=true), include authorizationList so
// 1Shot upgrades the orchestrator EOA to a smart account in the same transaction.

export type OneShotTransaction = {
  to: `0x${string}`
  data: `0x${string}`
  value?: string
}

export async function executeVia1Shot7710(
  workTransactions: OneShotTransaction[],
  options: { upgradeViaEip7702?: boolean } = {}
): Promise<{ taskId: string; txHash?: string }> {
  // Import lazily to avoid circular-import issues at module level
  const {
    getOrchestratorSmartAccount,
    orchestratorEOA,
    orchestratorWalletClient,
    publicClient: pubClient,
  } = await import('./delegation')

  // Step 1: Discover relayer capabilities
  const caps = await getCapabilities()
  const paymentToken = caps.paymentTokens[0] as `0x${string}`

  // Step 2: Get fee floor — gas cost expressed in USDC
  const feeData = await getFeeData(paymentToken)
  const feeAmount = BigInt(feeData.minFee)

  // Step 3: Build fee-payment transaction (USDC → feeCollector)
  const feeTx: OneShotTransaction = {
    to: USDC_ADDRESS,
    data: encodeFunctionData({
      abi: ERC20_TRANSFER_ABI,
      functionName: 'transfer',
      args: [caps.feeCollector as `0x${string}`, feeAmount],
    }),
    value: '0',
  }
  const allTransactions = [feeTx, ...workTransactions]
  const txBundle = allTransactions.map(t => ({ to: t.to, data: t.data, value: t.value ?? '0' }))

  // Step 4: Create EIP-7710 root delegation: orchestrator → 1Shot targetAddress
  // 0xff...ff is the root authority constant (no parent delegation)
  const ROOT_AUTHORITY = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff' as `0x${string}`
  const account = await getOrchestratorSmartAccount()
  const rawDelegation = {
    delegate: caps.targetAddress as `0x${string}`,
    delegator: account.address,
    authority: ROOT_AUTHORITY,
    caveats: [] as { enforcer: `0x${string}`; terms: `0x${string}`; args: `0x${string}` }[],
    // Fresh random salt per delegation — prevents replay attacks
    salt: toHex(BigInt(Date.now()) * BigInt(100_000) + BigInt(Math.floor(Math.random() * 100_000)), { size: 32 }),
  }

  // Step 5: Sign the delegation with orchestrator smart account
  const signature = await account.signDelegation({ delegation: rawDelegation })
  const signedDelegation = { ...rawDelegation, signature }

  // Format delegation for 1Shot JSON-RPC API
  const oneShotDelegation = {
    to: signedDelegation.delegate,
    from: signedDelegation.delegator,
    authority: signedDelegation.authority,
    caveats: signedDelegation.caveats,
    nonce: signedDelegation.salt,
    signature: signedDelegation.signature,
  }

  // Step 6: Estimate — validates bundle and returns price-locked context (~45s window)
  const estimate = await estimateTransaction({
    chainId: CHAIN_ID,
    transactions: txBundle,
    delegation: oneShotDelegation,
    context: '',
  })

  // Build final bundle
  const bundle: Record<string, unknown> = {
    chainId: CHAIN_ID,
    transactions: txBundle,
    delegation: oneShotDelegation,
    context: estimate.context,
  }

  // EIP-7702: Include authorization to upgrade orchestrator EOA → smart account via 1Shot.
  // Per 1Shot docs: "Local/Script Signers: Include one authorizationList entry on first use,
  // authorizing the relayer's targetAddress as the delegator."
  if (options.upgradeViaEip7702) {
    const { signAuthorization } = await import('viem/experimental')
    const nonce = await pubClient.getTransactionCount({ address: orchestratorEOA.address })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const authorization = await signAuthorization(orchestratorWalletClient as any, {
      contractAddress: caps.targetAddress as `0x${string}`,
      account: orchestratorEOA,
      nonce,
    })
    bundle.authorizationList = [authorization]
  }

  // Step 7: Submit via 1Shot EIP-7710 delegation relay (NOT ERC-4337 bundler)
  const taskId = await sendTransaction(bundle)

  // Step 8: Poll for confirmation (30s timeout, non-fatal — return taskId regardless)
  try {
    const status = await waitForConfirmation(taskId, 30_000)
    return { taskId, txHash: status.txHash }
  } catch {
    return { taskId }
  }
}
