import 'dotenv/config'
import { HTTPFacilitatorClient } from '@x402/core/server'
import { x402ResourceServer } from '@x402/express'
import { x402ExactEvmErc7710ServerScheme } from '@metamask/x402'

export const NETWORK_ID = 'eip155:84532' // Base Sepolia
export const PORT = process.env.PORT ?? 4001

export const payToAddress = (
  process.env.AGENT_MARKET_INTELLIGENCE_PAY_TO ??
  process.env.ORCHESTRATOR_SESSION_ADDRESS!
) as `0x${string}`

const facilitatorClient = new HTTPFacilitatorClient({
  url:
    process.env.METAMASK_FACILITATOR_URL ??
    'https://tx-sentinel-base-sepolia.dev-api.cx.metamask.io/platform/v2/x402',
})

export const resourceServer = new x402ResourceServer(facilitatorClient).register(
  NETWORK_ID,
  new x402ExactEvmErc7710ServerScheme()
)
