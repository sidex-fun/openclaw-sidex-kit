/**
 * ProposalJudge — LLM-powered evaluation of evolution proposals.
 * 
 * Scores each proposal on 4 axes:
 *   1. Relevance  — Does it relate to this project's domain?
 *   2. Value      — Does it add meaningful functionality or improvement?
 *   3. Safety     — Is it free from malicious intent or dangerous patterns?
 *   4. Feasibility — Can it be implemented with the current codebase?
 * 
 * Returns a verdict: APPROVED, REJECTED, or NEEDS_REVIEW with reasoning.
 */
export class ProposalJudge {
    /**
     * @param {object} config
     * @param {import('../LLMClient.js').LLMClient} config.llm - LLM client instance
     * @param {number} [config.approvalThreshold] - Minimum average score to approve (0-10, default: 7)
     * @param {number} [config.safetyMinimum] - Minimum safety score (0-10, default: 8)
     * @param {string[]} [config.projectContext] - Description of the project for context
     */
    constructor(config = {}) {
        if (!config.llm) throw new Error('ProposalJudge requires an LLM client');

        this.llm = config.llm;
        this.approvalThreshold = config.approvalThreshold ?? 7;
        this.safetyMinimum = config.safetyMinimum ?? 8;

        this.projectContext = config.projectContext || [
            'OpenClaw Sidex Kit — an autonomous AI trading agent SDK.',
            'Core modules: AgentOrchestrator, LLMClient, MarketDataFeed, PositionManager, RiskManager, SurvivalManager, EventBus, WalletManager, X402Client.',
            'Exchange pipelines: Binance, Bybit, Hyperliquid, Solana Jupiter, Uniswap, Polymarket.',
            'Tech stack: Node.js ESM, no TypeScript runtime, viem for blockchain, ws for WebSocket.',
            'The project is a published npm SDK (openclaw-sidex-kit).'
        ];

        this.JUDGE_PROMPT = `You are a senior software architect reviewing proposals for an open-source project.

PROJECT CONTEXT:
${this.projectContext.join('\n')}

Your job is to evaluate whether a proposed change is worth implementing.
Score each axis from 0 to 10 and provide brief reasoning.

SCORING AXES:
- relevance: Does this proposal relate to the project's domain and goals?
- value: Does it add meaningful functionality, fix a real problem, or improve UX/DX?
- safety: Is it free from malicious intent, backdoors, or dangerous patterns? (supply chain attacks, data exfiltration, etc.)
- feasibility: Can it be implemented with the current codebase without major rewrites?

RESPOND ONLY WITH VALID JSON:
{
  "relevance": { "score": 0-10, "reason": "..." },
  "value": { "score": 0-10, "reason": "..." },
  "safety": { "score": 0-10, "reason": "..." },
  "feasibility": { "score": 0-10, "reason": "..." },
  "summary": "One sentence overall assessment",
  "verdict": "APPROVED" | "REJECTED" | "NEEDS_REVIEW"
}`;
    }

    /**
     * Evaluate a proposal.
     * @param {object} proposal - { id, title, body, author, source }
     * @returns {Promise<{verdict: string, scores: object, summary: string, avgScore: number}>}
     */
    async evaluate(proposal) {
        const userMessage = `PROPOSAL:
Title: ${proposal.title}
Author: ${proposal.author} (via ${proposal.source})
Description:
${proposal.body}

Evaluate this proposal.`;

        try {
            const response = await this.llm.chat([
                { role: 'system', content: this.JUDGE_PROMPT },
                { role: 'user', content: userMessage }
            ], { temperature: 0.2 });

            const evaluation = this._parseEvaluation(response);

            // Override verdict based on hard thresholds
            if (evaluation.scores.safety < this.safetyMinimum) {
                evaluation.verdict = 'REJECTED';
                evaluation.summary = `[SAFETY BLOCK] Safety score ${evaluation.scores.safety}/10 below minimum ${this.safetyMinimum}. ${evaluation.summary}`;
            } else if (evaluation.avgScore < this.approvalThreshold) {
                if (evaluation.verdict === 'APPROVED') {
                    evaluation.verdict = 'NEEDS_REVIEW';
                    evaluation.summary = `[THRESHOLD] Average score ${evaluation.avgScore.toFixed(1)} below ${this.approvalThreshold}. ${evaluation.summary}`;
                }
            }

            console.log(`⚖️  [Judge] Proposal "${proposal.title}" → ${evaluation.verdict} (avg: ${evaluation.avgScore.toFixed(1)}/10)`);
            console.log(`   Relevance: ${evaluation.scores.relevance} | Value: ${evaluation.scores.value} | Safety: ${evaluation.scores.safety} | Feasibility: ${evaluation.scores.feasibility}`);

            return evaluation;

        } catch (error) {
            console.error(`❌ [Judge] Evaluation failed for "${proposal.title}": ${error.message}`);
            return {
                verdict: 'REJECTED',
                scores: { relevance: 0, value: 0, safety: 0, feasibility: 0 },
                reasons: {},
                summary: `Evaluation error: ${error.message}`,
                avgScore: 0
            };
        }
    }

    /**
     * Parse the LLM evaluation response.
     * @private
     */
    _parseEvaluation(responseText) {
        let jsonStr = responseText.trim();

        // Strip markdown fences
        const fenceMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (fenceMatch) jsonStr = fenceMatch[1].trim();

        const objectMatch = jsonStr.match(/\{[\s\S]*\}/);
        if (objectMatch) jsonStr = objectMatch[0];

        try {
            const parsed = JSON.parse(jsonStr);

            const scores = {
                relevance: Math.max(0, Math.min(10, parsed.relevance?.score ?? 0)),
                value: Math.max(0, Math.min(10, parsed.value?.score ?? 0)),
                safety: Math.max(0, Math.min(10, parsed.safety?.score ?? 0)),
                feasibility: Math.max(0, Math.min(10, parsed.feasibility?.score ?? 0))
            };

            const reasons = {
                relevance: parsed.relevance?.reason || '',
                value: parsed.value?.reason || '',
                safety: parsed.safety?.reason || '',
                feasibility: parsed.feasibility?.reason || ''
            };

            const avgScore = (scores.relevance + scores.value + scores.safety + scores.feasibility) / 4;

            const validVerdicts = ['APPROVED', 'REJECTED', 'NEEDS_REVIEW'];
            const verdict = validVerdicts.includes(parsed.verdict) ? parsed.verdict : 'NEEDS_REVIEW';

            return {
                verdict,
                scores,
                reasons,
                summary: parsed.summary || 'No summary provided.',
                avgScore
            };
        } catch (error) {
            return {
                verdict: 'REJECTED',
                scores: { relevance: 0, value: 0, safety: 0, feasibility: 0 },
                reasons: {},
                summary: `Parse error: ${responseText.substring(0, 100)}`,
                avgScore: 0
            };
        }
    }
}
