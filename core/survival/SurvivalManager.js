/**
 * SurvivalManager (Project Heartbeat)
 * 
 * Manages the "biological" state of the agent based on its economic health.
 * Applies evolutionary pressure by adjusting behavior dynamically.
 */
export class SurvivalManager {
    /**
     * @param {object} config
     * @param {number} config.initialBalance - The starting capital (Equity)
     * @param {object} [config.x402Client] - Optional x402 client for managing expenses
     * @param {function} [config.onPanic] - Callback when entering panic mode
     * @param {function} [config.onGrowth] - Callback when entering growth mode
     */
    constructor(config) {
        this.initialBalance = config.initialBalance;
        this.currentBalance = config.initialBalance;
        this.x402Client = config.x402Client || null;

        this.callbacks = {
            onPanic: config.onPanic || (() => { }),
            onGrowth: config.onGrowth || (() => { }),
            onSurvival: config.onSurvival || (() => { })
        };

        this.state = 'SURVIVAL'; // Start in neutral state

        console.log(`💓 Survival Manager Active. Baseline Equity: ${this.initialBalance}`);
    }

    /**
     * Updates the health status based on new balance data.
     * @param {number} newBalance - Current total equity (Wallet + Exchange Account)
     */
    updateVitalSigns(newBalance) {
        this.currentBalance = newBalance;
        const healthRatio = (this.currentBalance / this.initialBalance);

        // State Machine
        if (healthRatio >= 1.20) {
            this.setMode('GROWTH', healthRatio);
        } else if (healthRatio <= 0.85 && healthRatio > 0.50) {
            this.setMode('DEFENSIVE', healthRatio);
        } else if (healthRatio <= 0.50) {
            this.setMode('CRITICAL', healthRatio);
        } else {
            this.setMode('SURVIVAL', healthRatio);
        }

        return this.state;
    }

    setMode(newMode, ratio) {
        if (this.state === newMode) return; // No change

        const percentage = ((ratio - 1) * 100).toFixed(2);
        console.log(`\n🔄 METABOLISM CHANGE: ${this.state} -> ${newMode} (P&L: ${percentage}%)`);

        this.state = newMode;

        switch (newMode) {
            case 'GROWTH':
                // Abundance: Spend on intel, take higher risks
                if (this.x402Client) {
                    console.log("🟢 [Growth] x402 Budget: UNLOCKED. Buying premium signals.");
                    // logic to enable spending would go here in a real implementation
                }
                this.callbacks.onGrowth();
                break;

            case 'SURVIVAL':
                // Neutral: Business as usual
                console.log("🔵 [Survival] Cruising altitude. Balanced risk.");
                this.callbacks.onSurvival();
                break;

            case 'DEFENSIVE':
                // Hardship: Cut costs
                if (this.x402Client) {
                    console.log("🟠 [Defensive] x402 Budget: FROZEN. Cutting expenses.");
                    // logic to disable spending
                }
                console.log("🟠 [Defensive] Risk lowered. Stick to safe setups.");
                this.callbacks.onPanic(); // Panic/Defense are similar for callbacks
                break;

            case 'CRITICAL':
                // Near Death: Hibernation or Hail Mary
                console.log("🔴 [CRITICAL] SYSTEMS FAILING. Entering Hibernation to preserve capital.");
                if (this.x402Client) {
                    console.log("🔴 [CRITICAL] x402: TERMINATED.");
                }
                process.exit(0); // "Die" to save the user's money
                break;
        }
    }

    getPnL() {
        return this.currentBalance - this.initialBalance;
    }
}
