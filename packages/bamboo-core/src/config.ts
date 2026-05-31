import { AuthService } from './auth';

export interface ToolConfig {
    apiKey: string;
    baseUrl: string;
}

export class ConfigService {
    private authService: AuthService;
    private apiBaseUrl: string;

    constructor(authService: AuthService, apiBaseUrl: string = 'https://api.bamboonode.cn') {
        this.authService = authService;
        this.apiBaseUrl = apiBaseUrl;
    }

    /**
     * Get the runtime configuration for a specific tool.
     *
     * The API key (sk-xxx) is stored directly in ~/.bamboo/credentials
     * and was generated during the login flow. No intermediate token needed.
     *
     * Base URL handling:
     *   - Anthropic SDK adds /v1 internally, so ANTHROPIC_BASE_URL must NOT include /v1
     *   - OpenAI SDK expects /v1 in the base URL, so OPENAI_BASE_URL must include /v1
     */
    public async getConfig(toolName: string): Promise<ToolConfig> {
        const apiKey = await this.authService.getToken();
        if (!apiKey) {
            throw new Error('Not logged in. Please run the CLI to start the login flow.');
        }

        // Anthropic SDK appends /v1 itself; OpenAI SDK expects /v1 in the base URL
        const baseUrl = toolName === 'claude'
            ? this.apiBaseUrl
            : `${this.apiBaseUrl}/v1`;

        return { apiKey, baseUrl };
    }
}
