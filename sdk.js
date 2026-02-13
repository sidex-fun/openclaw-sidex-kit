/**
 * OpenClaw SDK — High-level API for building autonomous trading agents.
 * 
 * Usage:
 *   import { createAgent, createLLM, createRiskManager } from 'openclaw-sidex-kit/sdk';
 * 
 *   const agent = createAgent({
 *       initialBalance: 1000,
 *       llm: { provider: 'openai', apiKey: 'sk-...' },
 *       risk: { maxLeverage: 10 }
 *   });
 * 
 *   await agent.start();
 */

import { eventBus } from './core/EventBus.js';
import { SurvivalManager } from './core/survival/SurvivalManager.js';
import { LLMClient } from './core/LLMClient.js';
import { MarketDataFeed } from './core/MarketDataFeed.js';
import { PositionManager } from './core/PositionManager.js';
import { RiskManager } from './core/RiskManager.js';
import { AgentOrchestrator } from './core/AgentOrchestrator.js';
import { WalletManager } from './core/x402/WalletManager.js';
import { X402Client } from './core/x402/X402Client.js';
import { SocialSentimentAnalyzer } from './pipelines/market_intelligence/social_sentiment.js';
import { LiquidationIntelligence } from './core/LiquidationIntelligence.js';

// Re-export all core modules
export {
    eventBus,
    SurvivalManager,
    LLMClient,
    MarketDataFeed,
    PositionManager,
    RiskManager,
    AgentOrchestrator,
    WalletManager,
    X402Client,
    SocialSentimentAnalyzer,
    LiquidationIntelligence,
};

/**
 * Create a fully configured autonomous trading agent.
 * 
 * @param {object} options
 * @param {number} options.initialBalance - Starting capital
 * @param {string[]} [options.symbols] - Symbols to track (default: ['BTCUSDT','ETHUSDT','SOLUSDT'])
 * @param {number} [options.intervalMs] - Loop interval in ms (default: 30000)
 * @param {object} [options.llm] - LLM configuration { provider, model, apiBase, apiKey }
 * @param {object} [options.risk] - Risk configuration { maxLeverage, maxPositions, ... }
 * @param {string} [options.dataDir] - Data directory for persistence
 * @param {function} [options.onTrade] - Custom trade execution handler
 * @param {function} [options.onClose] - Custom close execution handler
 * @returns {AgentOrchestrator}
 */
export function createAgent(options = {}) {
    return new AgentOrchestrator({
        initialBalance: options.initialBalance || 1000,
        symbols: options.symbols,
        baseIntervalMs: options.intervalMs,
        dataDir: options.dataDir,
        alphaDbPath: options.alphaDbPath,
        llmConfig: options.llm,
        riskConfig: options.risk,
        x402Client: options.x402Client || null,
        executeTrade: options.onTrade || null,
        executeClose: options.onClose || null,
    });
}

/**
 * Create a standalone LLM client for trading decisions.
 * 
 * @param {object} [options]
 * @param {'ollama'|'openai'|'anthropic'} [options.provider] - LLM provider
 * @param {string} [options.model] - Model name
 * @param {string} [options.apiBase] - API base URL
 * @param {string} [options.apiKey] - API key
 * @returns {LLMClient}
 */
export function createLLM(options = {}) {
    return new LLMClient(options);
}

/**
 * Create a standalone market data feed.
 * 
 * @param {object} [options]
 * @param {string[]} [options.symbols] - Symbols to track
 * @param {number} [options.pollIntervalMs] - Polling interval fallback
 * @returns {MarketDataFeed}
 */
export function createMarketFeed(options = {}) {
    return new MarketDataFeed(options);
}

/**
 * Create a standalone risk manager.
 * 
 * @param {object} [options]
 * @param {number} [options.maxLeverage] - Max leverage
 * @param {number} [options.maxPositions] - Max concurrent positions
 * @param {number} [options.riskPercent] - Risk per trade as % of balance
 * @returns {RiskManager}
 */
export function createRiskManager(options = {}) {
    if (options.riskPercent !== undefined) {
        options.defaultRiskPercent = options.riskPercent;
    }
    return new RiskManager(options);
}

/**
 * Create a standalone survival manager.
 * 
 * @param {number} initialBalance - Starting capital
 * @param {object} [callbacks] - State change callbacks
 * @returns {SurvivalManager}
 */
export function createSurvival(initialBalance, callbacks = {}) {
    return new SurvivalManager({
        initialBalance,
        ...callbacks,
    });
}

/**
 * Create a standalone position manager.
 * 
 * @param {object} [options]
 * @param {string} [options.dataDir] - Persistence directory
 * @param {function} [options.onClose] - Close handler
 * @returns {PositionManager}
 */
export function createPositionManager(options = {}) {
    return new PositionManager({
        dataDir: options.dataDir,
        onClosePosition: options.onClose || null,
    });
}

/**
 * Create a standalone liquidation intelligence feed.
 * 
 * @param {object} [options]
 * @param {string[]} [options.symbols] - Symbols to track
 * @param {number} [options.pollIntervalMs] - Data refresh interval
 * @param {string} [options.exchange] - Primary exchange ('binance' | 'bybit')
 * @param {object} [options.coinglass] - CoinGlass premium config { apiKey }
 * @param {object} [options.x402] - x402 config { client, autoPayPremium, maxPaymentPerDay }
 * @returns {LiquidationIntelligence}
 */
export function createLiquidationIntel(options = {}) {
    return new LiquidationIntelligence(options);
}
