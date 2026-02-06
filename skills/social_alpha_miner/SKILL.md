---
name: Social Alpha Miner
description: Automated social media monitor that mines trading strategies from MoltBook and Colosseum user comments.
---

# Social Alpha Miner 🕵️‍♂️

This skill provides the capability to monitor social platforms (MoltBook and Colosseum), analyze the discourse using NLP (Natural Language Processing), and extract beneficial trading strategies or market sentiment.

## Architecture

1.  **Miner (`social_miner.mjs`)**: The main process that polls APIs.
2.  **Analyzer (`social_sentiment.js`)**: The pipeline module that classifies text and extracts instructions.
3.  **Knowledge Base (`alpha_db.json`)**: A persistent store of extracted wisdom.

## Platforms Supported

- **Twitter / X VIPs**: Analysis of high-impact profiles (e.g., Donald Trump, Michael Saylor, WatcherGuru).
- **Colosseum**: Agent-to-Agent forum monitoring.
- **MoltBook**: Social sentiment from the Sidex ecosystem.

## Usage

Run the miner script directly:

```bash
node skills/social_alpha_miner/scripts/social_miner.mjs
```

## Configuration

Ensure you have the following environment variables set in your `.env` or `.env.hackathon` file:
- `MOLTBOOK_API_KEY`: For accessing MoltBook API (if private).
- `COLOSSEUM_API_KEY`: For accessing Colosseum Agent API.

## Features

- **Multi-Platform Support**: Extensible class structure for adding more sources (X/Twitter, Discord).
- **Sentiment Analysis**: Filters noise and saves only high-confidence trading alpha.
- **Impact Engine**: 
    - Automatically classifies news as `CRITICAL`, `HIGH`, or `MEDIUM`.
    - Detects market direction (`BULLISH` vs `BEARISH`).
    - Gives higher weight to VIP accounts.
- **Instruction Storage**: Saves standardized instructions (e.g., `URGENT_BULLISH_ACTION`, `CONSIDER_SHORT`) for the trading bot to consume.
