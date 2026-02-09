import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

/**
 * LLMClient — Unified interface for Ollama, OpenAI, and Anthropic.
 * 
 * Provides structured trading decisions from any supported LLM provider.
 * Reads configuration from environment variables:
 *   LLM_PROVIDER   - 'ollama' | 'openai' | 'anthropic'
 *   LLM_MODEL      - Model name (e.g. 'llama3.3', 'gpt-4o', 'claude-3-5-sonnet-20241022')
 *   LLM_API_BASE   - Base URL for the API
 *   OPENAI_API_KEY  - API key for OpenAI
 *   ANTHROPIC_API_KEY - API key for Anthropic
 *   OLLAMA_MODEL    - Override model name for Ollama specifically
 */
export class LLMClient {
    constructor(config = {}) {
        this.provider = config.provider || process.env.LLM_PROVIDER || 'ollama';
        this.model = config.model || process.env.OLLAMA_MODEL || process.env.LLM_MODEL || 'llama3.3';
        this.apiBase = config.apiBase || process.env.LLM_API_BASE || 'http://localhost:11434';
        this.apiKey = config.apiKey || process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY || '';
        this.timeout = config.timeout || 60000;
        this.maxRetries = config.maxRetries || 2;

        this.TRADING_SYSTEM_PROMPT = `You are an autonomous crypto trading agent. You analyze market data, social signals, and portfolio state to make trading decisions.

RULES:
- You MUST respond ONLY with valid JSON. No markdown, no explanation, no extra text.
- Every response must follow this exact schema:
{
  "action": "BUY" | "SELL" | "CLOSE" | "HOLD",
  "symbol": "BTC" | "ETH" | "SOL" | etc,
  "confidence": 0.0 to 1.0,
  "reasoning": "one sentence explanation",
  "leverage": 1 to 20,
  "urgency": "LOW" | "MEDIUM" | "HIGH"
}
- If no clear opportunity exists, use action "HOLD".
- Be conservative with leverage. Default to 5x unless strong conviction.
- Never exceed 20x leverage.
- Consider the agent's survival state when making decisions.`;

        this.PERSONA_PROMPTS = {
            ANALYST: `You are 'The Technician', a cold, calculating technical analyst.
FOCUS: Price action, RSI, EMAs, market structure.
TASK: Analyze the provided Market Data. Identify trends and key levels.
OUTPUT: A concise, bulleted analysis (max 50 words) ending with a clear bias: BULLISH, BEARISH, or NEUTRAL.`,

            SENTINEL: `You are 'The Sentinel', a social sentiment tracker.
FOCUS: Social signals, news, crowd psychology, and alpha signals.
TASK: Analyze the provided Recent Signals. Gauge market emotion.
OUTPUT: A concise, bulleted analysis (max 50 words) ending with a clear bias: BULLISH, BEARISH, or NEUTRAL.`,

            GUARDIAN: `You are 'The Guardian', a strict risk manager.
FOCUS: Capital preservation, leverage limits, survival state.
TASK: Review the Agent State and Positions. Criticize any reckless behavior.
OUTPUT: A concise warning or approval (max 50 words). Recommend a maximum safe leverage (e.g., "Max Leverage: 5x").`,

            LEADER: `You are the 'Head of Trading'. You have received reports from your staff (Technician, Sentinel, Guardian).
TASK: Synthesize their specific inputs into a single FINAL TRADING DECISION.
RULES:
- Respond ONLY with valid JSON.
- If the Guardian is worried, reduce leverage or HOLD.
- If Technician and Sentinel disagree, favor the Guardian's safety or HOLD.
- Follow the exact JSON schema provided previously.`
        };

        console.log(`🧠 LLM Client initialized: provider=${this.provider}, model=${this.model}`);
    }

    /**
     * Send a chat completion request to the configured LLM.
     * @param {Array<{role: string, content: string}>} messages
     * @param {object} options - { temperature, maxTokens }
     * @returns {Promise<string>} The assistant's response text
     */
    async chat(messages, options = {}) {
        const temperature = options.temperature ?? 0.3;
        const maxTokens = options.maxTokens || 1024;

        for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
            try {
                switch (this.provider) {
                    case 'ollama':
                        return await this._ollamaChat(messages, temperature);
                    case 'openai':
                        return await this._openaiChat(messages, temperature, maxTokens);
                    case 'anthropic':
                        return await this._anthropicChat(messages, temperature, maxTokens);
                    default:
                        throw new Error(`Unknown LLM provider: ${this.provider}`);
                }
            } catch (error) {
                if (attempt < this.maxRetries) {
                    const delay = Math.pow(2, attempt) * 1000;
                    console.warn(`⚠️ LLM request failed (attempt ${attempt + 1}/${this.maxRetries + 1}): ${error.message}. Retrying in ${delay}ms...`);
                    await new Promise(r => setTimeout(r, delay));
                } else {
                    throw error;
                }
            }
        }
    }

    /**
     * Make a structured trading decision based on context.
     * @param {object} context
     * @param {object} context.marketData - Current prices, indicators
     * @param {Array} context.signals - Recent trading signals from social/alpha
     * @param {Array} context.positions - Currently open positions
     * @param {string} context.survivalState - Current survival mode
     * @param {number} context.balance - Current balance
     * @param {number} context.pnl - Current PnL
     * @returns {Promise<object>} Parsed decision object
     */
    async decide(context) {
        const userMessage = this._buildDecisionPrompt(context);

        const messages = [
            { role: 'system', content: this.TRADING_SYSTEM_PROMPT },
            { role: 'user', content: userMessage }
        ];

        try {
            const response = await this.chat(messages, { temperature: 0.2 });
            return this._parseDecision(response);
        } catch (error) {
            console.error('❌ LLM decision failed:', error.message);
            return {
                action: 'HOLD',
                symbol: null,
                confidence: 0,
                reasoning: `LLM error: ${error.message}`,
                leverage: 1,
                urgency: 'LOW'
            };
        }
    }

    /**
     * Conduct a debate among multiple personas to reach a decision.
     * @param {object} context
     * @returns {Promise<object>} Parsed decision object
     */
    async decideWithDebate(context) {
        // 1. Prepare contexts for each persona
        const marketStr = this._formatMarketData(context.marketData);
        const signalsStr = this._formatSignals(context.signals);
        const stateStr = this._formatState(context);

        // 2. Launch parallel requests for the "Council"
        console.log('   🗣️  Council of AI is debating...');

        const pAnalyst = this.chat([
            { role: 'system', content: this.PERSONA_PROMPTS.ANALYST },
            { role: 'user', content: `MARKET DATA:\n${marketStr}` }
        ], { temperature: 0.3 }).then(res => ({ role: 'TECHNICIAN', content: res }));

        const pSentinel = this.chat([
            { role: 'system', content: this.PERSONA_PROMPTS.SENTINEL },
            { role: 'user', content: `RECENT SIGNALS:\n${signalsStr}` }
        ], { temperature: 0.4 }).then(res => ({ role: 'SENTINEL', content: res }));

        const pGuardian = this.chat([
            { role: 'system', content: this.PERSONA_PROMPTS.GUARDIAN },
            { role: 'user', content: `AGENT STATE:\n${stateStr}` }
        ], { temperature: 0.1 }).then(res => ({ role: 'GUARDIAN', content: res }));

        // Wait for all opinions
        const [rAnalyst, rSentinel, rGuardian] = await Promise.all([pAnalyst, pSentinel, pGuardian]);

        // 3. Log the debate (Feedback loop)
        // We return these so the Orchestrator can log them if needed, or we log here.
        // For now, we'll embed them in the reasoning field of the decision if possible, or just log to console.
        console.log(`   🔸 [Technician]: ${rAnalyst.content.replace(/\n/g, ' ').substring(0, 100)}...`);
        console.log(`   🔸 [Sentinel]:   ${rSentinel.content.replace(/\n/g, ' ').substring(0, 100)}...`);
        console.log(`   🔸 [Guardian]:   ${rGuardian.content.replace(/\n/g, ' ').substring(0, 100)}...`);

        // 4. Final Decision by Leader
        const debateTranscript = `
REPORT FROM TECHNICIAN:
${rAnalyst.content}

REPORT FROM SENTINEL:
${rSentinel.content}

REPORT FROM GUARDIAN:
${rGuardian.content}

=== FINAL AUTHORIZATION ===
Based on these reports, make the final trade decision.
`;

        const messages = [
            { role: 'system', content: this.TRADING_SYSTEM_PROMPT + '\n' + this.PERSONA_PROMPTS.LEADER },
            { role: 'user', content: debateTranscript }
        ];

        try {
            const response = await this.chat(messages, { temperature: 0.2 });
            const decision = this._parseDecision(response);

            // Enrich reasoning with the debate summary
            decision.reasoning = `[Council] ${decision.reasoning}`;
            decision.debate = {
                technician: rAnalyst.content,
                sentinel: rSentinel.content,
                guardian: rGuardian.content
            };

            return decision;
        } catch (error) {
            console.error('❌ Council debate failed:', error.message);
            return this.decide(context); // Fallback to simple mode
        }
    }

    /**
     * Build the decision prompt from context.
     * @private
     */
    _buildDecisionPrompt(context) {
        const parts = [];

        parts.push('=== CURRENT AGENT STATE ===');
        parts.push(`Survival Mode: ${context.survivalState || 'UNKNOWN'}`);
        parts.push(`Balance: $${context.balance || 0}`);
        parts.push(`P&L: $${context.pnl || 0}`);

        if (context.positions && context.positions.length > 0) {
            parts.push('\n=== OPEN POSITIONS ===');
            context.positions.forEach(p => {
                parts.push(`- ${p.side.toUpperCase()} ${p.symbol} | Entry: $${p.entryPrice} | Size: $${p.size} | Leverage: ${p.leverage}x | PnL: $${p.unrealizedPnl || '?'}`);
            });
        } else {
            parts.push('\n=== OPEN POSITIONS ===\nNone');
        }

        if (context.marketData) {
            parts.push('\n=== MARKET DATA ===');
            for (const [symbol, data] of Object.entries(context.marketData)) {
                let line = `${symbol}: $${data.price}`;
                if (data.rsi !== undefined) line += ` | RSI: ${data.rsi.toFixed(1)}`;
                if (data.ema20 !== undefined) line += ` | EMA20: $${data.ema20.toFixed(2)}`;
                if (data.ema50 !== undefined) line += ` | EMA50: $${data.ema50.toFixed(2)}`;
                if (data.atr !== undefined) line += ` | ATR: $${data.atr.toFixed(2)}`;
                parts.push(line);
            }
        }

        if (context.signals && context.signals.length > 0) {
            parts.push('\n=== RECENT SIGNALS ===');
            context.signals.slice(0, 10).forEach(s => {
                parts.push(`- [${s.impact || 'MEDIUM'}] ${s.instruction} from ${s.source}/${s.author}: "${s.raw_text?.substring(0, 100)}"`);
            });
        }

        parts.push('\n=== DECISION REQUIRED ===');
        parts.push('Based on the above data, what is your trading decision? Respond with JSON only.');

        return parts.join('\n');
    }

    _formatMarketData(marketData) {
        if (!marketData) return 'No market data available.';
        return Object.entries(marketData).map(([symbol, data]) => {
            let line = `${symbol}: $${data.price}`;
            if (data.rsi) line += ` | RSI: ${data.rsi.toFixed(1)}`;
            if (data.ema20) line += ` | EMA20: ${data.ema20.toFixed(2)}`;
            return line;
        }).join('\n');
    }

    _formatSignals(signals) {
        if (!signals || signals.length === 0) return 'No recent social signals.';
        return signals.slice(0, 5).map(s => `- "${s.instruction}" (${s.source})`).join('\n');
    }

    _formatState(context) {
        let str = `Balance: $${context.balance} | PnL: $${context.pnl} | Mode: ${context.survivalState}\n`;
        if (context.positions && context.positions.length > 0) {
            str += 'Open Positions:\n' + context.positions.map(p => `- ${p.symbol} ${p.side} (PnL: ${p.unrealizedPnl})`).join('\n');
        } else {
            str += 'No open positions.';
        }
        return str;
    }

    /**
     * Parse LLM response into a structured decision.
     * @private
     */
    _parseDecision(responseText) {
        // Try to extract JSON from the response (LLMs sometimes wrap in markdown)
        let jsonStr = responseText.trim();

        // Remove markdown code fences if present
        const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (jsonMatch) {
            jsonStr = jsonMatch[1].trim();
        }

        // Try to find JSON object in the text
        const objectMatch = jsonStr.match(/\{[\s\S]*\}/);
        if (objectMatch) {
            jsonStr = objectMatch[0];
        }

        try {
            const decision = JSON.parse(jsonStr);

            // Validate and normalize
            const validActions = ['BUY', 'SELL', 'CLOSE', 'HOLD'];
            if (!validActions.includes(decision.action)) {
                decision.action = 'HOLD';
            }

            decision.confidence = Math.max(0, Math.min(1, parseFloat(decision.confidence) || 0));
            decision.leverage = Math.max(1, Math.min(20, parseInt(decision.leverage) || 5));
            decision.urgency = ['LOW', 'MEDIUM', 'HIGH'].includes(decision.urgency) ? decision.urgency : 'LOW';

            return decision;
        } catch (error) {
            console.warn('⚠️ Failed to parse LLM decision, defaulting to HOLD:', error.message);
            return {
                action: 'HOLD',
                symbol: null,
                confidence: 0,
                reasoning: `Parse error: ${responseText.substring(0, 100)}`,
                leverage: 1,
                urgency: 'LOW'
            };
        }
    }

    // --- Provider-specific implementations ---

    async _ollamaChat(messages, temperature) {
        const url = `${this.apiBase}/api/chat`;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: this.model,
                    messages,
                    stream: false,
                    options: { temperature }
                }),
                signal: controller.signal
            });

            if (!response.ok) {
                const body = await response.text();
                throw new Error(`Ollama error ${response.status}: ${body.substring(0, 200)}`);
            }

            const data = await response.json();
            return data.message?.content || '';
        } finally {
            clearTimeout(timeoutId);
        }
    }

    async _openaiChat(messages, temperature, maxTokens) {
        const url = `${this.apiBase}/chat/completions`;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`
                },
                body: JSON.stringify({
                    model: this.model,
                    messages,
                    temperature,
                    max_tokens: maxTokens,
                    response_format: { type: 'json_object' }
                }),
                signal: controller.signal
            });

            if (!response.ok) {
                const body = await response.text();
                throw new Error(`OpenAI error ${response.status}: ${body.substring(0, 200)}`);
            }

            const data = await response.json();
            return data.choices?.[0]?.message?.content || '';
        } finally {
            clearTimeout(timeoutId);
        }
    }

    async _anthropicChat(messages, temperature, maxTokens) {
        const url = `${this.apiBase}/v1/messages`;

        // Anthropic uses system as a top-level param, not in messages
        const systemMsg = messages.find(m => m.role === 'system');
        const userMessages = messages.filter(m => m.role !== 'system');

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': this.apiKey,
                    'anthropic-version': '2023-06-01'
                },
                body: JSON.stringify({
                    model: this.model,
                    system: systemMsg?.content || '',
                    messages: userMessages,
                    temperature,
                    max_tokens: maxTokens
                }),
                signal: controller.signal
            });

            if (!response.ok) {
                const body = await response.text();
                throw new Error(`Anthropic error ${response.status}: ${body.substring(0, 200)}`);
            }

            const data = await response.json();
            return data.content?.[0]?.text || '';
        } finally {
            clearTimeout(timeoutId);
        }
    }
}
