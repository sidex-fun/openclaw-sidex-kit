import fs from 'fs';
import path from 'path';

/**
 * CodeWriter — Executes implementation plans by writing files to disk.
 * 
 * Applies changes from a CodePlanner plan with safety guardrails:
 *   - Backs up modified files before overwriting
 *   - Validates file paths against allowlist
 *   - Creates directories as needed
 *   - Tracks all changes for potential rollback
 */
export class CodeWriter {
    /**
     * @param {object} config
     * @param {string} [config.projectRoot] - Root path of the project
     * @param {string} [config.backupDir] - Directory for file backups before modification
     * @param {string[]} [config.allowedPaths] - Paths the writer is allowed to touch
     * @param {string[]} [config.forbiddenPaths] - Paths that must never be touched
     * @param {number} [config.maxFileSize] - Max file size in bytes (default: 50KB)
     */
    constructor(config = {}) {
        this.projectRoot = config.projectRoot || process.cwd();
        this.backupDir = config.backupDir || path.join(this.projectRoot, 'data', 'evolution', 'backups');
        this.maxFileSize = config.maxFileSize || 50 * 1024; // 50KB

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
            'core/evolution/',
        ];

        this._appliedChanges = [];
    }

    /**
     * Apply a plan's changes to disk.
     * @param {object} plan - Plan from CodePlanner { changes: [...] }
     * @returns {{ success: boolean, applied: Array, errors: string[] }}
     */
    async apply(plan) {
        if (!plan || !plan.changes || plan.changes.length === 0) {
            return { success: false, applied: [], errors: ['No changes in plan'] };
        }

        this._appliedChanges = [];
        const errors = [];

        // Create backup directory for this run
        const runId = `run-${Date.now()}`;
        const runBackupDir = path.join(this.backupDir, runId);

        for (const change of plan.changes) {
            try {
                // Validate path
                const pathError = this._validatePath(change.filePath);
                if (pathError) {
                    errors.push(pathError);
                    continue;
                }

                // Validate content size
                if (change.content && Buffer.byteLength(change.content) > this.maxFileSize) {
                    errors.push(`File ${change.filePath} exceeds max size (${this.maxFileSize} bytes)`);
                    continue;
                }

                const absolutePath = path.join(this.projectRoot, change.filePath);

                if (change.action === 'modify') {
                    // Backup existing file
                    if (fs.existsSync(absolutePath)) {
                        await this._backupFile(absolutePath, runBackupDir, change.filePath);
                    }
                    // Write new content
                    this._writeFile(absolutePath, change.content);
                    this._appliedChanges.push({ action: 'modify', filePath: change.filePath, backupDir: runBackupDir });
                    console.log(`   ✏️  Modified: ${change.filePath}`);

                } else if (change.action === 'create') {
                    if (fs.existsSync(absolutePath)) {
                        // File already exists — treat as modify with backup
                        await this._backupFile(absolutePath, runBackupDir, change.filePath);
                        console.log(`   ⚠️  File exists, overwriting with backup: ${change.filePath}`);
                    }
                    this._writeFile(absolutePath, change.content);
                    this._appliedChanges.push({ action: 'create', filePath: change.filePath, backupDir: runBackupDir });
                    console.log(`   📄 Created: ${change.filePath}`);

                } else {
                    errors.push(`Unknown action "${change.action}" for ${change.filePath}`);
                }

            } catch (error) {
                errors.push(`Failed to apply ${change.filePath}: ${error.message}`);
            }
        }

        const success = errors.length === 0 && this._appliedChanges.length > 0;

        if (success) {
            console.log(`✅ [CodeWriter] Applied ${this._appliedChanges.length} change(s) successfully.`);
        } else if (this._appliedChanges.length > 0) {
            console.warn(`⚠️ [CodeWriter] Applied ${this._appliedChanges.length} change(s) with ${errors.length} error(s).`);
        }

        return { success, applied: [...this._appliedChanges], errors };
    }

    /**
     * Rollback all changes from the last apply().
     * @returns {{ success: boolean, rolled: number, errors: string[] }}
     */
    async rollback() {
        const errors = [];
        let rolled = 0;

        for (const change of this._appliedChanges.reverse()) {
            try {
                const absolutePath = path.join(this.projectRoot, change.filePath);

                if (change.action === 'create') {
                    // Delete created file
                    if (fs.existsSync(absolutePath)) {
                        fs.unlinkSync(absolutePath);
                        rolled++;
                        console.log(`   🔙 Deleted: ${change.filePath}`);
                    }

                } else if (change.action === 'modify') {
                    // Restore from backup
                    const backupPath = path.join(change.backupDir, change.filePath);
                    if (fs.existsSync(backupPath)) {
                        fs.copyFileSync(backupPath, absolutePath);
                        rolled++;
                        console.log(`   🔙 Restored: ${change.filePath}`);
                    } else {
                        errors.push(`No backup found for ${change.filePath}`);
                    }
                }
            } catch (error) {
                errors.push(`Rollback failed for ${change.filePath}: ${error.message}`);
            }
        }

        this._appliedChanges = [];

        console.log(`🔙 [CodeWriter] Rolled back ${rolled} change(s).`);
        return { success: errors.length === 0, rolled, errors };
    }

    /**
     * Get list of applied changes.
     * @returns {Array}
     */
    getAppliedChanges() {
        return [...this._appliedChanges];
    }

    // --- Internal ---

    _validatePath(filePath) {
        if (!filePath) return 'Empty file path';

        // Prevent path traversal
        if (filePath.includes('..')) return `Path traversal detected: ${filePath}`;

        // Check forbidden
        for (const forbidden of this.forbiddenPaths) {
            if (filePath.startsWith(forbidden)) {
                return `Forbidden path: ${filePath}`;
            }
        }

        // Check allowed
        const isAllowed = this.allowedPaths.some(allowed => filePath.startsWith(allowed));
        if (!isAllowed) {
            return `Path not in allowlist: ${filePath}`;
        }

        return null;
    }

    async _backupFile(absolutePath, backupDir, relativePath) {
        const backupPath = path.join(backupDir, relativePath);
        const backupFileDir = path.dirname(backupPath);

        if (!fs.existsSync(backupFileDir)) {
            fs.mkdirSync(backupFileDir, { recursive: true });
        }

        fs.copyFileSync(absolutePath, backupPath);
    }

    _writeFile(absolutePath, content) {
        const dir = path.dirname(absolutePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(absolutePath, content, 'utf8');
    }
}
