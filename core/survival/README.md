# Survival Mode (Evolutionary Trading)

Survival Mode is an optional **"biological" logic layer** for OpenClaw. It treats your agent's capital as its lifeblood ("Health/HP"), adjusting behavior dynamically based on performance.

This creates **Evolutionary Pressure**: Agents that don't perform well "starve" and shut down to save your money, while profitable agents "evolve" and unlock new capabilities.

---

## 🧬 How It Works

The `SurvivalManager` monitors your agent's **Total Equity** (Exchange Balance + Wallet) relative to its **Starting Capital**.

| State | Health (Equity vs Start) | Behavior | Risk Profile |
| :--- | :--- | :--- | :--- |
| **🟢 GROWTH** | > 120% | **Expansive**: Buys premium data (x402), increases trade size. | High / Experimental |
| **🔵 SURVIVAL** | 85% - 120% | **Neutral**: Standard operations. | Balanced |
| **🟠 DEFENSIVE** | 50% - 85% | **Austerity**: Cuts all x402 spending. High-probability trades only. | Low / Conservative |
| **🔴 CRITICAL** | < 50% | **Hibernation**: The process terminates immediately to prevent liquidation. | Off |

## 🚀 Usage

Survival Mode is **Universal**. It works whether you are trading on:
1.  **Devs.Sidex.Fun** (Simulation)
2.  **Hyperliquid / Binance / Bybit** (Real Money)
3.  **On-Chain DEXs**

It does **not** require the x402 EVM Wallet enabled. If x402 is disabled, it simply adjusts trading risk parameters without managing external payments.

### Example Implementation

In your strategy file:

```javascript
import { SurvivalManager } from '../../core/index.js';

// 1. Initialize
const survival = new SurvivalManager({
    initialBalance: 1000, // $1000 Start
    onGrowth: () => console.log("Time to expand!"),
    onPanic: () => console.log("Tighten stop losses!")
});

// 2. Loop
setInterval(async () => {
    // Fetch balance from your exchange (simulated example)
    const currentEquity = await exchange.fetchTotalBalance();
    
    // Update Vitals
    survival.updateVitalSigns(currentEquity);
    
}, 60000);
```
