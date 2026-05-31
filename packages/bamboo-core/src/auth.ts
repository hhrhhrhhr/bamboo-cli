import fs from 'fs';
import path from 'path';
import os from 'os';
import http from 'http';
import { exec } from 'child_process';
import readline from 'readline';
import axios from 'axios';

const CREDENTIALS_DIR = path.join(os.homedir(), '.bamboo');
const CREDENTIALS_FILE = path.join(CREDENTIALS_DIR, 'credentials');

// ─── HTML Templates ──────────────────────────────────────────────────

const SUCCESS_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Bamboo CLI - Login Successful</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      display: flex; justify-content: center; align-items: center;
      height: 100vh;
      background: linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 50%, #d1fae5 100%);
    }
    .card {
      text-align: center; padding: 3rem 2.5rem;
      background: white; border-radius: 1rem;
      box-shadow: 0 4px 24px rgba(0,0,0,0.06);
      max-width: 420px; width: 90%;
    }
    .icon { font-size: 3rem; margin-bottom: 1rem; }
    h1 { color: #16a34a; font-size: 1.5rem; margin-bottom: 0.5rem; }
    p { color: #6b7280; line-height: 1.6; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">🎋</div>
    <h1>Login Successful!</h1>
    <p>You can close this tab and return to your terminal.</p>
  </div>
</body>
</html>`;

function errorHtml(message: string): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Bamboo CLI - Login Failed</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      display: flex; justify-content: center; align-items: center;
      height: 100vh;
      background: linear-gradient(135deg, #fef2f2 0%, #fecaca 100%);
    }
    .card {
      text-align: center; padding: 3rem 2.5rem;
      background: white; border-radius: 1rem;
      box-shadow: 0 4px 24px rgba(0,0,0,0.06);
      max-width: 420px; width: 90%;
    }
    .icon { font-size: 3rem; margin-bottom: 1rem; }
    h1 { color: #dc2626; font-size: 1.5rem; margin-bottom: 0.5rem; }
    p { color: #6b7280; line-height: 1.6; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">❌</div>
    <h1>Login Failed</h1>
    <p>${message}</p>
    <p style="margin-top:1rem;">Please close this tab and try again in your terminal.</p>
  </div>
</body>
</html>`;
}

// ─── AuthService ─────────────────────────────────────────────────────

export class AuthService {
    /** new-api URL - used for LLM API calls via /v1 */
    private apiBaseUrl: string;
    /** Libra URL - used for login and API key generation */
    private authUrl: string;

    /**
     * @param apiBaseUrl  new-api base URL (e.g. http://localhost:3010)
     * @param authUrl     Libra base URL  (e.g. http://localhost:2999)
     *                    Defaults to apiBaseUrl when not specified.
     */
    constructor(apiBaseUrl: string = 'https://api.bamboonode.cn', authUrl?: string) {
        this.apiBaseUrl = apiBaseUrl;
        this.authUrl = authUrl || apiBaseUrl;
    }

    // ─── Login (primary + fallback) ─────────────────────────────────

    /**
     * Primary: Browser-based login via Libra → returns sk-xxx API key.
     * Fallback: Terminal email/password login via Libra CLI API.
     *
     * Both paths end with a persistent API key stored in ~/.bamboo/credentials.
     */
    public async login(): Promise<string> {
        try {
            return await this.browserLogin();
        } catch (err: any) {
            console.error(`Bamboo: Browser login unavailable (${err.message}).`);
            console.error('Bamboo: Falling back to terminal login...');
            console.error('');
            return await this.terminalLogin();
        }
    }

    // ─── Browser Login ──────────────────────────────────────────────

    /**
     * 1. Start a local HTTP server on a random port
     * 2. Open the browser to Libra's /api/auth/cli/authorize
     * 3. Libra authenticates the user and creates/finds an sk-xxx API key
     * 4. Libra redirects to our callback with ?api_key=sk-xxx
     * 5. Save the API key to disk
     */
    private browserLogin(): Promise<string> {
        return new Promise((resolve, reject) => {
            const server = http.createServer();
            let timeoutId: NodeJS.Timeout;

            server.listen(0, '127.0.0.1', () => {
                const addr = server.address() as { port: number };
                const port = addr.port;
                const redirectUri = `http://localhost:${port}/callback`;
                const authorizeUrl =
                    `${this.authUrl}/api/auth/cli/authorize?redirect_uri=${encodeURIComponent(redirectUri)}`;

                console.error('');
                console.error('══════════════════════════════════════');
                console.error('       🎋 Bamboo CLI Login');
                console.error('══════════════════════════════════════');
                console.error('');
                console.error('  Opening browser for login...');
                console.error(`  If the browser does not open, visit:`);
                console.error(`  ${authorizeUrl}`);
                console.error('');
                console.error('  Waiting for authentication...');

                openBrowser(authorizeUrl);

                // 5-minute timeout
                timeoutId = setTimeout(() => {
                    server.close();
                    reject(new Error('Login timed out (5 min). Please try again.'));
                }, 5 * 60 * 1000);
            });

            server.on('request', async (req, res) => {
                const reqUrl = new URL(req.url || '/', 'http://localhost');

                if (reqUrl.pathname !== '/callback') {
                    res.writeHead(404);
                    res.end('Not Found');
                    return;
                }

                const apiKey = reqUrl.searchParams.get('api_key');
                const error = reqUrl.searchParams.get('error');

                if (apiKey) {
                    await this.saveApiKey(apiKey);

                    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
                    res.end(SUCCESS_HTML);

                    clearTimeout(timeoutId);
                    server.close();

                    console.error('');
                    console.error('  ✅ Login successful!');
                    console.error(`  API key saved to: ${CREDENTIALS_FILE}`);
                    console.error('');
                    resolve(apiKey);
                } else {
                    const errMsg = error || 'Unknown error';
                    res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
                    res.end(errorHtml(errMsg));

                    clearTimeout(timeoutId);
                    server.close();
                    reject(new Error(`Login failed: ${errMsg}`));
                }
            });

            server.on('error', (err) => {
                clearTimeout(timeoutId);
                reject(new Error(`Failed to start callback server: ${err.message}`));
            });
        });
    }

    // ─── Terminal Login (fallback) ──────────────────────────────────

    /**
     * Prompt email + password in the terminal, then call Libra's
     * /api/auth/cli/login endpoint which returns an sk-xxx API key.
     */
    private async terminalLogin(): Promise<string> {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stderr,
        });

        const ask = (question: string): Promise<string> =>
            new Promise((resolve) => rl.question(question, resolve));

        try {
            console.error('══════════════════════════════════════');
            console.error('  🎋 Bamboo CLI Login (Terminal)');
            console.error('══════════════════════════════════════');
            console.error(`  Server: ${this.authUrl}`);
            console.error('');

            const email = await ask('  Email: ');
            const password = await this.askPassword('  Password: ', rl);
            console.error('');

            if (!email || !password) {
                throw new Error('Email and password are required.');
            }

            console.error('  Authenticating...');
            const resp = await axios.post(
                `${this.authUrl}/api/auth/cli/login`,
                { email, password },
                { headers: { 'Content-Type': 'application/json' } },
            );

            if (!resp.data?.success) {
                throw new Error(resp.data?.message || 'Login failed');
            }

            const apiKey = resp.data.api_key;
            if (!apiKey) {
                throw new Error('Server did not return a valid API key.');
            }

            await this.saveApiKey(apiKey);

            console.error('  ✅ Login successful!');
            console.error(`  API key saved to: ${CREDENTIALS_FILE}`);
            console.error('');

            return apiKey;
        } finally {
            rl.close();
        }
    }

    // ─── Password Prompt (hidden input) ─────────────────────────────

    private askPassword(prompt: string, rl: readline.Interface): Promise<string> {
        return new Promise((resolve) => {
            const stdin = process.stdin;
            const stderr = process.stderr;

            stderr.write(prompt);

            if (stdin.isTTY) {
                stdin.setRawMode(true);
                stdin.resume();
                stdin.setEncoding('utf8');

                let password = '';
                const onData = (char: string) => {
                    const c = char.toString();
                    if (c === '\n' || c === '\r' || c === '\u0004') {
                        stdin.setRawMode(false);
                        stdin.pause();
                        stdin.removeListener('data', onData);
                        stderr.write('\n');
                        resolve(password);
                    } else if (c === '\u0003') {
                        stdin.setRawMode(false);
                        process.exit(1);
                    } else if (c === '\u007f' || c === '\b') {
                        if (password.length > 0) {
                            password = password.slice(0, -1);
                            stderr.write('\b \b');
                        }
                    } else {
                        password += c;
                        stderr.write('*');
                    }
                };
                stdin.on('data', onData);
            } else {
                rl.question('', (answer) => resolve(answer));
            }
        });
    }

    // ─── Credential Storage ─────────────────────────────────────────

    /**
     * Read the stored API key (sk-xxx) from disk.
     *
     * Supports three formats for backward compatibility:
     *  1. JSON  { "api_key": "sk-xxx" }          ← current
     *  2. JSON  { "access_token": "..." }         ← old JWT format (ignored)
     *  3. Plain text "sk-xxx"                     ← legacy
     */
    public async getToken(): Promise<string | null> {
        try {
            if (!fs.existsSync(CREDENTIALS_FILE)) return null;

            const raw = fs.readFileSync(CREDENTIALS_FILE, 'utf-8').trim();
            if (!raw) return null;

            // JSON format
            if (raw.startsWith('{')) {
                const parsed = JSON.parse(raw);

                // Current format
                if (parsed.api_key) return parsed.api_key;

                // Old JWT format - can't use, need re-login
                if (parsed.access_token) return null;

                return null;
            }

            // Plain text - accept if it looks like an API key
            if (raw.startsWith('sk-')) return raw;

            // Old plain-text JWT - can't use
            return null;
        } catch {
            return null;
        }
    }

    private async saveApiKey(apiKey: string): Promise<void> {
        if (!fs.existsSync(CREDENTIALS_DIR)) {
            fs.mkdirSync(CREDENTIALS_DIR, { recursive: true });
        }
        const data = JSON.stringify({ api_key: apiKey }, null, 2);
        fs.writeFileSync(CREDENTIALS_FILE, data, { mode: 0o600 });
    }

    /**
     * Clear stored credentials (logout).
     */
    public async logout(): Promise<void> {
        try {
            if (fs.existsSync(CREDENTIALS_FILE)) {
                fs.unlinkSync(CREDENTIALS_FILE);
                console.error('Bamboo: Logged out. Credentials cleared.');
            }
        } catch {
            // ignore
        }
    }
}

// ─── Utilities ───────────────────────────────────────────────────────

/**
 * Open a URL in the default browser (cross-platform, no external deps).
 */
function openBrowser(url: string): void {
    const escaped = url.replace(/"/g, '\\"');
    const cmd =
        process.platform === 'darwin'  ? `open "${escaped}"` :
        process.platform === 'win32'   ? `start "" "${escaped}"` :
                                         `xdg-open "${escaped}"`;

    exec(cmd, (err) => {
        if (err) {
            console.error(`Bamboo: Could not open browser automatically.`);
        }
    });
}
