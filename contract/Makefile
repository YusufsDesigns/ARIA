-include .env

.PHONY: build test clean fmt snapshot anvil install deploy-sepolia deploy-local

# ─── Local Dev ────────────────────────────────────────────────────────────────

build:
	forge build

test:
	forge test -vvv

clean:
	forge clean

fmt:
	forge fmt

snapshot:
	forge snapshot

anvil:
	anvil

install:
	forge install foundry-rs/forge-std --no-commit

# ─── Deployment ───────────────────────────────────────────────────────────────

# Requires in .env: ALCHEMY_RPC_URL, DEPLOYER_ADDRESS, BASESCAN_API_KEY, KEYSTORE_NAME
deploy-sepolia:
	forge script script/Deploy.s.sol \
		--rpc-url $(ALCHEMY_RPC_URL) \
		--broadcast \
		--account deployer \
		--verify \
		--etherscan-api-key $(BASESCAN_API_KEY) \
		-vvvv

# Requires in .env: PRIVATE_KEY
deploy-local:
	forge script script/Deploy.s.sol \
		--rpc-url http://localhost:8545 \
		--broadcast \
		--private-key $(PRIVATE_KEY) \
		-vvvv

# ─── Verification (standalone) ────────────────────────────────────────────────

# Usage: make verify CONTRACT=<deployed-address>
verify:
	forge verify-contract $(CONTRACT) src/AgentRegistry.sol:AgentRegistry \
		--chain base-sepolia \
		--etherscan-api-key $(BASESCAN_API_KEY) \
		--watch
