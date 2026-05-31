#!/usr/bin/env node

import { AuthService, ConfigService, ProcessManager, resolveBin } from '@bamboo/core';

const API_BASE = process.env.BAMBOO_API_BASE || 'https://api.bamboonode.cn';
const AUTH_URL = process.env.BAMBOO_AUTH_URL || 'https://www.bamboonode.cn';

async function main() {
    try {
        const authService = new AuthService(API_BASE, AUTH_URL);
        const configService = new ConfigService(authService, API_BASE);
        const processManager = new ProcessManager();

        // 1. Resolve claude binary from PATH
        const claudeBin = resolveBin('claude', '@anthropic-ai/claude-code');

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
        console.log('Bamboo: Fetching configuration for Claude...');
        const config = await configService.getConfig('claude');

        // 4. Prepare Environment
        const env: NodeJS.ProcessEnv = {
            ANTHROPIC_API_KEY: config.apiKey,
            ANTHROPIC_BASE_URL: config.baseUrl,
        };

        if (process.env.BAMBOO_ALLOW_INSECURE_TLS === '1') {
            env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
        }

        // 5. Spawn claude with user args
        const args = process.argv.slice(2);
        await processManager.run(claudeBin, args, env);

    } catch (error: any) {
        console.error(`Bamboo Error: ${error.message || error}`);
        process.exit(1);
    }
}

main();
