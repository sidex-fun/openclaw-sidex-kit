import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';

/**
 * InboxCollector — Collects evolution proposals from multiple sources.
 * 
 * Sources:
 *   1. GitHub Issues (labeled 'evolution' or 'feature-request')
 *   2. Local proposals file (proposals.json) — for webhooks, bots, manual input
 *   3. GitHub Discussions (if enabled)
 * 
 * Each proposal is normalized to:
 *   { id, source, author, title, body, timestamp, raw }
 */
export class InboxCollector {
    /**
     * @param {object} config
     * @param {string} [config.repo] - GitHub repo in 'owner/repo' format
     * @param {string} [config.githubToken] - GitHub personal access token
     * @param {string} [config.proposalsFile] - Path to local proposals JSON file
     * @param {string[]} [config.issueLabels] - GitHub issue labels to filter (default: ['evolution'])
     * @param {number} [config.maxAge] - Max age of proposals in hours (default: 72)
     * @param {number} [config.maxPerCycle] - Max proposals to return per collection (default: 5)
     */
    constructor(config = {}) {
        this.repo = config.repo || process.env.GITHUB_REPO || '';
        this.githubToken = config.githubToken || process.env.GITHUB_TOKEN || '';
        this.proposalsFile = config.proposalsFile || path.join(process.cwd(), 'data', 'evolution', 'proposals.json');
        this.issueLabels = config.issueLabels || ['evolution'];
        this.maxAge = (config.maxAge || 72) * 60 * 60 * 1000; // hours to ms
        this.maxPerCycle = config.maxPerCycle || 5;
        this.processedFile = config.processedFile || path.join(process.cwd(), 'data', 'evolution', 'processed.json');

        this._processed = this._loadProcessed();
    }

    /**
     * Collect proposals from all configured sources.
     * @returns {Promise<Array<{id: string, source: string, author: string, title: string, body: string, timestamp: string, raw: object}>>}
     */
    async collect() {
        const proposals = [];

        // Source 1: GitHub Issues
        if (this.repo && this.githubToken) {
            try {
                const issues = await this._fetchGitHubIssues();
                proposals.push(...issues);
            } catch (error) {
                console.warn(`⚠️ [InboxCollector] GitHub Issues fetch failed: ${error.message}`);
            }
        }

        // Source 2: Local proposals file (from webhooks, bots, manual)
        try {
            const local = this._readLocalProposals();
            proposals.push(...local);
        } catch (error) {
            console.warn(`⚠️ [InboxCollector] Local proposals read failed: ${error.message}`);
        }

        // Filter already processed
        const fresh = proposals.filter(p => !this._processed.has(p.id));

        // Filter by age
        const cutoff = Date.now() - this.maxAge;
        const recent = fresh.filter(p => new Date(p.timestamp).getTime() > cutoff);

        // Limit per cycle
        const batch = recent.slice(0, this.maxPerCycle);

        if (batch.length > 0) {
            console.log(`📬 [InboxCollector] ${batch.length} new proposal(s) collected from ${proposals.length} total.`);
        }

        return batch;
    }

    /**
     * Mark a proposal as processed so it won't be collected again.
     * @param {string} proposalId
     * @param {string} outcome - 'approved' | 'rejected' | 'failed' | 'merged'
     */
    markProcessed(proposalId, outcome) {
        this._processed.set(proposalId, {
            outcome,
            processedAt: new Date().toISOString()
        });
        this._saveProcessed();
    }

    /**
     * Add a proposal programmatically (for bots, webhooks, etc.)
     * @param {object} proposal - { title, body, author? }
     */
    addProposal(proposal) {
        const entry = {
            id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            source: 'local',
            author: proposal.author || 'anonymous',
            title: proposal.title,
            body: proposal.body,
            timestamp: new Date().toISOString(),
            raw: proposal
        };

        // Append to local proposals file
        const dir = path.dirname(this.proposalsFile);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        let existing = [];
        if (fs.existsSync(this.proposalsFile)) {
            try {
                existing = JSON.parse(fs.readFileSync(this.proposalsFile, 'utf8'));
            } catch { existing = []; }
        }

        existing.push(entry);
        fs.writeFileSync(this.proposalsFile, JSON.stringify(existing, null, 2));

        return entry;
    }

    // --- GitHub Issues ---

    async _fetchGitHubIssues() {
        const labels = this.issueLabels.join(',');
        const url = `https://api.github.com/repos/${this.repo}/issues?labels=${labels}&state=open&sort=created&direction=desc&per_page=20`;

        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${this.githubToken}`,
                'Accept': 'application/vnd.github.v3+json',
                'User-Agent': 'openclaw-evolution'
            }
        });

        if (!response.ok) {
            throw new Error(`GitHub API ${response.status}: ${await response.text()}`);
        }

        const issues = await response.json();

        return issues.map(issue => ({
            id: `gh-issue-${issue.number}`,
            source: 'github-issue',
            author: issue.user?.login || 'unknown',
            title: issue.title,
            body: issue.body || '',
            timestamp: issue.created_at,
            raw: { number: issue.number, url: issue.html_url, labels: issue.labels.map(l => l.name) }
        }));
    }

    // --- Local Proposals File ---

    _readLocalProposals() {
        if (!fs.existsSync(this.proposalsFile)) return [];

        try {
            const raw = fs.readFileSync(this.proposalsFile, 'utf8');
            const entries = JSON.parse(raw);
            return Array.isArray(entries) ? entries : [];
        } catch {
            return [];
        }
    }

    // --- Processed Tracking ---

    _loadProcessed() {
        try {
            if (fs.existsSync(this.processedFile)) {
                const raw = fs.readFileSync(this.processedFile, 'utf8');
                const entries = JSON.parse(raw);
                return new Map(Object.entries(entries));
            }
        } catch { /* ignore */ }
        return new Map();
    }

    _saveProcessed() {
        try {
            const dir = path.dirname(this.processedFile);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            fs.writeFileSync(this.processedFile, JSON.stringify(Object.fromEntries(this._processed), null, 2));
        } catch (error) {
            console.error(`❌ [InboxCollector] Failed to save processed state: ${error.message}`);
        }
    }
}
