import fs from 'fs';
import path from 'path';

/**
 * CodePlanner — LLM-powered implementation planner for approved proposals.
 * 
 * Takes an approved proposal and generates a detailed implementation plan:
 *   - Which files to create or modify
 *   - What logic to implement
 *   - What exports to add
 *   - What tests to write
 * 
 * The plan is structured JSON that CodeWriter can execute.
 */
export class CodePlanner {
    /**
     * @param {object} config
     * @param {import('../LLMClient.js').LLMClient} config.llm - LLM client instance
     * @param {string} [config.projectRoot] - Root path of the project
     * @param {string[]} [config.allowedPaths] - Glob patterns of paths the agent can modify
     * @param {string[]} [config.forbiddenPaths] - Paths that must never be touched
     */
    constructor(config = {}) {
        if (!config.llm) throw new Error('CodePlanner requires an LLM client');

        this.llm = config.llm;
        this.projectRoot = config.projectRoot || process.cwd();

        this.allowedPaths = config.allowedPaths || [
            'core/',
            'pipelines/',
            'sdk.js',
            'types.d.ts'
        ];

        this.forbiddenPaths = config.forbiddenPaths || [
            '.env',
            '.git/',
            'node_modules/',
            'package-lock.json',
            'core/evolution/',  // Cannot self-modify the evolution system
        ];

        this.PLANNER_PROMPT = `You are a senior software engineer planning code changes for an open-source Node.js SDK.

PROJECT STRUCTURE:
{PROJECT_TREE}

RULES:
- You can ONLY modify or create files within these allowed paths: ${this.allowedPaths.join(', ')}
- You MUST NEVER touch these paths: ${this.forbiddenPaths.join(', ')}
- All code must be Node.js ESM (import/export, no require)
- Follow existing code style and patterns
- Keep changes minimal and focused
- Each file change must include the FULL new content (not diffs)
- If creating new classes, they should follow the existing constructor(config={}) pattern

RESPOND ONLY WITH VALID JSON:
{
  "plan": {
    "summary": "Brief description of what will be implemented",
    "rationale": "Why this approach was chosen",
    "estimatedComplexity": "low" | "medium" | "high",
    "changes": [
      {
        "action": "create" | "modify",
        "filePath": "relative/path/to/file.js",
        "description": "What this change does",
        "content": "FULL file content (for create) or the complete new version (for modify)"
      }
    ],
    "exports": [
      {
        "file": "core/index.js or sdk.js",
        "add": "ClassName or functionName"
      }
    ],
    "testCases": [
      "Description of what should be tested"
    ]
  }
}`;
    }

    /**
     * Generate an implementation plan for an approved proposal.
     * @param {object} proposal - The original proposal { title, body }
     * @param {object} evaluation - The judge's evaluation { scores, summary }
     * @returns {Promise<{plan: object, valid: boolean, errors: string[]}>}
     */
    async plan(proposal, evaluation) {
        // Build project tree for context
        const projectTree = this._getProjectTree();

        const prompt = this.PLANNER_PROMPT.replace('{PROJECT_TREE}', projectTree);

        const userMessage = `APPROVED PROPOSAL:
Title: ${proposal.title}
Description: ${proposal.body}

JUDGE NOTES:
${evaluation.summary}
Feasibility: ${evaluation.scores.feasibility}/10
Value: ${evaluation.scores.value}/10

Generate a detailed implementation plan.`;

        try {
            const response = await this.llm.chat([
                { role: 'system', content: prompt },
                { role: 'user', content: userMessage }
            ], { temperature: 0.3, maxTokens: 4096 });

            const result = this._parsePlan(response);

            // Validate the plan
            const errors = this._validatePlan(result.plan);

            if (errors.length > 0) {
                console.warn(`⚠️ [CodePlanner] Plan has ${errors.length} validation error(s):`);
                errors.forEach(e => console.warn(`   - ${e}`));
            }

            console.log(`📋 [CodePlanner] Plan generated: ${result.plan.changes?.length || 0} file change(s), complexity: ${result.plan.estimatedComplexity}`);

            return {
                plan: result.plan,
                valid: errors.length === 0,
                errors
            };

        } catch (error) {
            console.error(`❌ [CodePlanner] Planning failed: ${error.message}`);
            return {
                plan: null,
                valid: false,
                errors: [`Planning failed: ${error.message}`]
            };
        }
    }

    /**
     * Parse the LLM plan response.
     * @private
     */
    _parsePlan(responseText) {
        let jsonStr = responseText.trim();

        const fenceMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (fenceMatch) jsonStr = fenceMatch[1].trim();

        const objectMatch = jsonStr.match(/\{[\s\S]*\}/);
        if (objectMatch) jsonStr = objectMatch[0];

        try {
            const parsed = JSON.parse(jsonStr);
            return { plan: parsed.plan || parsed };
        } catch (error) {
            return {
                plan: {
                    summary: 'Failed to parse plan',
                    changes: [],
                    estimatedComplexity: 'unknown',
                    error: responseText.substring(0, 200)
                }
            };
        }
    }

    /**
     * Validate a plan against security rules.
     * @private
     */
    _validatePlan(plan) {
        const errors = [];

        if (!plan || !plan.changes || !Array.isArray(plan.changes)) {
            errors.push('Plan has no changes array');
            return errors;
        }

        if (plan.changes.length === 0) {
            errors.push('Plan has zero changes');
            return errors;
        }

        if (plan.changes.length > 10) {
            errors.push(`Too many changes (${plan.changes.length}). Maximum is 10 per proposal.`);
        }

        for (const change of plan.changes) {
            // Check forbidden paths
            for (const forbidden of this.forbiddenPaths) {
                if (change.filePath && change.filePath.startsWith(forbidden)) {
                    errors.push(`Forbidden path: ${change.filePath} (matches ${forbidden})`);
                }
            }

            // Check allowed paths
            const isAllowed = this.allowedPaths.some(allowed =>
                change.filePath && change.filePath.startsWith(allowed)
            );
            if (!isAllowed && change.filePath) {
                errors.push(`Path not in allowlist: ${change.filePath}`);
            }

            // Check for dangerous patterns in content
            if (change.content) {
                const dangerous = [
                    /process\.exit/g,
                    /child_process/g,
                    /eval\s*\(/g,
                    /Function\s*\(/g,
                    /require\s*\(\s*['"`]child/g,
                    /exec\s*\(/g,
                    /execSync/g,
                    /spawn\s*\(/g,
                    /rm\s+-rf/g,
                    /unlink.*\//g,
                ];

                for (const pattern of dangerous) {
                    if (pattern.test(change.content)) {
                        errors.push(`Dangerous pattern detected in ${change.filePath}: ${pattern.source}`);
                    }
                }
            }

            // Check content exists for create actions
            if (change.action === 'create' && (!change.content || change.content.trim().length === 0)) {
                errors.push(`Create action for ${change.filePath} has no content`);
            }
        }

        return errors;
    }

    /**
     * Get a simplified project tree for LLM context.
     * @private
     */
    _getProjectTree() {
        const lines = [];

        const walk = (dir, prefix = '') => {
            try {
                const entries = fs.readdirSync(dir, { withFileTypes: true });
                const filtered = entries.filter(e =>
                    !e.name.startsWith('.') &&
                    e.name !== 'node_modules' &&
                    e.name !== 'data'
                );

                for (const entry of filtered) {
                    const relPath = path.relative(this.projectRoot, path.join(dir, entry.name));

                    if (entry.isDirectory()) {
                        lines.push(`${prefix}${entry.name}/`);
                        walk(path.join(dir, entry.name), prefix + '  ');
                    } else if (entry.name.endsWith('.js') || entry.name.endsWith('.mjs') || entry.name.endsWith('.json') || entry.name.endsWith('.md')) {
                        const size = fs.statSync(path.join(dir, entry.name)).size;
                        lines.push(`${prefix}${entry.name} (${(size / 1024).toFixed(1)}kB)`);
                    }
                }
            } catch { /* skip unreadable dirs */ }
        };

        walk(this.projectRoot);
        return lines.join('\n');
    }
}
