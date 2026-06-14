# MetaMask Smart Accounts Kit — Complete Documentation

The MetaMask Smart Accounts Kit enables developers to create new experiences based on programmable account behavior and granular permission sharing. It offers a suite of contracts, libraries, and services designed for maximum composability, allowing developers to build and extend their dapps with ease.

---

## Table of Contents

- [Overview](#overview)
- [Installation and Setup](#installation-and-setup)
- [Quickstarts](#quickstarts)
  - [Smart Account Quickstart](#smart-account-quickstart)
  - [EIP-7702 Quickstart](#eip-7702-quickstart)
- [Configuration](#configuration)
  - [Configure the Bundler](#configure-the-bundler)
  - [Configure the Toolkit Environment](#configure-the-toolkit-environment)
- [Smart Accounts](#smart-accounts)
  - [Create a Smart Account](#create-a-smart-account)
  - [Deploy a Smart Account](#deploy-a-smart-account)
  - [Send a User Operation](#send-a-user-operation)
  - [Send a Gasless Transaction](#send-a-gasless-transaction)
  - [Generate a Multisig Signature](#generate-a-multisig-signature)
  - [Configure a Signer](#configure-a-signer)
- [Delegation](#delegation)
  - [Perform Executions on a Smart Account's Behalf](#perform-executions-on-a-smart-accounts-behalf)
  - [Delegation Scopes](#delegation-scopes)
  - [Create a Redelegation](#create-a-redelegation)
  - [Check the Delegation State](#check-the-delegation-state)
  - [Disable a Delegation](#disable-a-delegation)
- [Advanced Permissions (ERC-7715)](#advanced-permissions-erc-7715)
  - [Perform Executions on a MetaMask User's Behalf](#perform-executions-on-a-metamask-users-behalf)
  - [ERC-20 Token Permissions](#erc-20-token-permissions)
  - [Native Token Permissions](#native-token-permissions)
  - [Advanced Permissions Redelegation](#advanced-permissions-redelegation)
  - [Get Supported Permissions](#get-supported-permissions)
  - [Get Granted Permissions](#get-granted-permissions)
  - [Token Approval Revocation Permission](#token-approval-revocation-permission)
- [x402 Payments](#x402-payments)
  - [x402 Overview](#x402-overview)
  - [Create an x402 Server (Seller)](#create-an-x402-server-seller)
  - [Pay for an x402 API with Delegation (Buyer)](#pay-for-an-x402-api-with-delegation-buyer)
  - [Recurring x402 Payments](#recurring-x402-payments)
- [Skills](#skills)
- [Supported Networks](#supported-networks)
- [Supported Advanced Permissions Table](#supported-advanced-permissions-table)
- [Partner Integrations](#partner-integrations)

---

## Overview

The toolkit enables embedding [MetaMask Smart Accounts](https://docs.metamask.io/smart-accounts-kit/concepts/smart-accounts/) into dapps. Smart accounts support programmable account behavior and advanced features like delegated permissions, multi-signature approvals, and gas abstraction.

[Delegation](https://docs.metamask.io/smart-accounts-kit/concepts/delegation/overview/) is a core feature of smart accounts, enabling secure, rule-based permission sharing. Delegation is powered by the [Delegation Framework](https://github.com/metamask/delegation-framework), which defines how permissions are created, shared, and enforced.

The toolkit also supports [Advanced Permissions (ERC-7715)](https://docs.metamask.io/smart-accounts-kit/concepts/advanced-permissions/), which are fine-grained permissions dapps can request from users directly via the MetaMask browser extension. Advanced Permissions allow you to perform executions on the behalf of MetaMask users.

### Key Concepts

- **MetaMask smart account**: A smart contract account created using the Smart Accounts Kit that supports programmable behavior, flexible signing options, and ERC-7710 delegations.
- **User operation**: A pseudo-transaction object defined by ERC-4337 that describes what a smart account should execute. User operations are submitted to the alternate mempool managed by bundlers.
- **Bundler**: An ERC-4337 component that manages the alternate mempool: it collects user operations from smart accounts, packages them, and submits them to the network.
- **Paymaster**: A service that pays for user operations on behalf of a smart account.
- **Delegation**: The ability for a MetaMask smart account to authorize another account to perform specific executions on its behalf.
- **Delegation Framework**: A set of audited smart contracts that handle smart account creation, the delegation lifecycle, and caveat enforcement.
- **Delegator account**: The account that creates and signs a delegation to grant limited authority to another account.
- **Delegate account**: The account that receives delegated authority and can redeem a delegation under its constraints.
- **Caveat**: A restriction attached to a delegation that limits how delegated authority can be used.
- **Caveat enforcer**: A smart contract that enforces delegation rules by validating caveat conditions during redemption hooks.
- **Delegation scope**: A predefined authority pattern representing a caveat or group of caveats, which sets the initial actions a delegate is allowed to perform. You can combine scopes with additional caveats.
- **Delegation Manager**: The ERC-7710 component that validates and redeems delegations, including signature checks and caveat enforcer hooks.
- **Account abstraction**: A conceptual model for programmable onchain accounts, including flexible validation logic, custom signature schemes, and gas abstraction. ERC-4337 defines a mechanism for account abstraction.
- **Externally owned account (EOA)**: A private-key-controlled account with no built-in programmable execution logic.
- **Passkey**: A cryptographic key that can be used to sign transactions instead of a private key.
- **Signer**: An account that can sign transactions for a smart account.
- **Root delegation**: The first delegation in a chain, where an account delegates its own authority directly.
- **Redelegation**: A delegation that passes on authority granted by a previous delegation.
- **Open delegation**: A delegation that leaves the delegate unspecified, allowing any account to redeem it.
- **Open redelegation**: A redelegation with no specific delegate, allowing any account to redeem inherited permissions.
- **Advanced Permissions**: Fine-grained, wallet execution permissions that dapps can request from MetaMask extension users. Based on ERC-7715.

---

## Installation and Setup

### Prerequisites

- Install [Node.js](https://nodejs.org/en/blog/release/v18.18.0) v18 or later.
- Install [Yarn](https://yarnpkg.com/), [npm](https://docs.npmjs.com/downloading-and-installing-node-js-and-npm), or another package manager.
- If you plan to use any smart contracts (for example, to [create a custom caveat enforcer](https://docs.metamask.io/tutorials/create-custom-caveat-enforcer/)), install [Foundry](https://book.getfoundry.sh/getting-started/installation).

### 1. Install the Smart Accounts Kit

Install the [Smart Accounts Kit](https://www.npmjs.com/package/@metamask/smart-accounts-kit):

```bash
npm install @metamask/smart-accounts-kit
```

### 2. (Optional) Install the Contracts

If you plan to extend the Delegation Framework smart contracts (for example, to [create a custom caveat enforcer](https://docs.metamask.io/tutorials/create-custom-caveat-enforcer/)), install the contract package using Foundry's command-line tool, Forge:

```bash
forge install metamask/delegation-framework@v1.3.0
```

Add `@metamask/delegation-framework/=lib/metamask/delegation-framework/` in your `remappings.txt` file.

### 3. Get Started

You're now ready to start using the Smart Accounts Kit. See the [Smart Account Quickstart](#smart-account-quickstart) section below to walk through a simple example.

---

## Quickstarts

### Smart Account Quickstart

You can get started quickly with MetaMask Smart Accounts by creating your first smart account and sending a user operation.

#### Prerequisites

- Install [Node.js](https://nodejs.org/en/blog/release/v18.18.0) v18 or later.
- Install [Yarn](https://yarnpkg.com/), [npm](https://docs.npmjs.com/downloading-and-installing-node-js-and-npm), or another package manager.

#### Step 1: Install the Smart Accounts Kit

```bash
npm install @metamask/smart-accounts-kit
```

#### Step 2: Set Up a Public Client

Set up a Public Client using Viem's [createPublicClient](https://viem.sh/docs/clients/public) function. This client will let the smart account query the signer's account state and interact with the blockchain network.

```typescript
import { createPublicClient, http } from 'viem'
import { sepolia as chain } from 'viem/chains'

const publicClient = createPublicClient({
  chain,
  transport: http(),
})
```

#### Step 3: Set Up a Bundler Client

Set up a Bundler Client using Viem's [createBundlerClient](https://viem.sh/account-abstraction/clients/bundler) function. This lets you use the bundler service to estimate gas for user operations and submit transactions to the network.

```typescript
import { createBundlerClient } from 'viem/account-abstraction'

const bundlerClient = createBundlerClient({
  client: publicClient,
  transport: http('https://your-bundler-rpc.com'),
})
```

#### Step 4: Create a MetaMask Smart Account

Create a MetaMask smart account to send the first user operation. This example configures a Hybrid smart account, which is a flexible smart account implementation that supports both an EOA owner and any number of passkey (WebAuthn) signers:

```typescript
import { Implementation, toMetaMaskSmartAccount } from '@metamask/smart-accounts-kit'
import { privateKeyToAccount } from 'viem/accounts'

const account = privateKeyToAccount('0x...')

const smartAccount = await toMetaMaskSmartAccount({
  client: publicClient,
  implementation: Implementation.Hybrid,
  deployParams: [account.address, [], [], []],
  deploySalt: '0x',
  signer: { account },
})
```

See [Create a MetaMask smart account](#create-a-smart-account) to learn how to configure different smart account types.

#### Step 5: Send a User Operation

Send a user operation using Viem's [sendUserOperation](https://viem.sh/account-abstraction/actions/bundler/sendUserOperation) method.

The smart account will remain counterfactual until the first user operation. If the smart account is not deployed, it will be automatically deployed upon the sending first user operation.

```typescript
import { parseEther } from 'viem'

// Appropriate fee per gas must be determined for the specific bundler being used.
const maxFeePerGas = 1n
const maxPriorityFeePerGas = 1n

const userOperationHash = await bundlerClient.sendUserOperation({
  account: smartAccount,
  calls: [
    {
      to: '0x1234567890123456789012345678901234567890',
      value: parseEther('1'),
    },
  ],
  maxFeePerGas,
  maxPriorityFeePerGas,
})
```

See [Send a user operation](#send-a-user-operation) to learn how to estimate fee per gas, and wait for the transaction receipt.

#### Next Steps

- To grant specific permissions to other accounts from your smart account, [create a delegation](#perform-executions-on-a-smart-accounts-behalf).
- This quickstart example uses a Hybrid smart account. You can also [configure other smart account types](#create-a-smart-account).
- To upgrade an EOA to a smart account, see the [EIP-7702 quickstart](#eip-7702-quickstart).
- To quickly bootstrap a MetaMask Smart Accounts project, [use the CLI](https://docs.metamask.io/smart-accounts-kit/get-started/use-the-cli/).

---

### EIP-7702 Quickstart

This quickstart demonstrates how to upgrade your EOA to support MetaMask smart account functionality using an [EIP-7702](https://eips.ethereum.org/EIPS/eip-7702) transaction. This enables your EOA to leverage the benefits of account abstraction, such as batch transactions, gas sponsorship, and delegation.

This guide is for embedded wallets. To upgrade a MetaMask account, you can [use MetaMask Connect to upgrade to a smart account](https://docs.metamask.io/tutorials/upgrade-eoa-to-smart-account/).

#### Prerequisites

- Install [Node.js](https://nodejs.org/en/blog/release/v18.18.0) v18 or later.
- Install [Yarn](https://yarnpkg.com/), [npm](https://docs.npmjs.com/downloading-and-installing-node-js-and-npm), or another package manager.
- [Install Viem](https://viem.sh/).

#### Step 1: Install the Smart Accounts Kit

```bash
npm install @metamask/smart-accounts-kit
```

#### Step 2: Set Up a Public Client

Set up a Public Client using Viem's [createPublicClient](https://viem.sh/docs/clients/public) function. This client will let the EOA query the account state and interact with the blockchain network.

```typescript
import { createPublicClient, http } from 'viem'
import { sepolia as chain } from 'viem/chains'

const publicClient = createPublicClient({
  chain,
  transport: http(),
})
```

#### Step 3: Set Up a Bundler Client

```typescript
import { createBundlerClient } from 'viem/account-abstraction'

const bundlerClient = createBundlerClient({
  client: publicClient,
  transport: http('https://your-bundler-rpc.com'),
})
```

#### Step 4: Set Up a Wallet Client

Set up a Wallet Client using Viem's [createWalletClient](https://viem.sh/docs/clients/wallet) function. This lets you sign and submit EIP-7702 authorizations.

```typescript
import { createWalletClient, http } from 'viem'
import { sepolia as chain } from 'viem/chains'
import { privateKeyToAccount } from 'viem/accounts'

export const account = privateKeyToAccount('0x...')

export const walletClient = createWalletClient({
  account,
  chain,
  transport: http(),
})
```

#### Step 5: Authorize a 7702 Delegation

Create an authorization to map the contract code to an EOA, and sign it using Viem's [signAuthorization](https://viem.sh/docs/eip7702/signAuthorization) action. The `signAuthorization` action does not support JSON-RPC accounts.

This example uses [EIP7702StatelessDeleGator](https://github.com/MetaMask/delegation-framework/blob/main/src/EIP7702/EIP7702StatelessDeleGator.sol) as the EIP-7702 delegator contract. It follows a stateless design, as it does not store signer data in the contract's state. This approach provides a lightweight and secure way to upgrade an EOA to a MetaMask smart account.

```typescript
import {
  Implementation,
  toMetaMaskSmartAccount,
  getSmartAccountsEnvironment,
} from '@metamask/smart-accounts-kit'
import { privateKeyToAccount } from 'viem/accounts'

const environment = getSmartAccountsEnvironment(sepolia.id)
const contractAddress = environment.implementations.EIP7702StatelessDeleGatorImpl

const authorization = await walletClient.signAuthorization({
  account,
  contractAddress,
  executor: 'self',
})
```

#### Step 6: Submit the Authorization

Once you have signed an authorization, you can send an EIP-7702 transaction to set the EOA code. Since the authorization cannot be sent by itself, you can include it alongside a dummy transaction.

```typescript
import { zeroAddress } from 'viem'

const hash = await walletClient.sendTransaction({
  authorizationList: [authorization],
  data: '0x',
  to: zeroAddress,
})
```

#### Step 7: Create a MetaMask Smart Account

Create a smart account instance for the EOA and start leveraging the benefits of account abstraction.

```typescript
import { Implementation, toMetaMaskSmartAccount } from '@metamask/smart-accounts-kit'

const addresses = await walletClient.getAddresses()
const address = addresses[0]

const smartAccount = await toMetaMaskSmartAccount({
  client: publicClient,
  implementation: Implementation.Stateless7702,
  address,
  signer: { walletClient },
})
```

#### Step 8: Send a User Operation

Send a user operation through the upgraded EOA, using Viem's [sendUserOperation](https://viem.sh/account-abstraction/actions/bundler/sendUserOperation) method.

```typescript
import { parseEther } from 'viem'

// Appropriate fee per gas must be determined for the specific bundler being used.
const maxFeePerGas = 1n
const maxPriorityFeePerGas = 1n

const userOperationHash = await bundlerClient.sendUserOperation({
  account: smartAccount,
  calls: [
    {
      to: '0x1234567890123456789012345678901234567890',
      value: parseEther('1'),
    },
  ],
  maxFeePerGas,
  maxPriorityFeePerGas,
})
```

#### Next Steps

- To grant specific permissions to other accounts from your smart account, [create a delegation](#perform-executions-on-a-smart-accounts-behalf).
- To quickly bootstrap a MetaMask Smart Accounts project, [use the CLI](https://docs.metamask.io/smart-accounts-kit/get-started/use-the-cli/).

---

## Configuration

The Smart Accounts Kit is highly configurable, providing support for custom bundlers and paymasters. You can also configure the toolkit environment to interact with the Delegation Framework.

### Prerequisites

[Install and set up the Smart Accounts Kit.](#installation-and-setup)

### Configure the Bundler

The toolkit uses Viem's Account Abstraction API to configure custom bundlers and paymasters. This provides a robust and flexible foundation for creating and managing MetaMask Smart Accounts. See Viem's [account abstraction documentation](https://viem.sh/account-abstraction) for more information on the API's features, methods, and best practices.

To use the bundler and paymaster clients with the toolkit, create instances of these clients and configure them as follows:

```typescript
import { createPaymasterClient, createBundlerClient } from 'viem/account-abstraction'
import { http } from 'viem'
import { sepolia as chain } from 'viem/chains'

// Replace these URLs with your actual bundler and paymaster endpoints.
const bundlerUrl = 'https://your-bundler-url.com'
const paymasterUrl = 'https://your-paymaster-url.com'

// The paymaster is optional.
const paymasterClient = createPaymasterClient({
  transport: http(paymasterUrl),
})

const bundlerClient = createBundlerClient({
  transport: http(bundlerUrl),
  paymaster: paymasterClient,
  chain,
})
```

Replace the bundler and paymaster URLs with your bundler and paymaster endpoints. For example, you can use endpoints from [Pimlico](https://docs.pimlico.io/references/bundler), [Infura](https://docs.metamask.io/services/), or [ZeroDev](https://docs.zerodev.app/meta-infra/intro).

Providing a paymaster is optional when configuring your bundler client. However, if you choose not to use a paymaster, the smart account must have enough funds to pay gas fees.

### Configure the Toolkit Environment

The toolkit environment (`SmartAccountsEnvironment`) defines the contract addresses necessary for interacting with the Delegation Framework on a specific network. It serves several key purposes:

- It provides a centralized configuration for all the contract addresses required by the Delegation Framework.
- It enables easy switching between different networks (for example, Mainnet and testnet) or custom deployments.
- It ensures consistency across different parts of the application that interact with the Delegation Framework.

#### Resolve the Environment

When you create a MetaMask smart account, the toolkit automatically resolves the environment based on the version it requires and the chain configured. If no environment is found for the specified chain, it throws an error.

```typescript
import { SmartAccountsEnvironment } from '@metamask/smart-accounts-kit'
import { delegatorSmartAccount } from './config.ts'

const environment: SmartAccountsEnvironment = delegatorSmartAccount.environment
```

See the changelog of the toolkit version you are using (in the left sidebar) for supported chains.

Alternatively, you can use the [getSmartAccountsEnvironment](https://docs.metamask.io/smart-accounts-kit/reference/delegation/#getsmartaccountsenvironment) function to resolve the environment. This function is especially useful if your delegator is not a smart account when creating a redelegation.

```typescript
import { getSmartAccountsEnvironment, SmartAccountsEnvironment } from '@metamask/smart-accounts-kit'
import { sepolia } from 'viem/chains'

// Resolves the SmartAccountsEnvironment for Sepolia
const environment: SmartAccountsEnvironment = getSmartAccountsEnvironment(sepolia.id)
```

#### Deploy a Custom Environment

You can deploy the contracts using any method, but the toolkit provides a convenient [deploySmartAccountsEnvironment](https://docs.metamask.io/smart-accounts-kit/reference/delegation/#deploysmartaccountsenvironment) function. This function simplifies deploying the Delegation Framework contracts to your desired EVM chain.

This function requires a Viem [Public Client](https://viem.sh/docs/clients/public), [Wallet Client](https://viem.sh/docs/clients/wallet), and [Chain](https://viem.sh/docs/glossary/types#chain) to deploy the contracts and resolve the `SmartAccountsEnvironment`.

Your wallet must have a sufficient native token balance to deploy the contracts.

```typescript
import { walletClient, publicClient } from './config.ts'
import { sepolia as chain } from 'viem/chains'
import { deploySmartAccountsEnvironment } from '@metamask/smart-accounts-kit/utils'

const environment = await deploySmartAccountsEnvironment(walletClient, publicClient, chain)
```

You can also override specific contracts when calling `deploySmartAccountsEnvironment`. For example, if you've already deployed the `EntryPoint` contract on the target chain, you can pass the contract address to the function.

```typescript
import { walletClient, publicClient } from './config.ts'
import { sepolia as chain } from 'viem/chains'
import { deploySmartAccountsEnvironment } from '@metamask/smart-accounts-kit/utils'

const environment = await deploySmartAccountsEnvironment(
  walletClient,
  publicClient,
  chain,
  {
    EntryPoint: '0x0000000071727De22E5E9d8BAf0edAc6f37da032'
  }
)
```

Once the contracts are deployed, you can use them to override the environment.

#### Override the Environment

To override the environment, the toolkit provides an [overrideDeployedEnvironment](https://docs.metamask.io/smart-accounts-kit/reference/delegation/#overridedeployedenvironment) function to resolve `SmartAccountsEnvironment` with specified contracts for the given chain and contract version.

```typescript
import { walletClient, publicClient } from './config.ts'
import { sepolia as chain } from 'viem/chains'
import { SmartAccountsEnvironment } from '@metamask/smart-accounts-kit'
import {
  overrideDeployedEnvironment,
  deploySmartAccountsEnvironment,
} from '@metamask/smart-accounts-kit'

const environment: SmartAccountsEnvironment = await deploySmartAccountsEnvironment(
  walletClient,
  publicClient,
  chain
)

overrideDeployedEnvironment(chain.id, '1.3.0', environment)
```

If you've already deployed the contracts using a different method, you can create a `SmartAccountsEnvironment` instance with the required contract addresses, and pass it to the function.

```typescript
import { SmartAccountsEnvironment } from '@metamask/smart-accounts-kit'
import { overrideDeployedEnvironment } from '@metamask/smart-accounts-kit'

const environment: SmartAccountsEnvironment = {
  SimpleFactory: '0x124..',
  // ...
  implementations: {
    // ...
  },
}

overrideDeployedEnvironment(chain.id, '1.3.0', environment)
```

Make sure to specify the Delegation Framework version required by the toolkit. See the changelog of the toolkit version you are using (in the left sidebar) for its required Framework version.

---

## Smart Accounts

### Create a Smart Account

You can enable users to create a MetaMask smart account directly in your dapp. Use [toMetaMaskSmartAccount](https://docs.metamask.io/smart-accounts-kit/reference/smart-account/#tometamasksmartaccount) to create different types of smart accounts with different signature schemes.

#### Prerequisites

[Install and set up the Smart Accounts Kit.](#installation-and-setup)

#### Hybrid Smart Account

A Hybrid smart account supports both an EOA owner and any number of passkey (WebAuthn) signers.

This example uses `toMetaMaskSmartAccount` and Viem's [Wallet Client](https://viem.sh/docs/clients/wallet) to create a Hybrid smart account. The `signer` parameter also accepts Viem's [Local Account](https://viem.sh/docs/accounts/local) and [WebAuthnAccount](https://viem.sh/account-abstraction/accounts/webauthn#webauthn-account).

See the [toMetaMaskSmartAccount](https://docs.metamask.io/smart-accounts-kit/reference/smart-account/#tometamasksmartaccount) API reference for more information.

```typescript
import { publicClient } from './client.ts'
import { walletClient } from './signer.ts'
import { Implementation, toMetaMaskSmartAccount } from '@metamask/smart-accounts-kit'

// Some wallets like MetaMask may require you to request access to
// account addresses using walletClient.requestAddresses() first.
const [address] = await walletClient.getAddresses()

const smartAccount = await toMetaMaskSmartAccount({
  client: publicClient,
  implementation: Implementation.Hybrid,
  deployParams: [address, [], [], []],
  deploySalt: '0x',
  signer: { walletClient },
})
```

#### Multisig Smart Account

A Multisig smart account supports multiple EOA signers with a configurable threshold for execution.

This example uses [toMetaMaskSmartAccount](https://docs.metamask.io/smart-accounts-kit/reference/smart-account/#tometamasksmartaccount) to create a Multisig smart account with a combination of account signers and Wallet Client signers.

```typescript
import { publicClient } from './client.ts'
import { account, walletClient } from './signers.ts'
import { Implementation, toMetaMaskSmartAccount } from '@metamask/smart-accounts-kit'

const owners = [account.address, walletClient.address]
const signer = [{ account }, { walletClient }]
const threshold = 2n

const smartAccount = await toMetaMaskSmartAccount({
  client: publicClient,
  implementation: Implementation.MultiSig,
  deployParams: [owners, threshold],
  deploySalt: '0x',
  signer,
})
```

The number of signers must be at least equal to the threshold to generate a valid signature.

#### EIP-7702 Smart Account

An EIP-7702 smart account represents an EOA that has been upgraded to support MetaMask Smart Accounts functionality as defined by [EIP-7702](https://eips.ethereum.org/EIPS/eip-7702).

This example uses [toMetaMaskSmartAccount](https://docs.metamask.io/smart-accounts-kit/reference/smart-account/#tometamasksmartaccount) and Viem's [privateKeyToAccount](https://viem.sh/docs/accounts/local/privateKeyToAccount) to create an EIP-7702 smart account. This example doesn't handle the upgrade process; see the [EIP-7702 quickstart](#eip-7702-quickstart) to learn how to upgrade.

The EIP-7702 implementation only works with Viem's [Local Accounts](https://viem.sh/docs/accounts/local). It doesn't work with a [JSON-RPC Account](https://viem.sh/docs/accounts/jsonRpc) like MetaMask.

See the [Upgrade a MetaMask EOA to a smart account](https://docs.metamask.io/tutorials/upgrade-eoa-to-smart-account/) tutorial.

```typescript
import { publicClient } from './client.ts'
import { account } from './signer.ts'
import { Implementation, toMetaMaskSmartAccount } from '@metamask/smart-accounts-kit'

const smartAccount = await toMetaMaskSmartAccount({
  client: publicClient,
  implementation: Implementation.Stateless7702,
  address: account.address,
  signer: { account },
})
```

#### Next Steps

- [Configure signers](#configure-a-signer) to use a signer that fits your needs.
- [Deploy the smart account](#deploy-a-smart-account) and [send user operations](#send-a-user-operation) using [Viem Account Abstraction clients](#configuration).
- [Create delegations](#perform-executions-on-a-smart-accounts-behalf) to grant scoped permissions to other accounts.

---

### Deploy a Smart Account

You can deploy MetaMask Smart Accounts in two different ways. You can either deploy a smart account automatically when sending the first user operation, or manually deploy the account.

#### Prerequisites

- [Install and set up the Smart Accounts Kit.](#installation-and-setup)
- [Create a MetaMask smart account.](#create-a-smart-account)

#### Deploy with the First User Operation

When you send the first user operation from a smart account, the Smart Accounts Kit checks whether the account is already deployed. If the account is not deployed, the toolkit adds the `initCode` to the user operation to deploy the account within the same operation. Internally, the `initCode` is encoded using the `factory` and `factoryData`.

```typescript
import { bundlerClient, smartAccount } from './config.ts'
import { parseEther } from 'viem'

// Appropriate fee per gas must be determined for the specific bundler being used.
const maxFeePerGas = 1n
const maxPriorityFeePerGas = 1n

const userOperationHash = await bundlerClient.sendUserOperation({
  account: smartAccount,
  calls: [
    {
      to: '0x1234567890123456789012345678901234567890',
      value: parseEther('0.001'),
    },
  ],
  maxFeePerGas,
  maxPriorityFeePerGas,
})
```

#### Deploy Manually

To deploy a smart account manually, call the [getFactoryArgs](https://docs.metamask.io/smart-accounts-kit/reference/smart-account/#getfactoryargs) method from the smart account to retrieve the `factory` and `factoryData`. This allows you to use a relay account to sponsor the deployment without needing a paymaster.

The `factory` represents the contract address responsible for deploying the smart account, while `factoryData` contains the calldata that will be executed by the `factory` to deploy the smart account.

The relay account can be either an EOA or another smart account. This example uses an EOA.

```typescript
import { walletClient, smartAccount } from './config.ts'

const { factory, factoryData } = await smartAccount.getFactoryArgs()

// Deploy smart account using relay account.
const hash = await walletClient.sendTransaction({
  to: factory,
  data: factoryData,
})
```

#### Next Steps

- Learn more about [sending user operations](#send-a-user-operation).
- To sponsor gas for end users, see how to [send a gasless transaction](#send-a-gasless-transaction).

---

### Send a User Operation

User operations are the ERC-4337 counterpart to traditional blockchain transactions. They incorporate significant enhancements that improve user experience and provide greater flexibility in account management and transaction execution.

Viem's Account Abstraction API allows a developer to specify an array of `Calls` that will be executed as a user operation via Viem's [sendUserOperation](https://viem.sh/account-abstraction/actions/bundler/sendUserOperation) method. The Smart Accounts Kit encodes and executes the provided calls.

User operations are not directly sent to the network. Instead, they are sent to a bundler, which validates, optimizes, and aggregates them before network submission. See [Viem's Bundler Client](https://viem.sh/account-abstraction/clients/bundler) for details on how to interact with the bundler.

If a user operation is sent from a MetaMask smart account that has not been deployed, the toolkit configures the user operation to automatically deploy the account.

#### Prerequisites

- [Install and set up the Smart Accounts Kit.](#installation-and-setup)
- [Create a MetaMask smart account.](#create-a-smart-account)

#### Send a User Operation

The following is a simplified example of sending a user operation using Viem Core SDK. Viem Core SDK offers more granular control for developers who require it.

In the example, a user operation is created with the necessary gas limits. This user operation is passed to a bundler instance, and the `EntryPoint` address is retrieved from the client.

```typescript
import { bundlerClient, smartAccount } from './config.ts'
import { parseEther } from 'viem'

// Appropriate fee per gas must be determined for the specific bundler being used.
const maxFeePerGas = 1n
const maxPriorityFeePerGas = 1n

const userOperationHash = await bundlerClient.sendUserOperation({
  account: smartAccount,
  calls: [
    {
      to: '0x1234567890123456789012345678901234567890',
      value: parseEther('0.001'),
    },
  ],
  maxFeePerGas,
  maxPriorityFeePerGas,
})
```

#### Estimate Fee Per Gas

Different bundlers have different ways to estimate `maxFeePerGas` and `maxPriorityFeePerGas`, and can reject requests with insufficient values. The following example updates the previous example to estimate the fees.

This example uses constant values, but the [Hello Gator example](https://github.com/MetaMask/hello-gator) uses Pimlico's Alto bundler, which fetches user operation gas price using the RPC method [pimlico_getUserOperationPrice](https://docs.pimlico.io/infra/bundler/endpoints/pimlico_getUserOperationGasPrice).

To estimate the gas fee for Pimlico's bundler, install the [permissionless.js SDK](https://docs.pimlico.io/references/permissionless/).

```typescript
import { createPimlicoClient } from 'permissionless/clients/pimlico'
import { parseEther } from 'viem'
import { bundlerClient, smartAccount } from './config.ts'

const pimlicoClient = createPimlicoClient({
  transport: http('https://api.pimlico.io/v2/11155111/rpc?apikey=<YOUR-API-KEY>'),
})

const { fast: fee } = await pimlicoClient.getUserOperationGasPrice()

const userOperationHash = await bundlerClient.sendUserOperation({
  account: smartAccount,
  calls: [
    {
      to: '0x1234567890123456789012345678901234567890',
      value: parseEther('1'),
    },
  ],
  ...fee,
})
```

#### Wait for the Transaction Receipt

After submitting the user operation, it's crucial to wait for the receipt to ensure that it has been successfully included in the blockchain. Use the `waitForUserOperationReceipt` method provided by the bundler client.

```typescript
import { createPimlicoClient } from 'permissionless/clients/pimlico'
import { bundlerClient, smartAccount } from './config.ts'

const pimlicoClient = createPimlicoClient({
  transport: http('https://api.pimlico.io/v2/11155111/rpc?apikey=<YOUR-API-KEY>'),
})

const { fast: fee } = await pimlicoClient.getUserOperationGasPrice()

const userOperationHash = await bundlerClient.sendUserOperation({
  account: smartAccount,
  calls: [
    {
      to: '0x1234567890123456789012345678901234567890',
      value: parseEther('1'),
    },
  ],
  ...fee,
})

const { receipt } = await bundlerClient.waitForUserOperationReceipt({
  hash: userOperationHash,
})

console.log(receipt.transactionHash)
```

#### Next Steps

To sponsor gas for end users, see how to [send a gasless transaction](#send-a-gasless-transaction).

---

### Send a Gasless Transaction

MetaMask Smart Accounts support gas sponsorship, which simplifies onboarding by abstracting gas fees away from end users. You can use any paymaster service provider, such as [Pimlico](https://docs.pimlico.io/references/paymaster) or [ZeroDev](https://docs.zerodev.app/meta-infra/rpcs), or plug in your own custom paymaster.

#### Prerequisites

- [Install and set up the Smart Accounts Kit.](#installation-and-setup)
- [Create a MetaMask smart account.](#create-a-smart-account)

#### Send a Gasless Transaction

The following example demonstrates how to use Viem's [Paymaster Client](https://viem.sh/account-abstraction/clients/paymaster) to send gasless transactions. You can provide the paymaster client using the paymaster property in the [sendUserOperation](https://viem.sh/account-abstraction/actions/bundler/sendUserOperation#paymaster-optional) method, or in the [Bundler Client](https://viem.sh/account-abstraction/clients/bundler#paymaster-optional). In this example, the paymaster client is passed to the `sendUserOperation` method.

```typescript
import { bundlerClient, smartAccount, paymasterClient } from './config.ts'
import { parseEther } from 'viem'

// Appropriate fee per gas must be determined for the specific bundler being used.
const maxFeePerGas = 1n
const maxPriorityFeePerGas = 1n

const userOperationHash = await bundlerClient.sendUserOperation({
  account: smartAccount,
  calls: [
    {
      to: '0x1234567890123456789012345678901234567890',
      value: parseEther('0.001'),
    },
  ],
  maxFeePerGas,
  maxPriorityFeePerGas,
  paymaster: paymasterClient,
})
```

---

### Generate a Multisig Signature

The Smart Accounts Kit supports Multisig smart accounts, allowing you to add multiple EOA signers with a configurable execution threshold. When the threshold is greater than 1, you can collect signatures from the required signers and use the [aggregateSignature](https://docs.metamask.io/smart-accounts-kit/reference/smart-account/#aggregatesignature) function to combine them into a single aggregated signature.

#### Prerequisites

- [Install and set up the Smart Accounts Kit.](#installation-and-setup)
- [Create a Multisig smart account.](#multisig-smart-account)

#### Generate a Multisig Signature

The following example configures a Multisig smart account with two different signers: Alice and Bob. The account has a threshold of 2, meaning that signatures from both parties are required for any execution.

```typescript
import {
  bundlerClient,
  aliceSmartAccount,
  bobSmartAccount,
  aliceAccount,
  bobAccount,
} from './config.ts'
import { aggregateSignature } from '@metamask/smart-accounts-kit'

const userOperation = await bundlerClient.prepareUserOperation({
  account: aliceSmartAccount,
  calls: [
    {
      target: zeroAddress,
      value: 0n,
      data: '0x',
    },
  ],
})

const aliceSignature = await aliceSmartAccount.signUserOperation(userOperation)
const bobSignature = await bobSmartAccount.signUserOperation(userOperation)

const aggregatedSignature = aggregateSignature({
  signatures: [
    {
      signer: aliceAccount.address,
      signature: aliceSignature,
      type: 'ECDSA',
    },
    {
      signer: bobAccount.address,
      signature: bobSignature,
      type: 'ECDSA',
    },
  ],
})
```

---

### Configure a Signer

When creating a smart account, you must specify a signer. The signer owns the smart account and is responsible for generating the signatures required to submit user operations. MetaMask Smart Accounts is signer-agnostic, allowing you to use any signer you prefer, such as Embedded Wallets, passkeys, EOA wallets, or a custom signer.

MetaMask Smart Accounts has a native integration with [MetaMask Embedded Wallets](https://docs.metamask.io/embedded-wallets/), making user onboarding easier. In addition to the native integration, you can use third-party wallet providers as Privy, Dynamic, or Para as the signer for your smart account.

#### Available Signers

| Signer | Description |
| --- | --- |
| [MetaMask Embedded Wallets (Web3Auth)](#use-metamask-embedded-wallets) | Recommended. Provides social sign-in and simplified Web3 onboarding. |
| [Dynamic](#use-dynamic-with-metamask-smart-accounts) | Embedded wallet with social sign-in and passkey-based wallets. |
| [EOA (e.g. MetaMask)](#use-an-eoa-with-metamask-smart-accounts) | Use EOA wallets like MetaMask with Smart Accounts. |
| [Passkey](https://docs.metamask.io/smart-accounts-kit/guides/smart-accounts/signers/passkey/) | Use a passkey (WebAuthn) with MetaMask Smart Accounts. |
| [Privy](https://docs.metamask.io/smart-accounts-kit/guides/smart-accounts/signers/privy/) | Use Privy with MetaMask Smart Accounts. |

#### Use MetaMask Embedded Wallets

[MetaMask Embedded Wallets (Web3Auth)](https://docs.metamask.io/embedded-wallets/) provides a pluggable embedded wallet infrastructure to simplify Web3 wallet integration and user onboarding. It supports social sign-ins allowing users to access Web3 applications through familiar authentication methods in under a minute.

MetaMask Smart Accounts is a signer-agnostic implementation that allows you to use Embedded Wallets as a signer for smart accounts. This guide supports React and React-based frameworks.

##### Prerequisites

- Install [Node.js](https://nodejs.org/en/blog/release/v18.18.0) v18 or later.
- Install [Yarn](https://yarnpkg.com/), [npm](https://docs.npmjs.com/downloading-and-installing-node-js-and-npm), or another package manager.
- Create an [Embedded Wallets Client ID](https://docs.metamask.io/embedded-wallets/dashboard/).

##### Step 1: Install Dependencies

```bash
npm install @metamask/smart-accounts-kit @web3auth/modal wagmi @tanstack/react-query viem
```

##### Step 2: Create the Web3Auth Provider

Configure the `Web3AuthProvider` component to provide the Embedded Wallets context to your application. You'll also use the `WagmiProvider` to integrate Embedded Wallets with Wagmi. This provider enables you to use Wagmi hooks with Embedded Wallets.

Once you've created the `Web3AuthAppProvider`, wrap it at the root of your application so the rest of your application has access to the Embedded Wallets context.

For an advanced configuration, see the [Embedded Wallets guide](https://docs.metamask.io/embedded-wallets/sdk/react/advanced/).

```typescript
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactNode } from 'react'
import { Web3AuthProvider } from '@web3auth/modal/react'
// Make sure to import `WagmiProvider` from `@web3auth/modal/react/wagmi`, not `wagmi`
import { WagmiProvider } from '@web3auth/modal/react/wagmi'
import { web3authConfig } from './config.ts'

const queryClient = new QueryClient()

export function Web3AuthAppProvider({ children }: { children: ReactNode }) {
  return (
    <Web3AuthProvider config={web3authConfig}>
      <QueryClientProvider client={queryClient}>
        <WagmiProvider>{children}</WagmiProvider>
      </QueryClientProvider>
    </Web3AuthProvider>
  )
}
```

##### Step 3: Create a Smart Account

Once the user has connected their wallet, use the Wallet Client from Wagmi as the signer to create a MetaMask smart account.

```typescript
import { Implementation, toMetaMaskSmartAccount } from '@metamask/smart-accounts-kit'
import { useConnection, usePublicClient, useWalletClient } from 'wagmi'

const { address } = useConnection()
const publicClient = usePublicClient()
const { data: walletClient } = useWalletClient()

// Additional check to make sure the Embedded Wallets is connected
// and values are available.
if (!address || !walletClient || !publicClient) {
  // Handle the error case
}

const smartAccount = await toMetaMaskSmartAccount({
  client: publicClient,
  implementation: Implementation.Hybrid,
  deployParams: [address, [], [], []],
  deploySalt: '0x',
  signer: { walletClient },
})
```

#### Use Dynamic with MetaMask Smart Accounts

[Dynamic](https://www.dynamic.xyz/) is an embedded wallet solution that enables seamless social sign-in and passkey-based wallets, making user onboarding easier. MetaMask Smart Accounts is a signer-agnostic implementation that allows you to use Dynamic's EOA wallet as a signer for smart accounts. This guide supports React and React-based frameworks.

##### Prerequisites

- Install [Node.js](https://nodejs.org/en/blog/release/v18.18.0) v18 or later.
- Install [Yarn](https://yarnpkg.com/), [npm](https://docs.npmjs.com/downloading-and-installing-node-js-and-npm), or another package manager.
- Create a [Dynamic Environment ID](https://www.dynamic.xyz/docs/developer-dashboard/tokens-api-keys#environment-id).

##### Step 1: Install Dependencies

```bash
npm install @dynamic-labs/ethereum @dynamic-labs/sdk-react-core @dynamic-labs/wagmi-connector @metamask/smart-accounts-kit @tanstack/react-query wagmi viem
```

##### Step 2: Create the Dynamic Provider

Configure the [DynamicContextProvider](https://www.dynamic.xyz/docs/react-sdk/providers/providers-introduction#dynamic-context-provider) component to provide Dynamic's context to your application. You'll also use the [DynamicWagmiConnector](https://www.dynamic.xyz/docs/react-sdk/providers/providers-introduction#dynamic-wagmi-connector) to integrate Dynamic with Wagmi. This connector enables you to use Wagmi hooks with Dynamic.

Once you have created the `DynamicProvider`, you must wrap it at the root of your application so that the rest of your application has access to Dynamic's context.

For an advanced configuration, see how to [configure Dynamic and Wagmi](https://www.dynamic.xyz/docs/react-sdk/using-wagmi).

```typescript
import { QueryClientProvider } from '@tanstack/react-query'
import { WagmiProvider } from 'wagmi'
import { ReactNode } from 'react'
import { EthereumWalletConnectors } from '@dynamic-labs/ethereum'
import { DynamicContextProvider } from '@dynamic-labs/sdk-react-core'
import { DynamicWagmiConnector } from '@dynamic-labs/wagmi-connector'
import { wagmiConfig, queryClient } from './config.ts'

export function DynamicProvider({ children }: { children: ReactNode }) {
  return (
    <DynamicContextProvider
      settings={{
        // Get your environment id at https://app.dynamic.xyz/dashboard/developer
        environmentId: '<YOUR_DYNAMIC_ENVIRONMENT_ID>',
        walletConnectors: [EthereumWalletConnectors],
      }}
    >
      <QueryClientProvider client={queryClient}>
        <WagmiProvider config={wagmiConfig}>
          <DynamicWagmiConnector>
            {children}
          </DynamicWagmiConnector>
        </WagmiProvider>
      </QueryClientProvider>
    </DynamicContextProvider>
  )
}
```

##### Step 3: Create a Smart Account

Once the user has connected their wallet, use the Wallet Client from Wagmi as the signer to create a MetaMask smart account.

```typescript
import { Implementation, toMetaMaskSmartAccount } from '@metamask/smart-accounts-kit'
import { useConnection, usePublicClient, useWalletClient } from 'wagmi'

const { address } = useConnection()
const publicClient = usePublicClient()
const { data: walletClient } = useWalletClient()

// Additional check to make sure Dynamic is connected
// and values are available.
if (!address || !walletClient || !publicClient) {
  // Handle the error case
}

const smartAccount = await toMetaMaskSmartAccount({
  client: publicClient,
  implementation: Implementation.Hybrid,
  deployParams: [address, [], [], []],
  deploySalt: '0x',
  signer: { walletClient },
})
```

#### Use an EOA with MetaMask Smart Accounts

Externally owned accounts (EOAs) are accounts controlled by a user's private key (paired with a public address) and are typically accessed through wallet apps like MetaMask. MetaMask Smart Accounts is signer-agnostic, so you can use an EOA as the signer. This guide supports React and React-based frameworks. For Vue, see [Wagmi docs](https://wagmi.sh/vue/getting-started).

##### Prerequisites

- Install [Node.js](https://nodejs.org/en/blog/release/v18.18.0) v18 or later.
- Install [Yarn](https://yarnpkg.com/), [npm](https://docs.npmjs.com/downloading-and-installing-node-js-and-npm), or another package manager.

##### Step 1: Install Dependencies

```bash
npm install @metamask/smart-accounts-kit wagmi @metamask/connect-evm @tanstack/react-query viem
```

##### Step 2: Create the App Provider

Once you've created the `AppProvider`, wrap it at the root of your application so that the rest of your application has access to Wagmi's and TanStack's context. This will allow every component inside the provider to use the Wagmi hooks. The example uses the [MetaMask Connect](https://wagmi.sh/react/api/connectors/metaMask) connector. For an advanced configuration, see Wagmi's [createConfig](https://wagmi.sh/react/api/createConfig) API reference.

```typescript
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactNode } from 'react'
import { WagmiProvider } from 'wagmi'
import { config } from './config.ts'

const queryClient = new QueryClient()

export function AppProvider({ children }: { children: ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  )
}
```

##### Step 3: Create a Smart Account

Once the user has connected their wallet, use the Wallet Client from Wagmi as the signer to create a MetaMask smart account.

```typescript
import { Implementation, toMetaMaskSmartAccount } from '@metamask/smart-accounts-kit'
import { useConnection, usePublicClient, useWalletClient } from 'wagmi'

const { address } = useConnection()
const publicClient = usePublicClient()
const { data: walletClient } = useWalletClient()

// Additional check to make sure the EOA wallet is connected
// and values are available.
if (!address || !walletClient || !publicClient) {
  // Handle the error case
}

const smartAccount = await toMetaMaskSmartAccount({
  client: publicClient,
  implementation: Implementation.Hybrid,
  deployParams: [address, [], [], []],
  deploySalt: '0x',
  signer: { walletClient },
})
```

---

## Delegation

### Perform Executions on a Smart Account's Behalf

Delegation is the ability for a MetaMask smart account to grant permission to another account to perform executions on its behalf.

In this guide, you'll create a delegator account (Alice) and a delegate account (Bob), and grant Bob permission to perform executions on Alice's behalf. You'll complete the delegation lifecycle (create, sign, and redeem a delegation).

#### Prerequisites

[Install and set up the Smart Accounts Kit.](#installation-and-setup)

#### Step 1: Set Up a Public Client

Set up a Public Client using Viem's [createPublicClient](https://viem.sh/docs/clients/public) function. You will configure Alice's account (the delegator) and the Bundler Client with the Public Client, which you can use to query the signer's account state and interact with smart contracts.

```typescript
import { createPublicClient, http } from 'viem'
import { sepolia as chain } from 'viem/chains'

const publicClient = createPublicClient({
  chain,
  transport: http(),
})
```

#### Step 2: Set Up a Bundler Client

```typescript
import { createBundlerClient } from 'viem/account-abstraction'

const bundlerClient = createBundlerClient({
  client: publicClient,
  transport: http('https://your-bundler-rpc.com'),
})
```

#### Step 3: Create a Delegator Account

Create an account to represent Alice, the delegator who will create a delegation. The delegator must be a MetaMask smart account; use the toolkit's [toMetaMaskSmartAccount](https://docs.metamask.io/smart-accounts-kit/reference/smart-account/#tometamasksmartaccount) method to create the delegator account.

This example configures a Hybrid smart account, which is a flexible smart account implementation that supports both an EOA owner and any number of passkey (WebAuthn) signers:

```typescript
import { Implementation, toMetaMaskSmartAccount } from '@metamask/smart-accounts-kit'
import { privateKeyToAccount } from 'viem/accounts'

const delegatorAccount = privateKeyToAccount('0x...')

const delegatorSmartAccount = await toMetaMaskSmartAccount({
  client: publicClient,
  implementation: Implementation.Hybrid,
  deployParams: [delegatorAccount.address, [], [], []],
  deploySalt: '0x',
  signer: { account: delegatorAccount },
})
```

See [how to configure other smart account types](#create-a-smart-account).

#### Step 4: Create a Delegate Account

Create an account to represent Bob, the delegate who will receive the delegation. The delegate can be a smart account or an EOA:

```typescript
import { Implementation, toMetaMaskSmartAccount } from '@metamask/smart-accounts-kit'
import { privateKeyToAccount } from 'viem/accounts'

const delegateAccount = privateKeyToAccount('0x...')

const delegateSmartAccount = await toMetaMaskSmartAccount({
  client: publicClient,
  implementation: Implementation.Hybrid,
  deployParams: [delegateAccount.address, [], [], []],
  deploySalt: '0x',
  signer: { account: delegateAccount },
})
```

#### Step 5: Create a Delegation

Create a root delegation from Alice to Bob. With a root delegation, Alice is delegating her own authority away, as opposed to redelegating permissions she received from a previous delegation.

Use the toolkit's [createDelegation](https://docs.metamask.io/smart-accounts-kit/reference/delegation/#createdelegation) method to create a root delegation. When creating a delegation, you need to configure the scope of the delegation to define the initial authority.

This example uses the [erc20TransferAmount](#erc-20-transfer-scope) scope, allowing Alice to delegate to Bob the ability to spend her USDC, with a specified limit on the total amount.

Before creating a delegation, ensure that the delegator account (in this example, Alice's account) has been deployed. If the account is not deployed, redeeming the delegation will fail.

```typescript
import { createDelegation, ScopeType } from '@metamask/smart-accounts-kit'
import { parseUnits } from 'viem'

// USDC address on Ethereum Sepolia.
const tokenAddress = '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238'

const delegation = createDelegation({
  to: delegateSmartAccount.address,
  from: delegatorSmartAccount.address,
  environment: delegatorSmartAccount.environment,
  scope: {
    type: ScopeType.Erc20TransferAmount,
    tokenAddress,
    // 10 USDC
    maxAmount: parseUnits('10', 6),
  },
})
```

#### Step 6: Sign the Delegation

Sign the delegation with Alice's account, using the [signDelegation](https://docs.metamask.io/smart-accounts-kit/reference/smart-account/#signdelegation) method from `MetaMaskSmartAccount`. Alternatively, you can use the toolkit's [signDelegation](https://docs.metamask.io/smart-accounts-kit/reference/delegation/#signdelegation) utility method. Bob will later use the signed delegation to perform actions on Alice's behalf.

```typescript
const signature = await delegatorSmartAccount.signDelegation({
  delegation,
})

const signedDelegation = {
  ...delegation,
  signature,
}
```

#### Step 7: Redeem the Delegation

Bob can now redeem the delegation. The redeem transaction is sent to the `DelegationManager` contract, which validates the delegation and executes actions on Alice's behalf.

To prepare the calldata for the redeem transaction, use the [redeemDelegations](https://docs.metamask.io/smart-accounts-kit/reference/delegation/#redeemdelegations) method from `DelegationManager`. Since Bob is redeeming a single delegation chain, use the [SingleDefault](https://docs.metamask.io/smart-accounts-kit/concepts/delegation/delegation-manager/#execution-modes) execution mode.

Bob can redeem the delegation by submitting a user operation if his account is a smart account, or a regular transaction if his account is an EOA. In this example, Bob transfers 1 USDC from Alice's account to his own.

```typescript
import { createExecution, ExecutionMode } from '@metamask/smart-accounts-kit'
import { DelegationManager } from '@metamask/smart-accounts-kit/contracts'
import { zeroAddress } from 'viem'
import { callData } from './config.ts'

const delegations = [signedDelegation]

// USDC address on Ethereum Sepolia.
const tokenAddress = '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238'

const executions = [createExecution({ target: tokenAddress, callData })]

const redeemDelegationCalldata = DelegationManager.encode.redeemDelegations({
  delegations: [delegations],
  modes: [ExecutionMode.SingleDefault],
  executions: [executions],
})

const userOperationHash = await bundlerClient.sendUserOperation({
  account: delegateSmartAccount,
  calls: [
    {
      to: delegateSmartAccount.address,
      data: redeemDelegationCalldata,
    },
  ],
  maxFeePerGas: 1n,
  maxPriorityFeePerGas: 1n,
})
```

#### Next Steps

- See [how to configure different scopes](#delegation-scopes) to define the initial authority of a delegation.
- See [how to further refine the authority of a delegation](#constrain-a-delegation-scope) using caveat enforcers.
- See [how to disable a delegation](#disable-a-delegation) to revoke permissions.

---

### Delegation Scopes

When creating a delegation, you must configure a scope to define the delegation's initial authority and help prevent delegation misuse. You can further constrain this initial authority by [adding caveats to a delegation](#constrain-a-delegation-scope).

The Smart Accounts Kit currently supports three categories of scopes:

| Scope Type | Description |
| --- | --- |
| Spending limit scopes | Restricts the spending of native, ERC-20, and ERC-721 tokens based on defined conditions. |
| Function call scope | Restricts the delegation to specific contract methods, contract addresses, or calldata. |
| Ownership transfer scope | Restricts the delegation to only allow ownership transfers, specifically the `transferOwnership` function for a specified contract. |

#### Spending Limit Scopes

##### ERC-20 Transfer Scope

This scope ensures that ERC-20 token transfers are limited to a predefined maximum amount. This scope is useful for setting simple, fixed transfer limits without any time-based or streaming conditions. For example, Alice creates a delegation that allows Bob to spend up to 10 USDC without any conditions. Bob may use the 10 USDC in a single transaction or make multiple transactions, as long as the total does not exceed 10 USDC.

When this scope is applied, the toolkit automatically disallows native token transfers (sets the native token transfer limit to `0`).

Internally, this scope uses the [erc20TransferAmount](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#erc20transferamount) and [valueLte](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#valuelte) caveat enforcers. See the [ERC-20 transfer scope reference](https://docs.metamask.io/smart-accounts-kit/reference/delegation/delegation-scopes/#erc-20-transfer-scope) for more details.

```typescript
import { createDelegation, ScopeType } from '@metamask/smart-accounts-kit'
import { parseUnits } from 'viem'

const delegation = createDelegation({
  scope: {
    type: ScopeType.Erc20TransferAmount,
    tokenAddress: '0xc11F3a8E5C7D16b75c9E2F60d26f5321C6Af5E92',
    // USDC has 6 decimal places.
    maxAmount: parseUnits('10', 6),
  },
  to: delegateAccount,
  from: delegatorAccount,
  environment: delegatorAccount.environment,
})
```

##### ERC-20 Periodic Scope

This scope ensures a per-period limit for ERC-20 token transfers. You set the amount, period, and start date. At the start of each new period, the allowance resets. For example, Alice creates a delegation that lets Bob spend up to 10 USDC on her behalf each day. Bob can transfer a total of 10 USDC per day; the limit resets at the beginning of the next day.

When this scope is applied, the toolkit automatically disallows native token transfers (sets the native token transfer limit to `0`).

Internally, this scope uses the [erc20PeriodTransfer](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#erc20periodtransfer) and [valueLte](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#valuelte) caveat enforcers. See the [ERC-20 periodic scope reference](https://docs.metamask.io/smart-accounts-kit/reference/delegation/delegation-scopes/#erc-20-periodic-scope) for more details.

```typescript
import { createDelegation, ScopeType } from '@metamask/smart-accounts-kit'
import { parseUnits } from 'viem'

// startDate should be in seconds.
const startDate = Math.floor(Date.now() / 1000)

const delegation = createDelegation({
  scope: {
    type: ScopeType.Erc20PeriodTransfer,
    tokenAddress: '0xb4aE654Aca577781Ca1c5DE8FbE60c2F423f37da',
    // USDC has 6 decimal places.
    periodAmount: parseUnits('10', 6),
    periodDuration: 86400,
    startDate,
  },
  to: delegateAccount,
  from: delegatorAccount,
  environment: delegatorAccount.environment,
})
```

##### ERC-20 Streaming Scope

This scope ensures a linear streaming transfer limit for ERC-20 tokens. Token transfers are blocked until the defined start timestamp. At the start, a specified initial amount is released, after which tokens accrue linearly at the configured rate, up to the maximum allowed amount. For example, Alice creates a delegation that allows Bob to spend 0.1 USDC per second, starting with an initial amount of 10 USDC, up to a maximum of 100 USDC.

When this scope is applied, the toolkit automatically disallows native token transfers (sets the native token transfer limit to `0`).

Internally, this scope uses the [erc20Streaming](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#erc20streaming) and [valueLte](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#valuelte) caveat enforcers. See the [ERC-20 streaming scope reference](https://docs.metamask.io/smart-accounts-kit/reference/delegation/delegation-scopes/#erc-20-streaming-scope) for more details.

```typescript
import { createDelegation, ScopeType } from '@metamask/smart-accounts-kit'
import { parseUnits } from 'viem'

// startTime should be in seconds.
const startTime = Math.floor(Date.now() / 1000)

const delegation = createDelegation({
  scope: {
    type: ScopeType.Erc20Streaming,
    tokenAddress: '0xc11F3a8E5C7D16b75c9E2F60d26f5321C6Af5E92',
    // USDC has 6 decimal places.
    amountPerSecond: parseUnits('0.1', 6),
    initialAmount: parseUnits('10', 6),
    maxAmount: parseUnits('100', 6),
    startTime,
  },
  to: delegateAccount,
  from: delegatorAccount,
  environment: delegatorAccount.environment,
})
```

##### ERC-721 Scope

This scope limits the delegation to ERC-721 token transfers only. For example, Alice creates a delegation that allows Bob to transfer an NFT she owns on her behalf.

Internally, this scope uses the [erc721Transfer](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#erc721transfer) caveat enforcer. See the [ERC-721 scope reference](https://docs.metamask.io/smart-accounts-kit/reference/delegation/delegation-scopes/#erc-721-scope) for more details.

```typescript
import { createDelegation, ScopeType } from '@metamask/smart-accounts-kit'

const delegation = createDelegation({
  scope: {
    type: ScopeType.Erc721Transfer,
    tokenAddress: '0x3fF528De37cd95b67845C1c55303e7685c72F319',
    tokenId: 1n,
  },
  to: delegateAccount,
  from: delegatorAccount,
  environment: delegatorAccount.environment,
})
```

##### Native Token Transfer Scope

This scope ensures that native token transfers are limited to a predefined maximum amount. This scope is useful for setting simple, fixed transfer limits without any time-based or streaming conditions. For example, Alice creates a delegation that allows Bob to spend up to 0.1 ETH without any conditions.

When this scope is applied, the toolkit disallows ERC-20 and ERC-721 token transfers by default (sets `exactCalldata` to `0x`). You can optionally configure `exactCalldata` to restrict transactions to a specific operation, or configure `allowedCalldata` to allow transactions that match certain patterns or ranges.

Internally, this scope uses the [nativeTokenTransferAmount](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#nativetokentransferamount) caveat enforcer, and optionally uses the [allowedCalldata](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#allowedcalldata) or [exactCalldata](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#exactcalldata) caveat enforcers when those parameters are specified. See the [native token transfer scope reference](https://docs.metamask.io/smart-accounts-kit/reference/delegation/delegation-scopes/#native-token-transfer-scope) for more details.

```typescript
import { createDelegation, ScopeType } from '@metamask/smart-accounts-kit'
import { parseEther } from 'viem'

const delegation = createDelegation({
  scope: {
    type: ScopeType.NativeTokenTransferAmount,
    maxAmount: parseEther('0.001'),
  },
  to: delegateAccount,
  from: delegatorAccount,
  environment: delegatorAccount.environment,
})
```

##### Native Token Periodic Scope

This scope ensures a per-period limit for native token transfers. You set the amount, period, and start date. At the start of each new period, the allowance resets. For example, Alice creates a delegation that lets Bob spend up to 0.01 ETH on her behalf each day.

When this scope is applied, the toolkit disallows ERC-20 and ERC-721 token transfers by default (sets `exactCalldata` to `0x`). You can optionally configure `exactCalldata` or `allowedCalldata`.

Internally, this scope uses the [nativeTokenPeriodTransfer](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#nativetokenperiodtransfer) caveat enforcer, and optionally uses the [allowedCalldata](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#allowedcalldata) or [exactCalldata](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#exactcalldata) caveat enforcers when those parameters are specified. See the [native token periodic scope reference](https://docs.metamask.io/smart-accounts-kit/reference/delegation/delegation-scopes/#native-token-periodic-scope) for more details.

```typescript
import { createDelegation, ScopeType } from '@metamask/smart-accounts-kit'
import { parseEther } from 'viem'

// startDate should be in seconds.
const startDate = Math.floor(Date.now() / 1000)

const delegation = createDelegation({
  scope: {
    type: ScopeType.NativeTokenPeriodTransfer,
    periodAmount: parseEther('0.01'),
    periodDuration: 86400,
    startDate,
  },
  to: delegateAccount,
  from: delegatorAccount,
  environment: delegatorAccount.environment,
})
```

##### Native Token Streaming Scope

This scope ensures a linear streaming transfer limit for native tokens. Token transfers are blocked until the defined start timestamp. At the start, a specified initial amount is released, after which tokens accrue linearly at the configured rate, up to the maximum allowed amount. For example, Alice creates a delegation that allows Bob to spend 0.001 ETH per second, starting with an initial amount of 0.01 ETH, up to a maximum of 0.1 ETH.

When this scope is applied, the toolkit disallows ERC-20 and ERC-721 token transfers by default (sets `exactCalldata` to `0x`). You can optionally configure `exactCalldata` or `allowedCalldata`.

Internally, this scope uses the [nativeTokenStreaming](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#nativetokenstreaming) caveat enforcer, and optionally uses the [allowedCalldata](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#allowedcalldata) or [exactCalldata](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#exactcalldata) caveat enforcers when those parameters are specified. See the [native token streaming scope reference](https://docs.metamask.io/smart-accounts-kit/reference/delegation/delegation-scopes/#native-token-streaming-scope) for more details.

```typescript
import { createDelegation, ScopeType } from '@metamask/smart-accounts-kit'
import { parseEther } from 'viem'

// startTime should be in seconds.
const startTime = Math.floor(Date.now() / 1000)

const delegation = createDelegation({
  scope: {
    type: ScopeType.NativeTokenStreaming,
    amountPerSecond: parseEther('0.001'),
    initialAmount: parseEther('0.01'),
    maxAmount: parseEther('0.1'),
    startTime,
  },
  to: delegateAccount,
  from: delegatorAccount,
  environment: delegatorAccount.environment,
})
```

#### Function Call Scope

The function call scope defines the specific methods, contract addresses, and calldata that are allowed for the delegation. For example, Alice delegates to Bob the ability to call the `approve` function on the USDC contract, with the approval amount set to `0`.

This scope requires `targets`, which specifies the permitted contract addresses, and `selectors`, which specifies the allowed methods.

Internally, this scope uses the [allowedTargets](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#allowedtargets), [allowedMethods](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#allowedmethods), and [valueLte](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#valuelte) caveat enforcers, and optionally uses the [allowedCalldata](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#allowedcalldata) or [exactCalldata](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#exactcalldata) caveat enforcers when those parameters are specified. See the [function call scope reference](https://docs.metamask.io/smart-accounts-kit/reference/delegation/delegation-scopes/#function-call-scope) for more details.

The following example sets the delegation scope to allow the delegate to call the `approve` function on the USDC token contract:

```typescript
import { createDelegation, ScopeType } from '@metamask/smart-accounts-kit'

// USDC address on Sepolia.
const USDC_ADDRESS = '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238'

const delegation = createDelegation({
  scope: {
    type: ScopeType.FunctionCall,
    targets: [USDC_ADDRESS],
    selectors: ['approve(address, uint256)'],
  },
  to: delegateAccount,
  from: delegatorAccount,
  environment: delegatorAccount.environment,
})
```

##### Define Allowed Calldata

You can further restrict the scope by defining the `allowedCalldata`. For example, you can set `allowedCalldata` so the delegate is only permitted to call the `approve` function on the USDC token contract with an allowance value of `0`. This effectively limits the delegate to revoking ERC-20 approvals.

The `allowedCalldata` doesn't support multiple selectors. Each entry in the list represents a portion of calldata corresponding to the same function signature. You can include or exclude specific parameters to precisely define what parts of the calldata are valid.

```typescript
import { createDelegation, ScopeType } from '@metamask/smart-accounts-kit'
import { encodeAbiParameters, erc20Abi } from 'viem'

// USDC address on Sepolia.
const USDC_ADDRESS = '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238'

const delegation = createDelegation({
  scope: {
    type: ScopeType.FunctionCall,
    targets: [USDC_ADDRESS],
    selectors: ['approve(address, uint256)'],
    allowedCalldata: [
      {
        // Limits the allowance amount to be 0.
        value: encodeAbiParameters([{ name: 'amount', type: 'uint256' }], [0n]),
        // The first 4 bytes are for selector, and next 32 bytes
        // are for spender address.
        startIndex: 36,
      },
    ],
  },
  to: delegateAccount,
  from: delegatorAccount,
  environment: delegatorAccount.environment,
})
```

##### Define Exact Calldata

You can define the `exactCalldata` instead of the `allowedCalldata`. For example, you can set `exactCalldata` so the delegate is permitted to call only the `approve` function on the USDC token contract, with a specific spender address and an allowance value of 0. This effectively limits the delegate to revoking ERC-20 approvals for a specific spender.

```typescript
import { createDelegation, ScopeType } from '@metamask/smart-accounts-kit'
import { encodeFunctionData, erc20Abi } from 'viem'

// USDC address on Sepolia.
const USDC_ADDRESS = '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238'

const delegation = createDelegation({
  scope: {
    type: ScopeType.FunctionCall,
    targets: [USDC_ADDRESS],
    selectors: ['approve(address, uint256)'],
    exactCalldata: {
      calldata: encodeFunctionData({
        abi: erc20Abi,
        args: ['0x0227628f3F023bb0B980b67D528571c95c6DaC1c', 0n],
        functionName: 'approve',
      }),
    },
  },
  to: delegateAccount,
  from: delegatorAccount,
  environment: delegatorAccount.environment,
})
```

##### Allow Native Token Transfer in Function Call Scope

You can set `valueLte` to allow native token transfer up to a specified amount per call. By default, this value is set to `0`. For example, Alice can allow Bob to take `0.00001` ETH as a fee each time he revokes a token approval on her behalf.

```typescript
import { createDelegation, ScopeType } from '@metamask/smart-accounts-kit'
import { parseEther } from 'viem'

// USDC address on Sepolia.
const USDC_ADDRESS = '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238'

const delegation = createDelegation({
  scope: {
    type: ScopeType.FunctionCall,
    targets: [USDC_ADDRESS],
    selectors: ['approve(address, uint256)'],
    valueLte: { maxValue: parseEther('0.00001') },
  },
  to: delegateAccount,
  from: delegatorAccount,
  environment: delegatorAccount.environment,
})
```

#### Ownership Transfer Scope

The ownership transfer scope restricts a delegation to ownership transfer calls only. For example, Alice has deployed a smart contract, and she delegates to Bob the ability to transfer ownership of that contract.

This scope requires a `contractAddress`, which represents the address of the deployed contract. Internally, this scope uses the [ownershipTransfer](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#ownershiptransfer) caveat enforcer. See the [ownership transfer scope reference](https://docs.metamask.io/smart-accounts-kit/reference/delegation/delegation-scopes/#ownership-transfer-scope) for more details.

```typescript
import { createDelegation, ScopeType } from '@metamask/smart-accounts-kit'

const contractAddress = '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238'

const delegation = createDelegation({
  scope: {
    type: ScopeType.OwnershipTransfer,
    contractAddress,
  },
  to: delegateAccount,
  from: delegatorAccount,
  environment: delegatorAccount.environment,
})
```

#### Constrain a Delegation Scope

Delegation scopes define the delegation's initial authority and help prevent delegation misuse. You can further constrain these scopes and limit the delegation's authority by applying caveat enforcers.

For example, Alice creates a delegation with an ERC-20 transfer scope that allows Bob to spend up to 10 USDC. If Alice wants to further restrict the scope to limit Bob's delegation to be valid for only seven days, she can apply the [timestamp](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#timestamp) caveat enforcer.

The following example creates a delegation using [createDelegation](https://docs.metamask.io/smart-accounts-kit/reference/delegation/#createdelegation), applies the ERC-20 transfer scope with a spending limit of 10 USDC, and applies the `timestamp` caveat enforcer to restrict the delegation's validity to a seven-day period:

```typescript
import { createDelegation, ScopeType, CaveatType } from '@metamask/smart-accounts-kit'

// Convert milliseconds to seconds.
const currentTime = Math.floor(Date.now() / 1000)
// Seven days after current time.
const beforeThreshold = currentTime + 604800

const caveats = [
  {
    type: CaveatType.Timestamp,
    afterThreshold: currentTime,
    beforeThreshold,
  },
]

const delegation = createDelegation({
  scope: {
    type: ScopeType.Erc20TransferAmount,
    tokenAddress: '0xc11F3a8E5C7D16b75c9E2F60d26f5321C6Af5E92',
    maxAmount: 10000n,
  },
  // Apply caveats to the delegation.
  caveats,
  to: delegateAccount,
  from: delegatorAccount,
  environment: delegatorAccount.environment,
})
```

See the [caveats reference](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/) for the full list of caveat types and their parameters. For more specific or custom control, you can also [create custom caveat enforcers](https://docs.metamask.io/tutorials/create-custom-caveat-enforcer/) and apply them to delegations.

---

### Create a Redelegation

Redelegation is a core feature that sets delegations apart from other permission sharing frameworks. It allows a delegate to create a delegation chain, passing on the same or reduced level of authority from the root delegator.

For example, if Alice grants Bob permission to spend 10 USDC on her behalf, Bob can further grant Carol permission to spend up to 5 USDC on Alice's behalf — that is, Bob can redelegate. This creates a delegation chain where the root permissions are re-shared with additional parties.

#### Create a Root Delegation

Create a root delegation from Alice to Bob. This example uses the erc20TransferAmount scope, allowing Alice to delegate to Bob the ability to spend 10 USDC on her behalf.

```typescript
import { aliceSmartAccount, bobSmartAccount } from './config.ts'
import { createDelegation, ScopeType } from '@metamask/smart-accounts-kit'
import { parseUnits } from 'viem'

const delegation = createDelegation({
  scope: {
    type: ScopeType.Erc20TransferAmount,
    tokenAddress: '0xc11F3a8E5C7D16b75c9E2F60d26f5321C6Af5E92',
    // USDC has 6 decimal places.
    maxAmount: parseUnits('10', 6),
  },
  to: bobSmartAccount.address,
  from: aliceSmartAccount.address,
  environment: aliceSmartAccount.environment,
})

const signedDelegation = aliceSmartAccount.signDelegation({ delegation })
```

#### Create the Redelegation

Create a redelegation from Bob to Carol. When creating a redelegation, you can only narrow the scope of the original authority, not expand it.

To create a redelegation, provide the signed delegation as the `parentDelegation` argument when calling [createDelegation](https://docs.metamask.io/smart-accounts-kit/reference/delegation/#createdelegation). This example uses the erc20TransferAmount scope, allowing Bob to delegate to Carol the ability to spend 5 USDC on Alice's behalf.

```typescript
import { bobSmartAccount, carolSmartAccount } from './config.ts'
import { createDelegation, ScopeType } from '@metamask/smart-accounts-kit'
import { parseUnits } from 'viem'

const redelegation = createDelegation({
  scope: {
    type: ScopeType.Erc20TransferAmount,
    tokenAddress: '0xc11F3a8E5C7D16b75c9E2F60d26f5321C6Af5E92',
    // USDC has 6 decimal places.
    maxAmount: parseUnits('5', 6),
  },
  to: carolSmartAccount.address,
  from: bobSmartAccount.address,
  // Signed root delegation from previous step.
  parentDelegation: signedDelegation,
  environment: bobSmartAccount.environment,
})

const signedRedelegation = bobSmartAccount.signDelegation({ delegation: redelegation })
```

#### Limit Redelegation Using Caveats

When you create a redelegation, apply the toolkit's [caveats](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/) to narrow Carol's authority. For example, you can limit the authority so Carol can use the delegation only once.

To apply caveats, create the `Delegation` object and use [createCaveatBuilder](https://docs.metamask.io/smart-accounts-kit/reference/delegation/#createcaveatbuilder). Use [hashDelegation](https://docs.metamask.io/smart-accounts-kit/reference/delegation/#hashdelegation) to get the delegation hash, then provide it as the `authority` field.

This example uses the [limitedCalls](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#limitedcalls) caveat with a limit of `1`.

```typescript
import { bobSmartAccount, carolSmartAccount } from './config.ts'
import { CaveatType } from '@metamask/smart-accounts-kit'
import { createCaveatBuilder, hashDelegation } from '@metamask/smart-accounts-kit/utils'

const caveatBuilder = createCaveatBuilder(bobSmartAccount.environment)

const caveats = caveatBuilder.addCaveat(CaveatType.LimitedCalls, { limit: 1 })

const redelegation: Delegation = {
  delegate: carolSmartAccount.address,
  delegator: bobSmartAccount.address,
  authority: hashDelegation(rootDelegation),
  caveats: caveats.build(),
  salt: '0x',
}

const signedRedelegation = await bobSmartAccount.signDelegation({ delegation: redelegation })
```

---

### Check the Delegation State

When using spending limit delegation scopes or relevant caveat enforcers, you might need to check the remaining transferable amount in a delegation. For example, if a delegation allows a user to spend 10 USDC per week and they have already spent 10 - n USDC in the current period, you can determine how much of the allowance is still available for transfer.

Use the `CaveatEnforcerClient` to check the available balances for specific scopes or caveats.

#### Create a CaveatEnforcerClient

To check the delegation state, create a [CaveatEnforcerClient](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveat-enforcer-client/). This client allows you to interact with the caveat enforcers of the delegation, and read the required state.

```typescript
import { environment, publicClient as client } from './config.ts'
import { createCaveatEnforcerClient } from '@metamask/smart-accounts-kit'

const caveatEnforcerClient = createCaveatEnforcerClient({
  environment,
  client,
})
```

#### Read the Caveat Enforcer State

This example uses the [getErc20PeriodTransferEnforcerAvailableAmount](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveat-enforcer-client/#geterc20periodtransferenforceravailableamount) method to read the state and retrieve the remaining amount for the current transfer period.

```typescript
import { delegation } from './config.ts'

// Returns the available amount for current period.
const { availableAmount } =
  await caveatEnforcerClient.getErc20PeriodTransferEnforcerAvailableAmount({
    delegation,
  })
```

See the [Caveat Enforcer Client reference](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveat-enforcer-client/) for the full list of available methods.

---

### Disable a Delegation

Delegations are created offchain and can be stored anywhere, but you can disable a delegation onchain using the toolkit. When a delegation is disabled, any attempt to redeem it will revert, effectively revoking the permissions that were previously granted.

For example, if Alice has given permission to Bob to spend 10 USDC on her behalf, and after a week she wants to revoke that permission, Alice can disable the delegation she created for Bob. If Bob tries to redeem the disabled delegation, the transaction will revert, preventing him from spending Alice's USDC.

To disable a delegation, you can use the [disableDelegation](https://docs.metamask.io/smart-accounts-kit/reference/delegation/#disabledelegation) utility function from the toolkit to generate calldata. Once the calldata is prepared, you can send it to the Delegation Manager to disable the delegation.

```typescript
import { DelegationManager } from '@metamask/smart-accounts-kit/contracts'
import { environment, delegation, bundlerClient } from './config.ts'

const disableDelegationData = DelegationManager.encode.disableDelegation({
  delegation,
})

// Appropriate fee per gas must be determined for the specific bundler being used.
const maxFeePerGas = 1n
const maxPriorityFeePerGas = 1n

const userOperationHash = await bundlerClient.sendUserOperation({
  account: delegatorAccount,
  calls: [
    {
      to: environment.DelegationManager,
      data: disableDelegationData,
    },
  ],
  maxFeePerGas,
  maxPriorityFeePerGas,
})
```

---

## Advanced Permissions (ERC-7715)

### Perform Executions on a MetaMask User's Behalf

Advanced Permissions (ERC-7715) are fine-grained permissions that your dapp can request from a MetaMask user to execute transactions on their behalf. For example, a user can grant your dapp permission to spend 10 USDC per day to buy ETH over the course of a month. Once the permission is granted, your dapp can use the allocated 10 USDC each day to purchase ETH directly from the MetaMask user's account.

In this guide, you'll request an ERC-20 periodic transfer permission from a MetaMask user to transfer 1 USDC every day on their behalf.

#### Prerequisites

- [Install and set up the Smart Accounts Kit.](#installation-and-setup)
- [Install MetaMask Flask 13.5.0 or later.](https://docs.metamask.io/snaps/get-started/install-flask/)

#### Step 1: Set Up a Wallet Client

Set up a Wallet Client using Viem's [createWalletClient](https://viem.sh/docs/clients/wallet) function. This client will help you interact with MetaMask Flask.

Then, extend the Wallet Client functionality using `erc7715ProviderActions`. These actions enable you to request Advanced Permissions from the user.

```typescript
import { createWalletClient, custom } from 'viem'
import { erc7715ProviderActions } from '@metamask/smart-accounts-kit/actions'

const walletClient = createWalletClient({
  transport: custom(window.ethereum),
}).extend(erc7715ProviderActions())
```

#### Step 2: Set Up a Public Client

```typescript
import { createPublicClient, http } from 'viem'
import { sepolia as chain } from 'viem/chains'

const publicClient = createPublicClient({
  chain,
  transport: http(),
})
```

#### Step 3: Set Up a Session Account

Set up a session account, which can be either a smart account or an EOA, to request Advanced Permissions. The requested permissions are granted to the session account, which is responsible for executing transactions on behalf of the user.

```typescript
import { privateKeyToAccount } from 'viem/accounts'
import { toMetaMaskSmartAccount, Implementation } from '@metamask/smart-accounts-kit'

const privateKey = '0x...'
const account = privateKeyToAccount(privateKey)

const sessionAccount = await toMetaMaskSmartAccount({
  client: publicClient,
  implementation: Implementation.Hybrid,
  deployParams: [account.address, [], [], []],
  deploySalt: '0x',
  signer: { account },
})
```

#### Step 4: Check the EOA Account Code

With MetaMask Flask 13.9.0 or later, Advanced Permissions support automatically upgrading a user's account to a MetaMask smart account. On earlier versions, upgrade the user to a smart account before requesting Advanced Permissions.

If the user has not yet been upgraded, you can handle the upgrade [programmatically](https://docs.metamask.io/metamask-connect/evm/guides/send-transactions/batch-transactions/) or ask the user to [switch to a smart account manually](https://support.metamask.io/configure/accounts/switch-to-or-revert-from-a-smart-account/#how-to-switch-to-a-metamask-smart-account).

MetaMask's Advanced Permissions (ERC-7715) implementation requires the user to be upgraded to a MetaMask Smart Account because, under the hood, you're requesting a signature for an ERC-7710 delegation. ERC-7710 delegation is one of the core features supported only by MetaMask Smart Accounts.

```typescript
import { getSmartAccountsEnvironment } from '@metamask/smart-accounts-kit'
import { sepolia as chain } from 'viem/chains'

const addresses = await walletClient.requestAddresses()
const address = addresses[0]

// Get the EOA account code
const code = await publicClient.getCode({
  address,
})

if (code) {
  // The address to which EOA has delegated. According to EIP-7702, 0xef0100 || address
  // represents the delegation.
  //
  // You need to remove the first 8 characters (0xef0100) to get the delegator address.
  const delegatorAddress = `0x${code.substring(8)}`

  const statelessDelegatorAddress = getSmartAccountsEnvironment(chain.id).implementations
    .EIP7702StatelessDeleGatorImpl

  // If account is not upgraded to MetaMask smart account, you can
  // either upgrade programmatically or ask the user to switch to a smart account manually.
  const isAccountUpgraded =
    delegatorAddress.toLowerCase() === statelessDelegatorAddress.toLowerCase()
}
```

#### Step 5: Request Advanced Permissions

Request Advanced Permissions from the user with the Wallet Client's `requestExecutionPermissions` action. In this example, you'll request an ERC-20 periodic permission.

See the [requestExecutionPermissions](https://docs.metamask.io/smart-accounts-kit/reference/advanced-permissions/wallet-client/#requestexecutionpermissions) API reference for more information.

```typescript
import { sepolia as chain } from 'viem/chains'
import { parseUnits } from 'viem'

// Since current time is in seconds, we need to convert milliseconds to seconds.
const currentTime = Math.floor(Date.now() / 1000)
// 1 week from now.
const expiry = currentTime + 604800

// USDC address on Ethereum Sepolia.
const tokenAddress = '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238'

const grantedPermissions = await walletClient.requestExecutionPermissions([
  {
    chainId: chain.id,
    expiry,
    // The requested permissions will granted to the
    // session account.
    to: sessionAccount.address,
    permission: {
      type: 'erc20-token-periodic',
      data: {
        tokenAddress,
        // 10 USDC in WEI format. Since USDC has 6 decimals, 10 * 10^6
        periodAmount: parseUnits('10', 6),
        // 1 day in seconds
        periodDuration: 86400,
        justification: 'Permission to transfer 10 USDC every day',
      },
      isAdjustmentAllowed: true,
    },
  },
])
```

#### Step 6: Set Up a Viem Client

Set up a Viem client depending on your session account type.

For a smart account, set up a Bundler Client using Viem's [createBundlerClient](https://viem.sh/account-abstraction/clients/bundler) function. This lets you use the bundler service to estimate gas for user operations and submit transactions to the network.

For an EOA, set up a Wallet Client using Viem's [createWalletClient](https://viem.sh/docs/clients/wallet) function. This lets you send transactions directly to the network.

The toolkit provides public actions for both of the clients which can be used to redeem Advanced Permissions, and execute transactions on a user's behalf.

```typescript
import { createBundlerClient } from 'viem/account-abstraction'
import { erc7710BundlerActions } from '@metamask/smart-accounts-kit/actions'

const bundlerClient = createBundlerClient({
  client: publicClient,
  transport: http('https://your-bundler-rpc.com'),
  // Allows you to use the same Bundler Client as paymaster.
  paymaster: true,
}).extend(erc7710BundlerActions())
```

#### Step 7: Redeem Advanced Permissions

The session account can now redeem the permissions. The redeem transaction is sent to the `DelegationManager` contract, which validates the delegation and executes actions on the user's behalf.

To redeem the permissions, use the client action based on your session account type. A smart account uses the Bundler Client's `sendUserOperationWithDelegation` action, and an EOA uses the Wallet Client's `sendTransactionWithDelegation` action.

See the [sendUserOperationWithDelegation](https://docs.metamask.io/smart-accounts-kit/reference/erc7710/bundler-client/#senduseroperationwithdelegation) and [sendTransactionWithDelegation](https://docs.metamask.io/smart-accounts-kit/reference/erc7710/wallet-client/#sendtransactionwithdelegation) API reference for more information.

```typescript
import { calldata } from './config.ts'

// These properties must be extracted from the permission response.
const permissionContext = grantedPermissions[0].context
const delegationManager = grantedPermissions[0].delegationManager

// USDC address on Ethereum Sepolia.
const tokenAddress = '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238'

// Calls without permissionContext and delegationManager will be executed
// as a normal user operation.
const userOperationHash = await bundlerClient.sendUserOperationWithDelegation({
  publicClient,
  account: sessionAccount,
  calls: [
    {
      to: tokenAddress,
      data: calldata,
      permissionContext,
      delegationManager,
    },
  ],
  // Appropriate values must be used for fee-per-gas.
  maxFeePerGas: 1n,
  maxPriorityFeePerGas: 1n,
})
```

#### Next Steps

- See how to [get the supported execution permissions](#get-supported-permissions).
- See how to configure different [ERC-20 token permissions](#erc-20-token-permissions) and [native token permissions](#native-token-permissions).

---

### ERC-20 Token Permissions

Advanced Permissions (ERC-7715) supports ERC-20 token permission types that allow you to request fine-grained permissions for ERC-20 token transfers with periodic, fixed allowance, or streaming conditions, depending on your use case.

#### ERC-20 Allowance Permission

This permission type ensures a fixed ERC-20 token allowance. It allows transfers up to a maximum total amount and doesn't reset by period.

For example, a user signs an ERC-7715 permission that lets your dapp spend up to 50 USDC in total. After the dapp transfers 50 USDC, no additional transfers are allowed under this permission.

See the [ERC-20 allowance permission API reference](https://docs.metamask.io/smart-accounts-kit/reference/advanced-permissions/permissions/#erc-20-allowance-permission) for more information.

```typescript
import { sepolia as chain } from 'viem/chains'
import { parseUnits } from 'viem'
import { walletClient } from './client.ts'

// Since current time is in seconds, convert milliseconds to seconds.
const currentTime = Math.floor(Date.now() / 1000)
// 1 week from now.
const expiry = currentTime + 604800

// USDC address on Ethereum Sepolia.
const tokenAddress = '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238'

const grantedPermissions = await walletClient.requestExecutionPermissions([
  {
    chainId: chain.id,
    expiry,
    to: sessionAccount.address,
    permission: {
      type: 'erc20-token-allowance',
      data: {
        tokenAddress,
        // 50 USDC in WEI format. Since USDC has 6 decimals, 50 * 10^6.
        allowanceAmount: parseUnits('50', 6),
        startTime: currentTime,
        justification: 'Permission to transfer up to 50 USDC in total',
      },
      isAdjustmentAllowed: true,
    },
  },
])
```

#### ERC-20 Periodic Permission

This permission type ensures a per-period limit for ERC-20 token transfers. At the start of each new period, the allowance resets.

For example, a user signs an ERC-7715 permission that lets a dapp spend up to 10 USDC on their behalf each day. The dapp can transfer a total of 10 USDC per day; the limit resets at the beginning of the next day.

See the [ERC-20 periodic permission API reference](https://docs.metamask.io/smart-accounts-kit/reference/advanced-permissions/permissions/#erc-20-periodic-permission) for more information.

```typescript
import { sepolia as chain } from 'viem/chains'
import { parseUnits } from 'viem'
import { walletClient } from './client.ts'

const currentTime = Math.floor(Date.now() / 1000)
const expiry = currentTime + 604800

const tokenAddress = '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238'

const grantedPermissions = await walletClient.requestExecutionPermissions([
  {
    chainId: chain.id,
    expiry,
    to: sessionAccount.address,
    permission: {
      type: 'erc20-token-periodic',
      data: {
        tokenAddress,
        periodAmount: parseUnits('10', 6),
        periodDuration: 86400,
        justification: 'Permission to transfer 10 USDC every day',
      },
      isAdjustmentAllowed: true,
    },
  },
])
```

#### ERC-20 Stream Permission

This permission type ensures a linear streaming transfer limit for ERC-20 tokens. Token transfers are blocked until the defined start timestamp. At the start, a specified initial amount is released, after which tokens accrue linearly at the configured rate, up to the maximum allowed amount.

For example, a user signs an ERC-7715 permission that allows a dapp to spend 0.1 USDC per second, starting with an initial amount of 1 USDC, up to a maximum of 2 USDC.

See the [ERC-20 stream permission API reference](https://docs.metamask.io/smart-accounts-kit/reference/advanced-permissions/permissions/#erc-20-stream-permission) for more information.

```typescript
import { sepolia as chain } from 'viem/chains'
import { parseUnits } from 'viem'
import { walletClient } from './client.ts'

const currentTime = Math.floor(Date.now() / 1000)
const expiry = currentTime + 604800

const tokenAddress = '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238'

const grantedPermissions = await walletClient.requestExecutionPermissions([
  {
    chainId: chain.id,
    expiry,
    to: sessionAccount.address,
    permission: {
      type: 'erc20-token-stream',
      data: {
        tokenAddress,
        amountPerSecond: parseUnits('0.1', 6),
        initialAmount: parseUnits('1', 6),
        maxAmount: parseUnits('2', 6),
        startTime: currentTime,
        justification: 'Permission to use 0.1 USDC per second',
      },
      isAdjustmentAllowed: true,
    },
  },
])
```

---

### Native Token Permissions

Advanced Permissions (ERC-7715) supports native token permission types that allow you to request fine-grained permissions for native token transfers with periodic, fixed-allowance, or streaming conditions, depending on your use case.

#### Native Token Allowance Permission

This permission type ensures a fixed native token allowance. It allows transfers up to a maximum total amount and doesn't reset by period.

For example, a user signs an ERC-7715 permission that lets your dapp spend up to 0.05 ETH in total. After the dapp transfers 0.05 ETH, no additional transfers are allowed under this permission.

See the [native token allowance permission API reference](https://docs.metamask.io/smart-accounts-kit/reference/advanced-permissions/permissions/#native-token-allowance-permission) for more information.

```typescript
import { sepolia as chain } from 'viem/chains'
import { parseEther } from 'viem'
import { walletClient } from './client.ts'

const currentTime = Math.floor(Date.now() / 1000)
const expiry = currentTime + 604800

const grantedPermissions = await walletClient.requestExecutionPermissions([
  {
    chainId: chain.id,
    expiry,
    to: sessionAccount.address,
    permission: {
      type: 'native-token-allowance',
      data: {
        allowanceAmount: parseEther('0.05'),
        startTime: currentTime,
        justification: 'Permission to transfer up to 0.05 ETH in total',
      },
      isAdjustmentAllowed: true,
    },
  },
])
```

#### Native Token Periodic Permission

This permission type ensures a per-period limit for native token transfers. At the start of each new period, the allowance resets.

For example, a user signs an ERC-7715 permission that lets a dapp spend up to 0.001 ETH on their behalf each day. The dapp can transfer a total of 0.001 ETH per day; the limit resets at the beginning of the next day.

See the [native token periodic permission API reference](https://docs.metamask.io/smart-accounts-kit/reference/advanced-permissions/permissions/#native-token-periodic-permission) for more information.

```typescript
import { sepolia as chain } from 'viem/chains'
import { parseEther } from 'viem'
import { walletClient } from './client.ts'

const currentTime = Math.floor(Date.now() / 1000)
const expiry = currentTime + 604800

const grantedPermissions = await walletClient.requestExecutionPermissions([
  {
    chainId: chain.id,
    expiry,
    to: sessionAccount.address,
    permission: {
      type: 'native-token-periodic',
      data: {
        periodAmount: parseEther('0.001'),
        periodDuration: 86400,
        startTime: currentTime,
        justification: 'Permission to use 0.001 ETH every day',
      },
      isAdjustmentAllowed: true,
    },
  },
])
```

#### Native Token Stream Permission

This permission type ensures a linear streaming transfer limit for native tokens. Token transfers are blocked until the defined start timestamp. At the start, a specified initial amount is released, after which tokens accrue linearly at the configured rate, up to the maximum allowed amount.

For example, a user signs an ERC-7715 permission that allows a dapp to spend 0.0001 ETH per second, starting with an initial amount of 0.1 ETH, up to a maximum of 1 ETH.

See the [native token stream permission API reference](https://docs.metamask.io/smart-accounts-kit/reference/advanced-permissions/permissions/#native-token-stream-permission) for more information.

```typescript
import { sepolia as chain } from 'viem/chains'
import { parseEther } from 'viem'
import { walletClient } from './client.ts'

const currentTime = Math.floor(Date.now() / 1000)
const expiry = currentTime + 604800

const grantedPermissions = await walletClient.requestExecutionPermissions([
  {
    chainId: chain.id,
    expiry,
    to: sessionAccount.address,
    permission: {
      type: 'native-token-stream',
      data: {
        amountPerSecond: parseEther('0.0001'),
        initialAmount: parseEther('0.1'),
        maxAmount: parseEther('1'),
        startTime: currentTime,
        justification: 'Permission to use 0.0001 ETH per second',
      },
      isAdjustmentAllowed: true,
    },
  },
])
```

---

### Advanced Permissions Redelegation

Redelegation is a core feature that sets Advanced Permissions apart from other permission sharing frameworks. It allows a session account (delegate) to create a delegation chain, passing on the same or reduced level of authority from the MetaMask account (delegator).

For example, if a dapp is granted permission to spend 10 USDC on a user's behalf, it can further delegate that permission to specific agents, such as allowing a Swap agent to spend up to 5 USDC. This creates a permission sharing chain in which the root permissions are shared with additional parties.

#### Request Advanced Permissions

Request Advanced Permissions from the user with the Wallet Client's [requestExecutionPermissions](https://docs.metamask.io/smart-accounts-kit/reference/advanced-permissions/wallet-client/#requestexecutionpermissions) action.

This example uses the ERC-20 periodic permission, allowing the user to grant dapp the ability to spend 10 USDC on their behalf.

```typescript
import { sepolia as chain } from 'viem/chains'
import { sessionAccount, walletClient, tokenAddress } from './config.ts'
import { parseUnits } from 'viem'

const currentTime = Math.floor(Date.now() / 1000)
const expiry = currentTime + 604800

const grantedPermissions = await walletClient.requestExecutionPermissions([
  {
    chainId: chain.id,
    expiry,
    to: sessionAccount.address,
    permission: {
      type: 'erc20-token-periodic',
      data: {
        tokenAddress,
        periodAmount: parseUnits('10', 6),
        periodDuration: 86400,
        justification: 'Permission to transfer 10 USDC every day',
      },
      isAdjustmentAllowed: true,
    },
  },
])
```

#### Create the Redelegation

Create a redelegation from dapp to a Swap agent.

To create a redelegation, provide the granted permission context as the `permissionContext` argument when calling [redelegatePermissionContext](https://docs.metamask.io/smart-accounts-kit/reference/erc7710/wallet-client/#redelegatepermissioncontext). In the previous step, `sessionAccount` was extended with `erc7710WalletActions`.

When you create a redelegation, apply the toolkit's caveats to narrow the Swap agent's authority. In this example, we'll use [erc20TransferAmount](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#erc20transferamount) enforcer, allowing your dapp to delegate the Swap agent only the ability to spend 5 USDC on the user's behalf.

When creating a redelegation, you can only narrow the scope of the original authority, not expand it.

```typescript
import { sessionAccount, agentAccount, tokenAddress } from './config.ts'
import {
  createDelegation,
  ScopeType,
  getSmartAccountsEnvironment,
  Caveats,
  CaveatType,
} from '@metamask/smart-accounts-kit'
import { parseUnits } from 'viem'
import { sepolia as chain } from 'viem/chains'

const caveats: Caveats = [
  {
    type: CaveatType.Erc20TransferAmount,
    tokenAddress,
    // USDC has 6 decimal places.
    maxAmount: parseUnits('5', 6),
  },
]

const environment = getSmartAccountsEnvironment(chain.id)

const { permissionContext: signedPermissionContext } =
  await sessionAccount.redelegatePermissionContext({
    to: agentAccount.address,
    environment,
    permissionContext: grantedPermissions[0].context,
    caveats,
  })
```

---

### Get Supported Permissions

ERC-7715 defines an RPC method that returns the execution permissions a wallet supports. Use the method to verify the available Advanced Permissions types and rules before sending requests.

```typescript
import { walletClient } from './config.ts'

const supportedPermissions = await walletClient.getSupportedExecutionPermissions()
```

See the full list of [supported Advanced Permissions](#supported-advanced-permissions-table).

---

### Get Granted Permissions

ERC-7715 defines an RPC method that returns the granted execution permissions for a wallet. Use the method to get the granted Advanced Permissions for a wallet.

```typescript
import { walletClient } from './config.ts'

const grantedExecutionPermissions = await walletClient.getGrantedExecutionPermissions()
```

---

### Token Approval Revocation Permission

Advanced Permissions (ERC-7715) supports the token approval revocation permission type that allows you to request permission to revoke existing token approvals on behalf of the user.

This permission type enables revoking existing token approvals on behalf of the user. For example, a user signs an ERC-7715 permission that lets a dapp revoke any ERC-20 token allowances periodically, or during an ongoing exploit.

See the [token approval revocation permission API reference](https://docs.metamask.io/smart-accounts-kit/reference/advanced-permissions/permissions/#token-approval-revocation-permission) for more information.

```typescript
import { sepolia as chain } from 'viem/chains'
import { walletClient } from './client.ts'

const currentTime = Math.floor(Date.now() / 1000)
const expiry = currentTime + 60 * 60 * 24 * 30

const grantedPermissions = await walletClient.requestExecutionPermissions([
  {
    chainId: chain.id,
    expiry,
    to: sessionAccount.address,
    permission: {
      type: 'token-approval-revocation',
      data: {
        erc20Approve: true,
        erc721Approve: false,
        erc721SetApprovalForAll: false,
        permit2Approve: true,
        permit2Lockdown: false,
        permit2InvalidateNonces: false,
        justification: 'Permission to revoke ERC-20 token approvals',
      },
      isAdjustmentAllowed: false,
    },
  },
])
```

---

## x402 Payments

### x402 Overview

[x402](https://www.x402.org/) is an open payment protocol that uses the HTTP `402` status code to enable programmatic, machine-to-machine payments over HTTP. It allows servers to charge for API access without requiring buyer accounts, API keys, or traditional payment infrastructure.

For example, an AI agent can pay 0.01 USDC per request to access a weather API, or a dapp can charge users a micro-payment to retrieve premium onchain analytics data.

#### ERC-7710 Payments

The standard x402 protocol supports direct token transfers (using ERC-20 Permit2 or EIP-3009). ERC-7710 extends this by enabling delegation-based payments from MetaMask smart accounts.

With ERC-7710, a buyer's smart account creates a delegation that authorizes the facilitator to transfer tokens on their behalf. The buyer doesn't sign a direct token approval. Instead, they sign a delegation that the facilitator redeems during settlement.

This approach enables buyers to pay from MetaMask wallet. Buyers can restrict delegations to specific facilitator addresses, amounts, and time windows using delegation scopes. They can also create long-lived delegations that allow recurring payments without re-signing for each request.

Learn more about [ERC-7710 delegations](https://docs.metamask.io/smart-accounts-kit/concepts/delegation/overview/).

#### Facilitator URLs

| Name | ID | URL |
| --- | --- | --- |
| Base | eip155:8453 | `https://tx-sentinel-base-mainnet.dev-api.cx.metamask.io/platform/v2/x402` |
| Base Sepolia | eip155:84532 | `https://tx-sentinel-base-sepolia.dev-api.cx.metamask.io/platform/v2/x402` |
| Monad | eip155:143 | `https://tx-sentinel-monad-mainnet.dev-api.cx.metamask.io/platform/v2/x402` |

---

### Create an x402 Server (Seller)

In this guide, you build a Node.js server that charges for HTTP API access using x402 and accepts ERC-7710 delegation payments verified through the MetaMask facilitator.

You use the official [@x402/express](https://www.npmjs.com/package/@x402/express) middleware with the [@metamask/x402](https://www.npmjs.com/package/@metamask/x402) package, which provides an ERC-7710 server scheme that routes verification and settlement through the MetaMask facilitator.

#### Prerequisites

- [Node.js 18](https://nodejs.org/en) or later.
- A [Node.js Express server](https://expressjs.com/en/starter/installing.html).
- A seller payout address to receive funds (for example, a [MetaMask wallet](https://metamask.io/download) address).

#### Step 1: Install the Dependencies

```bash
npm install @metamask/x402 @x402/core @x402/express cors express
```

#### Step 2: Configure Middleware

Set up the Express server with the x402 `paymentMiddleware` and the `x402ExactEvmErc7710ServerScheme` from `@metamask/x402`.

The scheme automatically adds payment requirements with ERC-7710 fields when `assetTransferMethod` is set to `erc7710` in the route configuration.

The `paymentMiddleware` intercepts requests to protected routes and handles the full x402 payment flow, including requirements advertisement, verification, and settlement.

In this example, you create a protected `GET /api/hello` endpoint that charges 0.01 USDC on Base Sepolia.

Replace the payout address in `src/config.ts` with your own seller wallet address.

```typescript
import express, { type Request, type Response } from 'express'
import cors from 'cors'
import { paymentMiddleware, x402ResourceServer } from '@x402/express'
import { x402ExactEvmErc7710ServerScheme } from '@metamask/x402'
import { NETWORK_ID, PORT, payToAddress, facilitatorClient } from './config.js'

const app = express()

app.use(cors({ exposedHeaders: ['PAYMENT-REQUIRED', 'PAYMENT-RESPONSE'] }))

app.use(
  paymentMiddleware(
    {
      'GET /api/hello': {
        accepts: [
          {
            scheme: 'exact',
            price: '$0.01',
            network: NETWORK_ID,
            payTo: payToAddress,
            extra: {
              assetTransferMethod: 'erc7710',
            },
          },
        ],
        description: 'Access to protected resource',
        mimeType: 'application/json',
      },
    },
    new x402ResourceServer(facilitatorClient).register(
      NETWORK_ID,
      new x402ExactEvmErc7710ServerScheme()
    )
  )
)

app.get('/api/hello', (_req: Request, res: Response) => {
  res.json({ message: 'Hello!' })
})

app.listen(PORT, () => {
  console.log(`[seller] Server running on http://localhost:${PORT}`)
})
```

#### Next Steps

- Learn more about [ERC-7710 delegation](https://docs.metamask.io/smart-accounts-kit/concepts/delegation/overview/).
- See the [x402 ERC-7710 specification](https://github.com/coinbase/x402/blob/main/specs/schemes/exact/scheme_exact_evm.md#3-assettransfermethod-erc-7710).

---

### Pay for an x402 API with Delegation (Buyer)

In this guide, you use a buyer account to access API data from an x402 server by creating a delegation that authorizes token transfers on your behalf.

You use [createx402DelegationProvider](https://docs.metamask.io/smart-accounts-kit/reference/x402/#createx402delegationprovider) to set up an `x402Erc7710Client` with a delegation provider, register it with the x402 client, and use `wrapFetchWithPayment` to automatically handle payment when calling a protected API route.

#### Step 1: Install the Dependencies

```bash
npm install @x402/core @x402/fetch @metamask/x402
```

#### Step 2: Create a Buyer Account

Create an account to represent the buyer, the delegator who creates a delegation. The delegator must be a MetaMask smart account. Use the toolkit's [toMetaMaskSmartAccount](https://docs.metamask.io/smart-accounts-kit/reference/smart-account/#tometamasksmartaccount) method to create the buyer account.

Fund the smart account with USDC for the requested payment.

```typescript
import { Implementation, toMetaMaskSmartAccount } from '@metamask/smart-accounts-kit'
import { publicClient, buyerAccount } from './config'

export const buyerSmartAccount = await toMetaMaskSmartAccount({
  client: publicClient,
  implementation: Implementation.Hybrid,
  deployParams: [buyerAccount.address, [], [], []],
  deploySalt: '0x',
  signer: { account: buyerAccount },
})
```

#### Step 3: Create an x402 ERC-7710 Client

Create an `x402Erc7710Client` using [createx402DelegationProvider](https://docs.metamask.io/smart-accounts-kit/reference/x402/#createx402delegationprovider). The provider creates an open root delegation, signs it, and returns an ABI-encoded delegation chain when the x402 client needs to pay for a request.

The provider appends [redeemer](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#redeemer), [allowedTargets](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#allowedtargets), and [timestamp](https://docs.metamask.io/smart-accounts-kit/reference/delegation/caveats/#timestamp) caveats if not already present.

```typescript
import { createx402DelegationProvider } from '@metamask/smart-accounts-kit/experimental'
import { x402Erc7710Client } from '@metamask/x402'

const erc7710Client = new x402Erc7710Client({
  delegationProvider: createx402DelegationProvider({
    account: buyerSmartAccount,
  }),
})
```

#### Step 4: Register the Client

Register the ERC-7710 client with the x402 core client for all EVM networks. Create an HTTP client and a payment-aware `fetch` function using `wrapFetchWithPayment`.

```typescript
import { x402Client, x402HTTPClient } from '@x402/core/client'
import { wrapFetchWithPayment } from '@x402/fetch'

const coreClient = new x402Client().register('eip155:*', erc7710Client)
const httpClient = new x402HTTPClient(coreClient)

const fetchWithPayment = wrapFetchWithPayment(fetch, httpClient)
```

#### Step 5: Make the Paid Request

Call the protected endpoint using `fetchWithPayment`. It handles the x402 payment flow, calling your delegation provider to create an open delegation when the server returns a `402` response.

```typescript
const paidResponse = await fetchWithPayment('https://api.example.com/paid-endpoint', {
  method: 'GET',
})
```

---

### Recurring x402 Payments

In this guide, you set up recurring x402 payments by requesting an ERC-20 periodic Advanced Permissions permission from a user.

For example, a user gives your agent permission to spend up to 10 USDC per week. Later, when the agent calls an x402 endpoint, it checks the price, uses the granted permission, and pays.

#### Step 1: Install the Dependencies

```bash
npm install @x402/core @x402/fetch @metamask/x402
```

#### Step 2: Set Up a Wallet Client

Set up a Wallet Client using Viem's [createWalletClient](https://viem.sh/docs/clients/wallet) function. Use this client to interact with MetaMask.

Extend the Wallet Client with `erc7715ProviderActions` to enable Advanced Permissions requests.

```typescript
import { createWalletClient, custom } from 'viem'
import { erc7715ProviderActions } from '@metamask/smart-accounts-kit/actions'

const walletClient = createWalletClient({
  transport: custom(window.ethereum),
}).extend(erc7715ProviderActions())
```

#### Step 3: Set Up an Agent Account

The session account can be either a smart account or an EOA. This example uses an EOA as the session account.

```typescript
import { privateKeyToAccount } from 'viem/accounts'

const sessionAccount = privateKeyToAccount('0x...')
```

#### Step 4: Request Advanced Permissions

Request Advanced Permissions from the user with the Wallet Client's `requestExecutionPermissions` action.

In this example, you request an ERC-20 periodic permission with a weekly allowance of 10 USDC. This creates a recurring payment budget that your agent can store and reuse for x402 API calls.

See the [requestExecutionPermissions](https://docs.metamask.io/smart-accounts-kit/reference/advanced-permissions/wallet-client/#requestexecutionpermissions) API reference for more information.

```typescript
import { base as chain } from 'viem/chains'
import { parseUnits } from 'viem'

// USDC address on Base.
const tokenAddress = '0x...'

const currentTime = Math.floor(Date.now() / 1000)
const expiry = currentTime + 60 * 60 * 24 * 30 // Permission expires in 30 days.

const grantedPermissions = await walletClient.requestExecutionPermissions([
  {
    chainId: chain.id,
    expiry,
    to: sessionAccount.address,
    permission: {
      type: 'erc20-token-periodic',
      data: {
        tokenAddress,
        periodAmount: parseUnits('10', 6),
        periodDuration: 604800,
        startTime: currentTime,
        justification:
          'Permission for agent to spend up to 10 USDC every week for making x402 API calls',
      },
      isAdjustmentAllowed: false,
    },
  },
])
```

#### Step 5: Create an x402 ERC-7710 Client

Create an `x402Erc7710Client` using [createx402DelegationProvider](https://docs.metamask.io/smart-accounts-kit/reference/x402/#createx402delegationprovider).

The provider creates an open redelegation from the session account using the granted permission. The facilitator can then redeem the redelegated permission context for x402 settlement.

```typescript
import { createx402DelegationProvider } from '@metamask/smart-accounts-kit/experimental'
import { x402Erc7710Client } from '@metamask/x402'

const permission = grantedPermissions[0]

const erc7710Client = new x402Erc7710Client({
  delegationProvider: createx402DelegationProvider({
    account: sessionAccount,
    parentPermissionContext: permission.context,
    from: permission.from,
  }),
})
```

#### Step 6: Register the Client

Register the ERC-7710 client with the x402 core client for all EVM networks, then create an HTTP client and a payment-aware `fetch` function using `wrapFetchWithPayment`.

```typescript
import { x402Client, x402HTTPClient } from '@x402/core/client'
import { wrapFetchWithPayment } from '@x402/fetch'

const coreClient = new x402Client().register('eip155:*', erc7710Client)
const httpClient = new x402HTTPClient(coreClient)

const fetchWithPayment = wrapFetchWithPayment(fetch, httpClient)
```

#### Step 7: Make the Paid Request

Call the protected endpoint using `fetchWithPayment`. The x402 payment flow calls your delegation provider to create an open redelegation when the server returns a `402` response.

```typescript
const paidResponse = await fetchWithPayment('https://api.example.com/paid-endpoint', {
  method: 'GET',
})
```

You can reuse the same weekly granted permission for additional protected routes and providers in your agent flow. Your agent continues paying until the weekly cap is reached, then resumes after the next weekly period starts.

---

## Skills

Use skills to give your agent framework context on the MetaMask Smart Accounts Kit. Skills guide your agent through smart account creation, delegations, Advanced Permissions (ERC-7715), and x402 payments. Skills are available through the open-source [MetaMask/skills](https://github.com/MetaMask/skills) repository.

### Smart Accounts Kit Skill

This skill gives your agent context on the Smart Accounts Kit and how to integrate its capabilities into your dapp, including smart account creation, delegations, and Advanced Permissions.

```bash
npx skills add MetaMask/skills/domains/web3-tools/skills/smart-accounts-kit
```

#### Key Capabilities

| Capability | Description |
| --- | --- |
| Smart accounts | Integrate MetaMask Smart Accounts to support batch transactions, multi-sig signatures, and gas sponsorship. |
| Delegation | Integrate delegations to execute transactions on behalf of a smart account. |
| Advanced Permissions | Integrate Advanced Permissions to execute transactions on behalf of a MetaMask user. |

### x402 Payments Skill

This skill helps your agent implement x402 HTTP-based payments using the Smart Accounts Kit, enabling both buyer and seller flows with delegations and Advanced Permissions.

```bash
npx skills add MetaMask/skills/domains/web3-tools/skills/x402-payments
```

#### Key Capabilities

| Capability | Description |
| --- | --- |
| Seller | Set up x402 payment endpoints that accept HTTP 402-based payments. |
| Buyer | Pay for x402-protected resources using delegations or Advanced Permissions. |

---

## Supported Networks

The following tables display the networks supported by each version of the Smart Accounts Kit. If you don't see the network you're looking for, you can request support by emailing [hellogators@consensys.net](mailto:hellogators@consensys.net).

### MetaMask Smart Accounts — Mainnet Networks

| Network Name | v0.3.0 | v1.0.0 | v1.1.0 | v1.2.0 |
| --- | --- | --- | --- | --- |
| Arbitrum Nova | ✅ | ✅ | ✅ | ✅ |
| Arbitrum One | ✅ | ✅ | ✅ | ✅ |
| Base | ✅ | ✅ | ✅ | ✅ |
| Berachain | ✅ | ✅ | ✅ | ✅ |
| Binance Smart Chain | ✅ | ✅ | ✅ | ✅ |
| Celo | ❌ | ✅ | ✅ | ✅ |
| Citrea | ❌ | ✅ | ✅ | ✅ |
| Ethereum | ✅ | ✅ | ✅ | ✅ |
| Gnosis Chain | ✅ | ✅ | ✅ | ✅ |
| Ink | ✅ | ✅ | ✅ | ✅ |
| Katana | ❌ | ❌ | ❌ | ✅ |
| Linea | ✅ | ✅ | ✅ | ✅ |
| Mantle | ❌ | ❌ | ✅ | ✅ |
| MegaETH | ❌ | ✅ | ✅ | ✅ |
| Monad | ✅ | ✅ | ✅ | ✅ |
| Optimism | ✅ | ✅ | ✅ | ✅ |
| Polygon | ✅ | ✅ | ✅ | ✅ |
| Ronin | ❌ | ✅ | ✅ | ✅ |
| Sei | ✅ | ✅ | ✅ | ✅ |
| Sonic | ✅ | ✅ | ✅ | ✅ |
| Tempo | ❌ | ✅ | ✅ | ✅ |
| Unichain | ✅ | ✅ | ✅ | ✅ |

### MetaMask Smart Accounts — Testnet Networks

| Network Name | v0.3.0 | v1.0.0 | v1.1.0 | v1.2.0 |
| --- | --- | --- | --- | --- |
| Arbitrum Sepolia | ✅ | ✅ | ✅ | ✅ |
| Base Sepolia | ✅ | ✅ | ✅ | ✅ |
| Berachain Bepolia | ✅ | ✅ | ✅ | ✅ |
| Binance Smart Chain | ✅ | ✅ | ✅ | ✅ |
| Celo Alfajores | ❌ | ✅ | ✅ | ✅ |
| Citrea | ✅ | ✅ | ✅ | ✅ |
| Ethereum Sepolia | ✅ | ✅ | ✅ | ✅ |
| Gnosis Chiado | ✅ | ✅ | ✅ | ✅ |
| Hoodi | ✅ | ✅ | ✅ | ✅ |
| Ink Sepolia | ✅ | ✅ | ✅ | ✅ |
| Bokuto | ❌ | ❌ | ❌ | ✅ |
| Linea Sepolia | ✅ | ✅ | ✅ | ✅ |
| Mantle Sepolia | ❌ | ❌ | ✅ | ✅ |
| MegaETH | ✅ | ✅ | ✅ | ✅ |
| Monad | ✅ | ✅ | ✅ | ✅ |
| Optimism Sepolia | ✅ | ✅ | ✅ | ✅ |
| Polygon Amoy | ✅ | ✅ | ✅ | ✅ |
| Ronin Saigon | ❌ | ✅ | ✅ | ✅ |
| Sei | ✅ | ✅ | ✅ | ✅ |
| Sonic | ✅ | ✅ | ✅ | ✅ |
| Tempo Moderato | ❌ | ✅ | ✅ | ✅ |
| Unichain Sepolia | ✅ | ✅ | ✅ | ✅ |

### Advanced Permissions (ERC-7715) — Mainnet Networks

| Network Name | v0.3.0 | v1.0.0 | v1.1.0 | v1.2.0 |
| --- | --- | --- | --- | --- |
| Arbitrum Nova | ✅ | ✅ | ✅ | ✅ |
| Arbitrum One | ✅ | ✅ | ✅ | ✅ |
| Base | ✅ | ✅ | ✅ | ✅ |
| Berachain | ✅ | ✅ | ✅ | ✅ |
| Binance Smart Chain | ✅ | ✅ | ✅ | ✅ |
| Citrea | ✅ | ✅ | ✅ | ✅ |
| Ethereum | ✅ | ✅ | ✅ | ✅ |
| Gnosis | ✅ | ✅ | ✅ | ✅ |
| Linea | ✅ | ✅ | ✅ | ✅ |
| Monad | ✅ | ✅ | ✅ | ✅ |
| Optimism | ✅ | ✅ | ✅ | ✅ |
| Polygon | ✅ | ✅ | ✅ | ✅ |
| Sei | ✅ | ✅ | ✅ | ✅ |
| Sonic | ✅ | ✅ | ✅ | ✅ |
| Unichain | ✅ | ✅ | ✅ | ✅ |

### Advanced Permissions (ERC-7715) — Testnet Networks

| Network Name | v0.3.0 | v1.0.0 | v1.1.0 | v1.2.0 |
| --- | --- | --- | --- | --- |
| Arbitrum Sepolia | ✅ | ✅ | ✅ | ✅ |
| Base Sepolia | ✅ | ✅ | ✅ | ✅ |
| Berachain Bepolia | ✅ | ✅ | ✅ | ✅ |
| Binance Smart Chain | ✅ | ✅ | ✅ | ✅ |
| Chiado | ✅ | ✅ | ✅ | ✅ |
| Citrea | ✅ | ✅ | ✅ | ✅ |
| Hoodi | ✅ | ✅ | ✅ | ✅ |
| Linea Sepolia | ✅ | ✅ | ✅ | ✅ |
| MegaETH | ✅ | ✅ | ✅ | ✅ |
| Optimism Sepolia | ✅ | ✅ | ✅ | ✅ |
| Polygon Amoy | ✅ | ✅ | ✅ | ✅ |
| Sei | ✅ | ✅ | ✅ | ✅ |
| Sepolia | ✅ | ✅ | ✅ | ✅ |
| Sonic | ✅ | ✅ | ✅ | ✅ |
| Unichain Sepolia | ✅ | ✅ | ✅ | ✅ |

---

## Supported Advanced Permissions Table

The following table displays the Advanced Permissions types supported by the Smart Accounts Kit, MetaMask Flask, and MetaMask production, and the minimum version required for each. If you don't see the Advanced Permissions type you're looking for, you can request it by emailing [hellogators@consensys.net](mailto:hellogators@consensys.net).

| Permission Type | Smart Accounts Kit | MetaMask Flask | MetaMask |
| --- | --- | --- | --- |
| ERC-20 allowance | >= v1.4.0 | >= v13.32.1-flask.0 | >= v13.32.1 |
| ERC-20 periodic | >= v0.1.0 | >= v13.5.0 | >= v13.23.0 |
| ERC-20 stream | >= v0.1.0 | >= v13.5.0 | >= v13.23.0 |
| Native token allowance | >= v1.4.0 | >= v13.32.1-flask.0 | >= v13.32.1 |
| Native token periodic | >= v0.1.0 | >= v13.5.0 | >= v13.23.0 |
| Native token stream | >= v0.1.0 | >= v13.5.0 | >= v13.23.0 |
| Token approval revocation | >= v1.6.0 | - | - |

---

## Partner Integrations

The Smart Accounts Kit is integrated with multiple ecosystem partners. Check out the following documentation from these partners:

| Partner | Description | Link |
| --- | --- | --- |
| Scaffold-ETH 2 (Smart Accounts) | Install the MetaMask Smart Accounts extension for Scaffold-ETH 2. | [Docs](https://docs.metamask.io/smart-accounts-kit/development/get-started/use-scaffold-eth/smart-accounts/) |
| Scaffold-ETH 2 (Advanced Permissions) | Install the MetaMask Advanced Permissions (ERC-7715) extension for Scaffold-ETH 2. | [Docs](https://docs.metamask.io/smart-accounts-kit/development/get-started/use-scaffold-eth/advanced-permissions/) |
| Viem | Use MetaMask Smart Accounts with Viem. | [Docs](https://viem.sh/account-abstraction/accounts/smart/toMetaMaskSmartAccount) |
| Arbitrum | Use MetaMask Smart Accounts with Arbitrum. | [Docs](https://docs.arbitrum.io/for-devs/third-party-docs/MetaMask) |
| permissionless.js | Use MetaMask Smart Accounts with permissionless.js. | [Docs](https://docs.pimlico.io/guides/how-to/accounts/use-metamask-account) |
| Monad | Use MetaMask Smart Accounts with Monad Testnet. | [Docs](https://docs.monad.xyz/tooling-and-infra/account-abstraction/wallet-providers#metamask-delegation-toolkit) |