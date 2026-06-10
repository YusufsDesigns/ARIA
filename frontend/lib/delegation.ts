import { createPublicClient, createWalletClient, http } from 'viem'
import { createBundlerClient } from 'viem/account-abstraction'
import { baseSepolia } from 'viem/chains'
import { privateKeyToAccount } from 'viem/accounts'
import {
  getSmartAccountsEnvironment,
  toMetaMaskSmartAccount,
  Implementation,
} from '@metamask/smart-accounts-kit'

// Public client — for reading chain state
export const publicClient = createPublicClient({
  chain: baseSepolia,
  transport: http(process.env.ALCHEMY_RPC_URL),
})

// Server-side orchestrator EOA — the only private key on the server
export const orchestratorEOA = privateKeyToAccount(
  process.env.ORCHESTRATOR_SESSION_PRIVATE_KEY as `0x${string}`
)

// Viem wallet client with signing capability (needed for redelegation)
export const orchestratorWalletClient = createWalletClient({
  account: orchestratorEOA,
  chain: baseSepolia,
  transport: http(process.env.ALCHEMY_RPC_URL),
})

// 1Shot bundler client — submits UserOperations, pays gas in USDC (no ETH needed)
// Used for all on-chain writes from the orchestrator smart account
export const bundlerClient = createBundlerClient({
  chain: baseSepolia,
  transport: http(process.env.ONE_SHOT_RPC ?? 'https://relayer.1shotapi.com/relayers'),
})

// MetaMask Smart Accounts environment for Base Sepolia (84532)
export const mmEnvironment = getSmartAccountsEnvironment(baseSepolia.id)

// The DelegationManager contract that validates the delegation chain
export const DELEGATION_MANAGER = mmEnvironment.DelegationManager as `0x${string}`

// Lazily-initialized orchestrator smart account (needed to sign delegations as smart account)
// Initialised once on first use to avoid async at module level
let _smartAccount: Awaited<ReturnType<typeof toMetaMaskSmartAccount>> | null = null

export async function getOrchestratorSmartAccount() {
  if (!_smartAccount) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    _smartAccount = await toMetaMaskSmartAccount({
      client: publicClient as any,
      implementation: Implementation.Hybrid,
      deployParams: [orchestratorEOA.address, [], [], []],
      deploySalt: '0x',
      signer: { account: orchestratorEOA },
    })
  }
  return _smartAccount
}
