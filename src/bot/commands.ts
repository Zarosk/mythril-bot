import { Message } from 'discord.js';
import { VaultMonitor } from '../watcher/vault-monitor';
import { ProcessManager } from '../executor/process-manager';
import { ApprovalService } from '../workflow/approval-service';
import { TaskStatus, parseStatus, canTransition } from '../workflow/state-machine';
import { Config } from '../types';
import {
  createCurrentStatusEmbed,
  createQueueListEmbed,
  createExecutionStartedEmbed,
  createExecutionStoppedEmbed,
  createApprovalEmbed,
  createRejectionEmbed,
} from './embeds';
import logger from '../utils/logger';

const COMMAND_PREFIX = '!oads';

// Forward declaration for OadsBot to avoid circular imports
interface OadsBotInterface {
  startStreaming(): Promise<void>;
}

export interface CommandContext {
  message: Message;
  args: string[];
  vaultMonitor: VaultMonitor;
  processManager: ProcessManager;
  approvalService: ApprovalService;
  config: Config;
  bot?: OadsBotInterface;
}

type CommandHandler = (ctx: CommandContext) => Promise<void>;

const commands: Record<string, CommandHandler> = {
  status: handleStatus,
  queue: handleQueue,
  help: handleHelp,
  start: handleStart,
  stop: handleStop,
  approve: handleApprove,
  reject: handleReject,
};

export async function handleCommand(
  message: Message,
  vaultMonitor: VaultMonitor,
  processManager: ProcessManager,
  approvalService: ApprovalService,
  config: Config,
  bot?: OadsBotInterface
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

  // Show deprecation warning if enabled
  if (config.slashCommands.deprecatePrefixCommands) {
    await message.reply({
      content: `⚠️ **Deprecation Notice:** Prefix commands (\`!oads\`) are deprecated. Please use slash commands (\`/oads\`) instead.\n_This warning will be shown until you switch to slash commands._`,
      allowedMentions: { repliedUser: false },
    });
  }

  try {
    await handler({ message, args, vaultMonitor, processManager, approvalService, config, bot });
  } catch (error) {
    logger.error('Error handling command', { command: commandName, error });
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

async function handleHelp(ctx: CommandContext): Promise<void> {
  const helpText = `
**OADS Bot Commands**

**Status & Info**
\`!oads status\` - Show current active task status
\`!oads queue\` - List queued tasks
\`!oads help\` - Show this help message

**Execution Control**
\`!oads start\` - Start Claude Code execution on active task
\`!oads stop [reason]\` - Stop Claude Code execution gracefully

**Approval Workflow**
\`!oads approve [notes]\` - Approve task completion
\`!oads reject <reason>\` - Reject task and request retry (reason required)
`;

  await ctx.message.reply(helpText);
}

async function handleStart(ctx: CommandContext): Promise<void> {
  const task = ctx.vaultMonitor.getCurrentTask();

  if (!task) {
    await ctx.message.reply('No active task. Activate a task first.');
    return;
  }

  // Check if already executing
  if (ctx.processManager.isRunning()) {
    await ctx.message.reply('Claude Code is already running. Use `!oads stop` to halt it first.');
    return;
  }

  // Validate task status
  const status = parseStatus(task.metadata.status);
  if (!status || !canTransition(status, TaskStatus.EXECUTING)) {
    await ctx.message.reply(`Cannot start task in ${task.metadata.status} status. Task must be IN_PROGRESS.`);
    return;
  }

  try {
    // Start streaming before starting the process
    if (ctx.bot) {
      await ctx.bot.startStreaming();
    }
    await ctx.processManager.start(task);
    const embed = createExecutionStartedEmbed(task);
    await ctx.message.reply({ embeds: [embed] });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    await ctx.message.reply(`Failed to start Claude Code: ${errorMsg}`);
  }
}

async function handleStop(ctx: CommandContext): Promise<void> {
  const reason = ctx.args.join(' ') || undefined;

  if (!ctx.processManager.isRunning()) {
    await ctx.message.reply('Claude Code is not currently running.');
    return;
  }

  try {
    await ctx.processManager.stop(reason);
    const task = ctx.vaultMonitor.getCurrentTask();
    const embed = createExecutionStoppedEmbed(task, reason);
    await ctx.message.reply({ embeds: [embed] });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    await ctx.message.reply(`Failed to stop Claude Code: ${errorMsg}`);
  }
}

async function handleApprove(ctx: CommandContext): Promise<void> {
  const task = ctx.vaultMonitor.getCurrentTask();

  if (!task) {
    await ctx.message.reply('No active task to approve.');
    return;
  }

  // Check if still executing
  if (ctx.processManager.isRunning()) {
    await ctx.message.reply('Task is still executing. Stop execution first with `!oads stop`.');
    return;
  }

  const approver = ctx.message.author.tag;
  const notes = ctx.args.join(' ') || undefined;

  const result = await ctx.approvalService.approve(task, approver, notes);

  if (result.success) {
    const embed = createApprovalEmbed(task, approver, notes);
    await ctx.message.reply({ embeds: [embed] });
  } else {
    await ctx.message.reply(`Approval failed: ${result.message}`);
  }
}

async function handleReject(ctx: CommandContext): Promise<void> {
  const task = ctx.vaultMonitor.getCurrentTask();

  if (!task) {
    await ctx.message.reply('No active task to reject.');
    return;
  }

  // Check if still executing
  if (ctx.processManager.isRunning()) {
    await ctx.message.reply('Task is still executing. Stop execution first with `!oads stop`.');
    return;
  }

  const reason = ctx.args.join(' ');
  if (!reason) {
    await ctx.message.reply('Rejection requires a reason. Usage: `!oads reject <reason>`');
    return;
  }

  const rejector = ctx.message.author.tag;

  const result = await ctx.approvalService.reject(task, rejector, reason);

  if (result.success) {
    const embed = createRejectionEmbed(task, rejector, reason, result.retryCount || 1);
    await ctx.message.reply({ embeds: [embed] });
  } else {
    await ctx.message.reply(`Rejection failed: ${result.message}`);
  }
}
