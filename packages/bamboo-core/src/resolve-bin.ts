import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const isWindows = process.platform === 'win32';

/**
 * Known binary → expected version output substring.
 * Used to verify we found the correct binary, not a different package
 * with the same name (e.g. "codex" static site generator vs OpenAI Codex).
 */
const VERSION_CHECKS: Record<string, string> = {
    claude: 'Claude Code',
    codex: 'codex-cli',
};

/**
 * Resolve a CLI binary from the system PATH.
 *
 * Strategy B: users install the underlying CLI tools globally themselves
 * (e.g. `npm i -g @anthropic-ai/claude-code` or `npm i -g @openai/codex`).
 * Bamboo locates the binary at runtime.
 *
 * Cross-platform: uses `where` on Windows, `which` on macOS/Linux.
 *
 * @param name       The binary name to look up (e.g. "claude", "codex")
 * @param pkgHint    Human-readable install hint shown on failure
 * @returns          Absolute path to the binary
 */
export function resolveBin(name: string, pkgHint: string): string {
    const candidates: string[] = [];

    // 1. Lookup from system PATH (cross-platform)
    const pathResults = lookupFromPath(name);
    for (const p of pathResults) {
        if (!candidates.includes(p)) candidates.push(p);
    }

    // 2. Try common global npm/pnpm paths
    const globalDirs = getGlobalNodeModulesDirs();
    for (const dir of globalDirs) {
        // On Windows, npm creates .cmd shims in the parent of node_modules
        const binDir = isWindows ? path.resolve(dir, '..') : path.join(dir, '.bin');
        const extensions = isWindows ? ['.cmd', '.ps1', '.exe', ''] : [''];

        for (const ext of extensions) {
            const binPath = path.join(binDir, name + ext);
            if (fs.existsSync(binPath) && !candidates.includes(binPath)) {
                candidates.push(binPath);
            }
        }
    }

    // 3. Verify the binary is the one we expect
    const expectedSubstring = VERSION_CHECKS[name];
    for (const binPath of candidates) {
        if (!expectedSubstring || verifyBinary(binPath, expectedSubstring)) {
            return binPath;
        }
    }

    if (candidates.length > 0) {
        throw new Error(
            `Bamboo: Found "${name}" at ${candidates[0]}, but it is not the expected tool.\n` +
            `Please install the correct version:\n\n` +
            `  npm install -g ${pkgHint}\n`,
        );
    }

    throw new Error(
        `Bamboo: Could not find "${name}" binary.\n` +
        `Please install it globally first:\n\n` +
        `  npm install -g ${pkgHint}\n`,
    );
}

/**
 * Use system command to find a binary in PATH.
 *   - Windows: `where <name>` (may return multiple lines)
 *   - macOS/Linux: `which <name>`
 *
 * Returns an array of resolved paths.
 */
function lookupFromPath(name: string): string[] {
    const results: string[] = [];
    const cmd = isWindows ? `where ${name}` : `which ${name}`;

    try {
        const output = execSync(cmd, {
            encoding: 'utf-8',
            timeout: 5000,
            stdio: ['pipe', 'pipe', 'pipe'],
        }).trim();

        if (!output) return results;

        // `where` on Windows can return multiple lines (one per match)
        const lines = output.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
        for (const line of lines) {
            if (fs.existsSync(line)) {
                results.push(line);
            }
        }
    } catch {
        // command not found or binary not in PATH
    }

    return results;
}

/**
 * Run `<bin> --version` and check if the output contains the expected substring.
 */
function verifyBinary(binPath: string, expected: string): boolean {
    try {
        // On Windows, .cmd/.ps1 shims need shell: true to execute
        // On Windows, .cmd/.ps1 shims need shell mode to execute
        const needsShell = isWindows && /\.(cmd|ps1)$/i.test(binPath);
        const cmd = needsShell
            ? `"${binPath}" --version`
            : `"${binPath}" --version`;
        const output = execSync(cmd, {
            encoding: 'utf-8' as BufferEncoding,
            timeout: 5000,
            stdio: ['pipe', 'pipe', 'pipe'],
            ...(needsShell ? { shell: 'cmd.exe' } : {}),
        });
        return output.includes(expected);
    } catch {
        // --version failed; accept the binary anyway (some tools exit non-zero)
        return true;
    }
}

function getGlobalNodeModulesDirs(): string[] {
    const dirs: string[] = [];

    // npm global
    try {
        const npmRoot = execSync('npm root -g', {
            encoding: 'utf-8',
            timeout: 5000,
            stdio: ['pipe', 'pipe', 'pipe'],
        }).trim();
        if (npmRoot) dirs.push(npmRoot);
    } catch { /* ignore */ }

    // pnpm global
    try {
        const pnpmRoot = execSync('pnpm root -g', {
            encoding: 'utf-8',
            timeout: 5000,
            stdio: ['pipe', 'pipe', 'pipe'],
        }).trim();
        if (pnpmRoot) dirs.push(pnpmRoot);
    } catch { /* ignore */ }

    return dirs;
}
