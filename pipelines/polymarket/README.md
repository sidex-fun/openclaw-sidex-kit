# Polymarket Pipeline
> **Status:** Experimental  
> **Chain:** Polygon (MATIC/POL)  
> **Currency:** USDC (Bridged USDC)

This pipeline allows the OpenClaw agent to interact with Polymarket, a decentralized prediction market platform. It is designed to be autonomous, using the `x402` wallet system to manage funds and sign transactions on Polygon.

## 🚀 Getting Started

### Prerequisites
1.  **Polygon Wallet**: Your agent's `EVM_PRIVATE_KEY` must control a wallet with **MATIC (for gas)** and **USDC (for trading)** on the Polygon network.
2.  **API Access**: This pipeline uses the public Gamma API (read) and CTF Exchange (write).

### Configuration
Ensure your `.env` file is set up:
```bash
EVM_PRIVATE_KEY=0x...
# Optional: Override RPC if needed
# EVM_RPC_URL=https://polygon-rpc.com
```

## 🛠 Command Usage

### 1. View Markets
Fetch active markets from Polymarket.
```bash
# Fetch top markets by volume
node pipelines/polymarket/scripts/trade.mjs --action="markets"
```

### 2. Trade (Buy/Sell)
Execute a trade on a specific market.
```bash
node pipelines/polymarket/scripts/trade.mjs \
  --action="trade" \
  --market="0xConditionId..." \ 
  --side="buy" \
  --outcome="YES" \
  --amount="10" # Amount in USDC
```
*(Note: Condition ID and Outcome Indexing will be handled by the script helper)*

## 🤖 Autonomous Mode
Run the simple polling agent to trade autonomously based on simple logic (e.g., probability arbitrage).
```bash
node pipelines/polymarket/scripts/simple_agent.js
```

### 🧠 Social Sentiment Agent
Run the advanced agent that monitors social feeds (simulated) and trades based on High Impact news signals.
```bash
node pipelines/polymarket/scripts/sentiment_agent.js
```
- **Engine**: Uses `pipelines/market_intelligence` to analyze sentiment.
- **Triggers**: Trades on "HIGH" or "CRITICAL" impact news (e.g., Trump, SEC, Fed).


## ⚠️ Risks
- **Financial Loss**: Prediction markets are volatile.
- **Smart Contract Risk**: Interaction with CTF Exchange involves smart contract risks.
- **Gas Fees**: Ensure sufficient MATIC balance.

---
**Path:** `pipelines/polymarket/`
