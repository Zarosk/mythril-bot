import { ParsedTask, TaskDiff } from '../types';

export function diffTasks(oldTask: ParsedTask | null, newTask: ParsedTask): TaskDiff {
  const diff: TaskDiff = {
    statusChanged: false,
    criteriaChanged: false,
    changedCriteria: [],
    newLogEntries: [],
    isNewTask: oldTask === null,
  };

  if (oldTask === null) {
    // New task - everything is new
    diff.statusChanged = true;
    diff.newStatus = newTask.metadata.status;
    diff.newLogEntries = newTask.executionLog;
    return diff;
  }

  // Check status change
  if (oldTask.metadata.status !== newTask.metadata.status) {
    diff.statusChanged = true;
    diff.oldStatus = oldTask.metadata.status;
    diff.newStatus = newTask.metadata.status;
  }

  // Check criteria changes
  const oldCriteriaMap = new Map<string, boolean>();
  for (const criterion of oldTask.acceptanceCriteria) {
    oldCriteriaMap.set(criterion.text, criterion.completed);
  }

  for (const criterion of newTask.acceptanceCriteria) {
    const oldCompleted = oldCriteriaMap.get(criterion.text);
    if (oldCompleted !== undefined && oldCompleted !== criterion.completed) {
      diff.criteriaChanged = true;
      diff.changedCriteria.push({
        text: criterion.text,
        oldCompleted,
        newCompleted: criterion.completed,
      });
    }
  }

  // Check for new log entries
  const oldLogSet = new Set(oldTask.executionLog);
  for (const entry of newTask.executionLog) {
    if (!oldLogSet.has(entry)) {
      diff.newLogEntries.push(entry);
    }
  }

  return diff;
}

export function hasMeaningfulChanges(diff: TaskDiff): boolean {
  return (
    diff.isNewTask ||
    diff.statusChanged ||
    diff.criteriaChanged ||
    diff.newLogEntries.length > 0
  );
}
