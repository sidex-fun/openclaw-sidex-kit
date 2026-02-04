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

## Quick Start

### 1. Installation

```bash
git clone https://github.com/sidex-fun/openclaw-sidex-kit.git
cd openclaw-sidex-kit
npm install
```

### 2. Configuration

Create your environment file to store API keys and secrets securely.

```bash
cp .env.example .env
nano .env
```

### 3. Usage

Run the agent in autonomous mode or execute manual pipeline commands.

```bash
# Example: Execute a trade on Binance Pipeline
node pipelines/binance/scripts/trade.mjs --symbol="BTCUSDT" --side="buy" --amount="0.01" --api_key="..."
```

## Documentation

For full API references and architecture guides, visit the official documentation:
[**devs.sidex.fun/documentation**](https://devs.sidex.fun/documentation)

---

<div align="center">
  <p>© 2024 Sidex. All rights reserved.</p>
</div>
