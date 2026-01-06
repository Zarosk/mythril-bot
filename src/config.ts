import { config as dotenvConfig } from 'dotenv';
import { Config } from './types';

dotenvConfig();

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optionalEnv(name: string, defaultValue: string): string {
  return process.env[name] || defaultValue;
}

export function loadConfig(): Config {
  return {
    discord: {
      token: requireEnv('DISCORD_BOT_TOKEN'),
      guildId: requireEnv('DISCORD_GUILD_ID'),
      commandsChannelId: requireEnv('DISCORD_COMMANDS_CHANNEL_ID'),
      statusChannelId: requireEnv('DISCORD_STATUS_CHANNEL_ID'),
      alertsChannelId: requireEnv('DISCORD_ALERTS_CHANNEL_ID'),
      decisionsChannelId: requireEnv('DISCORD_DECISIONS_CHANNEL_ID'),
    },
    paths: {
      vaultPath: requireEnv('OBSIDIAN_VAULT_PATH'),
      codeProjectsPath: requireEnv('CODE_PROJECTS_PATH'),
      claudeCodePath: optionalEnv('CLAUDE_CODE_PATH', 'claude'),
    },
    settings: {
      logLevel: optionalEnv('LOG_LEVEL', 'info'),
      maxConcurrentInstances: parseInt(optionalEnv('MAX_CONCURRENT_INSTANCES', '3'), 10),
      pollIntervalMs: parseInt(optionalEnv('POLL_INTERVAL_MS', '5000'), 10),
    },
  };
}

export const config = loadConfig();
