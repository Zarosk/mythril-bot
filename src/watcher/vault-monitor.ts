import * as fs from 'fs';
import * as path from 'path';
import chokidar from 'chokidar';
import { EventEmitter } from 'events';
import { ParsedTask, TaskDiff, QueuedTask } from '../types';
import { parseTask } from './parser';
import { diffTasks, hasMeaningfulChanges } from './differ';

export interface VaultMonitorEvents {
  taskActivated: (task: ParsedTask) => void;
  taskUpdated: (task: ParsedTask, diff: TaskDiff) => void;
  taskQueued: (task: QueuedTask) => void;
  taskCompleted: (filename: string, title: string) => void;
  taskBlocked: (filename: string, title: string) => void;
  error: (error: Error) => void;
}

export class VaultMonitor extends EventEmitter {
  private vaultPath: string;
  private watcher: chokidar.FSWatcher | null = null;
  private lastActiveTask: ParsedTask | null = null;
  private activePath: string;
  private queuePath: string;
  private completedPath: string;
  private blockedPath: string;

  constructor(vaultPath: string) {
    super();
    this.vaultPath = vaultPath;
    this.activePath = path.join(vaultPath, '_orchestra', 'ACTIVE.md');
    this.queuePath = path.join(vaultPath, '_orchestra', 'queue');
    this.completedPath = path.join(vaultPath, '_orchestra', 'completed');
    this.blockedPath = path.join(vaultPath, '_orchestra', 'blocked');
  }

  async start(): Promise<void> {
    // Read initial state of ACTIVE.md
    await this.checkActiveFile();

    // Watch the orchestra directory
    const orchestraPath = path.join(this.vaultPath, '_orchestra');

    this.watcher = chokidar.watch(orchestraPath, {
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 500,
        pollInterval: 100,
      },
    });

    this.watcher.on('change', (filePath: string) => {
      this.handleFileChange(filePath);
    });

    this.watcher.on('add', (filePath: string) => {
      this.handleFileAdd(filePath);
    });

    this.watcher.on('error', (error: Error) => {
      this.emit('error', error);
    });

    console.log(`[VaultMonitor] Watching: ${orchestraPath}`);
  }

  async stop(): Promise<void> {
    if (this.watcher) {
      await this.watcher.close();
      this.watcher = null;
    }
  }

  private async checkActiveFile(): Promise<void> {
    try {
      if (fs.existsSync(this.activePath)) {
        const content = fs.readFileSync(this.activePath, 'utf-8');
        const task = parseTask(content);

        if (this.lastActiveTask === null) {
          this.lastActiveTask = task;
          this.emit('taskActivated', task);
        }
      }
    } catch (error) {
      this.emit('error', error as Error);
    }
  }

  private handleFileChange(filePath: string): void {
    const normalizedPath = path.normalize(filePath);

    if (normalizedPath === path.normalize(this.activePath)) {
      this.handleActiveChange();
    }
  }

  private handleFileAdd(filePath: string): void {
    const normalizedPath = path.normalize(filePath);
    const dir = path.dirname(normalizedPath);

    if (dir === path.normalize(this.queuePath)) {
      this.handleNewQueuedTask(filePath);
    } else if (dir === path.normalize(this.completedPath)) {
      this.handleTaskCompleted(filePath);
    } else if (dir === path.normalize(this.blockedPath)) {
      this.handleTaskBlocked(filePath);
    }
  }

  private handleActiveChange(): void {
    try {
      const content = fs.readFileSync(this.activePath, 'utf-8');
      const newTask = parseTask(content);

      // Skip if content hash is the same
      if (this.lastActiveTask && this.lastActiveTask.contentHash === newTask.contentHash) {
        return;
      }

      const diff = diffTasks(this.lastActiveTask, newTask);

      if (hasMeaningfulChanges(diff)) {
        if (diff.isNewTask) {
          this.emit('taskActivated', newTask);
        } else {
          this.emit('taskUpdated', newTask, diff);
        }
      }

      this.lastActiveTask = newTask;
    } catch (error) {
      this.emit('error', error as Error);
    }
  }

  private handleNewQueuedTask(filePath: string): void {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const task = parseTask(content);

      const queuedTask: QueuedTask = {
        filename: path.basename(filePath),
        title: task.title,
        project: task.metadata.project,
        priority: task.metadata.priority,
      };

      this.emit('taskQueued', queuedTask);
    } catch (error) {
      this.emit('error', error as Error);
    }
  }

  private handleTaskCompleted(filePath: string): void {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const task = parseTask(content);
      this.emit('taskCompleted', path.basename(filePath), task.title);
    } catch (error) {
      this.emit('error', error as Error);
    }
  }

  private handleTaskBlocked(filePath: string): void {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const task = parseTask(content);
      this.emit('taskBlocked', path.basename(filePath), task.title);
    } catch (error) {
      this.emit('error', error as Error);
    }
  }

  getQueuedTasks(): QueuedTask[] {
    const tasks: QueuedTask[] = [];

    try {
      if (!fs.existsSync(this.queuePath)) {
        return tasks;
      }

      const files = fs.readdirSync(this.queuePath);
      for (const file of files) {
        if (file.endsWith('.md')) {
          const filePath = path.join(this.queuePath, file);
          const content = fs.readFileSync(filePath, 'utf-8');
          const task = parseTask(content);

          tasks.push({
            filename: file,
            title: task.title,
            project: task.metadata.project,
            priority: task.metadata.priority,
          });
        }
      }
    } catch (error) {
      console.error('[VaultMonitor] Error reading queue:', error);
    }

    return tasks;
  }

  getCurrentTask(): ParsedTask | null {
    return this.lastActiveTask;
  }
}
