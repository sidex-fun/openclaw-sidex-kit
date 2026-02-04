---
name: Solana Jupiter Pipeline
description: Standardized Pipeline for Solana DEX Aggregator (Jupiter)
---

# Solana Jupiter Connection Model

This pipeline connects to the **Jupiter Aggregator** on the Solana Blockchain to execute efficient swaps.

## 🔗 Connection Pipeline

Uses **Solana Private Key** to sign transactions locally.
Exchanges **USDC** for Target Tokens (Buy) and Target Tokens for **USDC** (Sell).

### Requirements
- **Private Key**: Base58 encoded Solana Private Key.
- **USDC**: Wallet must hold USDC for buying.
- **SOL**: Wallet must hold SOL for gas fees.

## 🛠 Usage Models

### 1. Opening Positions (Swap/Buy)

Swaps USDC for a specific SPL Token.

**Command Structure:**
```bash
node pipelines/solana_jupiter/scripts/trade.mjs \
  --symbol="So11111111111111111111111111111111111111112" \
  --side="buy" \
  --amount="10" \
  --private_key="[SOLANA_PRIVATE_KEY]"
```
*(Note: Symbol should be the Token Mint Address, e.g., the address for SOL or MEME)*

**Pipeline Logic:**
1.  **Quote**: Fetches best route from `quote-api.jup.ag`.
2.  **Transact**: Requests a swap transaction payload.
3.  **Sign**: Signs with the local Private Key.
4.  **Send**: Broadcasts to Solana RPC.

### 2. Closing Positions (Sell)

Swaps the entire balance of a Token back to USDC.

**Command Structure:**
```bash
node pipelines/solana_jupiter/scripts/close.mjs \
  --symbol="[TOKEN_MINT_ADDRESS]" \
  --private_key="[SOLANA_PRIVATE_KEY]"
```

**Path:** `pipelines/solana_jupiter/`
