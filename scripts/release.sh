#!/bin/bash
set -e

echo "Release is intentionally manual for now."
echo ""
echo "Public-release checklist:"
echo "  1. Review README.md and package metadata."
echo "  2. Run: pnpm install --frozen-lockfile"
echo "  3. Run: pnpm build"
echo "  4. Publish selected packages explicitly:"
echo "       npm publish packages/bamboo-core --access public"
echo "       npm publish packages/bamboo-claude --access public"
echo "       npm publish packages/bamboo-codex --access public"
echo ""
echo "This script does not push Docker images or publish packages automatically."

echo ""
echo "========================================="
echo "🎉 发布完成!"
echo "========================================="
