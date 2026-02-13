import fetch from 'node-fetch';
import WebSocket from 'ws';
import { eventBus } from './EventBus.js';

/**
 * LiquidationIntelligence — Market liquidation analysis and signal generation.
 * 
 * Provides real-time liquidation data, Open Interest, Funding Rates, and Long/Short
 * ratios to help the agent understand where market makers may move price.
 * 
 * Data Sources:
 *   FREE:    Binance Futures API (OI, Funding, L/S Ratio, Liquidation stream)
 *   FREE:    Bybit API (OI, Funding, L/S Ratio)
 *   PREMIUM: CoinGlass API (full liquidation heatmap, aggregated data)
 *            — Can be paid via x402 autonomous payment if configured
 * 
 * Signals emitted:
 *   liquidation:update    — New liquidation data available
 *   liquidation:signal    — Actionable signal (MAGNET, CASCADE, IMBALANCE, SQUEEZE)
 *   liquidation:cascade   — Liquidation cascade detected (high urgency)
 * 
 * @example
 *   const intel = new LiquidationIntelligence({
 *       symbols: ['BTCUSDT', 'ETHUSDT'],
 *       coinglass: { apiKey: 'cg-...' }  // optional premium
 *   });
 *   await intel.start();
 *   const context = intel.getContext('BTCUSDT');
 */
export class LiquidationIntelligence {
    /**
     * @param {object} config
     * @param {string[]} [config.symbols] - Symbols to track (default: ['BTCUSDT', 'ETHUSDT'])
     * @param {number} [config.pollIntervalMs] - Data refresh interval (default: 60000)
     * @param {object} [config.coinglass] - CoinGlass premium config
     * @param {string} [config.coinglass.apiKey] - CoinGlass API key
     * @param {string} [config.coinglass.apiBase] - CoinGlass API base URL
     * @param {object} [config.x402] - x402 client for autonomous premium payments
     * @param {import('./x402/X402Client.js').X402Client} [config.x402.client] - X402Client instance
     * @param {boolean} [config.x402.autoPayPremium] - Auto-pay for premium data (default: false)
     * @param {number} [config.x402.maxPaymentPerDay] - Max daily spend in wei (default: 0)
     * @param {string} [config.exchange] - Primary exchange for free data ('binance' | 'bybit', default: 'binance')
     * @param {number} [config.cascadeThresholdUsd] - USD threshold for cascade alert (default: 10000000)
     * @param {number} [config.squeezeRatioThreshold] - L/S ratio threshold for squeeze signal (default: 2.0)
     * @param {number} [config.magnetProximityPercent] - % proximity to liquidation zone for magnet signal (default: 1.5)
     */
    constructor(config = {}) {
        this.symbols = (config.symbols || ['BTCUSDT', 'ETHUSDT']).map(s => s.toUpperCase());
        this.pollIntervalMs = config.pollIntervalMs || 60000;
        this.exchange = config.exchange || 'binance';

        // Premium: CoinGlass
        this.coinglass = {
            apiKey: config.coinglass?.apiKey || process.env.COINGLASS_API_KEY || '',
            apiBase: config.coinglass?.apiBase || 'https://open-api-v3.coinglass.com/api',
            enabled: false
        };
        this.coinglass.enabled = !!this.coinglass.apiKey;

        // x402 autonomous payments for premium data
        this.x402 = {
            client: config.x402?.client || null,
            autoPayPremium: config.x402?.autoPayPremium ?? false,
            maxPaymentPerDay: config.x402?.maxPaymentPerDay || 0,
            dailySpent: 0,
            lastResetDay: new Date().toDateString()
        };

        // Signal thresholds
        this.cascadeThresholdUsd = config.cascadeThresholdUsd || 10_000_000;  // $10M
        this.squeezeRatioThreshold = config.squeezeRatioThreshold || 2.0;
        this.magnetProximityPercent = config.magnetProximityPercent || 1.5;

        // State per symbol
        this.data = {};
        for (const symbol of this.symbols) {
            this.data[symbol] = {
                openInterest: { value: 0, change24h: 0, timestamp: 0 },
                fundingRate: { rate: 0, nextFundingTime: 0, timestamp: 0 },
                longShortRatio: { ratio: 0, longPercent: 0, shortPercent: 0, timestamp: 0 },
                liquidations: { recent: [], volume24h: { long: 0, short: 0 }, timestamp: 0 },
                heatmap: { levels: [], source: 'none', timestamp: 0 },
                signals: [],
                lastUpdate: 0
            };
        }

        this._running = false;
        this._pollTimer = null;
        this._liqWs = null;
        this._reconnectAttempts = 0;
    }

    /**
     * Start collecting liquidation intelligence.
     */
    async start() {
        this._running = true;
        console.log(`🔥 LiquidationIntelligence starting for: ${this.symbols.join(', ')}`);
        console.log(`   Exchange: ${this.exchange} | Premium: ${this.coinglass.enabled ? 'CoinGlass ✓' : 'Free tier'} | x402: ${this.x402.client ? 'enabled' : 'disabled'}`);

        // Initial data fetch
        await this._fetchAll();

        // Connect to liquidation WebSocket stream (Binance)
        if (this.exchange === 'binance') {
            try {
                await this._connectLiquidationStream();
            } catch (error) {
                console.warn(`⚠️ [LiqIntel] Liquidation stream failed: ${error.message}`);
            }
        }

        // Start polling for OI, Funding, L/S Ratio
        this._pollTimer = setInterval(() => {
            if (this._running) this._fetchAll();
        }, this.pollIntervalMs);
    }

    /**
     * Stop all data collection.
     */
    stop() {
        this._running = false;
        if (this._pollTimer) {
            clearInterval(this._pollTimer);
            this._pollTimer = null;
        }
        if (this._liqWs) {
            this._liqWs.close();
            this._liqWs = null;
        }
        console.log('🔥 LiquidationIntelligence stopped.');
    }

    /**
     * Get full liquidation context for a symbol (for LLM consumption).
     * @param {string} symbol
     * @returns {object} Structured context for trading decisions
     */
    getContext(symbol) {
        const s = symbol.toUpperCase();
        const d = this.data[s];
        if (!d) return null;

        const signals = this._generateSignals(s);

        return {
            symbol: s,
            openInterest: d.openInterest,
            fundingRate: d.fundingRate,
            longShortRatio: d.longShortRatio,
            liquidations24h: d.liquidations.volume24h,
            heatmap: d.heatmap.levels.length > 0 ? {
                source: d.heatmap.source,
                zones: d.heatmap.levels.slice(0, 10) // Top 10 zones
            } : null,
            signals,
            summary: this._buildSummary(s, signals),
            lastUpdate: d.lastUpdate
        };
    }

    /**
     * Get a formatted string context for all symbols (for LLM prompt injection).
     * @returns {string}
     */
    getLLMContext() {
        const parts = [];

        for (const symbol of this.symbols) {
            const ctx = this.getContext(symbol);
            if (!ctx) continue;

            parts.push(ctx.summary);
        }

        if (parts.length === 0) return 'LIQUIDATION CONTEXT: No data available.';

        return `LIQUIDATION CONTEXT:\n${parts.join('\n\n')}`;
    }

    /**
     * Get snapshot of all tracked symbols.
     * @returns {object}
     */
    getSnapshot() {
        const snapshot = {};
        for (const symbol of this.symbols) {
            snapshot[symbol] = this.getContext(symbol);
        }
        return snapshot;
    }

    // ═══════════════════════════════════════
    //  DATA FETCHING
    // ═══════════════════════════════════════

    async _fetchAll() {
        const fetches = [];

        for (const symbol of this.symbols) {
            if (this.exchange === 'binance') {
                fetches.push(this._fetchBinanceOI(symbol));
                fetches.push(this._fetchBinanceFunding(symbol));
                fetches.push(this._fetchBinanceLSRatio(symbol));
            } else if (this.exchange === 'bybit') {
                fetches.push(this._fetchBybitOI(symbol));
                fetches.push(this._fetchBybitFunding(symbol));
            }

            // Premium: CoinGlass heatmap
            if (this.coinglass.enabled) {
                fetches.push(this._fetchCoinGlassHeatmap(symbol));
            }

            // x402: Try to access premium data via payment
            if (this.x402.client && this.x402.autoPayPremium && !this.coinglass.enabled) {
                fetches.push(this._fetchPremiumViaX402(symbol));
            }
        }

        await Promise.allSettled(fetches);

        // Generate and emit signals
        for (const symbol of this.symbols) {
            this.data[symbol].lastUpdate = Date.now();
            const signals = this._generateSignals(symbol);
            this.data[symbol].signals = signals;

            if (signals.length > 0) {
                for (const signal of signals) {
                    eventBus.emit('liquidation:signal', { symbol, ...signal });

                    if (signal.type === 'CASCADE_RISK') {
                        eventBus.emit('liquidation:cascade', { symbol, ...signal });
                    }
                }
            }

            eventBus.emit('liquidation:update', { symbol, data: this.data[symbol] });
        }
    }

    // --- Binance Futures API (FREE) ---

    async _fetchBinanceOI(symbol) {
        try {
            const url = `https://fapi.binance.com/fapi/v1/openInterest?symbol=${symbol}`;
            const response = await fetch(url);
            if (!response.ok) return;

            const data = await response.json();
            const value = parseFloat(data.openInterest);

            // Also get OI statistics for 24h change
            const statsUrl = `https://fapi.binance.com/futures/data/openInterestHist?symbol=${symbol}&period=1h&limit=24`;
            const statsResp = await fetch(statsUrl);
            let change24h = 0;

            if (statsResp.ok) {
                const stats = await statsResp.json();
                if (stats.length >= 2) {
                    const oldest = parseFloat(stats[0].sumOpenInterest);
                    const newest = parseFloat(stats[stats.length - 1].sumOpenInterest);
                    change24h = oldest > 0 ? ((newest - oldest) / oldest) * 100 : 0;
                }
            }

            this.data[symbol].openInterest = {
                value,
                change24h: Math.round(change24h * 100) / 100,
                timestamp: Date.now()
            };
        } catch (error) {
            console.warn(`⚠️ [LiqIntel] Binance OI fetch failed for ${symbol}: ${error.message}`);
        }
    }

    async _fetchBinanceFunding(symbol) {
        try {
            const url = `https://fapi.binance.com/fapi/v1/premiumIndex?symbol=${symbol}`;
            const response = await fetch(url);
            if (!response.ok) return;

            const data = await response.json();

            this.data[symbol].fundingRate = {
                rate: parseFloat(data.lastFundingRate),
                markPrice: parseFloat(data.markPrice),
                indexPrice: parseFloat(data.indexPrice),
                nextFundingTime: data.nextFundingTime,
                timestamp: Date.now()
            };
        } catch (error) {
            console.warn(`⚠️ [LiqIntel] Binance Funding fetch failed for ${symbol}: ${error.message}`);
        }
    }

    async _fetchBinanceLSRatio(symbol) {
        try {
            // Global long/short account ratio
            const url = `https://fapi.binance.com/futures/data/globalLongShortAccountRatio?symbol=${symbol}&period=1h&limit=1`;
            const response = await fetch(url);
            if (!response.ok) return;

            const data = await response.json();
            if (data.length === 0) return;

            const latest = data[0];
            const ratio = parseFloat(latest.longShortRatio);

            this.data[symbol].longShortRatio = {
                ratio,
                longPercent: parseFloat(latest.longAccount) * 100,
                shortPercent: parseFloat(latest.shortAccount) * 100,
                timestamp: Date.now()
            };
        } catch (error) {
            console.warn(`⚠️ [LiqIntel] Binance L/S Ratio fetch failed for ${symbol}: ${error.message}`);
        }
    }

    // --- Bybit API (FREE) ---

    async _fetchBybitOI(symbol) {
        try {
            const url = `https://api.bybit.com/v5/market/open-interest?category=linear&symbol=${symbol}&intervalTime=1h&limit=24`;
            const response = await fetch(url);
            if (!response.ok) return;

            const json = await response.json();
            if (json.retCode !== 0 || !json.result?.list?.length) return;

            const list = json.result.list;
            const latest = parseFloat(list[0].openInterest);
            const oldest = parseFloat(list[list.length - 1].openInterest);
            const change24h = oldest > 0 ? ((latest - oldest) / oldest) * 100 : 0;

            this.data[symbol].openInterest = {
                value: latest,
                change24h: Math.round(change24h * 100) / 100,
                timestamp: Date.now()
            };
        } catch (error) {
            console.warn(`⚠️ [LiqIntel] Bybit OI fetch failed for ${symbol}: ${error.message}`);
        }
    }

    async _fetchBybitFunding(symbol) {
        try {
            const url = `https://api.bybit.com/v5/market/tickers?category=linear&symbol=${symbol}`;
            const response = await fetch(url);
            if (!response.ok) return;

            const json = await response.json();
            if (json.retCode !== 0 || !json.result?.list?.length) return;

            const ticker = json.result.list[0];

            this.data[symbol].fundingRate = {
                rate: parseFloat(ticker.fundingRate),
                markPrice: parseFloat(ticker.markPrice),
                indexPrice: parseFloat(ticker.indexPrice),
                nextFundingTime: parseInt(ticker.nextFundingTime),
                timestamp: Date.now()
            };
        } catch (error) {
            console.warn(`⚠️ [LiqIntel] Bybit Funding fetch failed for ${symbol}: ${error.message}`);
        }
    }

    // --- CoinGlass Premium API ---

    async _fetchCoinGlassHeatmap(symbol) {
        try {
            // Strip USDT suffix for CoinGlass
            const coin = symbol.replace(/USDT$/i, '');
            const url = `${this.coinglass.apiBase}/futures/liquidation/info?symbol=${coin}`;

            const response = await fetch(url, {
                headers: {
                    'coinglassSecret': this.coinglass.apiKey,
                    'Accept': 'application/json'
                }
            });

            if (!response.ok) {
                if (response.status === 402 && this.x402.client && this.x402.autoPayPremium) {
                    console.log(`🔒 [LiqIntel] CoinGlass requires payment. Attempting x402...`);
                    return this._handleX402Payment(url, symbol);
                }
                return;
            }

            const json = await response.json();
            if (json.code !== '0' || !json.data) return;

            // Parse liquidation levels into zones
            const levels = this._parseCoinGlassLevels(json.data, symbol);

            this.data[symbol].heatmap = {
                levels,
                source: 'coinglass',
                timestamp: Date.now()
            };

        } catch (error) {
            console.warn(`⚠️ [LiqIntel] CoinGlass fetch failed for ${symbol}: ${error.message}`);
        }
    }

    // --- x402 Premium Data Payment ---

    async _fetchPremiumViaX402(symbol) {
        if (!this.x402.client) return;

        // Reset daily counter
        const today = new Date().toDateString();
        if (this.x402.lastResetDay !== today) {
            this.x402.dailySpent = 0;
            this.x402.lastResetDay = today;
        }

        // Check daily limit
        if (this.x402.maxPaymentPerDay > 0 && this.x402.dailySpent >= this.x402.maxPaymentPerDay) {
            return;
        }

        try {
            const coin = symbol.replace(/USDT$/i, '');
            // Use x402 to fetch premium liquidation data
            // The x402 client handles 402 responses and payment automatically
            const url = `https://open-api-v3.coinglass.com/api/futures/liquidation/info?symbol=${coin}`;

            const response = await this.x402.client.fetch(url, {
                headers: { 'Accept': 'application/json' }
            });

            if (!response.ok) return;

            const json = await response.json();
            if (json.code !== '0' || !json.data) return;

            const levels = this._parseCoinGlassLevels(json.data, symbol);

            this.data[symbol].heatmap = {
                levels,
                source: 'coinglass-x402',
                timestamp: Date.now()
            };

            console.log(`💰 [LiqIntel] Premium heatmap acquired via x402 for ${symbol}`);

        } catch (error) {
            console.warn(`⚠️ [LiqIntel] x402 premium fetch failed for ${symbol}: ${error.message}`);
        }
    }

    async _handleX402Payment(url, symbol) {
        if (!this.x402.client || !this.x402.autoPayPremium) return;

        try {
            const response = await this.x402.client.fetch(url, {
                headers: {
                    'coinglassSecret': this.coinglass.apiKey,
                    'Accept': 'application/json'
                }
            });

            if (!response.ok) return;

            const json = await response.json();
            if (json.code !== '0' || !json.data) return;

            const levels = this._parseCoinGlassLevels(json.data, symbol);

            this.data[symbol].heatmap = {
                levels,
                source: 'coinglass-x402',
                timestamp: Date.now()
            };

        } catch (error) {
            console.warn(`⚠️ [LiqIntel] x402 payment flow failed: ${error.message}`);
        }
    }

    _parseCoinGlassLevels(data, symbol) {
        const levels = [];

        // CoinGlass returns liquidation data in various formats
        // Normalize to our standard format: { price, side, volumeUsd }
        if (Array.isArray(data)) {
            for (const entry of data) {
                if (entry.price && entry.vol) {
                    levels.push({
                        price: parseFloat(entry.price),
                        side: entry.side || (entry.type === 1 ? 'long' : 'short'),
                        volumeUsd: parseFloat(entry.vol),
                        exchange: entry.exchangeName || 'aggregated'
                    });
                }
            }
        } else if (data.liqHeatMap) {
            // Heatmap format
            for (const point of data.liqHeatMap) {
                levels.push({
                    price: parseFloat(point[0]),
                    side: 'mixed',
                    volumeUsd: parseFloat(point[1]),
                    exchange: 'aggregated'
                });
            }
        }

        // Sort by volume (highest first)
        levels.sort((a, b) => b.volumeUsd - a.volumeUsd);

        return levels;
    }

    // --- Binance Liquidation WebSocket Stream ---

    async _connectLiquidationStream() {
        // Binance forceOrder stream for all symbols
        const streams = this.symbols.map(s => `${s.toLowerCase()}@forceOrder`).join('/');
        const url = `wss://fstream.binance.com/stream?streams=${streams}`;

        return new Promise((resolve, reject) => {
            this._liqWs = new WebSocket(url);

            const timeout = setTimeout(() => {
                if (this._liqWs && this._liqWs.readyState !== WebSocket.OPEN) {
                    this._liqWs.close();
                    reject(new Error('Liquidation stream timeout'));
                }
            }, 10000);

            this._liqWs.on('open', () => {
                clearTimeout(timeout);
                this._reconnectAttempts = 0;
                console.log('🔥 Connected to Binance liquidation stream.');
                resolve();
            });

            this._liqWs.on('message', (raw) => {
                try {
                    const msg = JSON.parse(raw.toString());
                    if (msg.data?.o) {
                        this._processLiquidation(msg.data.o);
                    }
                } catch { /* ignore parse errors */ }
            });

            this._liqWs.on('close', () => {
                clearTimeout(timeout);
                if (this._running) {
                    this._scheduleLiqReconnect();
                }
            });

            this._liqWs.on('error', (err) => {
                clearTimeout(timeout);
                if (this._liqWs?.readyState !== WebSocket.OPEN) {
                    reject(err);
                }
            });
        });
    }

    _scheduleLiqReconnect() {
        if (!this._running || this._reconnectAttempts >= 10) return;

        const delay = Math.min(1000 * Math.pow(2, this._reconnectAttempts), 30000);
        this._reconnectAttempts++;

        setTimeout(async () => {
            try {
                await this._connectLiquidationStream();
            } catch {
                this._scheduleLiqReconnect();
            }
        }, delay);
    }

    _processLiquidation(order) {
        const symbol = order.s?.toUpperCase();
        if (!symbol || !this.data[symbol]) return;

        const liq = {
            symbol,
            side: order.S === 'BUY' ? 'short' : 'long', // Forced BUY = short liquidated
            price: parseFloat(order.p),
            quantity: parseFloat(order.q),
            usdValue: parseFloat(order.p) * parseFloat(order.q),
            timestamp: order.T || Date.now()
        };

        // Add to recent liquidations (keep last 100)
        this.data[symbol].liquidations.recent.push(liq);
        if (this.data[symbol].liquidations.recent.length > 100) {
            this.data[symbol].liquidations.recent = this.data[symbol].liquidations.recent.slice(-100);
        }

        // Update 24h volume
        this._updateLiqVolume24h(symbol);

        // Check for cascade
        const recentWindow = this.data[symbol].liquidations.recent.filter(
            l => l.timestamp > Date.now() - 60000 // last 60 seconds
        );
        const recentVolume = recentWindow.reduce((sum, l) => sum + l.usdValue, 0);

        if (recentVolume > this.cascadeThresholdUsd) {
            const dominantSide = this._getDominantLiqSide(recentWindow);
            eventBus.emit('liquidation:cascade', {
                symbol,
                volumeUsd: recentVolume,
                count: recentWindow.length,
                dominantSide,
                timestamp: Date.now()
            });
            console.log(`🔥🔥 [LiqIntel] CASCADE detected on ${symbol}! $${(recentVolume / 1e6).toFixed(1)}M in 60s (${dominantSide}s liquidated)`);
        }
    }

    _updateLiqVolume24h(symbol) {
        const cutoff = Date.now() - 24 * 60 * 60 * 1000;
        const recent = this.data[symbol].liquidations.recent.filter(l => l.timestamp > cutoff);

        let longVol = 0;
        let shortVol = 0;

        for (const liq of recent) {
            if (liq.side === 'long') longVol += liq.usdValue;
            else shortVol += liq.usdValue;
        }

        this.data[symbol].liquidations.volume24h = {
            long: longVol,
            short: shortVol,
            total: longVol + shortVol
        };
        this.data[symbol].liquidations.timestamp = Date.now();
    }

    _getDominantLiqSide(liquidations) {
        let longVol = 0;
        let shortVol = 0;
        for (const l of liquidations) {
            if (l.side === 'long') longVol += l.usdValue;
            else shortVol += l.usdValue;
        }
        return longVol > shortVol ? 'long' : 'short';
    }

    // ═══════════════════════════════════════
    //  SIGNAL GENERATION
    // ═══════════════════════════════════════

    _generateSignals(symbol) {
        const d = this.data[symbol];
        const signals = [];

        // 1. SQUEEZE_POTENTIAL — Extreme L/S imbalance
        if (d.longShortRatio.ratio > 0) {
            const ratio = d.longShortRatio.ratio;

            if (ratio >= this.squeezeRatioThreshold) {
                signals.push({
                    type: 'SQUEEZE_POTENTIAL',
                    direction: 'SHORT_SQUEEZE',
                    strength: Math.min(10, (ratio / this.squeezeRatioThreshold) * 7),
                    detail: `L/S ratio ${ratio.toFixed(2)} — heavy long bias. Short squeeze likely if price breaks resistance.`,
                    data: { ratio, longPercent: d.longShortRatio.longPercent }
                });
            } else if (ratio <= 1 / this.squeezeRatioThreshold) {
                signals.push({
                    type: 'SQUEEZE_POTENTIAL',
                    direction: 'LONG_SQUEEZE',
                    strength: Math.min(10, ((1 / ratio) / this.squeezeRatioThreshold) * 7),
                    detail: `L/S ratio ${ratio.toFixed(2)} — heavy short bias. Long squeeze likely if price breaks support.`,
                    data: { ratio, shortPercent: d.longShortRatio.shortPercent }
                });
            }
        }

        // 2. IMBALANCE — Funding rate extreme
        if (d.fundingRate.rate !== 0) {
            const absRate = Math.abs(d.fundingRate.rate);

            if (absRate > 0.001) { // > 0.1% — significant
                const direction = d.fundingRate.rate > 0 ? 'BEARISH' : 'BULLISH';
                signals.push({
                    type: 'IMBALANCE',
                    direction,
                    strength: Math.min(10, (absRate / 0.001) * 5),
                    detail: `Funding rate ${(d.fundingRate.rate * 100).toFixed(4)}% — ${direction === 'BEARISH' ? 'longs paying shorts (crowded long)' : 'shorts paying longs (crowded short)'}. Contrarian signal.`,
                    data: { fundingRate: d.fundingRate.rate }
                });
            }
        }

        // 3. CASCADE_RISK — High recent liquidation volume
        const recentLiqs = d.liquidations.recent.filter(l => l.timestamp > Date.now() - 300000); // 5 min
        const recentVolume = recentLiqs.reduce((sum, l) => sum + l.usdValue, 0);

        if (recentVolume > this.cascadeThresholdUsd * 0.5) {
            const dominantSide = this._getDominantLiqSide(recentLiqs);
            signals.push({
                type: 'CASCADE_RISK',
                direction: dominantSide === 'long' ? 'BEARISH' : 'BULLISH',
                strength: Math.min(10, (recentVolume / this.cascadeThresholdUsd) * 8),
                detail: `$${(recentVolume / 1e6).toFixed(1)}M liquidated in 5min (${dominantSide}s). Cascade risk elevated.`,
                data: { volumeUsd: recentVolume, dominantSide, count: recentLiqs.length }
            });
        }

        // 4. LIQUIDATION_MAGNET — Price approaching dense liquidation zone (requires heatmap)
        if (d.heatmap.levels.length > 0 && d.fundingRate.markPrice > 0) {
            const currentPrice = d.fundingRate.markPrice;
            const proximityThreshold = currentPrice * (this.magnetProximityPercent / 100);

            for (const level of d.heatmap.levels.slice(0, 5)) { // Top 5 zones
                const distance = Math.abs(level.price - currentPrice);

                if (distance < proximityThreshold && distance > 0) {
                    const direction = level.price > currentPrice ? 'BULLISH' : 'BEARISH';
                    signals.push({
                        type: 'LIQUIDATION_MAGNET',
                        direction,
                        strength: Math.min(10, (1 - distance / proximityThreshold) * 9),
                        detail: `$${(level.volumeUsd / 1e6).toFixed(1)}M in liquidations at $${level.price.toFixed(0)} (${((distance / currentPrice) * 100).toFixed(2)}% away). Price magnet ${direction === 'BULLISH' ? 'above' : 'below'}.`,
                        data: { targetPrice: level.price, volumeUsd: level.volumeUsd, distance }
                    });
                    break; // Only report closest magnet
                }
            }
        }

        // 5. OI_DIVERGENCE — Open Interest rising/falling significantly
        if (Math.abs(d.openInterest.change24h) > 10) {
            const direction = d.openInterest.change24h > 0 ? 'RISING' : 'FALLING';
            signals.push({
                type: 'OI_DIVERGENCE',
                direction,
                strength: Math.min(10, Math.abs(d.openInterest.change24h) / 5),
                detail: `Open Interest ${direction} ${Math.abs(d.openInterest.change24h).toFixed(1)}% in 24h. ${direction === 'RISING' ? 'New positions entering — trend continuation likely.' : 'Positions closing — trend exhaustion possible.'}`,
                data: { change24h: d.openInterest.change24h, value: d.openInterest.value }
            });
        }

        return signals;
    }

    // ═══════════════════════════════════════
    //  LLM SUMMARY BUILDER
    // ═══════════════════════════════════════

    _buildSummary(symbol, signals) {
        const d = this.data[symbol];
        const lines = [`${symbol}:`];

        // Open Interest
        if (d.openInterest.value > 0) {
            lines.push(`  OI: ${this._formatNumber(d.openInterest.value)} (${d.openInterest.change24h > 0 ? '+' : ''}${d.openInterest.change24h}% 24h)`);
        }

        // Funding Rate
        if (d.fundingRate.rate !== 0) {
            const rateStr = (d.fundingRate.rate * 100).toFixed(4);
            const bias = d.fundingRate.rate > 0 ? 'longs paying' : 'shorts paying';
            lines.push(`  Funding: ${rateStr}% (${bias})`);
        }

        // Long/Short Ratio
        if (d.longShortRatio.ratio > 0) {
            lines.push(`  L/S Ratio: ${d.longShortRatio.ratio.toFixed(2)} (Long: ${d.longShortRatio.longPercent.toFixed(1)}% | Short: ${d.longShortRatio.shortPercent.toFixed(1)}%)`);
        }

        // Liquidation volume
        const liqVol = d.liquidations.volume24h;
        if (liqVol.total > 0) {
            lines.push(`  Liquidations 24h: $${this._formatNumber(liqVol.total)} (Long: $${this._formatNumber(liqVol.long)} | Short: $${this._formatNumber(liqVol.short)})`);
        }

        // Heatmap
        if (d.heatmap.levels.length > 0) {
            const top = d.heatmap.levels[0];
            lines.push(`  Largest liq zone: $${top.price.toFixed(0)} ($${this._formatNumber(top.volumeUsd)}) [${d.heatmap.source}]`);
        }

        // Signals
        if (signals.length > 0) {
            lines.push(`  Signals:`);
            for (const sig of signals) {
                lines.push(`    → ${sig.type} (${sig.direction}, strength: ${sig.strength.toFixed(1)}/10): ${sig.detail}`);
            }
        }

        return lines.join('\n');
    }

    _formatNumber(num) {
        if (num >= 1e9) return `${(num / 1e9).toFixed(2)}B`;
        if (num >= 1e6) return `${(num / 1e6).toFixed(2)}M`;
        if (num >= 1e3) return `${(num / 1e3).toFixed(1)}K`;
        return num.toFixed(2);
    }
}
