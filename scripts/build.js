#!/usr/bin/env node

const { execSync } = require('child_process');

console.log('Building Bamboo CLI workspace...');

try {
  console.log('Building @bamboo/core...');
  execSync('pnpm --filter @bamboo/core build', { stdio: 'inherit' });

  console.log('Building @bamboo/claude...');
  execSync('pnpm --filter @bamboo/claude build', { stdio: 'inherit' });

  console.log('Building @bamboo/codex...');
  execSync('pnpm --filter @bamboo/codex build', { stdio: 'inherit' });

  console.log('\n✅ Build completed successfully!');
  console.log('\nArtifacts are available in packages/*/dist:');
  console.log('  - packages/bamboo-core/dist/');
  console.log('  - packages/bamboo-claude/dist/');
  console.log('  - packages/bamboo-codex/dist/');
} catch (error) {
  console.error('Build failed:', error.message);
  process.exit(1);
}
