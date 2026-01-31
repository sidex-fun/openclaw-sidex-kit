# 📘 Sidex AI Operations Manual

This document lists all commands accepted by the **Sidex Trade Bot Agent**.

## 1. 💰 MANUAL TRADES (Direct Execution)

The agent accepts values with or without the `$` symbol. Execution is immediate.

### ➤ BUY / LONG (Bet on Price Increase)
Bet that the price will go up.
*Format:* `buy [AMOUNT] [COIN] (optional: with [LEVERAGE]x)`

**Examples:**
- `buy 1000$ BTC`      👉 Buy $1000 of Bitcoin (Default leverage 10x)
- `buy $500 ETH`       👉 Buy $500 of Ethereum
- `long 200$ SOL`      👉 "Long" is a synonym for buy
- `buy 1000$ BTC with 20x` 👉 Specifying 20x leverage
- `open 5000$ BTC at 50x`  👉 "Open" also works

### ➤ SELL / SHORT (Bet on Price Decrease)
Bet that the price will fall.
*Format:* `sell [AMOUNT] [COIN] (optional: with [LEVERAGE]x)`

**Examples:**
- `sell 1000$ BTC`     👉 Short $1000 of Bitcoin
- `short $500 ETH`     👉 Short $500 of Ethereum
- `sell 200$ SOL with 5x` 👉 Short with 5x leverage

### ➤ CLOSE POSITIONS
Secure your profits or cut losses.
*Format:* `close [COIN] (optional: direction)`

**Examples:**
- `close BTC`          👉 Closes your BTC Long position
- `close ETH short`    👉 Closes specifically the ETH Short
- `exit SOL`           👉 "Exit" is a synonym for close

---

## 2. 🧠 AUTONOMOUS STRATEGIES (AI Protocols)

Activate the "Autonomous Agent" to execute complex trading sequences.
It will analyze, "think", and execute step-by-step.

### 🚀 Protocol: Alpha Momentum
**Profile:** Aggressive (Bull Market)
**Action:** Aggressive buying of BTC, ETH, and SOL (20x).
**Command:**
`execute protocol alpha_momentum`

### 🛡️ Protocol: Bitcoin Fortress
**Profile:** Defensive (Hedge)
**Action:** Long BTC and hedge by Shorting ETH and SOL.
**Command:**
`execute protocol btc_dominance`

### 🐻 Protocol: Winter Protocol
**Profile:** Crash Market (Bear)
**Action:** Sell everything. Massive Short on BTC, ETH, SOL.
**Command:**
`execute protocol bear_raid`

---

## 3. 🧠 AGENT SKILLS

Your agent has specific skills installed in this kit:

### MoltBook Analyst
Automatic social posting after trades.
**Trigger:** Automatically runs after `trade.mjs` or by asking "post analysis".
**Command:**
`post analysis to moltbook`

---
*Sidex AI - Agent Starter Kit*
