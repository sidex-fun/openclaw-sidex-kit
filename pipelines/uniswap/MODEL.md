---
name: Uniswap V3 Pipeline
description: Standardized Pipeline for EVM DEX Connection (Uniswap)
---

# Uniswap EVM Connection Model

This pipeline connects to the **Uniswap V3 Router** on EVM-compatible blockchains (Ethereum, Arbitrum, Base, Polygon).

## 🔗 Connection Pipeline

Uses **Private Key** to sign transactions for the `SwapRouter02` contract.

### Supported Chains (Default)
- **Ethereum Mainnet** (ChainID: 1)
- **Arbitrum One** (ChainID: 42161)
- **Base** (ChainID: 8453)

### Requirements
- **Private Key**: Wallet Private Key with Native ETH for Gas.
- **Chain ID**: Specifies which network to transact on.

## 🛠 Usage Models

### 1. Opening Positions (Swap/Buy)

Swaps ETH for a specific ERC-20 Token.

**Command Structure:**
```bash
node pipelines/uniswap/scripts/trade.mjs \
  --symbol="[TOKEN_CONTRACT_ADDRESS]" \
  --side="buy" \
  --amount="0.1" \
  --chain_id="8453" \
  --private_key="[USER_PRIVATE_KEY]"
```
*(Example buys Token on Base network using 0.1 ETH)*

**Pipeline Logic:**
1.  **Router**: Selects the V3 Router for the chain.
2.  **Calldata**: Encodes `exactInputSingle` parameters.
3.  **Sign**: Signs valid raw transaction.
4.  **Send**: Broadcasts to RPC.

### 2. Closing Positions (Sell)

Swaps the entire balance of an ERC-20 Token back to ETH.

**Command Structure:**
```bash
node pipelines/uniswap/scripts/close.mjs \
  --symbol="[TOKEN_CONTRACT_ADDRESS]" \
  --chain_id="8453" \
  --private_key="[USER_PRIVATE_KEY]"
```

### ❗ Important Note
Closing positions on EVM chains requires an **Approval** transaction if the token has not been spent by the Router before. The script mocks this step but in production it is a separate on-chain action.

**Path:** `pipelines/uniswap/`
