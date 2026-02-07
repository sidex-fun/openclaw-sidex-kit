<div align="center">
  <img src="https://sidex.fun/logo.png" alt="Sidex Logo" width="120" />
  <h1>OpenClaw Sidex Kit</h1>
  <p>
    <b>The Standardized Execution Layer for Autonomous Trading Agents</b>
  </p>
  
  <p>
    <a href="https://devs.sidex.fun/documentation">Documentation</a> •
    <a href="https://x.com/sidex_fun">X (Twitter)</a> •
    <a href="https://t.me/sidex_fun">Telegram</a> •
    <a href="https://discord.gg/sidex">Discord</a>
  </p>
</div>

---

## About Sidex

**Sidex is turning trading into a game.**

We provide a cutting-edge platform featuring **1v1 Duels**, **Battle Royale**, **Tap Trading**, and other gamified financial experiences. Our mission is to make high-frequency trading accessible, engaging, and competitive.

## Developer Ecosystem (`devs.sidex.fun`)

This repository is the official starter kit for **OpenClaw**, the autonomous agent framework for Sidex.

The **Sidex Developer Platform** allows engineers to build, test, and refine automated trading strategies in a **Real-Time Simulated Crypto Futures Environment**. 

- **Real Market Conditions:** We stream live market data to ensure your algorithms face reality.
- **Risk-Free Testing:** limitless paper trading environment to perfect your strategy before deployment.
- **Universal Architecture:** Once tested, your agent is ready to deploy on any major exchange using our standardized pipelines.

## Universal Pipelines

The OpenClaw Kit features a modular pipeline architecture, allowing your agent to interface with major Decentralized (DEX) and Centralized (CEX) exchanges using a unified command structure.

| Exchange | Type | Support |
| :--- | :--- | :--- |
| **Hyperliquid** | DEX (Perps) | [Model Included](./pipelines/hyperliquid/MODEL.md) |
| **Binance** | CEX (Futures) | [Model Included](./pipelines/binance/MODEL.md) |
| **Bybit** | CEX (Unified) | [Model Included](./pipelines/bybit/MODEL.md) |
| **Solana (Jupiter)** | DEX (Spot) | [Model Included](./pipelines/solana_jupiter/MODEL.md) |
| **Uniswap** | DEX (EVM) | [Model Included](./pipelines/uniswap/MODEL.md) |
| **Polymarket** | Prediction (Polygon) | [Model Included](./pipelines/polymarket/README.md) |

## Autonomous Economics (x402)

OpenClaw Agents are equipped with an integrated **Economic Core** powered by the **x402 Protocol**. This allows agents to autonomously **buy and sell resources** machine-to-machine.

- **Self-Sufficiency**: Agents can pay for premium trading signals, news feeds, or computational power using their own crypto wallet.
- **Auto-Negotiation**: The kit automatically handles `402 Payment Required` responses, paying the vendor and retrieving the data in a single flow.

- **Multichain**: Built on `viem`, supporting payments on any EVM chain (Base, Polygon, Arbitrum, etc.).

## Survival Mode (Evolutionary Logic)

Inspired by biological systems, the **Survival Manager** adjusts the agent's behavior based on its PnL health. It uses **hysteresis** to prevent rapid state oscillation and emits events via the internal **EventBus** for all modules to react.

| State | Trigger | Behavior |
| :--- | :--- | :--- |
| **Growth** | Profit > 20% | Aggressive scanning, higher leverage allowed, x402 budget unlocked |
| **Survival** | Neutral zone | Balanced risk, normal operation |
| **Recovery** | Improving from Defensive | Cautious optimism, gradual risk increase |
| **Defensive** | Loss > 15% | Reduced risk, frozen x402 budget, slower loop |
| **Critical** | Loss > 50% | Graceful shutdown — closes all positions and preserves capital |

*Note: This works on both Simulations (Sidex Devs) and Real Exchanges.*

## Quick Start

### Option A: One-Command Full Install (Recommended)

The full installer handles **everything** — system dependencies, Node.js, npm packages, Ollama (local AI), LLaMA 3.3 model download, and `.env` configuration — in a single interactive script.

```bash
git clone https://github.com/sidex-fun/openclaw-sidex-kit.git
cd openclaw-sidex-kit
bash quick-setup/install.sh
```

> **What it installs:** `curl`, `git`, `wget`, Node.js (v20+), all npm dependencies, [Ollama](https://ollama.com) for local AI, and the LLaMA 3.3 model. It also walks you through configuring your `.env` with Sidex tokens, exchange keys, and wallet setup.

### Option B: Manual Installation

If you prefer to install things yourself:

```bash
git clone https://github.com/sidex-fun/openclaw-sidex-kit.git
cd openclaw-sidex-kit
npm install
```

Then run the interactive configuration wizard:

```bash
npm run setup
```

This wizard will generate your `.env` file with the correct API keys and features enabled.

### AI Model Setup

OpenClaw agents work best with a **local LLM** via [Ollama](https://ollama.com). This avoids API costs and content-policy restrictions that external providers (GPT, Claude) impose on trading-related prompts.

```bash
# Install Ollama (Linux)
curl -fsSL https://ollama.com/install.sh | sh

# Download the recommended model
ollama pull llama3.3

# Start the server
ollama serve
```

> **⚠ External APIs (GPT, Claude, etc.):** You can configure them in `.env`, but they have content filters and rate limits that may block trading analysis prompts. Local LLaMA 3.3 is **strongly recommended** for full, unrestricted functionality.

### Usage

**Autonomous Mode** — Start the full agent loop (recommended):

```bash
npm start
```

The agent will connect to live market data, consult the LLM every cycle, and execute trades autonomously based on risk parameters.

**Manual Pipeline Commands** — Execute individual trades directly:

```bash
# Binance Pipeline
node pipelines/binance/scripts/trade.mjs --symbol="BTCUSDT" --side="buy" --amount="0.01" --api_key="..."

# Sidex Simulation
node skills/sidex_trader/scripts/trade.mjs --symbol="BTC/USDT" --side="buy" --amount="100" --leverage="10" --token="YOUR_TOKEN"
```

## 🤖 Autonomous Agent Architecture

The kit features a fully autonomous **Agent Orchestrator** that runs a continuous decision loop:

```
┌─────────────────────────────────────────────────┐
│              AgentOrchestrator                   │
│   gatherSignals → think → riskFilter → execute  │
│                    ↕ monitor                     │
├───────────┬───────────┬────────────┬─────────────┤
│  Market   │  Signal   │   Risk     │  Position   │
│  DataFeed │  Ingester │   Manager  │  Manager    │
│  (prices, │  (social, │  (sizing,  │ (tracking,  │
│   RSI,    │   news,   │   limits,  │  TP/SL,     │
│   EMA,    │   alpha)  │  survival) │  PnL)       │
│   ATR)    │           │            │             │
├───────────┴───────────┴────────────┴─────────────┤
│               EventBus (Internal Comms)          │
├───────────┬───────────┬────────────┬─────────────┤
│  Binance  │  Hyper-   │   Sidex    │ Polymarket  │
│  Pipeline │  liquid   │  Gateway   │  Pipeline   │
├───────────┴───────────┴────────────┴─────────────┤
│      LLM Client       │     x402 / Wallet        │
│  (Ollama/OpenAI/Claude)│    (On-chain Payments)   │
└────────────────────────┴─────────────────────────┘
```

### Core Modules

| Module | Description |
| :--- | :--- |
| **AgentOrchestrator** | Main loop — gathers signals, consults LLM, filters risk, executes trades, monitors positions |
| **LLMClient** | Unified interface for Ollama, OpenAI, and Anthropic. Returns structured JSON trading decisions |
| **MarketDataFeed** | Real-time prices via Binance WebSocket. Calculates RSI(14), EMA(20/50), ATR(14) in-memory |
| **PositionManager** | Tracks open positions, auto-triggers Stop-Loss/Take-Profit, persists state to disk |
| **RiskManager** | Position sizing, exposure limits, per-asset caps. Adapts dynamically to Survival state |
| **SurvivalManager** | Biological state machine with hysteresis. Emits events for all modules to react |
| **EventBus** | Singleton event system for decoupled module communication |
| **X402Client** | Handles `402 Payment Required` flows for machine-to-machine payments |

### Agent Loop Cycle

1. **Gather Signals** — Reads `alpha_db.json` from Social Alpha Miner for recent high-confidence signals
2. **Think** — Sends market data + signals + portfolio state to the LLM for a structured decision (BUY/SELL/CLOSE/HOLD)
3. **Risk Filter** — Validates the decision against position limits, exposure caps, and survival state
4. **Execute** — Dispatches the trade to the appropriate pipeline (Sidex, Binance, Hyperliquid, etc.)
5. **Monitor** — Updates unrealized PnL, checks TP/SL levels, feeds the Survival Manager

The loop interval adapts automatically: **faster in Growth** (more opportunities), **slower in Defensive** (conserve resources).

## 📂 Project Structure

- **`/core`**: The brain of the agent — Orchestrator, LLM, Market Data, Positions, Risk, Survival, x402.
- **`/pipelines`**: Connectors for different exchanges (Hyperliquid, Binance, Bybit, Polymarket, etc.).
- **`/skills`**: Advanced capabilities (Social Alpha Miner, Sidex Trader, MoltBook Analyst).
- **`/quick-setup`**: Interactive configuration scripts.
- **`/data`**: Persisted agent state and position data (auto-generated).
- **`agent.js`**: Main entry point — run with `npm start`.

## 🧠 Social Alpha Miner

The kit includes an NLP engine that monitors social platforms for trading signals.

- **Impact Engine**: Detects `CRITICAL` news from VIP accounts (Donald Trump, Saylor, etc.).
- **Sentiment Analysis**: Converts "tweets" into actionable code instructions (`URGENT_BULLISH_ACTION`).
- **Sources**: Twitter/X, Colosseum, and MoltBook.
- **Integration**: Signals are stored in `alpha_db.json` and automatically consumed by the Agent Orchestrator each cycle.

## Documentation

For full API references and architecture guides, visit the official documentation:
[**devs.sidex.fun/documentation**](https://devs.sidex.fun/documentation)

---

<div align="center">
  <p>© 2026 Sidex</p>
</div>
