import { createx402DelegationProvider } from '@metamask/smart-accounts-kit/experimental'
import { x402Erc7710Client } from '@metamask/x402'
import { x402Client, x402HTTPClient } from '@x402/core/client'
import { wrapFetchWithPayment, decodePaymentResponseHeader } from '@x402/fetch'
import { orchestratorEOA, mmEnvironment } from '../delegation'

export type AgentResponse = {
  status: 'success' | 'partial' | 'error'
  output: string
  outputType: 'text' | 'image' | 'audio' | 'json' | 'video'
  contentType: string
  executionTime: number
  txHash?: string
  // Two-phase async agents (e.g. video): when present, the paid request only
  // *started* the job — poll `${endpointBase}/result/${jobId}` for the result.
  jobId?: string
}

/**
 * Poll an async agent's free `GET /result/:jobId` endpoint until the job is done.
 * No payment — the x402 charge already happened on the POST /execute that started
 * the job. Each poll is a short request, so nothing is ever held open long enough
 * to trip a 502. `onProgress` is invoked on each not-yet-ready poll for SSE.
 */
export async function pollAgentResult(
  endpointBase: string,
  jobId: string,
  onProgress?: (elapsedSeconds: number) => void,
  opts: { intervalMs?: number; timeoutMs?: number } = {},
): Promise<AgentResponse> {
  const intervalMs = opts.intervalMs ?? 5000
  const timeoutMs = opts.timeoutMs ?? 270_000
  const started = Date.now()
  const url = `${endpointBase.replace(/\/$/, '')}/result/${jobId}`

  while (Date.now() - started < timeoutMs) {
    await new Promise((r) => setTimeout(r, intervalMs))
    let res: Response
    try {
      res = await fetch(url, { method: 'GET' })
    } catch {
      continue // transient — retry on next tick
    }
    if (!res.ok) {
      if (res.status === 404) throw new Error(`Async job ${jobId} not found`)
      continue
    }
    const body = (await res.json()) as AgentResponse & { done?: boolean }
    if (body.done) {
      return {
        status: body.status,
        output: body.output,
        outputType: body.outputType,
        contentType: body.contentType,
        executionTime: body.executionTime,
      }
    }
    onProgress?.(Math.round((Date.now() - started) / 1000))
  }
  throw new Error(`Async job ${jobId} timed out after ${Math.round(timeoutMs / 1000)}s`)
}

/**
 * Pay an agent via x402 + ERC-7710 using the official MetaMask Smart Accounts Kit
 * buyer flow (recurring x402 payments pattern).
 *
 * This mirrors the docs "Recurring x402 Payments" guide exactly:
 *
 *   User's MetaMask Smart Account
 *     └─ [ERC-7715] grants periodic USDC budget to the orchestrator EOA
 *           stored as `permissionContext` hex, with `permissionFrom` = user's
 *           smart account address (the grant's `from`).
 *
 *   Orchestrator (this function)
 *     └─ createx402DelegationProvider({
 *            account: orchestratorEOA,          // the account the grant was made TO
 *            parentPermissionContext: <grant>,  // User → orchestrator (ERC-7715)
 *            from: <user smart account>,        // grant.from
 *        })
 *        The provider creates an OPEN REDELEGATION from the session account
 *        (orchestrator EOA), appends the redeemer / allowedTargets / timestamp
 *        caveats, signs it with the EOA, and ABI-encodes the full chain when the
 *        x402 client needs to pay. `wrapFetchWithPayment` drives the 402→pay→retry
 *        cycle and emits the correctly-shaped PAYMENT-SIGNATURE header.
 *
 *   MetaMask Facilitator
 *     └─ verifies the chain → settles USDC → agent receives payment.
 *
 * The redelegation MUST be signed by the same account named as the grant's
 * delegate (the orchestrator EOA). Signing with a different account — e.g. a
 * smart account whose address differs from the EOA — fails facilitator
 * verification and the agent returns 402.
 */
export async function callAgentWithX402(
  endpointUrl: string,
  task: string,
  context: Record<string, unknown>,
  permissionContext: `0x${string}`,
  userAddress: string,
  permissionFrom?: string | null,
): Promise<AgentResponse> {
  // IMPORTANT: do NOT pass `from`. The redelegation's delegator must equal the
  // parent delegation's delegate — i.e. the orchestrator EOA that signs it.
  //
  // The stored ERC-7715 grant is a root delegation:
  //   delegator(from) = user's smart account  →  delegate(to) = orchestrator EOA
  //
  // When the provider creates the open sub-delegation it uses
  // `from = config.from ?? account.address` as the redelegation's delegator, and
  // signs it with `account` (the orchestrator EOA). A redelegation is only valid
  // if its delegator == the parent's delegate (you can only pass on authority you
  // hold) AND it is signed by that delegator. Both are the orchestrator EOA, so
  // letting `from` default to `account.address` is correct. Passing the user's
  // address here (the old bug) made delegator != signer != parent.delegate, which
  // the DelegationManager rejects → facilitator verify() fails → seller 402 {}.
  //
  // The user (whose USDC actually moves) is recovered separately by the SDK as
  // `rootDelegator` from the root delegation's delegator, and returned in the
  // payment payload's `delegator` field. So `permissionFrom` is not needed here.
  void permissionFrom

  const erc7710Client = new x402Erc7710Client({
    delegationProvider: createx402DelegationProvider({
      account: orchestratorEOA,
      environment: mmEnvironment,
      parentPermissionContext: permissionContext,
    }),
  })

  const coreClient = new x402Client().register('eip155:*', erc7710Client)
  const httpClient = new x402HTTPClient(coreClient)
  const fetchWithPayment = wrapFetchWithPayment(fetch, httpClient)

  // fetchWithPayment handles the full 402 → create redelegation → retry cycle.
  const response = await fetchWithPayment(endpointUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ task, context }),
  })

  if (!response.ok) {
    const errText = await response.text().catch(() => `HTTP ${response.status}`)
    throw new Error(`Agent call failed after payment (${response.status}): ${errText}`)
  }

  // Extract the on-chain settlement tx hash from the PAYMENT-RESPONSE header so
  // the UI can render a BaseScan link.
  let txHash: string | undefined
  try {
    const settlementHeader =
      response.headers.get('X-PAYMENT-RESPONSE') ??
      response.headers.get('PAYMENT-RESPONSE') ??
      response.headers.get('payment-response')
    if (settlementHeader) {
      const settlement = decodePaymentResponseHeader(settlementHeader)
      if (settlement?.transaction) txHash = settlement.transaction
    }
  } catch {
    /* settlement header absent or unparseable — proceed without a tx hash */
  }

  const agentResponse = (await response.json()) as AgentResponse
  return { ...agentResponse, txHash }
}
