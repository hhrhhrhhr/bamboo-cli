# CLAUDE.md

This file gives coding agents the minimum useful context for working in this
repository.

## Project Overview

Bamboo CLI is a pnpm monorepo with three packages:

- `packages/bamboo-core` (`@bamboo/core`): shared authentication, credential
  storage, Bamboo endpoint configuration, binary resolution, and process
  management.
- `packages/bamboo-claude` (`@bamboo/claude`): starts the `claude` binary with
  Bamboo-provided Anthropic-compatible environment variables.
- `packages/bamboo-codex` (`@bamboo/codex`): starts the `codex` binary with
  Bamboo-provided OpenAI-compatible environment variables and writes a Codex
  model provider entry.

## Commands

```bash
pnpm install
pnpm build
pnpm build:core
pnpm build:claude
pnpm build:codex
```

Package-level builds run `tsc`.

## Runtime Configuration

Default endpoints:

- `BAMBOO_API_BASE=https://api.bamboonode.cn`
- `BAMBOO_AUTH_URL=https://www.bamboonode.cn`

Local credentials are stored in `~/.bamboo/credentials` with `0600`
permissions. Never commit real credentials or local configuration files.

TLS verification is enabled by default. Only set
`BAMBOO_ALLOW_INSECURE_TLS=1` for trusted local development endpoints.

## Security Expectations

- Keep examples as placeholders: `$OPENAI_API_KEY`, `$ANTHROPIC_API_KEY`, or
  `sk-xxx`.
- Do not add `.env` files, generated credentials, local logs, or user-specific
  tool config to the repository.
- If adding docs that discuss credentials, explicitly point users to
  environment variables or `~/.bamboo/credentials`, not committed files.

## Code Style

- TypeScript source is under `packages/*/src`.
- Keep comments short and useful.
- Prefer narrow changes that follow the current package boundaries.
- Run `pnpm build` after changes that touch package code.
