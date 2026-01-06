/**
 * Stream Buffer
 * Buffers output and flushes periodically or when threshold is reached.
 * Used to batch Claude Code output before sending to Discord.
 */

export interface StreamBufferOptions {
  flushIntervalMs: number;  // How often to auto-flush (default: 1500ms)
  maxBufferSize: number;    // Force flush when buffer exceeds this (default: 1500 chars)
  onFlush: (content: string) => void | Promise<void>;
}

const DEFAULT_OPTIONS: Omit<StreamBufferOptions, 'onFlush'> = {
  flushIntervalMs: 1500,
  maxBufferSize: 1500,
};

export class StreamBuffer {
  private buffer: string = '';
  private flushInterval: ReturnType<typeof setInterval> | null = null;
  private options: StreamBufferOptions;
  private isFlushing: boolean = false;
  private pendingFlush: string | null = null;

  constructor(options: Partial<StreamBufferOptions> & Pick<StreamBufferOptions, 'onFlush'>) {
    this.options = {
      ...DEFAULT_OPTIONS,
      ...options,
    };
  }

  /**
   * Start the buffer's auto-flush timer
   */
  start(): void {
    if (this.flushInterval) return;

    this.flushInterval = setInterval(() => {
      this.flush();
    }, this.options.flushIntervalMs);
  }

  /**
   * Stop the buffer and flush any remaining content
   */
  async stop(): Promise<void> {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }

    // Final flush
    await this.flush();
  }

  /**
   * Append content to the buffer
   */
  append(chunk: string): void {
    this.buffer += chunk;

    // Force flush if buffer exceeds max size
    if (this.buffer.length >= this.options.maxBufferSize) {
      this.flush();
    }
  }

  /**
   * Flush the current buffer contents
   */
  async flush(): Promise<void> {
    if (this.buffer.length === 0) return;

    // If already flushing, queue this content
    if (this.isFlushing) {
      this.pendingFlush = (this.pendingFlush || '') + this.buffer;
      this.buffer = '';
      return;
    }

    this.isFlushing = true;
    const content = this.buffer;
    this.buffer = '';

    try {
      await this.options.onFlush(content);
    } catch (error) {
      console.error('[StreamBuffer] Flush error:', error);
    } finally {
      this.isFlushing = false;

      // Process any pending content
      if (this.pendingFlush) {
        const pending = this.pendingFlush;
        this.pendingFlush = null;
        this.buffer = pending;
        await this.flush();
      }
    }
  }

  /**
   * Clear the buffer without flushing
   */
  clear(): void {
    this.buffer = '';
    this.pendingFlush = null;
  }

  /**
   * Get current buffer size
   */
  getBufferSize(): number {
    return this.buffer.length;
  }

  /**
   * Check if buffer is running
   */
  isRunning(): boolean {
    return this.flushInterval !== null;
  }
}
