import * as crypto from 'crypto';
import { ParsedTask, TaskMetadata, AcceptanceCriterion } from '../types';

export function computeHash(content: string): string {
  return crypto.createHash('md5').update(content).digest('hex');
}

export function parseTaskTitle(content: string): { id: string; title: string } {
  const titleMatch = content.match(/^# Task:\s*(\S+)\s*-\s*(.+)$/m);
  if (titleMatch) {
    return { id: titleMatch[1], title: titleMatch[2].trim() };
  }

  const simpleTitleMatch = content.match(/^# Task:\s*(.+)$/m);
  if (simpleTitleMatch) {
    return { id: 'UNKNOWN', title: simpleTitleMatch[1].trim() };
  }

  return { id: 'UNKNOWN', title: 'Unknown Task' };
}

export function parseMetadataTable(content: string): TaskMetadata {
  const defaults: TaskMetadata = {
    status: 'UNKNOWN',
    project: '',
    trustLevel: '',
    priority: '',
    created: '',
    activated: '',
    branch: '',
    repoPath: '',
  };

  const fieldMappings: Record<string, keyof TaskMetadata> = {
    'status': 'status',
    'project': 'project',
    'trust level': 'trustLevel',
    'priority': 'priority',
    'created': 'created',
    'activated': 'activated',
    'branch': 'branch',
    'repo path': 'repoPath',
  };

  const tableRowRegex = /\|\s*([^|]+)\s*\|\s*([^|]+)\s*\|/g;
  let match;

  while ((match = tableRowRegex.exec(content)) !== null) {
    const field = match[1].trim().toLowerCase();
    const value = match[2].trim();

    const key = fieldMappings[field];
    if (key) {
      defaults[key] = value;
    }
  }

  return defaults;
}

export function parseAcceptanceCriteria(content: string): AcceptanceCriterion[] {
  const criteria: AcceptanceCriterion[] = [];

  // Find the Acceptance Criteria section
  const acSection = content.match(/## Acceptance Criteria\s*([\s\S]*?)(?=\n##|\n---|\n$)/);
  if (!acSection) {
    return criteria;
  }

  const checkboxRegex = /- \[([ xX])\]\s*(.+)/g;
  let match;

  while ((match = checkboxRegex.exec(acSection[1])) !== null) {
    criteria.push({
      completed: match[1].toLowerCase() === 'x',
      text: match[2].trim(),
    });
  }

  return criteria;
}

export function parseExecutionLog(content: string): string[] {
  const logSection = content.match(/## Execution Log\s*([\s\S]*?)(?=\n---|\n$)/);
  if (!logSection) {
    return [];
  }

  const lines = logSection[1].split('\n');
  const logEntries: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    // Match log entries that start with - [ or just -
    if (trimmed.startsWith('- [') && !trimmed.startsWith('- [ ]') && !trimmed.startsWith('- [x]')) {
      logEntries.push(trimmed.substring(2)); // Remove the "- " prefix
    }
  }

  return logEntries;
}

export function parseDescription(content: string): string {
  const descSection = content.match(/## Task Description\s*([\s\S]*?)(?=\n##|$)/);
  if (descSection) {
    return descSection[1].trim();
  }
  return '';
}

export function parseTask(content: string): ParsedTask {
  const { id, title } = parseTaskTitle(content);
  const metadata = parseMetadataTable(content);
  const description = parseDescription(content);
  const acceptanceCriteria = parseAcceptanceCriteria(content);
  const executionLog = parseExecutionLog(content);
  const contentHash = computeHash(content);

  return {
    id,
    title,
    metadata,
    description,
    acceptanceCriteria,
    executionLog,
    rawContent: content,
    contentHash,
  };
}
