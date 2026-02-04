---
name: Bybit Pipeline
description: Standardized Pipeline for Bybit V5 CEX Connection
---

# Bybit Connection Model

This pipeline provides the structure for connecting User Accounts to **Bybit Unified Trading Account (V5)** for High-Frequency Trading.

## 🔗 Connection Pipeline

Uses **Bybit V5 API** with HMAC-SHA256 signature (Headers).

### Requirements
- **API Key**: Generated in Bybit Account settings.
- **API Secret**: Secret key for signing requests.
- **Permissions**: "Unified Trading" or "Contract" permissions enabled.

## 🛠 Usage Models

### 1. Opening Positions (Trade)

Executes a Market Order on Bybit Linear (USDT Perpetual).

**Command Structure:**
```bash
node pipelines/bybit/scripts/trade.mjs \
  --symbol="BTCUSDT" \
  --side="buy" \
  --amount="0.01" \
  --leverage="10" \
  --api_key="[USER_API_KEY]" \
  --api_secret="[USER_API_SECRET]"
```

**Pipeline Logic:**
1.  **Format**: Normalize Symbol (remove `/`).
2.  **Sign**: Generate signature using `timestamp + key + window + payload`.
3.  **Execute**: POST to `https://api.bybit.com/v5/order/create`.

### 2. Closing Positions (Risk Management)

Closes existing positions by sending a reducing market order.

**Command Structure:**
```bash
node pipelines/bybit/scripts/close.mjs \
  --symbol="BTCUSDT" \
  --direction="long" \
  --api_key="[USER_API_KEY]" \
  --api_secret="[USER_API_SECRET]"
```

**Path:** `pipelines/bybit/`
