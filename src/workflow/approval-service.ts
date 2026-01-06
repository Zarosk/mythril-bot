/**
 * Approval Service
 * Handles task approval and rejection workflows
 */

import { ParsedTask } from '../types';
import { FileMover } from './file-mover';
import { TaskStatus, parseStatus, canTransition } from './state-machine';

export interface ApprovalResult {
  success: boolean;
  message: string;
  newPath?: string;
}

export interface RejectionResult {
  success: boolean;
  message: string;
  retryCount?: number;
}

export class ApprovalService {
  private fileMover: FileMover;

  constructor(vaultPath: string) {
    this.fileMover = new FileMover(vaultPath);
  }

  async approve(
    task: ParsedTask,
    approver: string,
    notes?: string
  ): Promise<ApprovalResult> {
    const currentStatus = parseStatus(task.metadata.status);

    if (!currentStatus) {
      return {
        success: false,
        message: `Unknown task status: ${task.metadata.status}`,
      };
    }

    // Check if all criteria are completed - warn but allow
    const incompleteCriteria = task.acceptanceCriteria.filter(c => !c.completed);
    let warningMessage = '';
    if (incompleteCriteria.length > 0) {
      warningMessage = ` Warning: ${incompleteCriteria.length} criteria still incomplete.`;
    }

    // Validate state transition
    if (
      currentStatus !== TaskStatus.PENDING_REVIEW &&
      !this.allCriteriaCompleted(task)
    ) {
      // Allow approval if status is PENDING_REVIEW or all criteria checked
      if (!canTransition(currentStatus, TaskStatus.COMPLETED)) {
        return {
          success: false,
          message: `Cannot approve task in ${currentStatus} status. Expected PENDING_REVIEW or all criteria completed.`,
        };
      }
    }

    // Update task content with approval metadata
    const timestamp = new Date().toISOString();
    const approvalLine = `- [${timestamp}] APPROVED by ${approver}${notes ? `: ${notes}` : ''}`;

    let updatedContent = this.updateTaskStatus(task.rawContent, TaskStatus.COMPLETED);
    updatedContent = this.addApprovalMetadata(updatedContent, approver, timestamp);
    updatedContent = this.appendToExecutionLog(updatedContent, approvalLine);

    // Move to completed folder
    const moveResult = await this.fileMover.moveToCompleted(task.id, updatedContent);
    if (!moveResult.success) {
      return {
        success: false,
        message: `Failed to move task to completed: ${moveResult.error}`,
      };
    }

    // Clear ACTIVE.md
    await this.fileMover.clearActiveFile();

    return {
      success: true,
      message: `Task ${task.id} approved and moved to completed.${warningMessage}`,
      newPath: moveResult.newPath,
    };
  }

  async reject(task: ParsedTask, rejector: string, reason: string): Promise<RejectionResult> {
    if (!reason || reason.trim().length === 0) {
      return {
        success: false,
        message: 'Rejection requires a reason.',
      };
    }

    const currentStatus = parseStatus(task.metadata.status);
    if (!currentStatus) {
      return {
        success: false,
        message: `Unknown task status: ${task.metadata.status}`,
      };
    }

    // Get current retry count and increment
    const retryCount = this.getRetryCount(task.rawContent) + 1;

    // Update task content
    const timestamp = new Date().toISOString();
    const rejectionLine = `- [${timestamp}] REJECTED by ${rejector}: ${reason}`;

    let updatedContent = this.updateTaskStatus(task.rawContent, TaskStatus.IN_PROGRESS);
    updatedContent = this.updateRetryCount(updatedContent, retryCount);
    updatedContent = this.appendToExecutionLog(updatedContent, rejectionLine);

    // Write back to ACTIVE.md
    this.fileMover.writeActiveFile(updatedContent);

    return {
      success: true,
      message: `Task ${task.id} rejected. Retry #${retryCount}. Reason: ${reason}`,
      retryCount,
    };
  }

  private allCriteriaCompleted(task: ParsedTask): boolean {
    return (
      task.acceptanceCriteria.length > 0 &&
      task.acceptanceCriteria.every(c => c.completed)
    );
  }

  private updateTaskStatus(content: string, newStatus: TaskStatus): string {
    // Update status in metadata table
    return content.replace(
      /\|\s*Status\s*\|\s*[^|]+\s*\|/i,
      `| Status | ${newStatus} |`
    );
  }

  private addApprovalMetadata(
    content: string,
    approver: string,
    timestamp: string
  ): string {
    // Add approval metadata after status row
    const approvalRow = `| Approved | ${timestamp} |`;
    const approverRow = `| Approved By | ${approver} |`;

    // Find end of metadata table
    const tableEndMatch = content.match(/(\|\s*[^|]+\s*\|\s*[^|]+\s*\|\n)(\n|## )/);
    if (tableEndMatch) {
      const insertPos = tableEndMatch.index! + tableEndMatch[1].length;
      return (
        content.slice(0, insertPos) +
        approvalRow +
        '\n' +
        approverRow +
        '\n' +
        content.slice(insertPos)
      );
    }
    return content;
  }

  private getRetryCount(content: string): number {
    const match = content.match(/\|\s*Retry Count\s*\|\s*(\d+)\s*\|/i);
    return match ? parseInt(match[1], 10) : 0;
  }

  private updateRetryCount(content: string, count: number): string {
    if (content.match(/\|\s*Retry Count\s*\|/i)) {
      return content.replace(
        /\|\s*Retry Count\s*\|\s*\d+\s*\|/i,
        `| Retry Count | ${count} |`
      );
    }

    // Add retry count row if not present
    const tableEndMatch = content.match(/(\|\s*[^|]+\s*\|\s*[^|]+\s*\|\n)(\n|## )/);
    if (tableEndMatch) {
      const insertPos = tableEndMatch.index! + tableEndMatch[1].length;
      return (
        content.slice(0, insertPos) +
        `| Retry Count | ${count} |\n` +
        content.slice(insertPos)
      );
    }
    return content;
  }

  private appendToExecutionLog(content: string, entry: string): string {
    // Find execution log section and append
    const logMatch = content.match(/(## Execution Log\s*\n[\s\S]*?)(\n---|\n$|$)/);
    if (logMatch) {
      const insertPos = logMatch.index! + logMatch[1].length;
      return content.slice(0, insertPos) + '\n' + entry + content.slice(insertPos);
    }

    // If no execution log section, add one
    return content + '\n\n## Execution Log\n\n' + entry + '\n';
  }
}
