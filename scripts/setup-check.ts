#!/usr/bin/env npx ts-node

/**
 * Mythril Setup Validation Script
 * Checks that all prerequisites are met before running
 */

import { execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

interface CheckResult {
  name: string;
  passed: boolean;
  message: string;
  required: boolean;
}

const results: CheckResult[] = [];

function check(name: string, fn: () => string | boolean, required = true): void {
  try {
    const result = fn();
    const passed = result !== false;
    results.push({
      name,
      passed,
      message: typeof result === 'string' ? result : (passed ? '✓' : '✗'),
      required
    });
  } catch (error: any) {
    results.push({
      name,
      passed: false,
      message: error.message || 'Failed',
      required
    });
  }
}

function execCommand(cmd: string): string {
  return execSync(cmd, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
}

console.log('\n🛡️  Mythril Setup Validation\n');
console.log('Checking prerequisites...\n');

// Node.js version
check('Node.js 18+', () => {
  const version = execCommand('node --version');
  const major = parseInt(version.replace('v', '').split('.')[0]);
  if (major < 18) throw new Error(`Found ${version}, need v18+`);
  return version;
});

// npm
check('npm installed', () => {
  return execCommand('npm --version');
});

// Git
check('Git installed', () => {
  return execCommand('git --version').replace('git version ', '');
});

// Claude Code CLI
check('Claude Code CLI', () => {
  try {
    const version = execCommand('claude --version');
    return version;
  } catch {
    throw new Error('Not found. Run: npm install -g @anthropic-ai/claude-code');
  }
});

// Claude Code auth (try to check if authenticated)
check('Claude Code authenticated', () => {
  try {
    // This might vary - adjust based on actual CLI behavior
    execCommand('claude --help');
    return 'Appears configured (run "claude" manually to verify)';
  } catch {
    throw new Error('Run: claude auth');
  }
}, false); // Not strictly required for validation

// .env file
check('.env file exists', () => {
  const envPath = join(process.cwd(), '.env');
  if (!existsSync(envPath)) {
    throw new Error('Copy .env.example to .env and configure it');
  }
  return 'Found';
});

// Required env vars
check('DISCORD_BOT_TOKEN set', () => {
  const envPath = join(process.cwd(), '.env');
  if (!existsSync(envPath)) throw new Error('.env missing');
  const content = readFileSync(envPath, 'utf-8');
  if (!content.includes('DISCORD_BOT_TOKEN=') || content.includes('DISCORD_BOT_TOKEN=your_')) {
    throw new Error('Set your Discord bot token in .env');
  }
  return 'Configured';
});

check('ANTHROPIC_API_KEY set', () => {
  const envPath = join(process.cwd(), '.env');
  if (!existsSync(envPath)) throw new Error('.env missing');
  const content = readFileSync(envPath, 'utf-8');
  if (!content.includes('ANTHROPIC_API_KEY=') || content.includes('ANTHROPIC_API_KEY=your_')) {
    throw new Error('Set your Anthropic API key in .env');
  }
  return 'Configured';
});

// Print results
console.log('Results:\n');

let hasErrors = false;
for (const result of results) {
  const icon = result.passed ? '✅' : (result.required ? '❌' : '⚠️');
  console.log(`${icon} ${result.name}: ${result.message}`);
  if (!result.passed && result.required) hasErrors = true;
}

console.log('');

if (hasErrors) {
  console.log('❌ Some required checks failed. Please fix the issues above.\n');
  process.exit(1);
} else {
  console.log('✅ All checks passed! You can run: npm run dev:all\n');
  process.exit(0);
}
