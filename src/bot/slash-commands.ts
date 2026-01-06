/**
 * Slash Commands
 * Discord slash command registration and handling for OADS bot.
 * Migrates from prefix commands (!oads) to slash commands (/oads).
 */

import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  AutocompleteInteraction,
  RESTPostAPIChatInputApplicationCommandsJSONBody,
} from 'discord.js';
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

// Forward declaration for OadsBot to avoid circular imports
interface OadsBotInterface {
  startStreaming(): Promise<void>;
  getActiveThread(): unknown;
}

/**
 * Build and return slash command definitions
 */
export function registerSlashCommands(): RESTPostAPIChatInputApplicationCommandsJSONBody[] {
  const oadsCommand = new SlashCommandBuilder()
    .setName('oads')
    .setDescription('OADS Orchestra Control')
    .addSubcommand(sub =>
      sub
        .setName('status')
        .setDescription('Show current active task status')
    )
    .addSubcommand(sub =>
      sub
        .setName('queue')
        .setDescription('List queued tasks')
    )
    .addSubcommand(sub =>
      sub
        .setName('list')
        .setDescription('List tasks with optional filter')
        .addStringOption(opt =>
          opt
            .setName('filter')
            .setDescription('Filter tasks by status')
            .setRequired(false)
            .addChoices(
              { name: 'All', value: 'all' },
              { name: 'Queued', value: 'queued' },
              { name: 'Active', value: 'active' },
              { name: 'Completed', value: 'completed' }
            )
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('start')
        .setDescription('Start Claude Code execution on active task')
    )
    .addSubcommand(sub =>
      sub
        .setName('stop')
        .setDescription('Stop Claude Code execution gracefully')
        .addStringOption(opt =>
          opt
            .setName('reason')
            .setDescription('Reason for stopping')
            .setRequired(false)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('approve')
        .setDescription('Approve task completion')
        .addStringOption(opt =>
          opt
            .setName('notes')
            .setDescription('Optional approval notes')
            .setRequired(false)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('reject')
        .setDescription('Reject task and request retry')
        .addStringOption(opt =>
          opt
            .setName('reason')
            .setDescription('Reason for rejection (required)')
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('pick')
        .setDescription('Pick a task from the queue')
        .addStringOption(opt =>
          opt
            .setName('task')
            .setDescription('Task file to activate')
            .setRequired(true)
            .setAutocomplete(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('help')
        .setDescription('Show help information')
        .addStringOption(opt =>
          opt
            .setName('command')
            .setDescription('Specific command to get help for')
            .setRequired(false)
            .addChoices(
              { name: 'status', value: 'status' },
              { name: 'queue', value: 'queue' },
              { name: 'list', value: 'list' },
              { name: 'start', value: 'start' },
              { name: 'stop', value: 'stop' },
              { name: 'approve', value: 'approve' },
              { name: 'reject', value: 'reject' },
              { name: 'pick', value: 'pick' },
              { name: 'brain', value: 'brain' }
            )
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('brain')
        .setDescription('Add a note to the brain')
        .addStringOption(opt =>
          opt
            .setName('content')
            .setDescription('Note content')
            .setRequired(true)
        )
        .addStringOption(opt =>
          opt
            .setName('project')
            .setDescription('Optional project name')
            .setRequired(false)
        )
    );

  return [oadsCommand.toJSON()];
}

/**
 * Handle slash command interactions
 */
export async function handleSlashCommand(
  interaction: ChatInputCommandInteraction,
  vaultMonitor: VaultMonitor,
  processManager: ProcessManager,
  approvalService: ApprovalService,
  config: Config,
  bot: OadsBotInterface
): Promise<void> {
  if (interaction.commandName !== 'oads') return;

  const subcommand = interaction.options.getSubcommand();

  try {
    switch (subcommand) {
      case 'status':
        await handleStatus(interaction, vaultMonitor);
        break;
      case 'queue':
        await handleQueue(interaction, vaultMonitor);
        break;
      case 'list':
        await handleList(interaction, vaultMonitor);
        break;
      case 'start':
        await handleStart(interaction, vaultMonitor, processManager, bot);
        break;
      case 'stop':
        await handleStop(interaction, vaultMonitor, processManager);
        break;
      case 'approve':
        await handleApprove(interaction, vaultMonitor, processManager, approvalService);
        break;
      case 'reject':
        await handleReject(interaction, vaultMonitor, processManager, approvalService);
        break;
      case 'pick':
        await handlePick(interaction, vaultMonitor);
        break;
      case 'help':
        await handleHelp(interaction);
        break;
      case 'brain':
        await handleBrain(interaction, config);
        break;
      default:
        await interaction.reply({
          content: `Unknown subcommand: ${subcommand}`,
          ephemeral: true,
        });
    }
  } catch (error) {
    console.error(`[SlashCommands] Error handling /${subcommand}:`, error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({
        content: `An error occurred: ${errorMessage}`,
        ephemeral: true,
      });
    } else {
      await interaction.reply({
        content: `An error occurred: ${errorMessage}`,
        ephemeral: true,
      });
    }
  }
}

/**
 * Handle autocomplete interactions
 */
export async function handleAutocomplete(
  interaction: AutocompleteInteraction,
  vaultMonitor: VaultMonitor
): Promise<void> {
  if (interaction.commandName !== 'oads') return;

  const focusedOption = interaction.options.getFocused(true);

  if (focusedOption.name === 'task') {
    // Provide autocomplete for task selection
    const tasks = vaultMonitor.getQueuedTasks();
    const filtered = tasks
      .filter(t =>
        t.filename.toLowerCase().includes(focusedOption.value.toLowerCase()) ||
        t.title.toLowerCase().includes(focusedOption.value.toLowerCase())
      )
      .slice(0, 25); // Discord limit

    await interaction.respond(
      filtered.map(t => ({
        name: `${t.filename.replace('.md', '')} - ${t.title}`.substring(0, 100),
        value: t.filename,
      }))
    );
  }
}

// Individual command handlers

async function handleStatus(
  interaction: ChatInputCommandInteraction,
  vaultMonitor: VaultMonitor
): Promise<void> {
  const task = vaultMonitor.getCurrentTask();
  const embed = createCurrentStatusEmbed(task);
  await interaction.reply({ embeds: [embed] });
}

async function handleQueue(
  interaction: ChatInputCommandInteraction,
  vaultMonitor: VaultMonitor
): Promise<void> {
  const tasks = vaultMonitor.getQueuedTasks();
  const embed = createQueueListEmbed(tasks);
  await interaction.reply({ embeds: [embed] });
}

async function handleList(
  interaction: ChatInputCommandInteraction,
  vaultMonitor: VaultMonitor
): Promise<void> {
  const filter = interaction.options.getString('filter') || 'all';

  // For now, we only have access to queue and current task
  // TODO: Add access to completed/blocked tasks
  const tasks = vaultMonitor.getQueuedTasks();
  const currentTask = vaultMonitor.getCurrentTask();

  let description = '';

  if (filter === 'all' || filter === 'active') {
    if (currentTask) {
      description += `**Active:**\n• ${currentTask.id}: ${currentTask.title}\n\n`;
    }
  }

  if (filter === 'all' || filter === 'queued') {
    if (tasks.length > 0) {
      description += `**Queued:**\n`;
      tasks.forEach((t, i) => {
        description += `${i + 1}. ${t.title} (${t.project || 'N/A'})\n`;
      });
    } else if (filter === 'queued') {
      description = 'No tasks in queue.';
    }
  }

  if (!description) {
    description = 'No tasks found.';
  }

  await interaction.reply({
    embeds: [{
      title: '📋 Task List',
      description: description.substring(0, 4000),
      color: 0x0099ff,
      timestamp: new Date().toISOString(),
    }],
  });
}

async function handleStart(
  interaction: ChatInputCommandInteraction,
  vaultMonitor: VaultMonitor,
  processManager: ProcessManager,
  bot: OadsBotInterface
): Promise<void> {
  const task = vaultMonitor.getCurrentTask();

  if (!task) {
    await interaction.reply({
      content: 'No active task. Activate a task first.',
      ephemeral: true,
    });
    return;
  }

  if (processManager.isRunning()) {
    await interaction.reply({
      content: 'Claude Code is already running. Use `/oads stop` to halt it first.',
      ephemeral: true,
    });
    return;
  }

  const status = parseStatus(task.metadata.status);
  if (!status || !canTransition(status, TaskStatus.EXECUTING)) {
    await interaction.reply({
      content: `Cannot start task in ${task.metadata.status} status. Task must be IN_PROGRESS.`,
      ephemeral: true,
    });
    return;
  }

  // Defer reply since starting may take a moment
  await interaction.deferReply();

  try {
    // Start streaming before starting the process
    await bot.startStreaming();
    await processManager.start(task);

    const embed = createExecutionStartedEmbed(task);
    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    await interaction.editReply(`Failed to start Claude Code: ${errorMsg}`);
  }
}

async function handleStop(
  interaction: ChatInputCommandInteraction,
  vaultMonitor: VaultMonitor,
  processManager: ProcessManager
): Promise<void> {
  const reason = interaction.options.getString('reason') || undefined;

  if (!processManager.isRunning()) {
    await interaction.reply({
      content: 'Claude Code is not currently running.',
      ephemeral: true,
    });
    return;
  }

  await interaction.deferReply();

  try {
    await processManager.stop(reason);
    const task = vaultMonitor.getCurrentTask();
    const embed = createExecutionStoppedEmbed(task, reason);
    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    await interaction.editReply(`Failed to stop Claude Code: ${errorMsg}`);
  }
}

async function handleApprove(
  interaction: ChatInputCommandInteraction,
  vaultMonitor: VaultMonitor,
  processManager: ProcessManager,
  approvalService: ApprovalService
): Promise<void> {
  const task = vaultMonitor.getCurrentTask();

  if (!task) {
    await interaction.reply({
      content: 'No active task to approve.',
      ephemeral: true,
    });
    return;
  }

  if (processManager.isRunning()) {
    await interaction.reply({
      content: 'Task is still executing. Stop execution first with `/oads stop`.',
      ephemeral: true,
    });
    return;
  }

  const approver = interaction.user.tag;
  const notes = interaction.options.getString('notes') || undefined;

  await interaction.deferReply();

  const result = await approvalService.approve(task, approver, notes);

  if (result.success) {
    const embed = createApprovalEmbed(task, approver, notes);
    await interaction.editReply({ embeds: [embed] });
  } else {
    await interaction.editReply(`Approval failed: ${result.message}`);
  }
}

async function handleReject(
  interaction: ChatInputCommandInteraction,
  vaultMonitor: VaultMonitor,
  processManager: ProcessManager,
  approvalService: ApprovalService
): Promise<void> {
  const task = vaultMonitor.getCurrentTask();

  if (!task) {
    await interaction.reply({
      content: 'No active task to reject.',
      ephemeral: true,
    });
    return;
  }

  if (processManager.isRunning()) {
    await interaction.reply({
      content: 'Task is still executing. Stop execution first with `/oads stop`.',
      ephemeral: true,
    });
    return;
  }

  const reason = interaction.options.getString('reason', true); // Required
  const rejector = interaction.user.tag;

  await interaction.deferReply();

  const result = await approvalService.reject(task, rejector, reason);

  if (result.success) {
    const embed = createRejectionEmbed(task, rejector, reason, result.retryCount || 1);
    await interaction.editReply({ embeds: [embed] });
  } else {
    await interaction.editReply(`Rejection failed: ${result.message}`);
  }
}

async function handlePick(
  interaction: ChatInputCommandInteraction,
  _vaultMonitor: VaultMonitor
): Promise<void> {
  const taskFile = interaction.options.getString('task', true);

  // TODO: Implement task activation from queue
  // This would move the task from queue to ACTIVE.md

  await interaction.reply({
    content: `Task picking not yet implemented. Selected: ${taskFile}`,
    ephemeral: true,
  });
}

async function handleHelp(interaction: ChatInputCommandInteraction): Promise<void> {
  const command = interaction.options.getString('command');

  const commandHelp: Record<string, { title: string; description: string }> = {
    status: {
      title: '/oads status',
      description: 'Shows the current active task status including:\n• Task ID and title\n• Current status\n• Progress on acceptance criteria\n• Recent execution log entries',
    },
    queue: {
      title: '/oads queue',
      description: 'Lists all tasks waiting in the queue with their:\n• Title\n• Project\n• Priority',
    },
    list: {
      title: '/oads list [filter]',
      description: 'Lists tasks with optional filtering.\n\n**Filters:**\n• `all` - Show all tasks\n• `queued` - Show only queued tasks\n• `active` - Show only active task\n• `completed` - Show completed tasks',
    },
    start: {
      title: '/oads start',
      description: 'Starts Claude Code execution on the active task.\n\nRequirements:\n• A task must be active\n• Task must be in IN_PROGRESS status\n• No other execution running\n\nOutput is streamed to the task thread in real-time.',
    },
    stop: {
      title: '/oads stop [reason]',
      description: 'Gracefully stops Claude Code execution.\n\n**Options:**\n• `reason` - Optional reason for stopping\n\nThe process is first sent SIGTERM, then SIGKILL if needed.',
    },
    approve: {
      title: '/oads approve [notes]',
      description: 'Approves task completion and moves it to completed.\n\n**Options:**\n• `notes` - Optional approval notes\n\nRequirements:\n• Execution must be stopped first',
    },
    reject: {
      title: '/oads reject <reason>',
      description: 'Rejects the task and returns it for retry.\n\n**Options:**\n• `reason` - Required reason for rejection\n\nRequirements:\n• Execution must be stopped first',
    },
    pick: {
      title: '/oads pick <task>',
      description: 'Picks a task from the queue to activate.\n\n**Options:**\n• `task` - Task file to activate (autocomplete available)\n\nUse Tab to see available tasks.',
    },
    brain: {
      title: '/oads brain <content> [project]',
      description: 'Add a note to the brain.\n\n**Options:**\n• `content` - Note content (required)\n• `project` - Optional project name\n\nNotes are stored via the Brain API.',
    },
  };

  if (command && commandHelp[command]) {
    const help = commandHelp[command];
    await interaction.reply({
      embeds: [{
        title: help.title,
        description: help.description,
        color: 0x0099ff,
      }],
    });
  } else {
    const generalHelp = `
**OADS Bot Commands**

**Status & Info**
\`/oads status\` - Show current active task status
\`/oads queue\` - List queued tasks
\`/oads list [filter]\` - List tasks with optional filter
\`/oads help [command]\` - Show help

**Execution Control**
\`/oads start\` - Start Claude Code execution
\`/oads stop [reason]\` - Stop execution gracefully

**Approval Workflow**
\`/oads approve [notes]\` - Approve task completion
\`/oads reject <reason>\` - Reject task for retry

**Task Selection**
\`/oads pick <task>\` - Pick task from queue (Tab for autocomplete)

**Brain**
\`/oads brain <content> [project]\` - Add a note to the brain

Use \`/oads help <command>\` for detailed info on any command.
`;

    await interaction.reply({
      embeds: [{
        title: '📚 OADS Bot Help',
        description: generalHelp,
        color: 0x0099ff,
      }],
    });
  }
}

async function handleBrain(
  interaction: ChatInputCommandInteraction,
  config: Config
): Promise<void> {
  const content = interaction.options.getString('content', true);
  const project = interaction.options.getString('project') || undefined;

  if (!config.brainApi.apiKey) {
    await interaction.reply({
      content: 'Brain API key not configured. Set BRAIN_API_KEY in your environment.',
      ephemeral: true,
    });
    return;
  }

  await interaction.deferReply();

  try {
    const response = await fetch(`${config.brainApi.url}/api/v1/notes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': config.brainApi.apiKey,
      },
      body: JSON.stringify({
        content,
        project,
        source: 'discord',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API returned ${response.status}: ${errorText}`);
    }

    const result = await response.json() as { id?: string | number };

    await interaction.editReply({
      embeds: [{
        title: 'Note Added to Brain',
        description: content.length > 200 ? content.substring(0, 200) + '...' : content,
        color: 0x00ff00,
        fields: [
          ...(project ? [{ name: 'Project', value: project, inline: true }] : []),
          ...(result.id ? [{ name: 'Note ID', value: String(result.id), inline: true }] : []),
        ],
        timestamp: new Date().toISOString(),
      }],
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    await interaction.editReply(`Failed to add note to brain: ${errorMsg}`);
  }
}
