import {
  createOpenDelegation,
  ScopeType,
  CaveatType,
} from '@metamask/smart-accounts-kit'
import { encodeDelegations, decodeDelegations } from '@metamask/smart-accounts-kit/utils'
import { orchestratorEOA, mmEnvironment, getOrchestratorSmartAccount } from '../delegation'

export type AgentResponse = {
  status: 'success' | 'partial' | 'error'
  output: string
  outputType: 'text' | 'image' | 'audio' | 'json'
  contentType: string
  executionTime: number
}

/**
 * Pay an agent via x402 + ERC-7710 using explicit MetaMask Smart Accounts Kit calls.
 *
 * Full delegation chain (A2A redelegation):
 *
 *   User's Smart Account
 *     └─ [ERC-7715] grants periodic budget to Orchestrator
 *           stored as permissionContext hex (User→Orchestrator delegation)
 *
 *   Orchestrator (this function)
 *     1. decodeDelegations(permissionContext) → extract root delegation (User→Orchestrator)
 *     2. createOpenDelegation({ parentDelegation: root, scope: exactAgentPrice })
 *            creates open sub-delegation (no specific delegate — facilitator redeems)
 *     3. orchestratorAccount.signDelegation({ delegation })
 *            Orchestrator signs on behalf of user (authorized via ERC-7715)
 *     4. encodeDelegations([signedRedelegation, ...existingChain])
 *            encodes full chain: [new open redelegation, root delegation]
 *     5. Sends chain as PAYMENT-SIGNATURE header to agent endpoint
 *
 *   MetaMask Facilitator
 *     └─ verifies full chain → settles USDC → agent receives payment
 */
export async function callAgentWithX402(
  endpointUrl: string,
  task: string,
  context: Record<string, unknown>,
  permissionContext: `0x${string}`,
  userAddress: string,
): Promise<AgentResponse> {
  const body = JSON.stringify({ task, context })

  // ── Step 1: Probe endpoint — expect HTTP 402 with payment requirements ──────
  const probe = await fetch(endpointUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  })

  if (probe.status !== 402) {
    if (probe.ok) return probe.json() as Promise<AgentResponse>
    const errText = await probe.text().catch(() => `HTTP ${probe.status}`)
    throw new Error(`Expected 402 from agent, got ${probe.status}: ${errText}`)
  }

  // ── Step 2: Decode PAYMENT-REQUIRED header ───────────────────────────────────
  const rawHeader =
    probe.headers.get('PAYMENT-REQUIRED') ??
    probe.headers.get('payment-required')
  if (!rawHeader) throw new Error('Agent returned 402 without PAYMENT-REQUIRED header')

  const paymentRequired = JSON.parse(
    Buffer.from(rawHeader, 'base64').toString('utf-8')
  ) as {
    x402Version?: number
    accepts: Array<{
      scheme: string
      asset: `0x${string}`
      amount: string
      network: string
      payTo: `0x${string}`
      extra?: { assetTransferMethod?: string; facilitatorAddresses?: `0x${string}`[] }
    }>
  }

  const accepted = paymentRequired.accepts?.[0]
  if (!accepted) throw new Error('No accepted payment requirements in 402 response')
  if (accepted.extra?.assetTransferMethod !== 'erc7710') {
    throw new Error(
      `Agent does not support erc7710 payments. Got: ${accepted.extra?.assetTransferMethod}`
    )
  }

  // ── Step 3: Decode parent permission context ─────────────────────────────────
  // The permissionContext is the ERC-7715 grant from the user's MetaMask wallet:
  //   decodeDelegations() extracts the User→Orchestrator delegation chain.
  const existingDelegations = decodeDelegations(permissionContext)
  const parentDelegation = existingDelegations[0]
  if (!parentDelegation) {
    throw new Error('Permission context contains no delegations — ERC-7715 grant may be invalid')
  }

  // ── Step 4: CREATE open redelegation with MetaMask Smart Accounts Kit ────────
  // createOpenDelegation: creates a sub-delegation with no specific delegate.
  //   • from:             user's address (orchestrator acts on user's behalf)
  //   • parentDelegation: root delegation (User→Orchestrator from ERC-7715)
  //   • scope:            restrict to EXACT USDC amount agent charges — no more
  //   • caveats[Redeemer]: only MetaMask facilitator addresses can redeem
  //
  // This is the A2A redelegation: Orchestrator creates a scoped sub-authority
  // from the user's root grant, valid only for this one agent payment.
  const facilitatorAddresses =
    (accepted.extra?.facilitatorAddresses ?? []) as `0x${string}`[]

  const openRedelegation = createOpenDelegation({
    from: userAddress as `0x${string}`,
    environment: mmEnvironment,
    parentDelegation,
    scope: {
      type: ScopeType.Erc20TransferAmount,
      tokenAddress: accepted.asset,
      maxAmount: BigInt(accepted.amount),
    },
    ...(facilitatorAddresses.length > 0 && {
      caveats: [
        {
          type: CaveatType.Redeemer,
          redeemers: facilitatorAddresses,
        },
      ],
    }),
  })

  // ── Step 5: SIGN the redelegation ────────────────────────────────────────────
  // The orchestrator smart account (MetaMask Smart Accounts Kit) signs the
  // sub-delegation. The orchestrator is authorised to sign on the user's behalf
  // because the user granted it permission via ERC-7715 requestExecutionPermissions.
  const orchestratorAccount = await getOrchestratorSmartAccount()
  const signature = await orchestratorAccount.signDelegation({
    delegation: openRedelegation,
  })
  const signedRedelegation = { ...openRedelegation, signature }

  // ── Step 6: ENCODE the full delegation chain ─────────────────────────────────
  // encodeDelegations assembles the complete chain the facilitator will verify:
  //   [0] the new open redelegation (Orchestrator → anyone, scoped to agent price)
  //   [1+] the existing chain from ERC-7715 (User → Orchestrator)
  //
  // The facilitator reads this chain root-to-tip, verifying each signature,
  // then executes the USDC transfer from the user's smart account to the agent.
  const fullPermissionContext = encodeDelegations([
    signedRedelegation,
    ...existingDelegations,
  ])

  // ── Step 7: Build x402 ERC-7710 payment payload ──────────────────────────────
  const paymentPayload = {
    x402Version: paymentRequired.x402Version ?? 2,
    payload: {
      delegationManager: mmEnvironment.DelegationManager,
      permissionContext: fullPermissionContext,
      delegator: userAddress,
    },
  }
  const encodedPayment = Buffer.from(JSON.stringify(paymentPayload)).toString('base64')

  // ── Step 8: Send paid request with PAYMENT-SIGNATURE header ─────────────────
  const response = await fetch(endpointUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'PAYMENT-SIGNATURE': encodedPayment,
    },
    body,
  })

  if (!response.ok) {
    const errText = await response.text().catch(() => `HTTP ${response.status}`)
    throw new Error(`Agent call failed after payment (${response.status}): ${errText}`)
  }

  return response.json() as Promise<AgentResponse>
}

/**
 * Probe an agent endpoint to get its x402 payment requirements without paying.
 * Used by the orchestrator to check price before committing budget.
 */
export async function probeAgentPaymentRequirements(endpointUrl: string) {
  try {
    const res = await fetch(endpointUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task: '', context: {} }),
    })
    if (res.status !== 402) return null
    const header = res.headers.get('PAYMENT-REQUIRED') ?? res.headers.get('payment-required')
    if (!header) return null
    const envelope = JSON.parse(Buffer.from(header, 'base64').toString('utf-8'))
    return envelope.accepts?.[0] ?? null
  } catch {
    return null
  }
}
