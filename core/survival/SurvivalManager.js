import { eventBus } from '../EventBus.js';

/**
 * SurvivalManager (Project Heartbeat)
 * 
 * Manages the "biological" state of the agent based on its economic health.
 * Applies evolutionary pressure by adjusting behavior dynamically.
 * 
 * States: GROWTH → SURVIVAL → RECOVERY → DEFENSIVE → CRITICAL
 * 
 * Features:
 *   - Hysteresis: requires N consecutive ticks in a new zone before switching
 *   - RECOVERY state: transitional phase from DEFENSIVE back to SURVIVAL
 *   - Graceful shutdown: emits agent:shutdown instead of process.exit()
 *   - EventBus integration: emits survival:change on every state transition
 */
export class SurvivalManager {
    /**
     * @param {object} config
     * @param {number} config.initialBalance - The starting capital (Equity)
     * @param {object} [config.x402Client] - Optional x402 client for managing expenses
     * @param {function} [config.onPanic] - Callback when entering panic mode
     * @param {function} [config.onGrowth] - Callback when entering growth mode
     * @param {function} [config.onSurvival] - Callback when entering survival mode
     * @param {function} [config.onDefensive] - Callback when entering defensive mode
     * @param {function} [config.onRecovery] - Callback when entering recovery mode
     * @param {function} [config.onCritical] - Callback when entering critical mode (replaces process.exit)
     * @param {number}   [config.hysteresisThreshold] - Consecutive ticks required before state change (default 3)
     */
    constructor(config) {
        this.initialBalance = config.initialBalance;
        this.currentBalance = config.initialBalance;
        this.x402Client = config.x402Client || null;

        this.callbacks = {
            onPanic: config.onPanic || (() => { }),
            onGrowth: config.onGrowth || (() => { }),
            onSurvival: config.onSurvival || (() => { }),
            onDefensive: config.onDefensive || config.onPanic || (() => { }),
            onRecovery: config.onRecovery || (() => { }),
            onCritical: config.onCritical || (() => { })
        };

        this.state = 'SURVIVAL'; // Start in neutral state
        this.previousState = null;

        // Hysteresis: prevent rapid state oscillation
        this.hysteresisThreshold = config.hysteresisThreshold || 3;
        this._pendingState = null;
        this._pendingCount = 0;

        // History for debugging
        this.stateHistory = [];

        console.log(`💓 Survival Manager Active. Baseline Equity: ${this.initialBalance}`);
    }

    /**
     * Updates the health status based on new balance data.
     * @param {number} newBalance - Current total equity (Wallet + Exchange Account)
     */
    updateVitalSigns(newBalance) {
        this.currentBalance = newBalance;
        const healthRatio = (this.currentBalance / this.initialBalance);

        // Determine target state based on ratio
        let targetState;
        if (healthRatio >= 1.20) {
            targetState = 'GROWTH';
        } else if (healthRatio <= 0.50) {
            targetState = 'CRITICAL';
        } else if (healthRatio <= 0.85 && healthRatio > 0.50) {
            // If coming from DEFENSIVE and improving, go to RECOVERY first
            if (this.state === 'DEFENSIVE' && healthRatio > 0.70) {
                targetState = 'RECOVERY';
            } else {
                targetState = 'DEFENSIVE';
            }
        } else if (this.state === 'RECOVERY' && healthRatio < 1.0) {
            // Stay in RECOVERY until we reach neutral territory
            targetState = 'RECOVERY';
        } else {
            targetState = 'SURVIVAL';
        }

        // CRITICAL bypasses hysteresis — immediate transition
        if (targetState === 'CRITICAL') {
            this._pendingState = null;
            this._pendingCount = 0;
            this._setMode('CRITICAL', healthRatio);
            return this.state;
        }

        // Hysteresis: require N consecutive ticks before changing state
        if (targetState !== this.state) {
            if (this._pendingState === targetState) {
                this._pendingCount++;
            } else {
                this._pendingState = targetState;
                this._pendingCount = 1;
            }

            if (this._pendingCount >= this.hysteresisThreshold) {
                this._setMode(targetState, healthRatio);
                this._pendingState = null;
                this._pendingCount = 0;
            }
        } else {
            // Already in target state, reset pending
            this._pendingState = null;
            this._pendingCount = 0;
        }

        return this.state;
    }

    /**
     * Internal state transition handler.
     * @private
     */
    _setMode(newMode, ratio) {
        if (this.state === newMode) return;

        const percentage = ((ratio - 1) * 100).toFixed(2);
        const fromState = this.state;

        console.log(`\n🔄 METABOLISM CHANGE: ${fromState} -> ${newMode} (P&L: ${percentage}%)`);

        this.previousState = this.state;
        this.state = newMode;

        // Record in history
        this.stateHistory.push({
            from: fromState,
            to: newMode,
            ratio,
            timestamp: new Date().toISOString()
        });
        // Keep history bounded
        if (this.stateHistory.length > 100) {
            this.stateHistory = this.stateHistory.slice(-50);
        }

        // Emit event on EventBus
        eventBus.emit('survival:change', {
            from: fromState,
            to: newMode,
            ratio,
            pnlPercent: parseFloat(percentage),
            balance: this.currentBalance
        });

        switch (newMode) {
            case 'GROWTH':
                // Abundance: Spend on intel, take higher risks
                if (this.x402Client) {
                    console.log("🟢 [Growth] x402 Budget: UNLOCKED. Buying premium signals.");
                }
                this.callbacks.onGrowth();
                break;

            case 'SURVIVAL':
                // Neutral: Business as usual
                console.log("🔵 [Survival] Cruising altitude. Balanced risk.");
                this.callbacks.onSurvival();
                break;

            case 'RECOVERY':
                // Transitional: improving from DEFENSIVE, not yet SURVIVAL
                console.log("🟡 [Recovery] Conditions improving. Cautious optimism.");
                this.callbacks.onRecovery();
                break;

            case 'DEFENSIVE':
                // Hardship: Cut costs
                if (this.x402Client) {
                    console.log("🟠 [Defensive] x402 Budget: FROZEN. Cutting expenses.");
                }
                console.log("🟠 [Defensive] Risk lowered. Stick to safe setups.");
                this.callbacks.onDefensive();
                break;

            case 'CRITICAL':
                // Near Death: Graceful shutdown instead of process.exit()
                console.log("🔴 [CRITICAL] SYSTEMS FAILING. Initiating graceful shutdown to preserve capital.");
                if (this.x402Client) {
                    console.log("🔴 [CRITICAL] x402: TERMINATED.");
                }
                this.callbacks.onCritical();
                eventBus.emit('agent:shutdown', { reason: 'critical_capital_loss', balance: this.currentBalance });
                break;
        }
    }

    /**
     * Get current PnL in absolute terms.
     */
    getPnL() {
        return this.currentBalance - this.initialBalance;
    }

    /**
     * Get current health ratio.
     */
    getHealthRatio() {
        return this.currentBalance / this.initialBalance;
    }

    /**
     * Get state history for debugging.
     */
    getHistory() {
        return this.stateHistory;
    }
}
