# Quick Setup Wizard 🧙‍♂️

The `quick-setup` directory contains the interactive configuration wizard for OpenClaw. This tool simplifies the complex process of configuring API keys, wallets, and agent behaviors into a user-friendly terminal interface.

## How to Use

Simply run the following command in the root directory:

```bash
npm run setup
```

## Features

1.  **Guided Configuration**: Step-by-step prompts for setting up your Sidex identity, Exchange keys (Binance, Bybit, Hyperliquid), and x402 wallet.
2.  **Wallet Generation**: Can automatically generate a fresh EVM wallet private key for your agent if you don't have one.
3.  **Survival Mode Settings**: Allows fine-tuning of the "biological" parameters (starting balance, cost of living) for the Survival Mode logic.
4.  **Edit Mode**: Detects existing `.env` files and lets you modify specific values without retyping everything.

## Technical Details

- **File**: `quick-setup/setup.js`
- **Dependencies**: Uses `inquirer` for prompts and `chalk` for styling.
- **Security**: All keys are written locally to your `.env` file. The wizard does not transmit your keys anywhere.
