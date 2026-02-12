import { execSync } from 'child_process';

/**
 * GitCommitter — Handles git operations for the evolution pipeline.
 * 
 * Creates branches, commits changes, and opens Pull Requests on GitHub.
 * Uses `gh` CLI for PR creation and `git` for version control.
 * 
 * Flow:
 *   1. Create a feature branch from main
 *   2. Stage and commit the changes
 *   3. Push the branch to origin
 *   4. Create a Pull Request with full context
 */
export class GitCommitter {
    /**
     * @param {object} config
     * @param {string} [config.projectRoot] - Root path of the project
     * @param {string} [config.baseBranch] - Branch to create PRs against (default: 'main')
     * @param {string} [config.branchPrefix] - Prefix for evolution branches (default: 'evolution/')
     * @param {boolean} [config.directCommit] - If true, commit to baseBranch directly instead of PR (default: false)
     * @param {string} [config.repo] - GitHub repo in 'owner/repo' format (for PR labels)
     */
    constructor(config = {}) {
        this.projectRoot = config.projectRoot || process.cwd();
        this.baseBranch = config.baseBranch || 'main';
        this.branchPrefix = config.branchPrefix || 'evolution/';
        this.directCommit = config.directCommit ?? false;
        this.repo = config.repo || process.env.GITHUB_REPO || '';
    }

    /**
     * Commit changes and create a PR (or direct commit).
     * @param {object} proposal - Original proposal { id, title, body, author }
     * @param {object} evaluation - Judge evaluation { verdict, scores, summary }
     * @param {object} plan - Implementation plan { summary, changes }
     * @param {Array} appliedChanges - List of applied file changes
     * @returns {Promise<{success: boolean, branch?: string, prUrl?: string, commitHash?: string, error?: string}>}
     */
    async commit(proposal, evaluation, plan, appliedChanges) {
        try {
            const branchName = this._generateBranchName(proposal);
            const commitMessage = this._generateCommitMessage(proposal, evaluation, plan);
            const prBody = this._generatePRBody(proposal, evaluation, plan, appliedChanges);

            if (this.directCommit) {
                return await this._directCommit(commitMessage, appliedChanges);
            } else {
                return await this._createPR(branchName, commitMessage, prBody, proposal, appliedChanges);
            }

        } catch (error) {
            console.error(`❌ [GitCommitter] Failed: ${error.message}`);
            return { success: false, error: error.message };
        }
    }

    /**
     * Direct commit to the base branch.
     * @private
     */
    async _directCommit(commitMessage, appliedChanges) {
        // Ensure we're on the base branch
        this._exec(`git checkout ${this.baseBranch}`);
        
        // Stage changed files
        for (const change of appliedChanges) {
            this._exec(`git add "${change.filePath}"`);
        }

        // Commit
        this._exec(`git commit -m "${commitMessage.replace(/"/g, '\\"')}"`);
        
        // Push
        this._exec(`git push origin ${this.baseBranch}`);

        const commitHash = this._exec('git rev-parse --short HEAD').trim();

        console.log(`✅ [GitCommitter] Direct commit: ${commitHash} on ${this.baseBranch}`);

        return {
            success: true,
            branch: this.baseBranch,
            commitHash,
        };
    }

    /**
     * Create a feature branch and PR.
     * @private
     */
    async _createPR(branchName, commitMessage, prBody, proposal, appliedChanges) {
        // Ensure clean state on base branch
        this._exec(`git checkout ${this.baseBranch}`);
        this._exec(`git pull origin ${this.baseBranch} --rebase`);

        // Create and switch to feature branch
        try {
            this._exec(`git branch -D ${branchName}`);
        } catch { /* branch doesn't exist, that's fine */ }

        this._exec(`git checkout -b ${branchName}`);

        // Stage changed files
        for (const change of appliedChanges) {
            this._exec(`git add "${change.filePath}"`);
        }

        // Commit
        this._exec(`git commit -m "${commitMessage.replace(/"/g, '\\"')}"`);

        // Push branch
        this._exec(`git push origin ${branchName} --force`);

        const commitHash = this._exec('git rev-parse --short HEAD').trim();

        // Create PR using gh CLI
        let prUrl = null;
        try {
            const prTitle = `🧬 [Evolution] ${proposal.title}`;
            const prResult = this._exec(
                `gh pr create --base ${this.baseBranch} --head ${branchName} --title "${prTitle.replace(/"/g, '\\"')}" --body "${prBody.replace(/"/g, '\\"').replace(/\n/g, '\\n')}" --label "evolution,automated"`
            );
            prUrl = prResult.trim();
            console.log(`✅ [GitCommitter] PR created: ${prUrl}`);
        } catch (error) {
            console.warn(`⚠️ [GitCommitter] PR creation failed (gh CLI): ${error.message}`);
            console.log(`   Branch ${branchName} was pushed. Create PR manually.`);
        }

        // Switch back to base branch
        this._exec(`git checkout ${this.baseBranch}`);

        return {
            success: true,
            branch: branchName,
            commitHash,
            prUrl
        };
    }

    /**
     * Generate a branch name from the proposal.
     * @private
     */
    _generateBranchName(proposal) {
        const slug = proposal.title
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '')
            .substring(0, 40);

        return `${this.branchPrefix}${slug}`;
    }

    /**
     * Generate a conventional commit message.
     * @private
     */
    _generateCommitMessage(proposal, evaluation, plan) {
        const type = plan.estimatedComplexity === 'low' ? 'fix' : 'feat';
        const scope = 'evolution';
        const subject = proposal.title.substring(0, 72);
        const body = [
            '',
            `Proposal: ${proposal.id}`,
            `Author: ${proposal.author} (${proposal.source})`,
            `Judge Score: ${evaluation.avgScore?.toFixed(1)}/10`,
            `Verdict: ${evaluation.verdict}`,
            '',
            plan.summary || '',
            '',
            'Automated by OpenClaw Evolution Pipeline.'
        ].join('\n');

        return `${type}(${scope}): ${subject}\n${body}`;
    }

    /**
     * Generate a detailed PR body.
     * @private
     */
    _generatePRBody(proposal, evaluation, plan, appliedChanges) {
        const fileList = appliedChanges
            .map(c => `- \`${c.filePath}\` (${c.action})`)
            .join('\n');

        return `## 🧬 Evolution Proposal

**Title:** ${proposal.title}
**Author:** ${proposal.author} (via ${proposal.source})
**Proposal ID:** ${proposal.id}

### Original Request
${proposal.body}

---

### Judge Evaluation
| Axis | Score |
|------|-------|
| Relevance | ${evaluation.scores?.relevance || '?'}/10 |
| Value | ${evaluation.scores?.value || '?'}/10 |
| Safety | ${evaluation.scores?.safety || '?'}/10 |
| Feasibility | ${evaluation.scores?.feasibility || '?'}/10 |
| **Average** | **${evaluation.avgScore?.toFixed(1) || '?'}/10** |

**Verdict:** ${evaluation.verdict}
**Summary:** ${evaluation.summary}

---

### Implementation Plan
${plan.summary || 'No summary'}

**Complexity:** ${plan.estimatedComplexity || 'unknown'}

### Files Changed
${fileList}

---

> 🤖 This PR was automatically generated by the **OpenClaw Evolution Pipeline**.
> Review carefully before merging.`;
    }

    /**
     * Execute a git command.
     * @private
     */
    _exec(command) {
        return execSync(command, {
            cwd: this.projectRoot,
            timeout: 30000,
            stdio: ['pipe', 'pipe', 'pipe'],
            encoding: 'utf8'
        });
    }
}
