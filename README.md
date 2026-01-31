# OpenClaw Sidex Kit 🤖

Welcome to the **OpenClaw Sidex Kit**. This repository contains the essential "Skills" and "Scripts" to build your own autonomous trading agent on the **Sidex** infrastructure.

Your personal AI assistant KIT for automated trading on devs.sidex.fun, with full documentation available at devs.sidex.fun/documentation.

## 🚀 Quick Start

### 1. Prerequisites
- Node.js v18+
- A Sidex Developer Account (Get your token at [devs.sidex.fun](https://devs.sidex.fun))
- A MoltBook Account (for social posting)

### 2. Installation

```bash
# Clone this repository ( Simulated )
git clone https://github.com/sidex-ai/openclaw-sidex-kit.git
cd openclaw-sidex-kit

# Install dependencies
npm install
```

### 3. Configuration

Copy the example environment file:
```bash
cp .env.example .env
```
Edit `.env` and add your keys:
- `SIDEX_TOKEN`: Your execution token from Sidex Dashboard.
- `MOLTBOOK_API_KEY`: Your social key (Run `npx molthub@latest install moltbook` to generate).

## 📂 Structure

- **`skills/`**: The brain of your agent.
  - **`sidex_trader/`**: Logic for executing trades via WebSocket.
    - `trade.mjs`: The core trading script.
    - `close.mjs`: Position management.
  - **`moltbook_analyst/`**: Logic for social interactions.
    - `post_trade.mjs`: Automated trade journaling.

## 🎮 Usage

You can run scripts manually to test:

```bash
# Execute a Trade
node skills/sidex_trader/scripts/trade.mjs --symbol="BTC/USDT" --side="buy" --amount="100" --token="YOUR_TOKEN"

# Post Analysis
node skills/moltbook_analyst/scripts/post_trade.mjs
```

## 📖 Documentation

Check `COMMANDS.md` for the full list of voice/text commands your agent understands once these skills are loaded.

## ⚠️ Disclaimer

This repository is provided strictly for educational and demonstrative purposes. It serves as a starter kit to illustrate how to interact with the Sidex infrastructure and OpenClaw skills.

**By using this software, you acknowledge and agree that:**

1.  **No Financial Advice:** Nothing in this repository constitutes financial, investment, or trading advice.
2.  **User Responsibility:** You are solely responsible for the development, configuration, and execution of your own trading strategies. The "Autonomous Protocols" included are merely examples of logic implementation and should not be used in live trading without thorough testing and modification.
3.  **No Liability:** The Sidex team and contributors accept no liability for any financial losses, damages, or unintended consequences resulting from the use of this code. You run these bots entirely at your own risk.

**Trade responsibly.**

---
*Built for the Agentic Web*
