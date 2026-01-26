#!/usr/bin/env node

/**
 * Verification script for workspace linking
 * Tests that npm workspaces are configured correctly
 */

import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';

console.log('🔍 Verifying workspace configuration...\n');

const checks = [];

// Check 1: Workspace root package.json exists
console.log('✓ Check 1: Workspace root package.json exists');
checks.push(existsSync('package.json'));

// Check 2: Workspaces are defined
console.log('✓ Check 2: Workspaces are defined in package.json');
try {
  const pkg = JSON.parse(execSync('cat package.json', { encoding: 'utf-8' }));
  checks.push(Array.isArray(pkg.workspaces) && pkg.workspaces.includes('packages/*'));
} catch (e) {
  checks.push(false);
}

// Check 3: npm recognizes workspaces
console.log('✓ Check 3: npm recognizes workspaces');
try {
  const output = execSync('npm ls --workspaces --depth=0', { encoding: 'utf-8' });
  checks.push(output.includes('citation-mcp-server') && output.includes('research-assistant'));
} catch (e) {
  checks.push(false);
}

// Check 4: TypeScript base config exists
console.log('✓ Check 4: TypeScript base config exists');
checks.push(existsSync('tsconfig.base.json'));

// Check 5: Jest base config exists
console.log('✓ Check 5: Jest base config exists');
checks.push(existsSync('jest.config.base.js'));

// Check 6: MCP server builds successfully
console.log('✓ Check 6: MCP server builds successfully');
try {
  execSync('npm run build -w citation-mcp-server', { stdio: 'pipe' });
  checks.push(existsSync('packages/mcp-server/dist/index.js'));
} catch (e) {
  checks.push(false);
}

// Check 7: VS Code extension compiles successfully
console.log('✓ Check 7: VS Code extension compiles successfully');
try {
  execSync('npm run compile -w research-assistant', { stdio: 'pipe' });
  checks.push(existsSync('packages/vscode-extension/out/extension.js'));
} catch (e) {
  checks.push(false);
}

// Check 8: Workspace-level build works
console.log('✓ Check 8: Workspace-level build works');
try {
  execSync('npm run build', { stdio: 'pipe' });
  checks.push(true);
} catch (e) {
  checks.push(false);
}

// Check 9: Package directories exist
console.log('✓ Check 9: Package directories exist');
const packagesExist = [
  'packages/core',
  'packages/mcp-server',
  'packages/vscode-extension'
].every(dir => existsSync(dir));
checks.push(packagesExist);

// Check 10: Core package structure is ready
console.log('✓ Check 10: Core package structure is ready');
const coreStructure = [
  'packages/core/src',
  'packages/core/tests',
  'packages/core/src/managers',
  'packages/core/src/services',
  'packages/core/src/parsers',
  'packages/core/src/types',
  'packages/core/src/utils'
].every(dir => existsSync(dir));
checks.push(coreStructure);

// Summary
console.log('\n' + '='.repeat(50));
const passed = checks.filter(Boolean).length;
const total = checks.length;

if (passed === total) {
  console.log(`✅ All ${total} checks passed!`);
  console.log('\nWorkspace linking is configured correctly.');
  console.log('Ready to proceed with Phase 2: Extract Core Types');
  process.exit(0);
} else {
  console.log(`❌ ${total - passed} of ${total} checks failed`);
  console.log('\nWorkspace linking needs attention.');
  process.exit(1);
}
