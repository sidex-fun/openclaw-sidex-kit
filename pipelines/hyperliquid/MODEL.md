---
name: Hyperliquid Pipeline
description: Standardized Pipeline for Hyperliquid DEX Connection and Trading
---

# Hyperliquid Connection Model

This pipeline provides the structure for connecting User Accounts to **Hyperliquid DEX** for High-Frequency Trading. It follows the standard Moltbot/OpenClaw architecture.

## 🔗 Connection Pipeline

The pipeline abstracts the complexity of the Hyperliquid API into simple standardized commands.

### Requirements
- **Private Key**: Required for signing transactions (stored securely by the user).
- **Wallet Address**: For fetching position data.

## 🛠 Usage Models

### 1. Opening Positions (Trade)

Executes a Market or Limit order on Hyperliquid.

**Command Structure:**
```bash
node pipelines/hyperliquid/scripts/trade.mjs \
  --symbol="BTC" \
  --side="buy" \
  --amount="1000" \
  --leverage="20" \
  --private_key="[USER_PRIVATE_KEY]"
```

**Pipeline Logic:**
1.  **Validate**: Checks input parameters.
2.  **Connect**: Establishes connection to `api.hyperliquid.xyz`.
3.  **Construct**: Builds the specific L1 order payload (asset index, limit price, etc.).
4.  **Sign**: (Integration Point) Signs the payload with the connect wallet.
5.  **Execute**: Posts the transaction to the matching engine.

### 2. Closing Positions (Risk Management)

Closes existing positions to secure profit or stop loss.

**Command Structure:**
```bash
node pipelines/hyperliquid/scripts/close.mjs \
  --symbol="BTC" \
  --direction="long" \
  --private_key="[USER_PRIVATE_KEY]"
```

## 🏗 Integration Notes

This pipeline is designed to be **modular**. Users can plug in their specific signing provider (e.g., Ethers.js wallet, Hardware Wallet bridge) into the `trade.mjs` execution block.

**Path:** `pipelines/hyperliquid/`
