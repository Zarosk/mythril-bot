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
import {
  createTaskActivatedEmbed,
  createStatusUpdateEmbed,
  createLogUpdateMessage,
  createTaskQueuedEmbed,
  createTaskCompletedEmbed,
  createTaskBlockedEmbed,
} from './embeds';

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
      console.log(`[OadsBot] Logged in as ${this.client.user?.tag}`);
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
      console.error('[OadsBot] Vault monitor error:', error);
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
      console.error('[OadsBot] Process error:', error);
    });
  }

  private async registerCommands(): Promise<void> {
    try {
      const commands = registerSlashCommands();
      const rest = new REST({ version: '10' }).setToken(this.config.discord.token);

      console.log('[OadsBot] Registering slash commands...');
      await rest.put(
        Routes.applicationGuildCommands(
          this.client.user!.id,
          this.config.discord.guildId
        ),
        { body: commands }
      );
      console.log('[OadsBot] Slash commands registered successfully');
    } catch (error) {
      console.error('[OadsBot] Failed to register slash commands:', error);
    }
  }

  private async initializeChannels(): Promise<void> {
    try {
      const guild = await this.client.guilds.fetch(this.config.discord.guildId);

      const statusCh = await guild.channels.fetch(this.config.discord.statusChannelId);
      if (statusCh instanceof TextChannel) {
        this.statusChannel = statusCh;
        console.log(`[OadsBot] Status channel: #${statusCh.name}`);
      }

      const commandsCh = await guild.channels.fetch(this.config.discord.commandsChannelId);
      if (commandsCh instanceof TextChannel) {
        this.commandsChannel = commandsCh;
        console.log(`[OadsBot] Commands channel: #${commandsCh.name}`);
      }
    } catch (error) {
      console.error('[OadsBot] Error initializing channels:', error);
    }
  }

  private async handleMessage(message: Message): Promise<void> {
    // Ignore bot messages
    if (message.author.bot) return;

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

      console.log(`[OadsBot] Task activated: ${task.id}`);
    } catch (error) {
      console.error('[OadsBot] Error posting task activation:', error);
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
      console.error('[OadsBot] Error posting task update:', error);
    }
  }

  private async handleTaskQueued(task: QueuedTask): Promise<void> {
    if (!this.statusChannel) return;

    try {
      const embed = createTaskQueuedEmbed(task);
      await this.statusChannel.send({ embeds: [embed] });
      console.log(`[OadsBot] Task queued: ${task.title}`);
    } catch (error) {
      console.error('[OadsBot] Error posting queued task:', error);
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

      console.log(`[OadsBot] Task completed: ${title}`);
    } catch (error) {
      console.error('[OadsBot] Error posting task completion:', error);
    }
  }

  private async handleTaskBlocked(filename: string, title: string): Promise<void> {
    if (!this.statusChannel) return;

    try {
      const embed = createTaskBlockedEmbed(filename, title);
      await this.statusChannel.send({ embeds: [embed] });
      console.log(`[OadsBot] Task blocked: ${title}`);
    } catch (error) {
      console.error('[OadsBot] Error posting task blocked:', error);
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
        console.error('[OadsBot] Error stopping streamer:', error);
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
    console.log('[OadsBot] Started output streaming');
  }

  /**
   * Get the active thread for execution output
   */
  getActiveThread(): ThreadChannel | null {
    return this.activeThread;
  }

  async start(): Promise<void> {
    console.log('[OadsBot] Starting...');

    await this.client.login(this.config.discord.token);
    await this.vaultMonitor.start();

    console.log('[OadsBot] Ready!');
  }

  async stop(): Promise<void> {
    console.log('[OadsBot] Stopping...');

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

    console.log('[OadsBot] Stopped.');
  }
}
