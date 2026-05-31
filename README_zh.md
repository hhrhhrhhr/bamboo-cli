# Bamboo CLI

Bamboo CLI 是一组面向 AI 编程工具的轻量包装器。它通过 Bamboo 完成统一登录，获取用户 API Key，并用正确的环境变量启动底层 CLI。

当前包：

- `@bamboo/core`：登录、凭据存储、配置解析和进程启动的共享逻辑。
- `@bamboo/claude`：Anthropic Claude Code 的包装器。
- `@bamboo/codex`：OpenAI Codex CLI 的包装器。

## 项目目标

不同 AI 编程 CLI 对认证方式和 Base URL 的要求不一样。Bamboo 把这些细节收敛到统一入口：

- 用户只需要通过 Bamboo 登录一次。
- API Key 存储在本机 `~/.bamboo/credentials`。
- `bamboo-claude` 会为 `claude` 注入 `ANTHROPIC_API_KEY` 和 `ANTHROPIC_BASE_URL`。
- `bamboo-codex` 会为 `codex` 注入 `OPENAI_API_KEY`、`OPENAI_BASE_URL`，并写入 Bamboo 模型提供商配置。

## 安装依赖

```bash
pnpm install
```

底层 CLI 需要单独安装：

```bash
npm install -g @anthropic-ai/claude-code
npm install -g @openai/codex
```

## 构建

```bash
pnpm build
```

单独构建某个包：

```bash
pnpm build:core
pnpm build:claude
pnpm build:codex
```

## 使用

通过 Bamboo 启动 Claude Code：

```bash
bamboo-claude
```

通过 Bamboo 启动 Codex：

```bash
bamboo-codex
```

测试环境可以覆盖 Bamboo 服务地址：

```bash
BAMBOO_API_BASE="https://api.example.com" \
BAMBOO_AUTH_URL="https://app.example.com" \
bamboo-claude
```

## 凭据存储

Bamboo 会把登录流程返回的 API Key 写入：

```text
~/.bamboo/credentials
```

该文件会以 `0600` 权限写入，不应该提交到仓库。

## 安全说明

- 不要提交真实 API Key、token、`.env` 文件或本地凭据文件。
- 示例里只使用 `$OPENAI_API_KEY`、`$ANTHROPIC_API_KEY`、`sk-xxx` 这类占位符。
- 默认启用 TLS 校验。如果本地开发确实要连接可信的自签名服务，需要显式设置 `BAMBOO_ALLOW_INSECURE_TLS=1`。

## 仓库状态

这个仓库已经整理为 Bamboo 项目。早期 fork 带来的旧文档、旧发布 workflow 和旧营销资源已经从公开表面移除。
