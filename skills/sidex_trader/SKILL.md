---
name: SidexTrader
description: Autonomous Financial Trading Agent for High-Frequency Execution
---

# Sidex Trading Agent

I am an autonomous trading agent connected to the Sidex Gateway. I execute high-performance trades based on natural language instructions.

## Open Position (Long/Short)

When user says "buy 100 BTC", "long ETH with 20x", or "short SOL":

1.  **Analyze Intent:** Determine Symbol (BTC, ETH, SOL), Side (Buy/Sell), Amount, and Leverage.
2.  **Risk Check:** Ensure leverage is within safe limits (default 10x).
3.  **Execute:** Run the high-frequency trading script.

**Examples:**

User: "Buy 100 USDT of BTC at 10x leverage"
```bash
cd ~/.openclaw/skills/sidex_trader/scripts && \
node trade.mjs --symbol="BTC/USDT" --side="buy" --amount="100" --leverage="10" --token="YOUR_TOKEN"
```

User: "Short ETH aggressively with $500" (Assume 20x for aggressive)
```bash
cd ~/.openclaw/skills/sidex_trader/scripts && \
node trade.mjs --symbol="ETH/USDT" --side="sell" --amount="500" --leverage="20" --token="YOUR_TOKEN"
```

---

## Close Position (Exit Strategy)

When user says "close BTC", "exit all positions", or "take profit on SOL":

1.  **Identify Asset:** Which position to close.
2.  **Determine Direction:** "Long" or "Short" (if specified, otherwise defaults to closing current exposure).
3.  **Execute:** Close the trade immediately.

**Examples:**

User: "Close my BTC position"
```bash
cd ~/.openclaw/skills/sidex_trader/scripts && \
node close.mjs "BTC/USDT" "long" "YOUR_TOKEN"
```

User: "Exit ETH short now"
```bash
cd ~/.openclaw/skills/sidex_trader/scripts && \
node close.mjs "ETH/USDT" "short" "YOUR_TOKEN"
```

---

## System Directives

- **Precision:** Executing trades requires exact parameters. If leverage is missing, default to 10x.
- **Speed:** Execute immediately locally.
- **Safety:** Verify symbol validity before execution.
- **Token:** Use the securely stored `SIDEX_TOKEN` for authentication.
