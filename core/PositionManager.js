import fs from 'fs';
import path from 'path';
import { eventBus } from './EventBus.js';

/**
 * PositionManager — Tracks open positions, calculates PnL, and manages TP/SL.
 * 
 * Persists state to data/positions.json for crash recovery.
 * Listens to 'price:update' events to check stop-loss and take-profit levels.
 * Emits 'position:opened' and 'position:closed' events.
 */
export class PositionManager {
    /**
     * @param {object} config
     * @param {string} [config.dataDir] - Directory for persistence (default: data/)
     * @param {function} [config.onClosePosition] - Callback to execute the actual close order on exchange
     */
    constructor(config = {}) {
        this.dataDir = config.dataDir || path.join(process.cwd(), 'data');
        this.positionsFile = path.join(this.dataDir, 'positions.json');
        this.onClosePosition = config.onClosePosition || null;

        // Map of positionId -> position object
        this.positions = new Map();

        // Load persisted state
        this._loadState();

        // Listen for price updates to check TP/SL
        eventBus.on('price:update', (data) => this._checkStops(data));

        console.log(`📋 PositionManager active. ${this.positions.size} positions loaded from state.`);
    }

    /**
     * Register a new open position.
     * @param {object} params
     * @param {string} params.symbol - e.g. 'BTCUSDT'
     * @param {string} params.side - 'buy' or 'sell'
     * @param {number} params.entryPrice - Entry price
     * @param {number} params.size - Position size in USD
     * @param {number} params.leverage - Leverage used
     * @param {string} params.exchange - Exchange name (e.g. 'sidex', 'binance', 'hyperliquid')
     * @param {number} [params.stopLoss] - Stop-loss price
     * @param {number} [params.takeProfit] - Take-profit price
     * @returns {object} The created position
     */
    open(params) {
        const id = `${params.exchange}_${params.symbol}_${params.side}_${Date.now()}`;

        const position = {
            id,
            symbol: params.symbol.toUpperCase(),
            side: params.side.toLowerCase(),
            entryPrice: params.entryPrice,
            size: params.size,
            leverage: params.leverage || 1,
            exchange: params.exchange || 'sidex',
            stopLoss: params.stopLoss || null,
            takeProfit: params.takeProfit || null,
            unrealizedPnl: 0,
            openedAt: new Date().toISOString(),
            closedAt: null,
            closeReason: null
        };

        this.positions.set(id, position);
        this._saveState();

        console.log(`📈 Position OPENED: ${position.side.toUpperCase()} ${position.symbol} | Size: $${position.size} | Leverage: ${position.leverage}x | Entry: $${position.entryPrice}`);

        eventBus.emit('position:opened', position);
        return position;
    }

    /**
     * Close a position by ID.
     * @param {string} positionId
     * @param {string} reason - 'manual' | 'stop_loss' | 'take_profit' | 'survival' | 'shutdown'
     * @param {number} [exitPrice] - Exit price (for PnL calculation)
     * @returns {object|null} The closed position
     */
    close(positionId, reason = 'manual', exitPrice = null) {
        const position = this.positions.get(positionId);
        if (!position) {
            console.warn(`⚠️ Position ${positionId} not found.`);
            return null;
        }

        // Calculate final PnL if exit price provided
        if (exitPrice) {
            position.unrealizedPnl = this._calcPnL(position, exitPrice);
        }

        position.closedAt = new Date().toISOString();
        position.closeReason = reason;
        position.exitPrice = exitPrice;

        // Remove from active positions
        this.positions.delete(positionId);
        this._saveState();

        console.log(`📉 Position CLOSED [${reason}]: ${position.side.toUpperCase()} ${position.symbol} | PnL: $${position.unrealizedPnl.toFixed(2)}`);

        eventBus.emit('position:closed', position);
        return position;
    }

    /**
     * Close all open positions.
     * @param {string} reason
     */
    async closeAll(reason = 'shutdown') {
        const ids = Array.from(this.positions.keys());
        const results = [];

        for (const id of ids) {
            const position = this.positions.get(id);

            // Try to execute the close on the exchange
            if (this.onClosePosition) {
                try {
                    await this.onClosePosition(position);
                } catch (err) {
                    console.error(`❌ Failed to close position ${id} on exchange:`, err.message);
                }
            }

            results.push(this.close(id, reason));
        }

        return results;
    }

    /**
     * Get all open positions.
     * @returns {Array}
     */
    getOpen() {
        return Array.from(this.positions.values());
    }

    /**
     * Get open positions for a specific symbol.
     * @param {string} symbol
     * @returns {Array}
     */
    getBySymbol(symbol) {
        return this.getOpen().filter(p => p.symbol === symbol.toUpperCase());
    }

    /**
     * Get total unrealized PnL across all positions.
     * @returns {number}
     */
    getTotalPnL() {
        return this.getOpen().reduce((sum, p) => sum + (p.unrealizedPnl || 0), 0);
    }

    /**
     * Get total exposure (sum of all position sizes * leverage).
     * @returns {number}
     */
    getTotalExposure() {
        return this.getOpen().reduce((sum, p) => sum + (p.size * p.leverage), 0);
    }

    /**
     * Get number of open positions.
     * @returns {number}
     */
    getCount() {
        return this.positions.size;
    }

    /**
     * Update stop-loss and take-profit for a position.
     * @param {string} positionId
     * @param {object} levels - { stopLoss, takeProfit }
     */
    updateLevels(positionId, levels) {
        const position = this.positions.get(positionId);
        if (!position) return;

        if (levels.stopLoss !== undefined) position.stopLoss = levels.stopLoss;
        if (levels.takeProfit !== undefined) position.takeProfit = levels.takeProfit;

        this._saveState();
    }

    // --- Internal Methods ---

    /**
     * Check stop-loss and take-profit levels on price update.
     * @private
     */
    _checkStops(priceData) {
        const { symbol, price } = priceData;

        for (const [id, position] of this.positions) {
            if (position.symbol !== symbol) continue;

            // Update unrealized PnL
            position.unrealizedPnl = this._calcPnL(position, price);

            // Check Stop-Loss
            if (position.stopLoss) {
                const triggered = position.side === 'buy'
                    ? price <= position.stopLoss
                    : price >= position.stopLoss;

                if (triggered) {
                    console.log(`🛑 STOP-LOSS triggered for ${position.symbol} at $${price}`);
                    if (this.onClosePosition) {
                        this.onClosePosition(position).catch(e => console.error('Close error:', e.message));
                    }
                    this.close(id, 'stop_loss', price);
                    continue;
                }
            }

            // Check Take-Profit
            if (position.takeProfit) {
                const triggered = position.side === 'buy'
                    ? price >= position.takeProfit
                    : price <= position.takeProfit;

                if (triggered) {
                    console.log(`🎯 TAKE-PROFIT triggered for ${position.symbol} at $${price}`);
                    if (this.onClosePosition) {
                        this.onClosePosition(position).catch(e => console.error('Close error:', e.message));
                    }
                    this.close(id, 'take_profit', price);
                    continue;
                }
            }
        }
    }

    /**
     * Calculate PnL for a position at a given price.
     * @private
     */
    _calcPnL(position, currentPrice) {
        const direction = position.side === 'buy' ? 1 : -1;
        const priceChange = (currentPrice - position.entryPrice) / position.entryPrice;
        return position.size * priceChange * direction * position.leverage;
    }

    /**
     * Persist positions to disk.
     * @private
     */
    _saveState() {
        try {
            if (!fs.existsSync(this.dataDir)) {
                fs.mkdirSync(this.dataDir, { recursive: true });
            }

            const data = Array.from(this.positions.entries());
            fs.writeFileSync(this.positionsFile, JSON.stringify(data, null, 2));
        } catch (error) {
            console.error('❌ Failed to save position state:', error.message);
        }
    }

    /**
     * Load positions from disk.
     * @private
     */
    _loadState() {
        try {
            if (fs.existsSync(this.positionsFile)) {
                const raw = fs.readFileSync(this.positionsFile, 'utf8');
                const entries = JSON.parse(raw);
                this.positions = new Map(entries);
            }
        } catch (error) {
            console.warn('⚠️ Could not load position state:', error.message);
            this.positions = new Map();
        }
    }
}
