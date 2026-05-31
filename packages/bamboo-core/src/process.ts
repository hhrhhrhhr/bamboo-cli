import { spawn } from 'child_process';

export class ProcessManager {
    /**
     * Spawns a child process with full stdio inheritance.
     * Uses child_process.spawn directly - no need for execa dependency.
     * Propagates the child's exit code to the parent.
     *
     * Cross-platform: on Windows, .cmd/.bat shims require `shell: true`
     * for spawn to execute them correctly.
     */
    public async run(command: string, args: string[], env: NodeJS.ProcessEnv): Promise<void> {
        const finalEnv = { ...process.env, ...env };

        // Windows .cmd/.bat shims need shell: true
        const needsShell =
            process.platform === 'win32' && /\.(cmd|bat)$/i.test(command);

        return new Promise((resolve, reject) => {
            const child = spawn(command, args, {
                env: finalEnv,
                stdio: 'inherit',
                shell: needsShell,
            });

            child.on('error', (err) => {
                reject(new Error(`Failed to start process "${command}": ${err.message}`));
            });

            child.on('exit', (code, signal) => {
                if (signal) {
                    // Child was killed by a signal
                    process.exit(1);
                }
                // Propagate child's exit code
                process.exit(code ?? 0);
            });
        });
    }
}
