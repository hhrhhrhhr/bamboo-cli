#!/usr/bin/env node

import { AuthService, ConfigService, ProcessManager, resolveBin } from '@bamboo/core';
import path from 'path';
import fs from 'fs';
import os from 'os';

const API_BASE = process.env.BAMBOO_API_BASE || 'https://api.bamboonode.cn';
const AUTH_URL = process.env.BAMBOO_AUTH_URL || 'https://www.bamboonode.cn';

const CODEX_HOME = path.join(os.homedir(), '.codex');
const CODEX_AUTH_PATH = path.join(CODEX_HOME, 'auth.json');
const CODEX_CONFIG_PATH = path.join(CODEX_HOME, 'config.toml');

const PROVIDER_NAME = 'bamboo-proxy';

/**
 * Sync Bamboo API key into Codex's auth.json so Codex CLI can authenticate.
 * Codex reads auth.json on startup; env vars alone are not enough.
 */
function syncCodexAuth(apiKey: string): void {
    fs.mkdirSync(CODEX_HOME, { recursive: true });
    const auth = {
        auth_mode: 'apikey',
        OPENAI_API_KEY: apiKey,
    };
    fs.writeFileSync(CODEX_AUTH_PATH, JSON.stringify(auth, null, 2), 'utf-8');
}

/**
 * Ensure a "bamboo-proxy" model provider block exists in Codex config.toml.
 *
 * Uses the Responses API (/v1/responses) which is the only wire_api
 * supported by Codex CLI v0.101+.
 */
function ensureCodexProvider(baseUrl: string): void {
    const providerSection = `[model_providers.${PROVIDER_NAME}]`;

    let content = '';
    if (fs.existsSync(CODEX_CONFIG_PATH)) {
        content = fs.readFileSync(CODEX_CONFIG_PATH, 'utf-8');
    }

    // Build the provider block - wire_api defaults to "responses"
    const providerBlock = [
        providerSection,
        `name = "Bamboo Proxy"`,
        `base_url = "${baseUrl}"`,
        `env_key = "OPENAI_API_KEY"`,
    ].join('\n');

    if (content.includes(providerSection)) {
        // Replace existing block - find from header to next section or EOF
        const regex = new RegExp(
            `\\[model_providers\\.${PROVIDER_NAME}\\][\\s\\S]*?(?=\\n\\[|$)`,
        );
        content = content.replace(regex, providerBlock + '\n');
    } else {
        // Append provider block
        content = content.trimEnd() + '\n\n' + providerBlock + '\n';
    }

    fs.writeFileSync(CODEX_CONFIG_PATH, content, 'utf-8');
}

async function main() {
    try {
        const authService = new AuthService(API_BASE, AUTH_URL);
        const configService = new ConfigService(authService, API_BASE);
        const processManager = new ProcessManager();

        // 1. Resolve codex binary from PATH
        const codexBin = resolveBin('codex', '@openai/codex');

        // 2. Check Login
        let apiKey = await authService.getToken();
        if (!apiKey) {
            console.log('Bamboo: Not logged in. Starting login flow...');
            try {
                apiKey = await authService.login();
                console.log('Bamboo: Login successful!');
            } catch (err: any) {
                console.error(`Bamboo: Login failed - ${err.message || err}`);
                process.exit(1);
            }
        }

        // 3. Get Config
        console.log('Bamboo: Fetching configuration for Codex...');
        const config = await configService.getConfig('codex');

        // 4. Sync credentials and provider into Codex config
        syncCodexAuth(config.apiKey);
        ensureCodexProvider(config.baseUrl);

        // 5. Prepare Environment
        const env: NodeJS.ProcessEnv = {
            OPENAI_API_KEY: config.apiKey,
            OPENAI_BASE_URL: config.baseUrl,
        };

        if (process.env.BAMBOO_ALLOW_INSECURE_TLS === '1') {
            env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
        }

        // 6. Spawn - inject -c model_provider="bamboo-proxy" if user hasn't specified one
        const userArgs = process.argv.slice(2);
        const hasProvider = userArgs.some(
            (a, i) => a.startsWith('model_provider=')
                || (i > 0 && userArgs[i - 1] === '-c' && a.startsWith('model_provider')),
        );
        const extraArgs = hasProvider ? [] : ['-c', `model_provider="${PROVIDER_NAME}"`];

        const args = [...extraArgs, ...userArgs];
        await processManager.run(codexBin, args, env);

    } catch (error: any) {
        console.error(`Bamboo Error: ${error.message || error}`);
        process.exit(1);
    }
}

main();
