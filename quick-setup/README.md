# Quick Setup 🧙‍♂️

The `quick-setup` directory contains everything needed to get OpenClaw running from scratch.

## Full Installer (`install.sh`)

The **recommended** way to set up OpenClaw. A single interactive bash script that installs and configures the entire stack.

```bash
bash quick-setup/install.sh
```

### What it does (7 steps):

| Step | Description |
| :--- | :--- |
| **1. System Dependencies** | Installs `curl`, `git`, `wget`, build tools via your OS package manager |
| **2. Node.js** | Detects or installs Node.js v20+ (via nvm, package manager, or manual) |
| **3. npm Packages** | Runs `npm install` / `npm ci` for all project dependencies |
| **4. Ollama** | Installs [Ollama](https://ollama.com) — the local AI runtime for running LLMs |
| **5. AI Model** | Downloads LLaMA 3.3 (70B, 8B, or 3B based on your hardware) |
| **6. Configuration** | Creates `.env` and launches the interactive setup wizard |
| **7. Verification** | Checks all components are working correctly |

### Supported Systems

- **Linux**: Ubuntu/Debian (apt), Fedora/RHEL (dnf/yum), Arch (pacman), Alpine (apk)
- **macOS**: Homebrew or direct download

### AI Model Options

The installer recommends a local LLaMA model based on your system RAM:

| Model | Size | RAM Needed | Quality |
| :--- | :--- | :--- | :--- |
| `llama3.3:70b` | ~40GB | 48GB+ | Best |
| `llama3.2:8b` | ~4.7GB | 8GB+ | Good |
| `llama3.2:3b` | ~2GB | 4GB+ | Basic |

> **⚠ External APIs (GPT, Claude):** Supported as fallback, but they have content filters and rate limits that may block trading-related analysis. Local models are strongly recommended.

---

## Configuration Wizard (`setup.js`)

The interactive Node.js wizard for configuring API keys, wallets, and agent behavior. This is automatically called by `install.sh`, but can also be run standalone:

```bash
npm run setup
```

### Features

1.  **Guided Configuration**: Step-by-step prompts for Sidex identity, Exchange keys (Binance, Bybit, Hyperliquid), and x402 wallet.
2.  **Wallet Generation**: Automatically generates a fresh EVM wallet private key for your agent.
3.  **Survival Mode Settings**: Fine-tune the "biological" parameters (starting balance, cost of living).
4.  **Edit Mode**: Detects existing `.env` files and lets you modify specific values.

## Technical Details

- **Installer**: `quick-setup/install.sh` — Bash, zero external dependencies
- **Wizard**: `quick-setup/setup.js` — Uses `inquirer` for prompts and `chalk` for styling
- **Security**: All keys are written locally to your `.env` file. Nothing is transmitted externally.
