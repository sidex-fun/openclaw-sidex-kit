import WebSocket from 'ws';
import fetch from 'node-fetch';
import { eventBus } from './EventBus.js';

/**
 * MarketDataFeed — Real-time price data and technical indicators.
 * 
 * Connects to Binance public WebSocket streams for live ticker data.
 * Calculates basic technical indicators (RSI, EMA, ATR) in-memory.
 * Emits 'price:update' events on the EventBus.
 * 
 * Falls back to HTTP polling if WebSocket connection fails.
 */
export class MarketDataFeed {
    /**
     * @param {object} config
     * @param {string[]} config.symbols - Symbols to track (e.g. ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'])
     * @param {number} [config.pollIntervalMs] - Fallback polling interval (default 10000)
     * @param {number} [config.indicatorPeriod] - Period for RSI/ATR calculation (default 14)
     */
    constructor(config = {}) {
        this.symbols = (config.symbols || ['BTCUSDT', 'ETHUSDT', 'SOLUSDT']).map(s => s.toUpperCase());
        this.pollIntervalMs = config.pollIntervalMs || 10000;
        this.indicatorPeriod = config.indicatorPeriod || 14;

        // Price history for indicator calculation (keyed by symbol)
        this.priceHistory = {};
        this.latestPrices = {};
        this.indicators = {};

        this._ws = null;
        this._pollTimer = null;
        this._reconnectTimer = null;
        this._running = false;
        this._reconnectAttempts = 0;
        this._maxReconnectAttempts = 10;

        // Initialize data structures
        for (const symbol of this.symbols) {
            this.priceHistory[symbol] = [];
            this.latestPrices[symbol] = 0;
            this.indicators[symbol] = { rsi: null, ema20: null, ema50: null, atr: null };
        }
    }

    /**
     * Start receiving market data.
     */
    async start() {
        this._running = true;
        console.log(`📊 MarketDataFeed starting for: ${this.symbols.join(', ')}`);

        // Try WebSocket first, fall back to polling
        try {
            await this._connectWebSocket();
        } catch (error) {
            console.warn(`⚠️ WebSocket connection failed: ${error.message}. Falling back to HTTP polling.`);
            this._startPolling();
        }
    }

    /**
     * Stop all data feeds.
     */
    stop() {
        this._running = false;

        if (this._ws) {
            this._ws.close();
            this._ws = null;
        }
        if (this._pollTimer) {
            clearInterval(this._pollTimer);
            this._pollTimer = null;
        }
        if (this._reconnectTimer) {
            clearTimeout(this._reconnectTimer);
            this._reconnectTimer = null;
        }

        console.log('📊 MarketDataFeed stopped.');
    }

    /**
     * Get the latest snapshot of all market data with indicators.
     * @returns {object} Keyed by symbol
     */
    getSnapshot() {
        const snapshot = {};
        for (const symbol of this.symbols) {
            snapshot[symbol] = {
                price: this.latestPrices[symbol],
                ...this.indicators[symbol],
                historyLength: this.priceHistory[symbol].length
            };
        }
        return snapshot;
    }

    /**
     * Get data for a specific symbol.
     * @param {string} symbol
     */
    getPrice(symbol) {
        const s = symbol.toUpperCase();
        return this.latestPrices[s] || 0;
    }

    // --- WebSocket Connection ---

    async _connectWebSocket() {
        const streams = this.symbols.map(s => `${s.toLowerCase()}@ticker`).join('/');
        const url = `wss://stream.binance.com:9443/ws/${streams}`;

        return new Promise((resolve, reject) => {
            this._ws = new WebSocket(url);

            const connectTimeout = setTimeout(() => {
                if (this._ws && this._ws.readyState !== WebSocket.OPEN) {
                    this._ws.close();
                    reject(new Error('WebSocket connection timeout'));
                }
            }, 10000);

            this._ws.on('open', () => {
                clearTimeout(connectTimeout);
                this._reconnectAttempts = 0;
                console.log('📊 Connected to Binance WebSocket stream.');
                resolve();
            });

            this._ws.on('message', (raw) => {
                try {
                    const data = JSON.parse(raw.toString());
                    if (data.s && data.c) {
                        this._processTick(data.s, parseFloat(data.c), {
                            high: parseFloat(data.h),
                            low: parseFloat(data.l),
                            volume: parseFloat(data.v)
                        });
                    }
                } catch (e) {
                    // Ignore parse errors on individual messages
                }
            });

            this._ws.on('close', () => {
                clearTimeout(connectTimeout);
                if (this._running) {
                    console.warn('📊 WebSocket disconnected. Attempting reconnect...');
                    this._scheduleReconnect();
                }
            });

            this._ws.on('error', (err) => {
                clearTimeout(connectTimeout);
                if (this._ws.readyState !== WebSocket.OPEN) {
                    reject(err);
                } else {
                    console.error('📊 WebSocket error:', err.message);
                }
            });
        });
    }

    _scheduleReconnect() {
        if (!this._running) return;
        if (this._reconnectAttempts >= this._maxReconnectAttempts) {
            console.warn('📊 Max reconnect attempts reached. Switching to HTTP polling.');
            this._startPolling();
            return;
        }

        const delay = Math.min(1000 * Math.pow(2, this._reconnectAttempts), 30000);
        this._reconnectAttempts++;

        this._reconnectTimer = setTimeout(async () => {
            try {
                await this._connectWebSocket();
            } catch (e) {
                console.warn(`📊 Reconnect attempt ${this._reconnectAttempts} failed.`);
                this._scheduleReconnect();
            }
        }, delay);
    }

    // --- HTTP Polling Fallback ---

    _startPolling() {
        if (this._pollTimer) return;

        console.log(`📊 Starting HTTP polling every ${this.pollIntervalMs / 1000}s`);

        const poll = async () => {
            if (!this._running) return;
            try {
                const symbols = JSON.stringify(this.symbols);
                const url = `https://api.binance.com/api/v3/ticker/price?symbols=${encodeURIComponent(symbols)}`;
                const response = await fetch(url);

                if (!response.ok) throw new Error(`HTTP ${response.status}`);

                const tickers = await response.json();
                for (const ticker of tickers) {
                    this._processTick(ticker.symbol, parseFloat(ticker.price));
                }
            } catch (error) {
                console.error('📊 Polling error:', error.message);
            }
        };

        // Run immediately, then on interval
        poll();
        this._pollTimer = setInterval(poll, this.pollIntervalMs);
    }

    // --- Price Processing & Indicators ---

    _processTick(symbol, price, extra = {}) {
        const s = symbol.toUpperCase();
        if (!this.symbols.includes(s)) return;

        this.latestPrices[s] = price;

        // Store price with metadata for indicator calculation
        this.priceHistory[s].push({
            price,
            high: extra.high || price,
            low: extra.low || price,
            timestamp: Date.now()
        });

        // Keep last 200 data points max
        if (this.priceHistory[s].length > 200) {
            this.priceHistory[s] = this.priceHistory[s].slice(-200);
        }

        // Recalculate indicators
        this._updateIndicators(s);

        // Emit event
        eventBus.emit('price:update', {
            symbol: s,
            price,
            ...this.indicators[s],
            volume: extra.volume,
            timestamp: Date.now()
        });
    }

    _updateIndicators(symbol) {
        const history = this.priceHistory[symbol];
        const prices = history.map(h => h.price);
        const period = this.indicatorPeriod;

        if (prices.length < period + 1) return;

        // RSI
        this.indicators[symbol].rsi = this._calcRSI(prices, period);

        // EMA 20 & 50
        if (prices.length >= 20) {
            this.indicators[symbol].ema20 = this._calcEMA(prices, 20);
        }
        if (prices.length >= 50) {
            this.indicators[symbol].ema50 = this._calcEMA(prices, 50);
        }

        // ATR (requires high/low data)
        if (history.length >= period + 1) {
            this.indicators[symbol].atr = this._calcATR(history, period);
        }
    }

    /**
     * Calculate RSI (Relative Strength Index)
     */
    _calcRSI(prices, period) {
        const changes = [];
        for (let i = 1; i < prices.length; i++) {
            changes.push(prices[i] - prices[i - 1]);
        }

        const recent = changes.slice(-period);
        let avgGain = 0;
        let avgLoss = 0;

        for (const change of recent) {
            if (change > 0) avgGain += change;
            else avgLoss += Math.abs(change);
        }

        avgGain /= period;
        avgLoss /= period;

        if (avgLoss === 0) return 100;

        const rs = avgGain / avgLoss;
        return 100 - (100 / (1 + rs));
    }

    /**
     * Calculate EMA (Exponential Moving Average)
     */
    _calcEMA(prices, period) {
        const k = 2 / (period + 1);
        let ema = prices[0];

        for (let i = 1; i < prices.length; i++) {
            ema = prices[i] * k + ema * (1 - k);
        }

        return ema;
    }

    /**
     * Calculate ATR (Average True Range)
     */
    _calcATR(history, period) {
        const trueRanges = [];

        for (let i = 1; i < history.length; i++) {
            const high = history[i].high;
            const low = history[i].low;
            const prevClose = history[i - 1].price;

            const tr = Math.max(
                high - low,
                Math.abs(high - prevClose),
                Math.abs(low - prevClose)
            );
            trueRanges.push(tr);
        }

        const recent = trueRanges.slice(-period);
        return recent.reduce((sum, tr) => sum + tr, 0) / recent.length;
    }
}
