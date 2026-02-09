import fs from 'fs';
import path from 'path';
import { eventBus } from './EventBus.js';
import { LLMClient } from './LLMClient.js';
import { MarketDataFeed } from './MarketDataFeed.js';
import { PositionManager } from './PositionManager.js';
import { RiskManager } from './RiskManager.js';
import { SurvivalManager } from './survival/SurvivalManager.js';
import { SocialSentimentAnalyzer } from '../pipelines/market_intelligence/social_sentiment.js';

/**
 * AgentOrchestrator — The central brain of the autonomous trading agent.
 * 
 * Runs a continuous loop:
 *   1. gatherSignals()  — Collect social alpha, market data, portfolio state
 *   2. think()          — Send context to LLM for structured decision
 *   3. riskFilter()     — Validate decision through RiskManager
 *   4. execute()        — Dispatch trade to the appropriate pipeline
 *   5. monitor()        — Update PnL, feed SurvivalManager, check positions
 * 
 * Adapts loop interval based on survival state:
 *   GROWTH:    faster (more aggressive scanning)
 *   SURVIVAL:  normal
 *   DEFENSIVE: slower (conserve resources)
 *   RECOVERY:  moderate
 */
export class AgentOrchestrator {
    /**
     * @param {object} config
     * @param {number} config.initialBalance - Starting balance for SurvivalManager
     * @param {string[]} [config.symbols] - Symbols to track (default ['BTCUSDT','ETHUSDT','SOLUSDT'])
     * @param {number} [config.baseIntervalMs] - Base loop interval in ms (default 30000)
     * @param {string} [config.dataDir] - Data directory for persistence
     * @param {string} [config.alphaDbPath] - Path to alpha_db.json from Social Alpha Miner
     * @param {object} [config.llmConfig] - Override config for LLMClient
     * @param {object} [config.riskConfig] - Override config for RiskManager
     * @param {function} [config.executeTrade] - Custom trade execution function
     * @param {function} [config.executeClose] - Custom close execution function
     */
    constructor(config) {
        this.config = config;
        this.baseIntervalMs = config.baseIntervalMs || parseInt(process.env.AGENT_INTERVAL_MS) || 30000;
        this.dataDir = config.dataDir || path.join(process.cwd(), 'data');
        this.stateFile = path.join(this.dataDir, 'state.json');
        this.alphaDbPath = config.alphaDbPath || path.join(process.cwd(), 'skills', 'social_alpha_miner', 'scripts', 'alpha_db.json');

        this._running = false;
        this._loopTimer = null;
        this._cycleCount = 0;

        // Custom execution handlers (set by agent.js or pipeline integrations)
        this._executeTrade = config.executeTrade || null;
        this._executeClose = config.executeClose || null;

        // Initialize sub-modules
        this.llm = new LLMClient(config.llmConfig || {});

        this.marketData = new MarketDataFeed({
            symbols: config.symbols || (process.env.MARKET_SYMBOLS || 'BTCUSDT,ETHUSDT,SOLUSDT').split(',')
        });

        this.positionManager = new PositionManager({
            dataDir: this.dataDir,
            onClosePosition: (position) => this._handleCloseOnExchange(position)
        });

        this.riskManager = new RiskManager(config.riskConfig || {});

        this.survival = new SurvivalManager({
            initialBalance: config.initialBalance || parseFloat(process.env.SURVIVAL_START_BALANCE) || 1000,
            x402Client: config.x402Client || null,
            onCritical: () => this._onCriticalShutdown()
        });

        this.sentimentAnalyzer = new SocialSentimentAnalyzer();

        // Listen for shutdown events
        eventBus.on('agent:shutdown', (data) => this._gracefulShutdown(data));

        console.log('🤖 AgentOrchestrator initialized.');
    }

    /**
     * Start the autonomous agent loop.
     */
    async start() {
        if (this._running) {
            console.warn('⚠️ Agent is already running.');
            return;
        }

        this._running = true;
        console.log('\n🚀 ═══════════════════════════════════════');
        console.log('   OPENCLAW AUTONOMOUS AGENT STARTING');
        console.log('═══════════════════════════════════════\n');

        // Start market data feed
        await this.marketData.start();

        // Load previous state if available
        this._loadState();

        // Run the main loop
        this._runLoop();
    }

    /**
     * Stop the agent gracefully.
     */
    async stop() {
        console.log('\n🛑 Agent stopping...');
        this._running = false;

        if (this._loopTimer) {
            clearTimeout(this._loopTimer);
            this._loopTimer = null;
        }

        this.marketData.stop();
        this._saveState();

        console.log('🛑 Agent stopped. State saved.');
    }

    // --- Main Loop ---

    async _runLoop() {
        while (this._running) {
            this._cycleCount++;
            const cycleStart = Date.now();

            try {
                console.log(`\n⏱️  ═══ Cycle #${this._cycleCount} [${new Date().toISOString()}] ═══`);
                console.log(`   State: ${this.survival.state} | Balance: $${this.survival.currentBalance} | Positions: ${this.positionManager.getCount()}`);

                // Step 1: Gather signals
                const signals = await this._gatherSignals();

                // Step 2: Think (LLM decision)
                const decision = await this._think(signals);

                // Step 3: Risk filter
                const riskResult = this._riskFilter(decision);

                // Step 4: Execute (if approved)
                if (riskResult.allowed && decision.action !== 'HOLD') {
                    await this._execute(decision, riskResult);
                } else if (decision.action !== 'HOLD') {
                    console.log(`   ⛔ Trade blocked: ${riskResult.reason}`);
                } else {
                    console.log(`   ⏸️  HOLD — No action this cycle.`);
                }

                // Step 5: Monitor positions & update survival
                this._monitor();

            } catch (error) {
                console.error(`   ❌ Cycle error: ${error.message}`);
                eventBus.emit('agent:error', { cycle: this._cycleCount, error: error.message });
            }

            // Adaptive interval based on survival state
            const interval = this._getAdaptiveInterval();
            const elapsed = Date.now() - cycleStart;
            const sleepTime = Math.max(1000, interval - elapsed);

            console.log(`   💤 Next cycle in ${(sleepTime / 1000).toFixed(1)}s`);

            // Wait for next cycle
            await new Promise((resolve) => {
                this._loopTimer = setTimeout(resolve, sleepTime);
            });
        }
    }

    // --- Step 1: Gather Signals ---

    async _gatherSignals() {
        const signals = [];

        // Read alpha_db.json (from Social Alpha Miner)
        try {
            if (fs.existsSync(this.alphaDbPath)) {
                const raw = fs.readFileSync(this.alphaDbPath, 'utf8');
                const alphaEntries = JSON.parse(raw);

                // Only consider recent signals (last 30 minutes)
                const cutoff = Date.now() - (30 * 60 * 1000);
                const recent = alphaEntries.filter(e => {
                    const ts = new Date(e.discovered_at).getTime();
                    return ts > cutoff;
                });

                signals.push(...recent);
            }
        } catch (error) {
            console.warn('   ⚠️ Could not read alpha_db:', error.message);
        }

        if (signals.length > 0) {
            console.log(`   📡 ${signals.length} recent signal(s) found.`);
        }

        return signals;
    }

    // --- Step 2: Think (LLM Decision) ---

    async _think(signals) {
        const marketSnapshot = this.marketData.getSnapshot();
        const openPositions = this.positionManager.getOpen();

        const context = {
            marketData: marketSnapshot,
            signals,
            positions: openPositions,
            survivalState: this.survival.state,
            balance: this.survival.currentBalance,
            pnl: this.survival.getPnL()
        };

        console.log('   🧠 Convening the Council of AI...');

        // Use the new multi-persona debate mode
        const decision = await this.llm.decideWithDebate(context);

        console.log(`\n   🏛️  COUNCIL DECISION: ${decision.action} ${decision.symbol || ''}`);
        console.log(`   Rationale: ${decision.reasoning}`);
        console.log(`   Confidence: ${(decision.confidence * 100).toFixed(0)}% | Urgency: ${decision.urgency}`);

        return decision;
    }

    // --- Step 3: Risk Filter ---

    _riskFilter(decision) {
        if (decision.action === 'HOLD') {
            return { allowed: false, reason: 'HOLD decision', adjustedLeverage: 0, adjustedSize: 0 };
        }

        if (decision.action === 'CLOSE') {
            // Closing is always allowed
            return { allowed: true, reason: 'Close approved', adjustedLeverage: 0, adjustedSize: 0 };
        }

        const portfolio = {
            balance: this.survival.currentBalance,
            totalExposure: this.positionManager.getTotalExposure(),
            positionCount: this.positionManager.getCount(),
            positions: this.positionManager.getOpen()
        };

        return this.riskManager.canOpenPosition(decision, portfolio, this.survival.state);
    }

    // --- Step 4: Execute ---

    async _execute(decision, riskResult) {
        const symbol = decision.symbol ? `${decision.symbol}USDT` : null;

        if (decision.action === 'CLOSE') {
            // Find positions to close for this symbol
            const toClose = symbol
                ? this.positionManager.getBySymbol(symbol)
                : this.positionManager.getOpen();

            if (toClose.length === 0) {
                console.log(`   ⚠️ No positions found to close for ${symbol || 'all'}`);
                return;
            }

            for (const position of toClose) {
                await this._handleCloseOnExchange(position);
                const currentPrice = this.marketData.getPrice(position.symbol);
                this.positionManager.close(position.id, 'llm_decision', currentPrice);
            }
            return;
        }

        // BUY or SELL
        if (!symbol) {
            console.log('   ⚠️ No symbol specified in decision. Skipping.');
            return;
        }

        const side = decision.action === 'BUY' ? 'buy' : 'sell';
        const leverage = riskResult.adjustedLeverage;
        const size = riskResult.adjustedSize;
        const currentPrice = this.marketData.getPrice(symbol);

        if (currentPrice <= 0) {
            console.log(`   ⚠️ No price data for ${symbol}. Skipping trade.`);
            return;
        }

        // Calculate TP/SL
        const marketIndicators = this.marketData.indicators[symbol] || {};
        const stopLoss = this.riskManager.getStopLoss(currentPrice, side, marketIndicators.atr);
        const takeProfit = this.riskManager.getTakeProfit(currentPrice, side, stopLoss);

        console.log(`   ⚡ EXECUTING: ${side.toUpperCase()} ${symbol} | Size: $${size.toFixed(2)} | Leverage: ${leverage}x | SL: $${stopLoss.toFixed(2)} | TP: $${takeProfit.toFixed(2)}`);

        // Execute on exchange via custom handler
        if (this._executeTrade) {
            try {
                await this._executeTrade({
                    symbol: symbol.replace('USDT', '/USDT'),
                    side,
                    amount: size,
                    leverage
                });
            } catch (err) {
                console.error(`   ❌ Exchange execution failed: ${err.message}`);
                return;
            }
        }

        // Register position
        this.positionManager.open({
            symbol,
            side,
            entryPrice: currentPrice,
            size,
            leverage,
            exchange: 'sidex',
            stopLoss,
            takeProfit
        });
    }

    // --- Step 5: Monitor ---

    _monitor() {
        // Update survival manager with current balance + unrealized PnL
        const unrealizedPnl = this.positionManager.getTotalPnL();
        const effectiveBalance = this.survival.initialBalance + unrealizedPnl;
        this.survival.updateVitalSigns(effectiveBalance);

        // Periodic state save
        if (this._cycleCount % 5 === 0) {
            this._saveState();
        }
    }

    // --- Exchange Execution Handlers ---

    async _handleCloseOnExchange(position) {
        if (this._executeClose) {
            try {
                await this._executeClose(position);
            } catch (err) {
                console.error(`   ❌ Failed to close on exchange: ${err.message}`);
            }
        } else {
            console.log(`   📝 Close position ${position.id} (no exchange handler configured — simulation mode)`);
        }
    }

    // --- Shutdown ---

    _onCriticalShutdown() {
        console.log('🔴 CRITICAL shutdown triggered by SurvivalManager.');
    }

    async _gracefulShutdown(data) {
        console.log(`\n🔴 ═══ GRACEFUL SHUTDOWN ═══`);
        console.log(`   Reason: ${data?.reason || 'unknown'}`);
        console.log(`   Balance: $${data?.balance || '?'}`);

        // Close all open positions
        const openCount = this.positionManager.getCount();
        if (openCount > 0) {
            console.log(`   Closing ${openCount} open position(s)...`);
            await this.positionManager.closeAll('shutdown');
        }

        // Save final state
        this._saveState();

        // Stop the agent
        await this.stop();
    }

    // --- Adaptive Interval ---

    _getAdaptiveInterval() {
        const multipliers = {
            GROWTH: 0.5,     // Faster: more opportunities to capture
            SURVIVAL: 1.0,   // Normal
            RECOVERY: 1.3,   // Slightly slower
            DEFENSIVE: 2.0,  // Much slower: conserve
            CRITICAL: 999    // Won't reach here (shutdown)
        };

        const mult = multipliers[this.survival.state] || 1.0;
        return this.baseIntervalMs * mult;
    }

    // --- State Persistence ---

    _saveState() {
        try {
            if (!fs.existsSync(this.dataDir)) {
                fs.mkdirSync(this.dataDir, { recursive: true });
            }

            const state = {
                cycleCount: this._cycleCount,
                survivalState: this.survival.state,
                balance: this.survival.currentBalance,
                initialBalance: this.survival.initialBalance,
                pnl: this.survival.getPnL(),
                positionCount: this.positionManager.getCount(),
                lastSaved: new Date().toISOString()
            };

            fs.writeFileSync(this.stateFile, JSON.stringify(state, null, 2));
        } catch (error) {
            console.error('❌ Failed to save agent state:', error.message);
        }
    }

    _loadState() {
        try {
            if (fs.existsSync(this.stateFile)) {
                const raw = fs.readFileSync(this.stateFile, 'utf8');
                const state = JSON.parse(raw);

                this._cycleCount = state.cycleCount || 0;
                if (state.balance) {
                    this.survival.currentBalance = state.balance;
                }

                console.log(`📂 Restored state: Cycle #${this._cycleCount} | Balance: $${state.balance} | Last saved: ${state.lastSaved}`);
            }
        } catch (error) {
            console.warn('⚠️ Could not load agent state:', error.message);
        }
    }
}
