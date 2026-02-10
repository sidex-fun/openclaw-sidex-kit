# OpenClaw SDK

Build autonomous AI trading agents with survival mechanics, multi-LLM support, risk management, and multi-exchange pipelines.

## Installation

```bash
npm install openclaw-sidex-kit
```

## Quick Start

```javascript
import { createAgent } from 'openclaw-sidex-kit/sdk';

const agent = createAgent({
    initialBalance: 1000,
    symbols: ['BTCUSDT', 'ETHUSDT'],
    llm: { provider: 'ollama', model: 'llama3.3' },
    risk: { maxLeverage: 10, maxPositions: 3 },
    onTrade: async (trade) => {
        console.log(`Executing: ${trade.side} ${trade.symbol} $${trade.amount}`);
    },
});

await agent.start();
```

---

## Import Paths

| Path | Description |
|---|---|
| `openclaw-sidex-kit` | Core modules (direct class exports) |
| `openclaw-sidex-kit/sdk` | SDK with factory functions + re-exports |
| `openclaw-sidex-kit/core` | Alias for core modules |

```javascript
// Direct class imports
import { LLMClient, RiskManager, SurvivalManager } from 'openclaw-sidex-kit';

// Factory functions
import { createAgent, createLLM, createRiskManager } from 'openclaw-sidex-kit/sdk';
```

---

## API Reference

### `createAgent(options)` → `AgentOrchestrator`

Creates a fully configured autonomous trading agent with all sub-modules wired together.

```javascript
const agent = createAgent({
    initialBalance: 1000,          // Starting capital (required)
    symbols: ['BTCUSDT'],          // Symbols to track (default: BTC, ETH, SOL)
    intervalMs: 30000,             // Loop interval in ms
    dataDir: './data',             // Persistence directory
    llm: {                         // LLM configuration
        provider: 'openai',        //   'ollama' | 'openai' | 'anthropic'
        model: 'gpt-4o',
        apiKey: 'sk-...',
        apiBase: 'https://api.openai.com/v1',
    },
    risk: {                        // Risk management
        maxLeverage: 10,
        maxPositions: 5,
        riskPercent: 2,            // % of balance per trade
        minConfidence: 0.6,
    },
    onTrade: async (trade) => {},  // Custom trade execution
    onClose: async (position) => {},// Custom close execution
});

await agent.start();
// ... later
await agent.stop();
```

The agent runs a continuous loop: **gather signals → LLM debate → risk filter → execute → monitor**.

---

### `createLLM(options)` → `LLMClient`

Standalone LLM client with multi-provider support and a built-in "Council of AI" debate system.

```javascript
import { createLLM } from 'openclaw-sidex-kit/sdk';

const llm = createLLM({
    provider: 'anthropic',
    model: 'claude-3-5-sonnet-20241022',
    apiKey: process.env.ANTHROPIC_API_KEY,
    apiBase: 'https://api.anthropic.com',
});

// Simple chat
const response = await llm.chat([
    { role: 'system', content: 'You are a trading analyst.' },
    { role: 'user', content: 'Analyze BTC at $95,000 with RSI 72.' },
]);

// Structured trading decision
const decision = await llm.decide({
    marketData: { BTCUSDT: { price: 95000, rsi: 72, ema20: 93500 } },
    survivalState: 'SURVIVAL',
    balance: 1000,
    pnl: 50,
    positions: [],
    signals: [],
});
// → { action: 'HOLD', symbol: 'BTC', confidence: 0.4, reasoning: '...', leverage: 5, urgency: 'LOW' }

// Multi-persona debate (Technician + Sentinel + Guardian → Leader)
const debatedDecision = await llm.decideWithDebate(context);
// → includes debate.technician, debate.sentinel, debate.guardian
```

**Providers:** `ollama` (local, free), `openai`, `anthropic`

---

### `createRiskManager(options)` → `RiskManager`

Position sizing, exposure limits, and survival-aware risk gating.

```javascript
import { createRiskManager } from 'openclaw-sidex-kit/sdk';

const risk = createRiskManager({
    maxLeverage: 15,
    maxPositions: 5,
    riskPercent: 2,          // % of balance risked per trade
    maxExposurePercent: 80,  // max total exposure as % of balance
    minConfidence: 0.6,
});

// Check if a trade is allowed
const result = risk.canOpenPosition(
    { action: 'BUY', symbol: 'BTCUSDT', confidence: 0.8, leverage: 10 },
    { balance: 1000, totalExposure: 200, positionCount: 1, positions: [] },
    'SURVIVAL' // survival state adjusts limits dynamically
);
// → { allowed: true, reason: 'Trade approved', adjustedLeverage: 10, adjustedSize: 20 }

// Calculate TP/SL
const sl = risk.getStopLoss(95000, 'buy', 1200);  // ATR-based
const tp = risk.getTakeProfit(95000, 'buy', sl);    // 2:1 R:R

// Get effective limits for current survival state
const limits = risk.getEffectiveLimits('DEFENSIVE');
// → { maxPositions: 2, maxLeverage: 7, riskPercent: 1, minConfidence: 0.78 }
```

**Survival multipliers** automatically reduce risk in DEFENSIVE/CRITICAL states and increase it in GROWTH.

---

### `createSurvival(initialBalance, callbacks)` → `SurvivalManager`

Biological state machine that adapts agent behavior based on economic health.

```javascript
import { createSurvival } from 'openclaw-sidex-kit/sdk';

const survival = createSurvival(1000, {
    onGrowth: () => console.log('Expanding operations'),
    onSurvival: () => console.log('Business as usual'),
    onRecovery: () => console.log('Cautious optimism'),
    onDefensive: () => console.log('Cutting costs'),
    onCritical: () => console.log('Emergency shutdown'),
    hysteresisThreshold: 3, // consecutive ticks before state change
});

// Feed balance updates
survival.updateVitalSigns(1250); // → 'GROWTH' (125% of initial)
survival.updateVitalSigns(800);  // → 'DEFENSIVE' (80% of initial)

// Query state
survival.state;           // 'DEFENSIVE'
survival.getPnL();        // -200
survival.getHealthRatio(); // 0.8
survival.getHistory();    // [{ from, to, ratio, timestamp }, ...]
```

**States:** `GROWTH` (>120%) → `SURVIVAL` (85-120%) → `RECOVERY` (transitional) → `DEFENSIVE` (50-85%) → `CRITICAL` (<50%)

---

### `createMarketFeed(options)` → `MarketDataFeed`

Real-time price data with built-in technical indicators (RSI, EMA, ATR).

```javascript
import { createMarketFeed } from 'openclaw-sidex-kit/sdk';

const feed = createMarketFeed({
    symbols: ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'],
    pollIntervalMs: 10000,
    indicatorPeriod: 14,
});

await feed.start(); // Connects via WebSocket, falls back to HTTP polling

// Get all data
const snapshot = feed.getSnapshot();
// → { BTCUSDT: { price: 95000, rsi: 65.2, ema20: 93500, ema50: 91000, atr: 1200, historyLength: 150 } }

// Single price
feed.getPrice('BTCUSDT'); // → 95000

feed.stop();
```

---

### `createPositionManager(options)` → `PositionManager`

Track positions, calculate PnL, and manage TP/SL with disk persistence.

```javascript
import { createPositionManager } from 'openclaw-sidex-kit/sdk';

const positions = createPositionManager({
    dataDir: './data',
    onClose: async (position) => {
        // Execute close on exchange
    },
});

// Open a position
const pos = positions.open({
    symbol: 'BTCUSDT',
    side: 'buy',
    entryPrice: 95000,
    size: 100,
    leverage: 10,
    exchange: 'binance',
    stopLoss: 93000,
    takeProfit: 99000,
});

// Query
positions.getOpen();           // All open positions
positions.getBySymbol('BTCUSDT');
positions.getTotalPnL();       // Unrealized PnL
positions.getTotalExposure();  // Total size * leverage
positions.getCount();

// Close
positions.close(pos.id, 'manual', 96000);
await positions.closeAll('shutdown');
```

Automatically checks TP/SL on `price:update` events from the EventBus.

---

### `eventBus`

Central pub/sub for all agent events.

```javascript
import { eventBus } from 'openclaw-sidex-kit/sdk';

eventBus.on('price:update', (data) => {
    // { symbol, price, rsi, ema20, ema50, atr, volume, timestamp }
});

eventBus.on('position:opened', (position) => { /* ... */ });
eventBus.on('position:closed', (position) => { /* ... */ });

eventBus.on('survival:change', (data) => {
    // { from: 'SURVIVAL', to: 'GROWTH', ratio: 1.25, pnlPercent: 25, balance: 1250 }
});

eventBus.on('agent:shutdown', (data) => {
    // { reason: 'critical_capital_loss', balance: 450 }
});

eventBus.on('agent:error', (data) => {
    // { cycle: 42, error: 'LLM timeout' }
});

// Debug mode — logs all events
eventBus.setDebug(true);
```

---

### `WalletManager` & `X402Client`

On-chain identity and automatic payment for 402-gated APIs.

```javascript
import { WalletManager, X402Client } from 'openclaw-sidex-kit/sdk';

// Requires EVM_PRIVATE_KEY in env
const wallet = new WalletManager('base'); // 'base' or 'polygon'
wallet.getAddress();                       // '0x...'
await wallet.signMessage('hello');
await wallet.sendPayment('0x...', 1000000n);

// Auto-pay 402 APIs
const x402 = new X402Client();
const response = await x402.fetch('https://premium-api.example.com/signals');
// If 402 → pays automatically → retries with proof
```

---

## Exchange Pipelines

Pre-built adapters for major exchanges, following a standard interface:

| Pipeline | Type | Path |
|---|---|---|
| **Hyperliquid** | Perpetual DEX | `pipelines/hyperliquid/` |
| **Binance** | CEX Futures | `pipelines/binance/` |
| **Bybit** | CEX Unified V5 | `pipelines/bybit/` |
| **Jupiter (Solana)** | DEX Aggregator | `pipelines/solana_jupiter/` |
| **Uniswap** | EVM AMM | `pipelines/uniswap/` |
| **Polymarket** | Prediction Market | `pipelines/polymarket/` |

Each pipeline follows the standard structure:
- `scripts/trade.mjs` — Execute trades
- `scripts/close.mjs` — Close positions
- `MODEL.md` — Integration documentation

---

## Environment Variables

All config can be passed programmatically. Environment variables serve as fallbacks:

```bash
# LLM
LLM_PROVIDER=ollama          # ollama | openai | anthropic
LLM_MODEL=llama3.3
LLM_API_BASE=http://localhost:11434
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...

# Agent
AGENT_INTERVAL_MS=30000
MARKET_SYMBOLS=BTCUSDT,ETHUSDT,SOLUSDT
SURVIVAL_START_BALANCE=1000

# Risk
MAX_POSITIONS=5
MAX_LEVERAGE=20
RISK_PER_TRADE=2
MAX_EXPOSURE_PERCENT=80
MIN_CONFIDENCE=0.6

# Wallet (optional)
EVM_PRIVATE_KEY=0x...
EVM_RPC_URL=https://mainnet.base.org
```

---

## Architecture

```
┌─────────────────────────────────────────────────┐
│              AgentOrchestrator                   │
│  ┌──────────┐  ┌──────────┐  ┌──────────────┐  │
│  │ LLMClient│  │MarketData│  │  RiskManager  │  │
│  │ (Council)│  │  Feed    │  │  (Adaptive)   │  │
│  └────┬─────┘  └────┬─────┘  └──────┬───────┘  │
│       │              │               │           │
│  ┌────▼──────────────▼───────────────▼───────┐  │
│  │              EventBus                      │  │
│  └────┬──────────────┬───────────────┬───────┘  │
│       │              │               │           │
│  ┌────▼─────┐  ┌─────▼────┐  ┌──────▼───────┐  │
│  │ Position │  │ Survival │  │   Pipelines   │  │
│  │ Manager  │  │ Manager  │  │ (Exchanges)   │  │
│  └──────────┘  └──────────┘  └───────────────┘  │
└─────────────────────────────────────────────────┘
```

## License

ISC — Sidex Devs
