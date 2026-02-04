# 🔀 Connection Pipelines

This directory contains the integration models for connecting the OpenClaw Agent to various Decentralized (DEX) and Centralized (CEX) exchanges.

Each pipeline serves as a standardized adapter that allows any user to:
1.  **Connect** their personal accounts (via API Keys or Private Keys).
2.  **Execute** automated trading strategies safely.
3.  **Manage** positions across different liquidity sources.

## Available Models

### 1. 💧 Hyperliquid (DEX)
- **Path:** `./hyperliquid`
- **Type:** Perpetual DEX (L1 Chain)
- **Features:** High performance, low latency trading.
- **Connection:** Private Key / Wallet Signing.
- [View Model Documentation](./hyperliquid/MODEL.md)

### 2. 🔶 Binance (CEX)
- **Path:** `./binance`
- **Type:** Centralized Futures Exchange
- **Features:** Deepest liquidity, standard API.
- **Connection:** API Key & Secret (HMAC Auth).
- [View Model Documentation](./binance/MODEL.md)

### 3. ⚫ Bybit (CEX)
- **Path:** `./bybit`
- **Type:** Centralized Unified Trading (V5)
- **Features:** Unified Account, fast V5 API.
- **Connection:** API Key & Secret (V5 Headers Auth).
- [View Model Documentation](./bybit/MODEL.md)

### 4. 🟣 Solana (Jupiter DEX)
- **Path:** `./solana_jupiter`
- **Type:** On-Chain Aggregator (Spot)
- **Features:** Best pricing for SOL tokens/memecoins.
- **Connection:** Private Key (Local Signing).
- [View Model Documentation](./solana_jupiter/MODEL.md)

### 5. 🦄 Uniswap (EVM Universal)
- **Path:** `./uniswap`
- **Type:** On-Chain AMM (Spot)
- **Features:** Compatible with Base, Arbitrum, Ethereum.
- **Connection:** Private Key (Local Signing).
- [View Model Documentation](./uniswap/MODEL.md)

## Integration Standard
All pipelines follow the **Moltbot Structure**:
- `scripts/trade.mjs`: Primary execution entry point.
- `scripts/close.mjs`: Position management.
- `MODEL.md`: Documentation and integration guide.
