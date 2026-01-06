import {
  Client,
  GatewayIntentBits,
  TextChannel,
  Message,
  ThreadChannel,
} from 'discord.js';
import { Config, ParsedTask, TaskDiff, QueuedTask } from '../types';
import { VaultMonitor } from '../watcher/vault-monitor';
import { ProcessManager } from '../executor/process-manager';
import { ApprovalService } from '../workflow/approval-service';
import { handleCommand } from './commands';
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
    this.client.on('ready', () => {
      console.log(`[OadsBot] Logged in as ${this.client.user?.tag}`);
      this.initializeChannels();
    });

    this.client.on('messageCreate', (message: Message) => {
      this.handleMessage(message);
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
      this.config
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

  async start(): Promise<void> {
    console.log('[OadsBot] Starting...');

    await this.client.login(this.config.discord.token);
    await this.vaultMonitor.start();

    console.log('[OadsBot] Ready!');
  }

  async stop(): Promise<void> {
    console.log('[OadsBot] Stopping...');

    // Stop Claude Code process if running
    if (this.processManager.isRunning()) {
      await this.processManager.stop('Bot shutdown');
    }

    await this.vaultMonitor.stop();
    this.client.destroy();

    console.log('[OadsBot] Stopped.');
  }
}
