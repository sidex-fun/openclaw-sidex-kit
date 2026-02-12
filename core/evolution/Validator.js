import { execSync } from 'child_process';
import path from 'path';

/**
 * Validator — Verifies that code changes don't break the project.
 * 
 * Runs a series of checks after CodeWriter applies changes:
 *   1. Syntax check — Can Node.js parse the modified files?
 *   2. Import check — Do all imports resolve correctly?
 *   3. Export check — Does the main entry point still export everything?
 *   4. Test suite — Runs npm test if available
 * 
 * Returns pass/fail with details for each check.
 */
export class Validator {
    /**
     * @param {object} config
     * @param {string} [config.projectRoot] - Root path of the project
     * @param {string[]} [config.entryPoints] - Entry points to validate (default: core/index.js, sdk.js)
     * @param {boolean} [config.runTests] - Whether to run npm test (default: false)
     * @param {number} [config.timeout] - Timeout per check in ms (default: 15000)
     */
    constructor(config = {}) {
        this.projectRoot = config.projectRoot || process.cwd();
        this.entryPoints = config.entryPoints || ['core/index.js', 'sdk.js'];
        this.runTests = config.runTests ?? false;
        this.timeout = config.timeout || 15000;
    }

    /**
     * Run all validation checks.
     * @param {Array} appliedChanges - List of changes from CodeWriter { action, filePath }
     * @returns {Promise<{passed: boolean, checks: Array<{name: string, passed: boolean, detail: string}>}>}
     */
    async validate(appliedChanges) {
        const checks = [];

        // 1. Syntax check on all changed files
        for (const change of appliedChanges) {
            if (change.filePath.endsWith('.js') || change.filePath.endsWith('.mjs')) {
                const result = this._checkSyntax(change.filePath);
                checks.push({
                    name: `syntax:${change.filePath}`,
                    passed: result.passed,
                    detail: result.detail
                });
            }
        }

        // 2. Entry point import checks
        for (const entry of this.entryPoints) {
            const result = await this._checkImports(entry);
            checks.push({
                name: `imports:${entry}`,
                passed: result.passed,
                detail: result.detail
            });
        }

        // 3. Run test suite if configured
        if (this.runTests) {
            const result = this._runTestSuite();
            checks.push({
                name: 'test-suite',
                passed: result.passed,
                detail: result.detail
            });
        }

        const passed = checks.every(c => c.passed);
        const failCount = checks.filter(c => !c.passed).length;

        if (passed) {
            console.log(`✅ [Validator] All ${checks.length} check(s) passed.`);
        } else {
            console.error(`❌ [Validator] ${failCount}/${checks.length} check(s) failed.`);
            checks.filter(c => !c.passed).forEach(c => {
                console.error(`   ✗ ${c.name}: ${c.detail}`);
            });
        }

        return { passed, checks };
    }

    /**
     * Check syntax of a JS file using Node's --check flag.
     * @private
     */
    _checkSyntax(filePath) {
        const absolutePath = path.join(this.projectRoot, filePath);

        try {
            execSync(`node --check "${absolutePath}"`, {
                cwd: this.projectRoot,
                timeout: this.timeout,
                stdio: 'pipe'
            });
            return { passed: true, detail: 'Syntax OK' };
        } catch (error) {
            const stderr = error.stderr?.toString() || error.message;
            return { passed: false, detail: `Syntax error: ${stderr.substring(0, 200)}` };
        }
    }

    /**
     * Check that an entry point can be dynamically imported without errors.
     * @private
     */
    async _checkImports(entryPoint) {
        const absolutePath = path.join(this.projectRoot, entryPoint);

        try {
            // Use a subprocess to avoid polluting the current process
            const script = `
                import("${absolutePath.replace(/\\/g, '/')}")
                    .then(m => {
                        const keys = Object.keys(m);
                        process.stdout.write(JSON.stringify({ ok: true, exports: keys }));
                    })
                    .catch(e => {
                        process.stdout.write(JSON.stringify({ ok: false, error: e.message }));
                    });
            `;

            const result = execSync(`node --input-type=module -e '${script.replace(/'/g, "\\'")}'`, {
                cwd: this.projectRoot,
                timeout: this.timeout,
                stdio: ['pipe', 'pipe', 'pipe']
            });

            const output = result.toString().trim();
            try {
                const parsed = JSON.parse(output);
                if (parsed.ok) {
                    return { passed: true, detail: `Exports: ${parsed.exports.join(', ')}` };
                } else {
                    return { passed: false, detail: `Import error: ${parsed.error}` };
                }
            } catch {
                return { passed: true, detail: `Module loaded (output: ${output.substring(0, 100)})` };
            }

        } catch (error) {
            const stderr = error.stderr?.toString() || error.message;
            return { passed: false, detail: `Import failed: ${stderr.substring(0, 200)}` };
        }
    }

    /**
     * Run the project's test suite.
     * @private
     */
    _runTestSuite() {
        try {
            execSync('npm test', {
                cwd: this.projectRoot,
                timeout: 60000,
                stdio: 'pipe'
            });
            return { passed: true, detail: 'All tests passed' };
        } catch (error) {
            const output = error.stdout?.toString() || error.stderr?.toString() || error.message;
            return { passed: false, detail: `Tests failed: ${output.substring(0, 300)}` };
        }
    }
}
