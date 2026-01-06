import { Message } from 'discord.js';
import { VaultMonitor } from '../watcher/vault-monitor';
import {
  createCurrentStatusEmbed,
  createQueueListEmbed,
} from './embeds';

const COMMAND_PREFIX = '!oads';

export interface CommandContext {
  message: Message;
  args: string[];
  vaultMonitor: VaultMonitor;
}

type CommandHandler = (ctx: CommandContext) => Promise<void>;

const commands: Record<string, CommandHandler> = {
  status: handleStatus,
  queue: handleQueue,
  help: handleHelp,
};

export async function handleCommand(
  message: Message,
  vaultMonitor: VaultMonitor
): Promise<boolean> {
  const content = message.content.trim();

  if (!content.startsWith(COMMAND_PREFIX)) {
    return false;
  }

  const parts = content.slice(COMMAND_PREFIX.length).trim().split(/\s+/);
  const commandName = parts[0]?.toLowerCase();
  const args = parts.slice(1);

  if (!commandName) {
    await message.reply('Usage: `!oads <command>`. Try `!oads help` for available commands.');
    return true;
  }

  const handler = commands[commandName];
  if (!handler) {
    await message.reply(`Unknown command: \`${commandName}\`. Try \`!oads help\` for available commands.`);
    return true;
  }

  try {
    await handler({ message, args, vaultMonitor });
  } catch (error) {
    console.error(`[Commands] Error handling command ${commandName}:`, error);
    await message.reply('An error occurred while processing your command.');
  }

  return true;
}

async function handleStatus(ctx: CommandContext): Promise<void> {
  const task = ctx.vaultMonitor.getCurrentTask();
  const embed = createCurrentStatusEmbed(task);
  await ctx.message.reply({ embeds: [embed] });
}

async function handleQueue(ctx: CommandContext): Promise<void> {
  const tasks = ctx.vaultMonitor.getQueuedTasks();
  const embed = createQueueListEmbed(tasks);
  await ctx.message.reply({ embeds: [embed] });
}

async function handleHelp(_ctx: CommandContext): Promise<void> {
  const helpText = `
**OADS Bot Commands**

\`!oads status\` - Show current active task status
\`!oads queue\` - List queued tasks
\`!oads help\` - Show this help message

*Note: activate, block, complete, and history commands are planned for future releases.*
`;

  await _ctx.message.reply(helpText);
}
