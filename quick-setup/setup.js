import inquirer from 'inquirer';
import chalk from 'chalk';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';

const ENV_PATH = path.resolve(process.cwd(), '.env');

// Utilities
const loadEnv = () => {
    if (fs.existsSync(ENV_PATH)) {
        return dotenv.parse(fs.readFileSync(ENV_PATH));
    }
    return {};
};

const saveEnv = (config) => {
    const content = Object.entries(config)
        .map(([key, value]) => `${key}=${value}`)
        .join('\n');
    fs.writeFileSync(ENV_PATH, content);
    console.log(chalk.green('\n✅ Configuration saved to .env successfully!'));
};

const divider = () => console.log(chalk.gray('─'.repeat(50)));

const header = () => {
    console.clear();
    console.log(chalk.cyan.bold(`
   ____                   ____ _               
  / __ \\____  ___  ____  / __/| | __ _      __
 / / / / __ \\/ _ \\/ __ \\/ /   | |/ /| | /| / /
/ /_/ / /_/ /  __/ / / / /___ | /   | |/ |/ / 
\\____/ .___/\\___/_/ /_/_/     /_/    |__/|__/  
    /_/                                        
    `));
    console.log(chalk.yellow('    OpenClaw Sidex Kit - Interactive Setup'));
    divider();
};

// Questions
async function main() {
    header();

    const currentEnv = loadEnv();
    const hasConfig = Object.keys(currentEnv).length > 0;

    if (hasConfig) {
        console.log(chalk.white(`Found existing configuration with ${Object.keys(currentEnv).length} keys.`));
    }

    const { mode } = await inquirer.prompt([
        {
            type: 'list',
            name: 'mode',
            message: 'What would you like to do?',
            choices: [
                { name: '🚀 Start Fresh (Create new configuration)', value: 'fresh' },
                { name: '🛠️  Edit Existing Configuration', value: 'edit', disabled: !hasConfig },
                { name: '❌ Exit', value: 'exit' }
            ]
        }
    ]);

    if (mode === 'exit') {
        console.log('Bye!');
        process.exit(0);
    }

    let config = mode === 'edit' ? { ...currentEnv } : {};

    // 0. Operational Mode Selection
    divider();
    console.log(chalk.blue.bold('0. Operational Scope'));
    const { scope } = await inquirer.prompt([
        {
            type: 'list',
            name: 'scope',
            message: 'Select your Operational Mode:',
            choices: [
                { name: '🎮 Simulation Only (Devs.sidex.fun Environment)', value: 'sim' },
                { name: '💰 Hybrid (Simulation + Real Money Trading)', value: 'real' }
            ]
        }
    ]);

    // 1. Core Identity
    divider();
    console.log(chalk.blue.bold('1. Core Identity & Connectors'));

    const coreAnswers = await inquirer.prompt([
        {
            type: 'input',
            name: 'SIDEX_TOKEN',
            message: 'Paste your Sidex Connection Token (or full Connection String):',
            default: config.SIDEX_TOKEN || '',
            validate: input => input.length > 0 ? true : 'Token/String is required',
            filter: (input) => {
                // Helper: Auto-extract token if user pastes a URL (e.g., ws://...?token=XYZ)
                if (input.includes('token=')) {
                    const match = input.match(/token=([a-zA-Z0-9_\-.]+)/);
                    if (match && match[1]) {
                        return match[1];
                    }
                }
                return input.trim();
            }
        },
        {
            type: 'input',
            name: 'SIDEX_GATEWAY',
            message: 'Sidex Gateway URL:',
            default: config.SIDEX_GATEWAY || 'ws://devs.sidex.fun/gateway'
        },
        {
            type: 'input',
            name: 'MOLTBOOK_API_KEY',
            message: 'MoltBook API Key (Optional - Press Enter to Skip):',
            suffix: chalk.gray(' (Enables social posting)'),
            default: config.MOLTBOOK_API_KEY || ''
        }
    ]);

    Object.assign(config, coreAnswers);

    // 2. Exchanges (Only if Real Mode is selected)
    if (scope === 'real') {
        divider();
        console.log(chalk.blue.bold('2. Real Exchange Connections'));
        console.log(chalk.gray('Select the exchanges you want to trade on with real funds.'));

        const { exchanges } = await inquirer.prompt([
            {
                type: 'checkbox',
                name: 'exchanges',
                message: 'Active Exchanges:',
                choices: [
                    { name: 'Hyperliquid (DEX - Best for Perps)', value: 'hyperliquid', checked: !!config.HYPERLIQUID_PRIVATE_KEY },
                    { name: 'Binance (CEX)', value: 'binance', checked: !!config.BINANCE_API_KEY },
                    { name: 'Bybit (CEX)', value: 'bybit', checked: !!config.BYBIT_API_KEY }
                ]
            }
        ]);

        if (exchanges.includes('hyperliquid')) {
            console.log(chalk.cyan('\n-- Hyperliquid Setup --'));
            const hl = await inquirer.prompt([
                { type: 'input', name: 'HYPERLIQUID_WALLET_ADDRESS', message: 'Address:', default: config.HYPERLIQUID_WALLET_ADDRESS },
                { type: 'password', name: 'HYPERLIQUID_PRIVATE_KEY', message: 'Private Key:', default: config.HYPERLIQUID_PRIVATE_KEY, mask: '*' }
            ]);
            Object.assign(config, hl);
        }

        if (exchanges.includes('binance')) {
            console.log(chalk.cyan('\n-- Binance Setup --'));
            const bn = await inquirer.prompt([
                { type: 'input', name: 'BINANCE_API_KEY', message: 'API Key:', default: config.BINANCE_API_KEY },
                { type: 'password', name: 'BINANCE_SECRET_KEY', message: 'Secret Key:', default: config.BINANCE_SECRET_KEY, mask: '*' }
            ]);
            Object.assign(config, bn);
        }

        if (exchanges.includes('bybit')) {
            console.log(chalk.cyan('\n-- Byit Setup --'));
            const bb = await inquirer.prompt([
                { type: 'input', name: 'BYBIT_API_KEY', message: 'API Key:', default: config.BYBIT_API_KEY },
                { type: 'password', name: 'BYBIT_SECRET_KEY', message: 'Secret Key:', default: config.BYBIT_SECRET_KEY, mask: '*' }
            ]);
            Object.assign(config, bb);
        }
    } else {
        divider();
        console.log(chalk.green('🎮 Simulation Mode Active: Skipping Real Exchange keys.'));
    }

    // 3. x402 Economics
    divider();
    console.log(chalk.blue.bold('3. Autonomous Economics (x402 Protocol)'));
    console.log(chalk.gray('Allows the agent to hold funds and pay for data/services automatically.'));

    // Explicitly ask even if simulation, as x402 can work on testnets or for simulated services
    const { enableX402 } = await inquirer.prompt([
        {
            type: 'confirm',
            name: 'enableX402',
            message: 'Enable x402 Wallet?',
            default: !!config.EVM_PRIVATE_KEY
        }
    ]);

    if (enableX402) {
        const { walletAction } = await inquirer.prompt([
            {
                type: 'list',
                name: 'walletAction',
                message: 'Wallet Configuration:',
                choices: [
                    { name: '🔑 Import Private Key', value: 'import' },
                    { name: '🎲 Generate NEW Wallet (Recommended for new bots)', value: 'generate' }
                ]
            }
        ]);

        if (walletAction === 'generate') {
            const pk = generatePrivateKey();
            const account = privateKeyToAccount(pk);
            console.log(chalk.yellow('\n⚠️  GENERATED NEW WALLET ⚠️'));
            console.log(chalk.green(`Address:     ${account.address}`));
            console.log(chalk.red(`Private Key: ${pk}`));
            console.log(chalk.gray('This key will be saved locally in .env. Never share it.'));
            config.EVM_PRIVATE_KEY = pk;
        } else {
            const { pk } = await inquirer.prompt([
                { type: 'password', name: 'pk', message: 'EVM Private Key:', mask: '*', default: config.EVM_PRIVATE_KEY }
            ]);
            config.EVM_PRIVATE_KEY = pk;
        }

        const { rpc } = await inquirer.prompt([
            {
                type: 'list',
                name: 'rpc',
                message: 'Blockchain Network:',
                choices: [
                    { name: 'Base Mainnet (Low Fees)', value: 'https://mainnet.base.org' },
                    { name: 'Polygon', value: 'https://polygon-rpc.com' },
                    { name: 'Arbitrum One', value: 'https://arb1.arbitrum.io/rpc' },
                    { name: 'Custom URL', value: 'custom' }
                ],
                default: config.EVM_RPC_URL || 'https://mainnet.base.org'
            }
        ]);

        if (rpc === 'custom') {
            const { customRpc } = await inquirer.prompt([{ type: 'input', name: 'customRpc', message: 'RPC URL:' }]);
            config.EVM_RPC_URL = customRpc;
        } else {
            config.EVM_RPC_URL = rpc;
        }
    }

    // 4. Survival Mode Configuration
    divider();
    console.log(chalk.blue.bold('4. Survival Mode (Evolutionary Logic)'));
    console.log(chalk.gray('Dynamic risk management based on agent performance.'));

    // Default to true for better out-of-box experience
    const { enableSurvival } = await inquirer.prompt([
        {
            type: 'confirm',
            name: 'enableSurvival',
            message: 'Enable Survival Mode?',
            default: true
        }
    ]);

    if (enableSurvival) {
        const { advancedSurvival } = await inquirer.prompt([
            {
                type: 'confirm',
                name: 'advancedSurvival',
                message: 'Configure advanced survival parameters?',
                default: false
            }
        ]);

        if (advancedSurvival) {
            const survivalConfig = await inquirer.prompt([
                { type: 'number', name: 'SURVIVAL_START_BALANCE', message: 'Starting Balance Reference (USD):', default: parseFloat(config.SURVIVAL_START_BALANCE) || 1000 },
                { type: 'number', name: 'SURVIVAL_COST_PER_HOUR', message: 'Simulated Burn Rate ($/hr):', default: parseFloat(config.SURVIVAL_COST_PER_HOUR) || 0.1 }
            ]);
            Object.assign(config, survivalConfig);
        } else {
            // Set sensible defaults if enabled but advanced skipped
            if (!config.SURVIVAL_START_BALANCE) config.SURVIVAL_START_BALANCE = 1000;
            if (!config.SURVIVAL_COST_PER_HOUR) config.SURVIVAL_COST_PER_HOUR = 0.1;
        }
    }

    divider();
    console.log(chalk.bold('Summary:'));
    console.log(`- Mode: ${scope === 'sim' ? 'Simulation 🎮' : 'Real Money 💰'}`);
    console.log(`- x402 Wallet: ${enableX402 ? 'Active ✅' : 'Disabled ❌'}`);
    console.log(`- Survival Mode: ${enableSurvival ? 'Active ✅' : 'Disabled ❌'}`);

    const { confirmSave } = await inquirer.prompt([
        { type: 'confirm', name: 'confirmSave', message: 'Save configuration to .env?', default: true }
    ]);

    if (confirmSave) {
        saveEnv(config);
        console.log(chalk.cyan(`\n🚀 Setup Complete! You are ready to launch.`));
        console.log(chalk.gray(`Try running: npm start`));
    } else {
        console.log(chalk.yellow('Changes discarded.'));
    }
}

main().catch(err => {
    console.error(chalk.red('Error during setup:'), err);
});
