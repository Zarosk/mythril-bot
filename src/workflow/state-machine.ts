/**
 * Task State Machine
 * Manages valid state transitions for Mythril tasks
 */

export enum TaskStatus {
  IN_PROGRESS = 'IN_PROGRESS',
  EXECUTING = 'EXECUTING',
  PENDING_REVIEW = 'PENDING_REVIEW',
  COMPLETED = 'COMPLETED',
  BLOCKED = 'BLOCKED',
}

export interface StateTransitionResult {
  success: boolean;
  newStatus?: TaskStatus;
  error?: string;
}

const validTransitions: Record<TaskStatus, TaskStatus[]> = {
  [TaskStatus.IN_PROGRESS]: [TaskStatus.EXECUTING, TaskStatus.BLOCKED],
  [TaskStatus.EXECUTING]: [TaskStatus.IN_PROGRESS, TaskStatus.PENDING_REVIEW],
  [TaskStatus.PENDING_REVIEW]: [TaskStatus.COMPLETED, TaskStatus.IN_PROGRESS],
  [TaskStatus.COMPLETED]: [],
  [TaskStatus.BLOCKED]: [TaskStatus.IN_PROGRESS],
};

export function canTransition(from: TaskStatus, to: TaskStatus): boolean {
  const allowed = validTransitions[from];
  return allowed ? allowed.includes(to) : false;
}

export function transition(from: TaskStatus, to: TaskStatus): StateTransitionResult {
  if (!canTransition(from, to)) {
    return {
      success: false,
      error: `Invalid transition: ${from} → ${to}`,
    };
  }

  return {
    success: true,
    newStatus: to,
  };
}

export function parseStatus(statusStr: string): TaskStatus | null {
  const normalized = statusStr.toUpperCase().replace(/\s+/g, '_');
  if (Object.values(TaskStatus).includes(normalized as TaskStatus)) {
    return normalized as TaskStatus;
  }
  return null;
}

export function getValidNextStates(current: TaskStatus): TaskStatus[] {
  return validTransitions[current] || [];
}
