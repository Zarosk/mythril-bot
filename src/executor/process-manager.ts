/**
 * Process Manager
 * Manages Claude Code subprocess lifecycle
 */

import { exec, ChildProcess } from 'child_process';
import * as fs from 'fs';
import { EventEmitter } from 'events';
import { Config, ParsedTask } from '../types';

export interface ProcessManagerEvents {
  started: () => void;
  output: (data: string) => void;
  completed: (exitCode: number | null) => void;
  error: (error: Error) => void;
  stopped: (reason?: string) => void;
}

export interface ProcessState {
  isRunning: boolean;
  taskId: string | null;
  startTime: Date | null;
  pid: number | null;
}

export class ProcessManager extends EventEmitter {
  private config: Config;
  private process: ChildProcess | null = null;
  private currentTaskId: string | null = null;
  private startTime: Date | null = null;
  private outputBuffer: string[] = [];
  private gracefulStopTimeoutMs: number;
  private executionTimeoutMs: number;
  private executionTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(config: Config) {
    super();
    this.config = config;
    this.gracefulStopTimeoutMs = parseInt(
      process.env.GRACEFUL_STOP_TIMEOUT_MS || '10000',
      10
    );
    this.executionTimeoutMs = parseInt(
      process.env.EXECUTION_TIMEOUT_MS || '3600000',
      10
    );
  }

  getState(): ProcessState {
    return {
      isRunning: this.process !== null,
      taskId: this.currentTaskId,
      startTime: this.startTime,
      pid: this.process?.pid || null,
    };
  }

  isRunning(): boolean {
    return this.process !== null;
  }

  getOutput(): string[] {
    return [...this.outputBuffer];
  }

  async start(task: ParsedTask): Promise<void> {
    if (this.process) {
      throw new Error('Claude Code is already running');
    }

    this.currentTaskId = task.id;
    this.startTime = new Date();
    this.outputBuffer = [];

    const claudeCodePath = this.config.paths.claudeCodePath;
    const workingDir = task.metadata.repoPath || this.config.paths.codeProjectsPath;

    // Construct the prompt for Claude Code
    const prompt = this.buildPrompt(task);

    // Ensure working directory exists
    if (!fs.existsSync(workingDir)) {
      fs.mkdirSync(workingDir, { recursive: true });
    }

    try {
      // Escape quotes in prompt for shell command
      const escapedPrompt = prompt.replace(/"/g, '\\"');
      const command = `${claudeCodePath} --dangerously-skip-permissions -p "${escapedPrompt}"`;

      console.log(`[ProcessManager] Executing in: ${workingDir}`);
      console.log(`[ProcessManager] Command: claude -p "..."`);

      this.process = exec(command, {
        cwd: workingDir,
        env: { ...process.env },
        maxBuffer: 50 * 1024 * 1024, // 50MB buffer for large outputs
      }, (error, stdout, stderr) => {
        if (error) {
          console.error('[ProcessManager] Exec error:', error.message);
          return;
        }
        if (stdout) {
          console.log('[ProcessManager] Final output length:', stdout.length);
        }
        if (stderr) {
          console.error('[ProcessManager] Stderr:', stderr);
        }
      });

      // Stream output as it comes
      this.process.stdout?.on('data', (data: Buffer) => {
        const text = data.toString();
        console.log('[Claude]', text);
        this.outputBuffer.push(text);
        this.emit('output', text);
      });

      this.process.stderr?.on('data', (data: Buffer) => {
        const text = data.toString();
        console.error('[Claude Error]', text);
        this.outputBuffer.push(`[stderr] ${text}`);
        this.emit('output', `[stderr] ${text}`);
      });

      this.setupProcessHandlers();
      this.setupExecutionTimeout();

      this.emit('started');
      console.log(`[ProcessManager] Started Claude Code for task ${task.id}, PID: ${this.process.pid}`);
    } catch (error) {
      this.cleanup();
      throw error;
    }
  }

  private buildPrompt(task: ParsedTask): string {
    const criteriaList = task.acceptanceCriteria
      .map(c => `- [${c.completed ? 'x' : ' '}] ${c.text}`)
      .join('\n');

    return `Execute task: ${task.id} - ${task.title}

${task.description}

Acceptance Criteria:
${criteriaList}

Instructions:
1. Work through each acceptance criterion
2. Update the task file as you complete work
3. When done, set status to PENDING_REVIEW`;
  }

  private setupProcessHandlers(): void {
    if (!this.process) return;

    // stdout/stderr handlers are set up inline in start() method

    this.process.on('close', (code: number | null) => {
      console.log(`[ProcessManager] Claude Code exited with code ${code}`);
      this.cleanup();
      this.emit('completed', code);
    });

    this.process.on('error', (error: Error) => {
      console.error('[ProcessManager] Process error:', error);
      this.cleanup();
      this.emit('error', error);
    });
  }

  private setupExecutionTimeout(): void {
    this.executionTimeout = setTimeout(() => {
      console.warn('[ProcessManager] Execution timeout reached');
      this.stop('Execution timeout reached');
    }, this.executionTimeoutMs);
  }

  async stop(reason?: string): Promise<void> {
    if (!this.process) {
      console.log('[ProcessManager] No process running');
      return;
    }

    console.log(`[ProcessManager] Stopping Claude Code${reason ? `: ${reason}` : ''}`);

    return new Promise((resolve) => {
      const forceKillTimeout = setTimeout(() => {
        if (this.process) {
          console.log('[ProcessManager] Force killing process');
          this.process.kill('SIGKILL');
        }
        this.cleanup();
        this.emit('stopped', reason);
        resolve();
      }, this.gracefulStopTimeoutMs);

      if (this.process) {
        this.process.once('close', () => {
          clearTimeout(forceKillTimeout);
          this.cleanup();
          this.emit('stopped', reason);
          resolve();
        });

        // Try graceful termination first
        this.process.kill('SIGTERM');
      }
    });
  }

  private cleanup(): void {
    if (this.executionTimeout) {
      clearTimeout(this.executionTimeout);
      this.executionTimeout = null;
    }
    this.process = null;
    this.currentTaskId = null;
    this.startTime = null;
  }

  async killOrphanedProcesses(): Promise<void> {
    // Implementation depends on platform
    // For now, just ensure our tracked process is stopped
    if (this.process) {
      await this.stop('Cleaning up orphaned process');
    }
  }
}
