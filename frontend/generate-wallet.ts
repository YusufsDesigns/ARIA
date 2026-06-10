// run: npx tsx generate-wallet.ts
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'

const privateKey = generatePrivateKey()
const account = privateKeyToAccount(privateKey)

console.log('ORCHESTRATOR_SESSION_PRIVATE_KEY=' + privateKey)
console.log('ORCHESTRATOR_SESSION_ADDRESS=' + account.address)