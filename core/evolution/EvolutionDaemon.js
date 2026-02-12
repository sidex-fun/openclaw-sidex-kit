import fs from 'fs';
import path from 'path';
import { eventBus } from '../EventBus.js';
import { InboxCollector } from './InboxCollector.js';
import { ProposalJudge } from './ProposalJudge.js';
import { CodePlanner } from './CodePlanner.js';
import { CodeWriter } from './CodeWriter.js';
import { Validator } from './Validator.js';
import { GitCommitter } from './GitCommitter.js';

/**
 * EvolutionDaemon — Autonomous self-evolution pipeline.
 * 
 * Runs as a daemon that periodically:
 *   1. Collects proposals from external sources (GitHub Issues, local file, webhooks)
 *   2. Evaluates each proposal with an LLM judge (relevance, value, safety, feasibility)
 *   3. Plans implementation for approved proposals
 *   4. Writes code changes with guardrails (path whitelist, dangerous pattern detection)
 *   5. Validates changes (syntax, imports, tests)
 *   6. Commits and creates a PR (or direct commit)
 *   7. Rolls back on failure
 * 
 * Safety:
 *   - Rate limited (max proposals per cycle, max cycles per day)
 *   - File path whitelist/blacklist
 *   - Dangerous code pattern detection
 *   - Automatic rollback on validation failure
 *   - Full audit log of all actions
 * 
 * Usage:
 *   import { EvolutionDaemon } from './core/evolution/EvolutionDaemon.js';
 *   const daemon = new EvolutionDaemon({ llm, intervalMs: 3600000 });
 *   await daemon.start();
 */
export class EvolutionDaemon {
    /**
     * @param {object} config
     * @param {import('../LLMClient.js').LLMClient} config.llm - LLM client for judge and planner
     * @param {number} [config.intervalMs] - Polling interval in ms (default: 1 hour)
     * @param {number} [config.maxProposalsPerDay] - Daily rate limit (default: 10)
     * @param {string} [config.projectRoot] - Project root path
     * @param {boolean} [config.directCommit] - Commit to main directly vs PR (default: false)
     * @param {boolean} [config.autoMerge] - Auto-merge PRs if validation passes (default: false)
     * @param {number} [config.approvalThreshold] - Min score to approve (default: 7)
     * @param {number} [config.safetyMinimum] - Min safety score (default: 8)
     * @param {string} [config.repo] - GitHub repo 'owner/repo'
     * @param {string} [config.githubToken] - GitHub token
     * @param {string[]} [config.allowedPaths] - Paths the agent can modify
     * @param {string[]} [config.forbiddenPaths] - Paths that must never be touched
     * @param {object} [config.inbox] - Override config for InboxCollector
     * @param {object} [config.judge] - Override config for ProposalJudge
     * @param {object} [config.planner] - Override config for CodePlanner
     * @param {object} [config.writer] - Override config for CodeWriter
     * @param {object} [config.validator] - Override config for Validator
     * @param {object} [config.committer] - Override config for GitCommitter
     */
    constructor(config = {}) {
        if (!config.llm) throw new Error('EvolutionDaemon requires an LLM client');

        this.llm = config.llm;
        this.intervalMs = config.intervalMs || 60 * 60 * 1000; // 1 hour
        this.maxProposalsPerDay = config.maxProposalsPerDay || 10;
        this.projectRoot = config.projectRoot || process.cwd();
        this.directCommit = config.directCommit ?? false;
        this.autoMerge = config.autoMerge ?? false;

        this._running = false;
        this._timer = null;
        this._dailyCount = 0;
        this._dailyReset = null;

        // Audit log
        this.logDir = path.join(this.projectRoot, 'data', 'evolution', 'logs');
        this.logFile = path.join(this.logDir, 'evolution.log');

        // Shared config
        const sharedPaths = {
            allowedPaths: config.allowedPaths || ['core/', 'pipelines/', 'sdk.js', 'types.d.ts'],
            forbiddenPaths: config.forbiddenPaths || ['.env', '.git/', 'node_modules/', 'package-lock.json', 'core/evolution/'],
            projectRoot: this.projectRoot
        };

        // Initialize sub-modules
        this.inbox = new InboxCollector({
            repo: config.repo,
            githubToken: config.githubToken,
            ...config.inbox
        });

        this.judge = new ProposalJudge({
            llm: this.llm,
            approvalThreshold: config.approvalThreshold,
            safetyMinimum: config.safetyMinimum,
            ...config.judge
        });

        this.planner = new CodePlanner({
            llm: this.llm,
            ...sharedPaths,
            ...config.planner
        });

        this.writer = new CodeWriter({
            ...sharedPaths,
            ...config.writer
        });

        this.validator = new Validator({
            projectRoot: this.projectRoot,
            ...config.validator
        });

        this.committer = new GitCommitter({
            projectRoot: this.projectRoot,
            directCommit: this.directCommit,
            repo: config.repo,
            ...config.committer
        });

        console.log(`🧬 EvolutionDaemon initialized. Interval: ${this.intervalMs / 1000}s | Direct commit: ${this.directCommit}`);
    }

    /**
     * Start the evolution daemon loop.
     */
    async start() {
        if (this._running) {
            console.warn('⚠️ EvolutionDaemon is already running.');
            return;
        }

        this._running = true;
        this._resetDailyCounter();

        console.log('\n🧬 ═══════════════════════════════════════');
        console.log('   OPENCLAW EVOLUTION DAEMON STARTING');
        console.log('═══════════════════════════════════════\n');

        this._log('DAEMON_START', { intervalMs: this.intervalMs });

        // Run immediately, then on interval
        await this._cycle();

        this._timer = setInterval(async () => {
            if (this._running) {
                await this._cycle();
            }
        }, this.intervalMs);
    }

    /**
     * Stop the daemon.
     */
    stop() {
        this._running = false;
        if (this._timer) {
            clearInterval(this._timer);
            this._timer = null;
        }
        if (this._dailyReset) {
            clearTimeout(this._dailyReset);
            this._dailyReset = null;
        }
        this._log('DAEMON_STOP', {});
        console.log('🧬 EvolutionDaemon stopped.');
    }

    /**
     * Submit a proposal programmatically.
     * @param {object} proposal - { title, body, author? }
     * @returns {object} The created proposal entry
     */
    submitProposal(proposal) {
        return this.inbox.addProposal(proposal);
    }

    // --- Main Cycle ---

    async _cycle() {
        const cycleStart = Date.now();

        try {
            console.log(`\n🧬 ═══ Evolution Cycle [${new Date().toISOString()}] ═══`);
            console.log(`   Daily proposals processed: ${this._dailyCount}/${this.maxProposalsPerDay}`);

            // Rate limit check
            if (this._dailyCount >= this.maxProposalsPerDay) {
                console.log('   ⏸️  Daily rate limit reached. Skipping cycle.');
                return;
            }

            // Step 1: Collect proposals
            const proposals = await this.inbox.collect();

            if (proposals.length === 0) {
                console.log('   📭 No new proposals. Sleeping.');
                return;
            }

            // Process each proposal
            for (const proposal of proposals) {
                if (this._dailyCount >= this.maxProposalsPerDay) break;
                if (!this._running) break;

                await this._processProposal(proposal);
            }

        } catch (error) {
            console.error(`❌ [EvolutionDaemon] Cycle error: ${error.message}`);
            this._log('CYCLE_ERROR', { error: error.message });
            eventBus.emit('agent:error', { source: 'evolution', error: error.message });
        }

        const elapsed = ((Date.now() - cycleStart) / 1000).toFixed(1);
        console.log(`   ⏱️  Cycle completed in ${elapsed}s`);
    }

    /**
     * Process a single proposal through the full pipeline.
     * @private
     */
    async _processProposal(proposal) {
        console.log(`\n   📨 Processing: "${proposal.title}" by ${proposal.author}`);
        this._log('PROPOSAL_START', { id: proposal.id, title: proposal.title });

        // Step 2: Judge
        const evaluation = await this.judge.evaluate(proposal);
        this._log('PROPOSAL_JUDGED', { id: proposal.id, verdict: evaluation.verdict, avgScore: evaluation.avgScore });

        if (evaluation.verdict === 'REJECTED') {
            console.log(`   ❌ Proposal rejected: ${evaluation.summary}`);
            this.inbox.markProcessed(proposal.id, 'rejected');
            return;
        }

        if (evaluation.verdict === 'NEEDS_REVIEW') {
            console.log(`   ⏳ Proposal needs human review: ${evaluation.summary}`);
            this.inbox.markProcessed(proposal.id, 'needs_review');
            return;
        }

        // Step 3: Plan
        console.log('   📋 Planning implementation...');
        const { plan, valid, errors: planErrors } = await this.planner.plan(proposal, evaluation);

        if (!valid || !plan) {
            console.log(`   ❌ Plan invalid: ${planErrors.join(', ')}`);
            this._log('PLAN_INVALID', { id: proposal.id, errors: planErrors });
            this.inbox.markProcessed(proposal.id, 'plan_failed');
            return;
        }

        this._log('PLAN_CREATED', { id: proposal.id, changes: plan.changes?.length, complexity: plan.estimatedComplexity });

        // Step 4: Write code
        console.log('   ✏️  Applying changes...');
        const writeResult = await this.writer.apply(plan);

        if (!writeResult.success && writeResult.applied.length === 0) {
            console.log(`   ❌ Code write failed: ${writeResult.errors.join(', ')}`);
            this._log('WRITE_FAILED', { id: proposal.id, errors: writeResult.errors });
            this.inbox.markProcessed(proposal.id, 'write_failed');
            return;
        }

        // Step 5: Validate
        console.log('   🔍 Validating changes...');
        const validation = await this.validator.validate(writeResult.applied);

        if (!validation.passed) {
            console.log('   ❌ Validation failed. Rolling back...');
            await this.writer.rollback();
            this._log('VALIDATION_FAILED', {
                id: proposal.id,
                failedChecks: validation.checks.filter(c => !c.passed).map(c => c.name)
            });
            this.inbox.markProcessed(proposal.id, 'validation_failed');
            return;
        }

        // Step 6: Commit
        console.log('   📦 Committing changes...');
        const commitResult = await this.committer.commit(proposal, evaluation, plan, writeResult.applied);

        if (!commitResult.success) {
            console.log(`   ❌ Commit failed: ${commitResult.error}. Rolling back...`);
            await this.writer.rollback();
            this._log('COMMIT_FAILED', { id: proposal.id, error: commitResult.error });
            this.inbox.markProcessed(proposal.id, 'commit_failed');
            return;
        }

        // Success!
        this._dailyCount++;
        const outcome = commitResult.prUrl ? 'pr_created' : 'committed';
        this.inbox.markProcessed(proposal.id, outcome);

        this._log('PROPOSAL_COMPLETE', {
            id: proposal.id,
            title: proposal.title,
            branch: commitResult.branch,
            commitHash: commitResult.commitHash,
            prUrl: commitResult.prUrl || null,
            outcome
        });

        console.log(`   ✅ Evolution complete! ${commitResult.prUrl ? `PR: ${commitResult.prUrl}` : `Commit: ${commitResult.commitHash}`}`);

        eventBus.emit('evolution:complete', {
            proposal: { id: proposal.id, title: proposal.title },
            evaluation: { verdict: evaluation.verdict, avgScore: evaluation.avgScore },
            commit: commitResult
        });
    }

    // --- Daily Rate Limit ---

    _resetDailyCounter() {
        this._dailyCount = 0;

        // Reset at midnight
        const now = new Date();
        const midnight = new Date(now);
        midnight.setHours(24, 0, 0, 0);
        const msUntilMidnight = midnight.getTime() - now.getTime();

        this._dailyReset = setTimeout(() => {
            this._dailyCount = 0;
            console.log('🧬 Daily proposal counter reset.');
            this._resetDailyCounter(); // Schedule next reset
        }, msUntilMidnight);
    }

    // --- Audit Log ---

    _log(event, data) {
        try {
            if (!fs.existsSync(this.logDir)) {
                fs.mkdirSync(this.logDir, { recursive: true });
            }

            const entry = {
                timestamp: new Date().toISOString(),
                event,
                ...data
            };

            fs.appendFileSync(this.logFile, JSON.stringify(entry) + '\n');
        } catch { /* silent fail on log write */ }
    }
}
