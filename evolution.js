import dotenv from 'dotenv';
import { LLMClient } from './core/LLMClient.js';
import { EvolutionDaemon } from './core/evolution/EvolutionDaemon.js';

dotenv.config();

/**
 * evolution.js — Entry point for the OpenClaw Self-Evolution Daemon.
 * 
 * Usage:
 *   node evolution.js
 * 
 * Requires:
 *   - LLM configured (Ollama/OpenAI/Anthropic via .env)
 *   - GitHub token (GITHUB_TOKEN) for reading issues and creating PRs
 *   - GitHub repo (GITHUB_REPO) in 'owner/repo' format
 * 
 * The daemon will:
 *   1. Poll for proposals (GitHub Issues labeled 'evolution', local proposals.json)
 *   2. Evaluate each with an LLM judge
 *   3. Plan and implement approved changes
 *   4. Validate (syntax, imports)
 *   5. Create a PR or commit directly
 */

console.log(`
🧬 ═══════════════════════════════════════════════
   OPENCLAW SELF-EVOLUTION DAEMON
   "The code that writes itself."
═══════════════════════════════════════════════════
`);

// --- Configuration ---
const config = {
    intervalMs: parseInt(process.env.EVOLUTION_INTERVAL_MS) || 3600000,  // 1 hour
    maxProposalsPerDay: parseInt(process.env.EVOLUTION_MAX_PER_DAY) || 10,
    approvalThreshold: parseFloat(process.env.EVOLUTION_APPROVAL_THRESHOLD) || 7,
    safetyMinimum: parseFloat(process.env.EVOLUTION_SAFETY_MINIMUM) || 8,
    directCommit: process.env.EVOLUTION_DIRECT_COMMIT === 'true',
    repo: process.env.GITHUB_REPO || '',
    githubToken: process.env.GITHUB_TOKEN || '',
};

console.log('📋 Configuration:');
console.log(`   Interval:       ${config.intervalMs / 1000}s`);
console.log(`   Max/day:        ${config.maxProposalsPerDay}`);
console.log(`   Approval:       ≥${config.approvalThreshold}/10`);
console.log(`   Safety min:     ≥${config.safetyMinimum}/10`);
console.log(`   Mode:           ${config.directCommit ? 'Direct Commit' : 'Pull Request'}`);
console.log(`   Repo:           ${config.repo || '(not set)'}`);
console.log(`   GitHub token:   ${config.githubToken ? '✓ configured' : '✗ not set'}`);
console.log('');

// --- Initialize LLM ---
const llm = new LLMClient();

// --- Initialize Daemon ---
const daemon = new EvolutionDaemon({
    llm,
    ...config
});

// --- Graceful Shutdown ---
let shuttingDown = false;

async function shutdown(signal) {
    if (shuttingDown) return;
    shuttingDown = true;

    console.log(`\n⚠️  Received ${signal}. Stopping evolution daemon...`);
    daemon.stop();
    process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// --- Start ---
await daemon.start();
