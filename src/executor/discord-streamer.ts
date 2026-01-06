/**
 * Discord Streamer
 * Handles streaming output to Discord with rate limit handling,
 * message splitting, and code block formatting.
 */

import { TextChannel, ThreadChannel } from 'discord.js';
import { StreamBuffer } from './stream-buffer';
import logger from '../utils/logger';

// Discord message limit (2000) minus code block overhead
const MAX_MESSAGE_LENGTH = 1900;
const CODE_BLOCK_OVERHEAD = 8; // ```\n ... \n```

export interface DiscordStreamerOptions {
  channel: TextChannel | ThreadChannel;
  flushIntervalMs?: number;
  maxBufferSize?: number;
  useCodeBlocks?: boolean;
}

export interface StreamStats {
  messagesSent: number;
  totalCharacters: number;
  startTime: Date;
  lastMessageTime: Date | null;
}

export class DiscordStreamer {
  private channel: TextChannel | ThreadChannel;
  private streamBuffer: StreamBuffer;
  private useCodeBlocks: boolean;
  private stats: StreamStats;
  private isTyping: boolean = false;
  private typingInterval: ReturnType<typeof setInterval> | null = null;

  constructor(options: DiscordStreamerOptions) {
    this.channel = options.channel;
    this.useCodeBlocks = options.useCodeBlocks ?? true;
    this.stats = {
      messagesSent: 0,
      totalCharacters: 0,
      startTime: new Date(),
      lastMessageTime: null,
    };

    this.streamBuffer = new StreamBuffer({
      flushIntervalMs: options.flushIntervalMs ?? 1500,
      maxBufferSize: options.maxBufferSize ?? 1500,
      onFlush: (content: string): Promise<void> => this.sendToDiscord(content),
    });
  }

  /**
   * Start streaming (begins typing indicator and buffer)
   */
  async start(): Promise<void> {
    this.streamBuffer.start();
    this.startTypingIndicator();
    this.stats.startTime = new Date();
  }

  /**
   * Stop streaming and send any remaining content
   */
  async stop(): Promise<void> {
    this.stopTypingIndicator();
    await this.streamBuffer.stop();
  }

  /**
   * Append output to the stream
   */
  append(chunk: string): void {
    this.streamBuffer.append(chunk);
  }

  /**
   * Send a final summary message
   */
  async sendSummary(exitCode: number | null, duration: number): Promise<void> {
    const status = exitCode === 0 ? '✅ Completed' : exitCode === null ? '⏹️ Stopped' : `❌ Failed (exit ${exitCode})`;
    const durationStr = this.formatDuration(duration);

    const summary = [
      '─'.repeat(40),
      `**Execution ${status}**`,
      `Duration: ${durationStr}`,
      `Messages: ${this.stats.messagesSent}`,
      `Output: ${this.stats.totalCharacters} characters`,
    ].join('\n');

    await this.channel.send(summary);
  }

  /**
   * Get streaming stats
   */
  getStats(): StreamStats {
    return { ...this.stats };
  }

  /**
   * Send content to Discord, splitting if necessary
   */
  private async sendToDiscord(content: string): Promise<void> {
    if (!content.trim()) return;

    const chunks = this.splitContent(content);

    for (const chunk of chunks) {
      try {
        const message = this.useCodeBlocks ? this.wrapInCodeBlock(chunk) : chunk;
        await this.channel.send(message);
        this.stats.messagesSent++;
        this.stats.totalCharacters += chunk.length;
        this.stats.lastMessageTime = new Date();
      } catch (error) {
        logger.error('DiscordStreamer send error', { error });
        // Rate limit handling - wait and retry once
        if (this.isRateLimitError(error)) {
          await this.sleep(2000);
          try {
            const message = this.useCodeBlocks ? this.wrapInCodeBlock(chunk) : chunk;
            await this.channel.send(message);
            this.stats.messagesSent++;
            this.stats.totalCharacters += chunk.length;
            this.stats.lastMessageTime = new Date();
          } catch (retryError) {
            logger.error('DiscordStreamer retry failed', { error: retryError });
          }
        }
      }
    }
  }

  /**
   * Split content into chunks that fit Discord's message limit
   */
  private splitContent(content: string): string[] {
    const maxLength = this.useCodeBlocks
      ? MAX_MESSAGE_LENGTH - CODE_BLOCK_OVERHEAD
      : MAX_MESSAGE_LENGTH;

    const chunks: string[] = [];
    const lines = content.split('\n');
    let currentChunk = '';

    for (const line of lines) {
      // If single line exceeds limit, split it
      if (line.length > maxLength) {
        if (currentChunk) {
          chunks.push(currentChunk);
          currentChunk = '';
        }
        // Split long line
        for (let i = 0; i < line.length; i += maxLength) {
          chunks.push(line.substring(i, i + maxLength));
        }
        continue;
      }

      // Check if adding this line would exceed limit
      const newLength = currentChunk.length + (currentChunk ? 1 : 0) + line.length;
      if (newLength > maxLength) {
        if (currentChunk) {
          chunks.push(currentChunk);
        }
        currentChunk = line;
      } else {
        currentChunk += (currentChunk ? '\n' : '') + line;
      }
    }

    if (currentChunk) {
      chunks.push(currentChunk);
    }

    return chunks;
  }

  /**
   * Wrap content in a code block
   */
  private wrapInCodeBlock(content: string): string {
    // Escape any backticks in content
    const escaped = content.replace(/```/g, '`\u200B``');
    return '```\n' + escaped + '\n```';
  }

  /**
   * Start the typing indicator
   */
  private startTypingIndicator(): void {
    if (this.isTyping) return;

    this.isTyping = true;

    // Send typing indicator every 8 seconds (Discord shows it for ~10s)
    const sendTyping = async (): Promise<void> => {
      try {
        await this.channel.sendTyping();
      } catch {
        // Ignore typing errors
      }
    };

    sendTyping();
    this.typingInterval = setInterval(sendTyping, 8000);
  }

  /**
   * Stop the typing indicator
   */
  private stopTypingIndicator(): void {
    this.isTyping = false;
    if (this.typingInterval) {
      clearInterval(this.typingInterval);
      this.typingInterval = null;
    }
  }

  /**
   * Check if error is a rate limit error
   */
  private isRateLimitError(error: unknown): boolean {
    if (error && typeof error === 'object' && 'httpStatus' in error) {
      return (error as { httpStatus: number }).httpStatus === 429;
    }
    return false;
  }

  /**
   * Format duration in human-readable format
   */
  private formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise<void>(resolve => setTimeout(resolve, ms));
  }
}
