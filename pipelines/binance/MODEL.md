---
name: Binance Pipeline
description: Standardized Pipeline for Binance CEX Connection (Futures)
---

# Binance Connection Model

This pipeline provides the structure for connecting User Accounts to **Binance Futures** for High-Frequency Trading.

## 🔗 Connection Pipeline

Uses API Key & Secret HMAC SHA256 Authentication.

### Requirements
- **API Key**: Generated in Binance Dashboard.
- **API Secret**: Secret key for signing requests.
- **Permissions**: "Enable Futures" must be checked on the API Key.

## 🛠 Usage Models

### 1. Opening Positions (Trade)

Executes a Market Order on Binance Futures.

**Command Structure:**
```bash
node pipelines/binance/scripts/trade.mjs \
  --symbol="BTCUSDT" \
  --side="buy" \
  --amount="0.01" \
  --leverage="10" \
  --api_key="[USER_API_KEY]" \
  --api_secret="[USER_API_SECRET]"
```

**Pipeline Logic:**
1.  **Format**: Normalize Symbol (remove `/` for Binance).
2.  **Sign**: Generate HMAC-SHA256 signature using `api_secret`.
3.  **Execute**: POST to `https://fapi.binance.com/fapi/v1/order`.

### 2. Closing Positions (Risk Management)

Closes existing positions.

**Command Structure:**
```bash
node pipelines/binance/scripts/close.mjs \
  --symbol="BTCUSDT" \
  --direction="long" \
  --api_key="[USER_API_KEY]" \
  --api_secret="[USER_API_SECRET]"
```

**Path:** `pipelines/binance/`
