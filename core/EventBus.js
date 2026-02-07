import { EventEmitter } from 'events';

/**
 * EventBus — Central communication backbone for the agent.
 * 
 * Singleton EventEmitter that all modules use to publish and subscribe to events.
 * 
 * Standard Events:
 *   signal:new        - New trading signal detected (from Social Miner, LLM, etc.)
 *   price:update      - Real-time price tick { symbol, price, timestamp }
 *   position:opened   - A position was successfully opened
 *   position:closed   - A position was closed (TP/SL/manual)
 *   survival:change   - SurvivalManager state changed { from, to, ratio }
 *   agent:shutdown     - Graceful shutdown requested
 *   agent:error        - Non-fatal error for logging
 */
class AgentEventBus extends EventEmitter {
    constructor() {
        super();
        this.setMaxListeners(50);
        this._debug = false;
    }

    /**
     * Enable or disable debug logging for all events.
     * @param {boolean} enabled
     */
    setDebug(enabled) {
        if (enabled && !this._debugListener) {
            this._debugListener = (event, ...args) => {
                const preview = args.length > 0 ? JSON.stringify(args[0]).substring(0, 120) : '';
                console.log(`📡 [EventBus] ${event} ${preview}`);
            };
            this.onAny = this._debugListener;
            this._debug = true;
        } else if (!enabled) {
            this._debugListener = null;
            this.onAny = null;
            this._debug = false;
        }
    }

    /**
     * Override emit to support debug logging.
     * @param {string} event
     * @param  {...any} args
     */
    emit(event, ...args) {
        if (this._debug && this._debugListener) {
            this._debugListener(event, ...args);
        }
        return super.emit(event, ...args);
    }
}

// Singleton instance
const eventBus = new AgentEventBus();

export { eventBus };
export default eventBus;
