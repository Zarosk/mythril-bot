/**
 * File Mover
 * Handles moving task files between directories (queue, completed, blocked)
 */

import * as fs from 'fs';
import * as path from 'path';

export interface MoveResult {
  success: boolean;
  newPath?: string;
  error?: string;
}

export class FileMover {
  private vaultPath: string;
  private queuePath: string;
  private completedPath: string;
  private blockedPath: string;
  private activePath: string;

  constructor(vaultPath: string) {
    this.vaultPath = vaultPath;
    this.queuePath = path.join(vaultPath, '_orchestra', 'queue');
    this.completedPath = path.join(vaultPath, '_orchestra', 'completed');
    this.blockedPath = path.join(vaultPath, '_orchestra', 'blocked');
    this.activePath = path.join(vaultPath, '_orchestra', 'ACTIVE.md');
  }

  async moveToCompleted(taskId: string, content: string): Promise<MoveResult> {
    try {
      this.ensureDirectory(this.completedPath);

      const datePrefix = new Date().toISOString().split('T')[0];
      const filename = `${datePrefix}-${taskId}.md`;
      const newPath = path.join(this.completedPath, filename);

      fs.writeFileSync(newPath, content, 'utf-8');

      return { success: true, newPath };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async moveToBlocked(taskId: string, content: string): Promise<MoveResult> {
    try {
      this.ensureDirectory(this.blockedPath);

      const datePrefix = new Date().toISOString().split('T')[0];
      const filename = `${datePrefix}-${taskId}.md`;
      const newPath = path.join(this.blockedPath, filename);

      fs.writeFileSync(newPath, content, 'utf-8');

      return { success: true, newPath };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async clearActiveFile(): Promise<void> {
    const emptyContent = `# Task: None

No active task. Use \`!oads activate <task-id>\` to activate a task from the queue.
`;
    fs.writeFileSync(this.activePath, emptyContent, 'utf-8');
  }

  getActivePath(): string {
    return this.activePath;
  }

  readActiveFile(): string {
    if (!fs.existsSync(this.activePath)) {
      return '';
    }
    return fs.readFileSync(this.activePath, 'utf-8');
  }

  writeActiveFile(content: string): void {
    fs.writeFileSync(this.activePath, content, 'utf-8');
  }

  private ensureDirectory(dirPath: string): void {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }
}
