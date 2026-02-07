/**
 * RiskManager — Position sizing, exposure limits, and risk gating.
 * 
 * Works alongside SurvivalManager to adapt risk parameters based on agent health.
 * Does NOT depend on SurvivalManager directly — receives state via method params.
 */
export class RiskManager {
    /**
     * @param {object} config
     * @param {number} [config.maxPositions] - Maximum concurrent open positions (default 5)
     * @param {number} [config.maxExposurePercent] - Max total exposure as % of balance (default 80)
     * @param {number} [config.maxPerAssetPercent] - Max exposure per single asset as % of balance (default 30)
     * @param {number} [config.defaultRiskPercent] - Default risk per trade as % of balance (default 2)
     * @param {number} [config.maxLeverage] - Absolute max leverage allowed (default 20)
     * @param {number} [config.minConfidence] - Minimum LLM confidence to allow a trade (default 0.6)
     */
    constructor(config = {}) {
        this.maxPositions = config.maxPositions || parseInt(process.env.MAX_POSITIONS) || 5;
        this.maxExposurePercent = config.maxExposurePercent || parseInt(process.env.MAX_EXPOSURE_PERCENT) || 80;
        this.maxPerAssetPercent = config.maxPerAssetPercent || parseInt(process.env.MAX_PER_ASSET_PERCENT) || 30;
        this.defaultRiskPercent = config.defaultRiskPercent || parseFloat(process.env.RISK_PER_TRADE) || 2;
        this.maxLeverage = config.maxLeverage || parseInt(process.env.MAX_LEVERAGE) || 20;
        this.minConfidence = config.minConfidence || parseFloat(process.env.MIN_CONFIDENCE) || 0.6;

        // Survival state multipliers — adjust limits based on agent health
        this.survivalMultipliers = {
            GROWTH:    { risk: 1.5, leverage: 1.0, positions: 1.5, confidence: 0.8 },
            SURVIVAL:  { risk: 1.0, leverage: 1.0, positions: 1.0, confidence: 1.0 },
            DEFENSIVE: { risk: 0.5, leverage: 0.5, positions: 0.5, confidence: 1.3 },
            RECOVERY:  { risk: 0.7, leverage: 0.7, positions: 0.7, confidence: 1.2 },
            CRITICAL:  { risk: 0.0, leverage: 0.0, positions: 0.0, confidence: 9.9 }
        };

        console.log(`🛡️ RiskManager active. Max positions: ${this.maxPositions} | Risk/trade: ${this.defaultRiskPercent}% | Max leverage: ${this.maxLeverage}x`);
    }

    /**
     * Check whether a new position can be opened.
     * @param {object} signal - The trading decision { action, symbol, confidence, leverage }
     * @param {object} portfolio - Current portfolio state
     * @param {number} portfolio.balance - Current balance
     * @param {number} portfolio.totalExposure - Current total exposure
     * @param {number} portfolio.positionCount - Number of open positions
     * @param {Array}  portfolio.positions - Array of open positions
     * @param {string} survivalState - Current survival mode ('GROWTH', 'SURVIVAL', 'DEFENSIVE', 'CRITICAL')
     * @returns {{ allowed: boolean, reason: string, adjustedLeverage: number, adjustedSize: number }}
     */
    canOpenPosition(signal, portfolio, survivalState = 'SURVIVAL') {
        const mult = this.survivalMultipliers[survivalState] || this.survivalMultipliers.SURVIVAL;

        // 1. CRITICAL state — no trading allowed
        if (survivalState === 'CRITICAL') {
            return { allowed: false, reason: 'Agent in CRITICAL state. No trading allowed.', adjustedLeverage: 0, adjustedSize: 0 };
        }

        // 2. Confidence check
        const requiredConfidence = this.minConfidence * mult.confidence;
        if ((signal.confidence || 0) < requiredConfidence) {
            return {
                allowed: false,
                reason: `Confidence ${signal.confidence} below threshold ${requiredConfidence.toFixed(2)} (survival: ${survivalState})`,
                adjustedLeverage: 0,
                adjustedSize: 0
            };
        }

        // 3. Max positions check
        const effectiveMaxPositions = Math.floor(this.maxPositions * mult.positions);
        if (portfolio.positionCount >= effectiveMaxPositions) {
            return {
                allowed: false,
                reason: `Max positions reached: ${portfolio.positionCount}/${effectiveMaxPositions} (survival: ${survivalState})`,
                adjustedLeverage: 0,
                adjustedSize: 0
            };
        }

        // 4. Calculate adjusted leverage
        const requestedLeverage = signal.leverage || 5;
        const effectiveMaxLeverage = Math.floor(this.maxLeverage * mult.leverage);
        const adjustedLeverage = Math.max(1, Math.min(requestedLeverage, effectiveMaxLeverage));

        // 5. Calculate position size
        const riskPercent = this.defaultRiskPercent * mult.risk;
        const adjustedSize = this.calculatePositionSize(portfolio.balance, riskPercent);

        // 6. Total exposure check
        const maxExposure = portfolio.balance * (this.maxExposurePercent / 100);
        const newExposure = portfolio.totalExposure + (adjustedSize * adjustedLeverage);
        if (newExposure > maxExposure) {
            return {
                allowed: false,
                reason: `Would exceed max exposure: $${newExposure.toFixed(0)} > $${maxExposure.toFixed(0)}`,
                adjustedLeverage,
                adjustedSize: 0
            };
        }

        // 7. Per-asset exposure check
        const maxPerAsset = portfolio.balance * (this.maxPerAssetPercent / 100);
        const currentAssetExposure = (portfolio.positions || [])
            .filter(p => p.symbol === signal.symbol)
            .reduce((sum, p) => sum + (p.size * p.leverage), 0);

        if (currentAssetExposure + (adjustedSize * adjustedLeverage) > maxPerAsset) {
            return {
                allowed: false,
                reason: `Would exceed per-asset limit for ${signal.symbol}: $${(currentAssetExposure + adjustedSize * adjustedLeverage).toFixed(0)} > $${maxPerAsset.toFixed(0)}`,
                adjustedLeverage,
                adjustedSize: 0
            };
        }

        return {
            allowed: true,
            reason: 'Trade approved',
            adjustedLeverage,
            adjustedSize
        };
    }

    /**
     * Calculate position size based on balance and risk percentage.
     * @param {number} balance - Current account balance
     * @param {number} riskPercent - Risk per trade as percentage of balance
     * @param {number} [stopDistancePercent] - Optional stop distance for precise sizing
     * @returns {number} Position size in USD
     */
    calculatePositionSize(balance, riskPercent = this.defaultRiskPercent, stopDistancePercent = null) {
        const riskAmount = balance * (riskPercent / 100);

        if (stopDistancePercent && stopDistancePercent > 0) {
            // Size = Risk Amount / Stop Distance
            return riskAmount / (stopDistancePercent / 100);
        }

        // Default: risk amount is the position size
        return riskAmount;
    }

    /**
     * Calculate a stop-loss price based on entry and ATR.
     * @param {number} entryPrice
     * @param {string} side - 'buy' or 'sell'
     * @param {number} atr - Average True Range
     * @param {number} [multiplier] - ATR multiplier (default 2)
     * @returns {number} Stop-loss price
     */
    getStopLoss(entryPrice, side, atr, multiplier = 2) {
        if (!atr || atr <= 0) {
            // Fallback: 3% stop
            const fallbackDistance = entryPrice * 0.03;
            return side === 'buy' ? entryPrice - fallbackDistance : entryPrice + fallbackDistance;
        }

        const distance = atr * multiplier;
        return side === 'buy' ? entryPrice - distance : entryPrice + distance;
    }

    /**
     * Calculate a take-profit price based on risk/reward ratio.
     * @param {number} entryPrice
     * @param {string} side - 'buy' or 'sell'
     * @param {number} stopLoss - Stop-loss price
     * @param {number} [riskRewardRatio] - R:R ratio (default 2)
     * @returns {number} Take-profit price
     */
    getTakeProfit(entryPrice, side, stopLoss, riskRewardRatio = 2) {
        const riskDistance = Math.abs(entryPrice - stopLoss);
        const rewardDistance = riskDistance * riskRewardRatio;

        return side === 'buy' ? entryPrice + rewardDistance : entryPrice - rewardDistance;
    }

    /**
     * Get current effective limits based on survival state.
     * @param {string} survivalState
     * @returns {object}
     */
    getEffectiveLimits(survivalState = 'SURVIVAL') {
        const mult = this.survivalMultipliers[survivalState] || this.survivalMultipliers.SURVIVAL;
        return {
            maxPositions: Math.floor(this.maxPositions * mult.positions),
            maxLeverage: Math.floor(this.maxLeverage * mult.leverage),
            riskPercent: this.defaultRiskPercent * mult.risk,
            minConfidence: this.minConfidence * mult.confidence,
            survivalState
        };
    }
}
