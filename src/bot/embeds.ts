import { EmbedBuilder } from 'discord.js';
import { ParsedTask, TaskDiff, QueuedTask } from '../types';

const COLORS = {
  activated: 0x00ff00,  // Green
  inProgress: 0x0099ff, // Blue
  completed: 0x00ff00,  // Green
  blocked: 0xff0000,    // Red
  queued: 0xffaa00,     // Orange
  update: 0x9966ff,     // Purple
  executing: 0x00ccff,  // Cyan
  stopped: 0xff9900,    // Dark Orange
  approved: 0x00ff88,   // Light Green
  rejected: 0xff4444,   // Light Red
};

export function createTaskActivatedEmbed(task: ParsedTask): EmbedBuilder {
  const criteriaList = task.acceptanceCriteria
    .map(c => `${c.completed ? '☑' : '☐'} ${c.text}`)
    .join('\n');

  const embed = new EmbedBuilder()
    .setColor(COLORS.activated)
    .setTitle(`🚀 TASK ACTIVATED: ${task.id}`)
    .setDescription(task.title)
    .addFields(
      { name: '🏷️ Project', value: task.metadata.project || 'N/A', inline: true },
      { name: '⚡ Trust', value: task.metadata.trustLevel || 'N/A', inline: true },
      { name: '📊 Priority', value: task.metadata.priority || 'N/A', inline: true }
    );

  if (task.metadata.repoPath) {
    embed.addFields({ name: '📁 Repo', value: task.metadata.repoPath, inline: false });
  }

  if (criteriaList) {
    embed.addFields({ name: 'Acceptance Criteria', value: criteriaList.substring(0, 1024), inline: false });
  }

  embed.setTimestamp();

  return embed;
}

export function createStatusUpdateEmbed(task: ParsedTask, diff: TaskDiff): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(COLORS.update)
    .setTitle(`📋 ${task.id} - Status Update`)
    .setTimestamp();

  const updates: string[] = [];

  if (diff.statusChanged) {
    updates.push(`**Status:** ${diff.oldStatus} → ${diff.newStatus}`);
  }

  if (diff.criteriaChanged) {
    for (const change of diff.changedCriteria) {
      const emoji = change.newCompleted ? '✅' : '⬜';
      updates.push(`${emoji} ${change.text}`);
    }
  }

  if (updates.length > 0) {
    embed.setDescription(updates.join('\n'));
  }

  return embed;
}

export function createLogUpdateMessage(task: ParsedTask, newEntries: string[]): string {
  const lines = newEntries.map(entry => `📝 ${entry}`);
  return lines.join('\n');
}

export function createTaskQueuedEmbed(task: QueuedTask): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(COLORS.queued)
    .setTitle('📥 New Task Queued')
    .setDescription(task.title)
    .addFields(
      { name: 'Project', value: task.project || 'N/A', inline: true },
      { name: 'Priority', value: task.priority || 'N/A', inline: true }
    )
    .setTimestamp();
}

export function createTaskCompletedEmbed(filename: string, title: string): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(COLORS.completed)
    .setTitle('✅ Task Completed')
    .setDescription(title)
    .addFields({ name: 'File', value: filename })
    .setTimestamp();
}

export function createTaskBlockedEmbed(filename: string, title: string): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(COLORS.blocked)
    .setTitle('🛑 Task Blocked')
    .setDescription(title)
    .addFields({ name: 'File', value: filename })
    .setTimestamp();
}

export function createQueueListEmbed(tasks: QueuedTask[]): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(COLORS.queued)
    .setTitle('📋 Task Queue')
    .setTimestamp();

  if (tasks.length === 0) {
    embed.setDescription('No tasks in queue.');
  } else {
    const list = tasks
      .map((t, i) => `**${i + 1}.** ${t.title} (${t.project || 'N/A'}) - ${t.priority || 'N/A'}`)
      .join('\n');
    embed.setDescription(list);
  }

  return embed;
}

export function createCurrentStatusEmbed(task: ParsedTask | null): EmbedBuilder {
  if (!task) {
    return new EmbedBuilder()
      .setColor(0x808080)
      .setTitle('📋 Current Status')
      .setDescription('No active task.')
      .setTimestamp();
  }

  const criteriaList = task.acceptanceCriteria
    .map(c => `${c.completed ? '☑' : '☐'} ${c.text}`)
    .join('\n');

  const completedCount = task.acceptanceCriteria.filter(c => c.completed).length;
  const totalCount = task.acceptanceCriteria.length;

  const embed = new EmbedBuilder()
    .setColor(COLORS.inProgress)
    .setTitle(`📋 ${task.id}: ${task.title}`)
    .addFields(
      { name: 'Status', value: task.metadata.status, inline: true },
      { name: 'Project', value: task.metadata.project || 'N/A', inline: true },
      { name: 'Progress', value: `${completedCount}/${totalCount} criteria`, inline: true }
    );

  if (criteriaList) {
    embed.addFields({ name: 'Acceptance Criteria', value: criteriaList.substring(0, 1024), inline: false });
  }

  const recentLogs = task.executionLog.slice(-5);
  if (recentLogs.length > 0) {
    embed.addFields({ name: 'Recent Log', value: recentLogs.join('\n').substring(0, 1024), inline: false });
  }

  embed.setTimestamp();

  return embed;
}

export function createExecutionStartedEmbed(task: ParsedTask): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(COLORS.executing)
    .setTitle(`▶️ Execution Started: ${task.id}`)
    .setDescription(task.title)
    .addFields(
      { name: 'Status', value: 'EXECUTING', inline: true },
      { name: 'Project', value: task.metadata.project || 'N/A', inline: true }
    )
    .setTimestamp();
}

export function createExecutionStoppedEmbed(task: ParsedTask | null, reason?: string): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(COLORS.stopped)
    .setTitle(`⏹️ Execution Stopped${task ? `: ${task.id}` : ''}`)
    .setTimestamp();

  if (task) {
    embed.setDescription(task.title);
  }

  if (reason) {
    embed.addFields({ name: 'Reason', value: reason });
  }

  return embed;
}

export function createApprovalEmbed(
  task: ParsedTask,
  approver: string,
  notes?: string
): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(COLORS.approved)
    .setTitle(`✅ Task Approved: ${task.id}`)
    .setDescription(task.title)
    .addFields(
      { name: 'Approved By', value: approver, inline: true },
      { name: 'Status', value: 'COMPLETED', inline: true }
    )
    .setTimestamp();

  if (notes) {
    embed.addFields({ name: 'Notes', value: notes });
  }

  return embed;
}

export function createRejectionEmbed(
  task: ParsedTask,
  rejector: string,
  reason: string,
  retryCount: number
): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(COLORS.rejected)
    .setTitle(`❌ Task Rejected: ${task.id}`)
    .setDescription(task.title)
    .addFields(
      { name: 'Rejected By', value: rejector, inline: true },
      { name: 'Retry #', value: retryCount.toString(), inline: true },
      { name: 'Reason', value: reason }
    )
    .setTimestamp();
}
