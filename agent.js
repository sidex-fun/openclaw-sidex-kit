import dotenv from 'dotenv';
import { AgentOrchestrator } from './core/AgentOrchestrator.js';

dotenv.config();

/**
 * agent.js — Main entry point for the OpenClaw Autonomous Trading Agent.
 * 
 * Usage:
 *   node agent.js
 * 
 * Requires a configured .env file (run `npm run setup` first).
 * Handles SIGINT/SIGTERM for graceful shutdown.
 */

console.log(`
 ██████╗ ██████╗ ███████╗███╗   ██╗ ██████╗██╗      █████╗ ██╗    ██╗
██╔═══██╗██╔══██╗██╔════╝████╗  ██║██╔════╝██║     ██╔══██╗██║    ██║
██║   ██║██████╔╝█████╗  ██╔██╗ ██║██║     ██║     ███████║██║ █╗ ██║
██║   ██║██╔═══╝ ██╔══╝  ██║╚██╗██║██║     ██║     ██╔══██║██║███╗██║
╚██████╔╝██║     ███████╗██║ ╚████║╚██████╗███████╗██║  ██║╚███╔███╔╝
 ╚═════╝ ╚═╝     ╚══════╝╚═╝  ╚═══╝ ╚═════╝╚══════╝╚═╝  ╚═╝ ╚══╝╚══╝
                    Autonomous Trading Agent
`);

// --- Configuration Summary ---
const config = {
    initialBalance: parseFloat(process.env.SURVIVAL_START_BALANCE) || 1000,
    symbols: (process.env.MARKET_SYMBOLS || 'BTCUSDT,ETHUSDT,SOLUSDT').split(',').map(s => s.trim()),
    baseIntervalMs: parseInt(process.env.AGENT_INTERVAL_MS) || 30000,
};

console.log('📋 Configuration:');
console.log(`   Balance:  $${config.initialBalance}`);
console.log(`   Symbols:  ${config.symbols.join(', ')}`);
console.log(`   Interval: ${config.baseIntervalMs / 1000}s`);
console.log(`   LLM:      ${process.env.LLM_PROVIDER || 'ollama'} / ${process.env.OLLAMA_MODEL || process.env.LLM_MODEL || 'llama3.3'}`);
console.log('');

// --- Initialize Orchestrator ---
const agent = new AgentOrchestrator(config);

// --- Graceful Shutdown Handlers ---
let shuttingDown = false;

async function shutdown(signal) {
    if (shuttingDown) return;
    shuttingDown = true;

    console.log(`\n⚠️  Received ${signal}. Shutting down gracefully...`);

    try {
        await agent.stop();
    } catch (err) {
        console.error('Error during shutdown:', err.message);
    }

    process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('uncaughtException', (err) => {
    console.error('💀 Uncaught Exception:', err);
    shutdown('uncaughtException');
});
process.on('unhandledRejection', (reason) => {
    console.error('💀 Unhandled Rejection:', reason);
});

// --- Start ---
agent.start().catch((err) => {
    console.error('❌ Failed to start agent:', err);
    process.exit(1);
});
