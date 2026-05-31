# Bamboo CLI

Bamboo CLI provides lightweight wrappers for AI coding tools. It centralizes
login through Bamboo, retrieves a user API key, and starts the underlying tool
with the right environment variables.

Current packages:

- `@bamboo/core` - shared login, credential storage, config resolution, and
  process helpers.
- `@bamboo/claude` - wrapper for Anthropic Claude Code.
- `@bamboo/codex` - wrapper for OpenAI Codex CLI.

## Why This Exists

Different coding CLIs expect different authentication and base URL settings.
Bamboo keeps those details in one place:

- Users log in once through Bamboo.
- The API key is stored locally in `~/.bamboo/credentials`.
- `bamboo-claude` launches `claude` with `ANTHROPIC_API_KEY` and
  `ANTHROPIC_BASE_URL`.
- `bamboo-codex` launches `codex` with `OPENAI_API_KEY`,
  `OPENAI_BASE_URL`, and a Bamboo model provider entry.

## Install Dependencies

```bash
pnpm install
```

Install the underlying CLIs separately:

```bash
npm install -g @anthropic-ai/claude-code
npm install -g @openai/codex
```

## Build

```bash
pnpm build
```

Build one package:

```bash
pnpm build:core
pnpm build:claude
pnpm build:codex
```

## Usage

Run Claude Code through Bamboo:

```bash
bamboo-claude
```

Run Codex through Bamboo:

```bash
bamboo-codex
```

You can override Bamboo endpoints when testing:

```bash
BAMBOO_API_BASE="https://api.example.com" \
BAMBOO_AUTH_URL="https://app.example.com" \
bamboo-claude
```

## Credential Storage

Bamboo writes the API key returned by the login flow to:

```text
~/.bamboo/credentials
```

The file is written with `0600` permissions and should never be committed.

## Security Notes

- Do not commit real API keys, tokens, `.env` files, or local credential files.
- Examples should use placeholders such as `$OPENAI_API_KEY`,
  `$ANTHROPIC_API_KEY`, or `sk-xxx`.
- TLS verification is enabled by default. For local development with a trusted
  self-signed endpoint, set `BAMBOO_ALLOW_INSECURE_TLS=1` explicitly.

## Repository Status

This repository is a Bamboo-focused codebase. Legacy docs, release workflows,
and marketing assets from the early fork have been removed from the public
surface.
