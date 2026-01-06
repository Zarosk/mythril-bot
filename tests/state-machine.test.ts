import {
  TaskStatus,
  canTransition,
  transition,
  parseStatus,
  getValidNextStates,
} from '../src/workflow/state-machine';

describe('state-machine', () => {
  describe('canTransition', () => {
    it('should allow IN_PROGRESS to EXECUTING', () => {
      expect(canTransition(TaskStatus.IN_PROGRESS, TaskStatus.EXECUTING)).toBe(true);
    });

    it('should allow EXECUTING to PENDING_REVIEW', () => {
      expect(canTransition(TaskStatus.EXECUTING, TaskStatus.PENDING_REVIEW)).toBe(true);
    });

    it('should allow EXECUTING to IN_PROGRESS (stop)', () => {
      expect(canTransition(TaskStatus.EXECUTING, TaskStatus.IN_PROGRESS)).toBe(true);
    });

    it('should allow PENDING_REVIEW to COMPLETED (approve)', () => {
      expect(canTransition(TaskStatus.PENDING_REVIEW, TaskStatus.COMPLETED)).toBe(true);
    });

    it('should allow PENDING_REVIEW to IN_PROGRESS (reject)', () => {
      expect(canTransition(TaskStatus.PENDING_REVIEW, TaskStatus.IN_PROGRESS)).toBe(true);
    });

    it('should not allow IN_PROGRESS directly to COMPLETED', () => {
      expect(canTransition(TaskStatus.IN_PROGRESS, TaskStatus.COMPLETED)).toBe(false);
    });

    it('should not allow COMPLETED to any state', () => {
      expect(canTransition(TaskStatus.COMPLETED, TaskStatus.IN_PROGRESS)).toBe(false);
      expect(canTransition(TaskStatus.COMPLETED, TaskStatus.EXECUTING)).toBe(false);
    });

    it('should allow IN_PROGRESS to BLOCKED', () => {
      expect(canTransition(TaskStatus.IN_PROGRESS, TaskStatus.BLOCKED)).toBe(true);
    });

    it('should allow BLOCKED to IN_PROGRESS', () => {
      expect(canTransition(TaskStatus.BLOCKED, TaskStatus.IN_PROGRESS)).toBe(true);
    });
  });

  describe('transition', () => {
    it('should return success for valid transition', () => {
      const result = transition(TaskStatus.IN_PROGRESS, TaskStatus.EXECUTING);

      expect(result.success).toBe(true);
      expect(result.newStatus).toBe(TaskStatus.EXECUTING);
      expect(result.error).toBeUndefined();
    });

    it('should return error for invalid transition', () => {
      const result = transition(TaskStatus.IN_PROGRESS, TaskStatus.COMPLETED);

      expect(result.success).toBe(false);
      expect(result.newStatus).toBeUndefined();
      expect(result.error).toContain('Invalid transition');
    });
  });

  describe('parseStatus', () => {
    it('should parse valid status strings', () => {
      expect(parseStatus('IN_PROGRESS')).toBe(TaskStatus.IN_PROGRESS);
      expect(parseStatus('EXECUTING')).toBe(TaskStatus.EXECUTING);
      expect(parseStatus('PENDING_REVIEW')).toBe(TaskStatus.PENDING_REVIEW);
      expect(parseStatus('COMPLETED')).toBe(TaskStatus.COMPLETED);
      expect(parseStatus('BLOCKED')).toBe(TaskStatus.BLOCKED);
    });

    it('should handle case insensitivity', () => {
      expect(parseStatus('in_progress')).toBe(TaskStatus.IN_PROGRESS);
      expect(parseStatus('In_Progress')).toBe(TaskStatus.IN_PROGRESS);
    });

    it('should handle spaces in status', () => {
      expect(parseStatus('IN PROGRESS')).toBe(TaskStatus.IN_PROGRESS);
      expect(parseStatus('PENDING REVIEW')).toBe(TaskStatus.PENDING_REVIEW);
    });

    it('should return null for invalid status', () => {
      expect(parseStatus('INVALID')).toBeNull();
      expect(parseStatus('')).toBeNull();
    });
  });

  describe('getValidNextStates', () => {
    it('should return valid next states for IN_PROGRESS', () => {
      const states = getValidNextStates(TaskStatus.IN_PROGRESS);
      expect(states).toContain(TaskStatus.EXECUTING);
      expect(states).toContain(TaskStatus.BLOCKED);
      expect(states).not.toContain(TaskStatus.COMPLETED);
    });

    it('should return empty array for COMPLETED', () => {
      const states = getValidNextStates(TaskStatus.COMPLETED);
      expect(states).toHaveLength(0);
    });

    it('should return valid next states for PENDING_REVIEW', () => {
      const states = getValidNextStates(TaskStatus.PENDING_REVIEW);
      expect(states).toContain(TaskStatus.COMPLETED);
      expect(states).toContain(TaskStatus.IN_PROGRESS);
    });
  });
});
