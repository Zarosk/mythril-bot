import {
  Client,
  GatewayIntentBits,
  TextChannel,
  Message,
  ThreadChannel,
  REST,
  Routes,
} from 'discord.js';
import { Config, ParsedTask, TaskDiff, QueuedTask } from '../types';
import { VaultMonitor } from '../watcher/vault-monitor';
import { ProcessManager } from '../executor/process-manager';
import { ApprovalService } from '../workflow/approval-service';
import { DiscordStreamer } from '../executor/discord-streamer';
import { handleCommand } from './commands';
import { registerSlashCommands, handleSlashCommand, handleAutocomplete } from './slash-commands';
import { handleChatMessage } from './chat-handler';
import {
  createTaskActivatedEmbed,
  createStatusUpdateEmbed,
  createLogUpdateMessage,
  createTaskQueuedEmbed,
  createTaskCompletedEmbed,
  createTaskBlockedEmbed,
} from './embeds';
import logger from '../utils/logger';

export class OadsBot {
  private client: Client;
  private config: Config;
  private vaultMonitor: VaultMonitor;
  private processManager: ProcessManager;
  private approvalService: ApprovalService;
  private statusChannel: TextChannel | null = null;
  private commandsChannel: TextChannel | null = null;
  private activeThread: ThreadChannel | null = null;
  private activeStreamer: DiscordStreamer | null = null;
  private executionStartTime: Date | null = null;

  constructor(config: Config) {
    this.config = config;
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
      ],
    });
    this.vaultMonitor = new VaultMonitor(config.paths.vaultPath);
    this.processManager = new ProcessManager(config);
    this.approvalService = new ApprovalService(config.paths.vaultPath);

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.client.on('ready', async () => {
      logger.info('Logged in to Discord', { tag: this.client.user?.tag });
      await this.initializeChannels();

      // Register slash commands if enabled
      if (this.config.slashCommands.enabled) {
        await this.registerCommands();
      }
    });

    this.client.on('messageCreate', (message: Message) => {
      this.handleMessage(message);
    });

    // Handle slash command interactions
    this.client.on('interactionCreate', async (interaction) => {
      if (interaction.isChatInputCommand()) {
        await handleSlashCommand(
          interaction,
          this.vaultMonitor,
          this.processManager,
          this.approvalService,
          this.config,
          this
        );
      } else if (interaction.isAutocomplete()) {
        await handleAutocomplete(interaction, this.vaultMonitor);
      }
    });

    // Vault monitor events
    this.vaultMonitor.on('taskActivated', (task: ParsedTask) => {
      this.handleTaskActivated(task);
    });

    this.vaultMonitor.on('taskUpdated', (task: ParsedTask, diff: TaskDiff) => {
      this.handleTaskUpdated(task, diff);
    });

    this.vaultMonitor.on('taskQueued', (task: QueuedTask) => {
      this.handleTaskQueued(task);
    });

    this.vaultMonitor.on('taskCompleted', (filename: string, title: string) => {
      this.handleTaskCompleted(filename, title);
    });

    this.vaultMonitor.on('taskBlocked', (filename: string, title: string) => {
      this.handleTaskBlocked(filename, title);
    });

    this.vaultMonitor.on('error', (error: Error) => {
      logger.error('Vault monitor error', { error: error.message, stack: error.stack });
    });

    // Process manager events for streaming
    this.processManager.on('started', () => {
      this.executionStartTime = new Date();
    });

    this.processManager.on('output', (data: string) => {
      if (this.activeStreamer) {
        this.activeStreamer.append(data);
      }
    });

    this.processManager.on('completed', async (exitCode: number | null) => {
      await this.handleExecutionCompleted(exitCode);
    });

    this.processManager.on('stopped', async (reason?: string) => {
      await this.handleExecutionStopped(reason);
    });

    this.processManager.on('error', (error: Error) => {
      logger.error('Process error', { error: error.message, stack: error.stack });
    });
  }

  private async registerCommands(): Promise<void> {
    try {
      const commands = registerSlashCommands();
      const rest = new REST({ version: '10' }).setToken(this.config.discord.token);

      logger.info('Registering slash commands...');
      await rest.put(
        Routes.applicationGuildCommands(
          this.client.user!.id,
          this.config.discord.guildId
        ),
        { body: commands }
      );
      logger.info('Slash commands registered successfully');
    } catch (error) {
      logger.error('Failed to register slash commands', { error });
    }
  }

  private async initializeChannels(): Promise<void> {
    try {
      const guild = await this.client.guilds.fetch(this.config.discord.guildId);

      const statusCh = await guild.channels.fetch(this.config.discord.statusChannelId);
      if (statusCh instanceof TextChannel) {
        this.statusChannel = statusCh;
        logger.info('Status channel initialized', { channel: statusCh.name });
      }

      const commandsCh = await guild.channels.fetch(this.config.discord.commandsChannelId);
      if (commandsCh instanceof TextChannel) {
        this.commandsChannel = commandsCh;
        logger.info('Commands channel initialized', { channel: commandsCh.name });
      }
    } catch (error) {
      logger.error('Error initializing channels', { error });
    }
  }

  private async handleMessage(message: Message): Promise<void> {
    // Ignore bot messages
    if (message.author.bot) return;

    // Handle chat channel messages (conversational AI mode)
    if (
      this.config.discord.chatChannelId &&
      message.channel.id === this.config.discord.chatChannelId
    ) {
      await handleChatMessage(message);
      return;
    }

    // Only handle commands in the commands channel
    if (message.channel.id !== this.config.discord.commandsChannelId) return;

    await handleCommand(
      message,
      this.vaultMonitor,
      this.processManager,
      this.approvalService,
      this.config,
      this
    );
  }

  private async handleTaskActivated(task: ParsedTask): Promise<void> {
    if (!this.statusChannel) return;

    try {
      const embed = createTaskActivatedEmbed(task);
      const message = await this.statusChannel.send({ embeds: [embed] });

      // Create a thread for execution log updates
      this.activeThread = await message.startThread({
        name: `${task.id} - Execution Log`,
        autoArchiveDuration: 1440, // 24 hours
      });

      logger.info('Task activated', { taskId: task.id, title: task.title });
    } catch (error) {
      logger.error('Error posting task activation', { taskId: task.id, error });
    }
  }

  private async handleTaskUpdated(task: ParsedTask, diff: TaskDiff): Promise<void> {
    try {
      // Post status/criteria changes to status channel
      if (diff.statusChanged || diff.criteriaChanged) {
        if (this.statusChannel) {
          const embed = createStatusUpdateEmbed(task, diff);
          await this.statusChannel.send({ embeds: [embed] });
        }
      }

      // Post log entries to thread
      if (diff.newLogEntries.length > 0 && this.activeThread) {
        const logMessage = createLogUpdateMessage(task, diff.newLogEntries);
        await this.activeThread.send(logMessage);
      }
    } catch (error) {
      logger.error('Error posting task update', { taskId: task.id, error });
    }
  }

  private async handleTaskQueued(task: QueuedTask): Promise<void> {
    if (!this.statusChannel) return;

    try {
      const embed = createTaskQueuedEmbed(task);
      await this.statusChannel.send({ embeds: [embed] });
      logger.info('Task queued', { title: task.title, project: task.project });
    } catch (error) {
      logger.error('Error posting queued task', { title: task.title, error });
    }
  }

  private async handleTaskCompleted(filename: string, title: string): Promise<void> {
    if (!this.statusChannel) return;

    try {
      const embed = createTaskCompletedEmbed(filename, title);
      await this.statusChannel.send({ embeds: [embed] });

      // Archive the thread
      if (this.activeThread) {
        await this.activeThread.setArchived(true);
        this.activeThread = null;
      }

      logger.info('Task completed', { filename, title });
    } catch (error) {
      logger.error('Error posting task completion', { filename, title, error });
    }
  }

  private async handleTaskBlocked(filename: string, title: string): Promise<void> {
    if (!this.statusChannel) return;

    try {
      const embed = createTaskBlockedEmbed(filename, title);
      await this.statusChannel.send({ embeds: [embed] });
      logger.info('Task blocked', { filename, title });
    } catch (error) {
      logger.error('Error posting task blocked', { filename, title, error });
    }
  }

  private async handleExecutionCompleted(exitCode: number | null): Promise<void> {
    await this.stopStreamer(exitCode);
  }

  private async handleExecutionStopped(_reason?: string): Promise<void> {
    await this.stopStreamer(null);
  }

  private async stopStreamer(exitCode: number | null): Promise<void> {
    if (this.activeStreamer) {
      try {
        const duration = this.executionStartTime
          ? Date.now() - this.executionStartTime.getTime()
          : 0;
        await this.activeStreamer.stop();
        await this.activeStreamer.sendSummary(exitCode, duration);
      } catch (error) {
        logger.error('Error stopping streamer', { error });
      }
      this.activeStreamer = null;
    }
    this.executionStartTime = null;
  }

  /**
   * Start streaming output to the active thread
   * Called when execution begins
   */
  async startStreaming(): Promise<void> {
    if (!this.activeThread || !this.config.streaming.enabled) {
      return;
    }

    // Stop any existing streamer
    if (this.activeStreamer) {
      await this.activeStreamer.stop();
    }

    this.activeStreamer = new DiscordStreamer({
      channel: this.activeThread,
      flushIntervalMs: this.config.streaming.bufferIntervalMs,
      maxBufferSize: this.config.streaming.maxBufferSize,
      useCodeBlocks: true,
    });

    await this.activeStreamer.start();
    logger.info('Started output streaming');
  }

  /**
   * Get the active thread for execution output
   */
  getActiveThread(): ThreadChannel | null {
    return this.activeThread;
  }

  async start(): Promise<void> {
    logger.info('Starting bot...');

    await this.client.login(this.config.discord.token);
    await this.vaultMonitor.start();

    logger.info('Bot ready');
  }

  async stop(): Promise<void> {
    logger.info('Stopping bot...');

    // Stop streamer if running
    if (this.activeStreamer) {
      await this.activeStreamer.stop();
      this.activeStreamer = null;
    }

    // Stop Claude Code process if running
    if (this.processManager.isRunning()) {
      await this.processManager.stop('Bot shutdown');
    }

    await this.vaultMonitor.stop();
    this.client.destroy();

    logger.info('Bot stopped');
  }
}
