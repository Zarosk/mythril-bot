import { diffTasks, hasMeaningfulChanges } from '../src/watcher/differ';
import { ParsedTask } from '../src/types';

function createMockTask(overrides: Partial<ParsedTask> = {}): ParsedTask {
  return {
    id: 'TEST-001',
    title: 'Test Task',
    metadata: {
      status: 'IN_PROGRESS',
      project: 'test',
      trustLevel: 'PROTOTYPE',
      priority: 'HIGH',
      created: '2026-01-05',
      activated: '2026-01-05',
      branch: 'main',
      repoPath: '/path/to/repo',
    },
    description: 'Test description',
    acceptanceCriteria: [],
    executionLog: [],
    rawContent: '',
    contentHash: 'abc123',
    ...overrides,
  };
}

describe('differ', () => {
  describe('diffTasks', () => {
    it('should detect new task', () => {
      const newTask = createMockTask();
      const diff = diffTasks(null, newTask);

      expect(diff.isNewTask).toBe(true);
      expect(diff.statusChanged).toBe(true);
      expect(diff.newStatus).toBe('IN_PROGRESS');
    });

    it('should detect status change', () => {
      const oldTask = createMockTask({
        metadata: { ...createMockTask().metadata, status: 'IN_PROGRESS' },
      });
      const newTask = createMockTask({
        metadata: { ...createMockTask().metadata, status: 'COMPLETE' },
      });

      const diff = diffTasks(oldTask, newTask);

      expect(diff.statusChanged).toBe(true);
      expect(diff.oldStatus).toBe('IN_PROGRESS');
      expect(diff.newStatus).toBe('COMPLETE');
    });

    it('should detect criteria changes', () => {
      const oldTask = createMockTask({
        acceptanceCriteria: [
          { text: 'First criterion', completed: false },
          { text: 'Second criterion', completed: false },
        ],
      });
      const newTask = createMockTask({
        acceptanceCriteria: [
          { text: 'First criterion', completed: true },
          { text: 'Second criterion', completed: false },
        ],
      });

      const diff = diffTasks(oldTask, newTask);

      expect(diff.criteriaChanged).toBe(true);
      expect(diff.changedCriteria).toHaveLength(1);
      expect(diff.changedCriteria[0]).toEqual({
        text: 'First criterion',
        oldCompleted: false,
        newCompleted: true,
      });
    });

    it('should detect new log entries', () => {
      const oldTask = createMockTask({
        executionLog: ['[Gate 0] Complete'],
      });
      const newTask = createMockTask({
        executionLog: ['[Gate 0] Complete', '[Gate 1] Complete'],
      });

      const diff = diffTasks(oldTask, newTask);

      expect(diff.newLogEntries).toHaveLength(1);
      expect(diff.newLogEntries[0]).toBe('[Gate 1] Complete');
    });

    it('should not detect changes when identical', () => {
      const task = createMockTask({
        acceptanceCriteria: [{ text: 'Test', completed: false }],
        executionLog: ['Entry 1'],
      });

      const diff = diffTasks(task, task);

      expect(diff.isNewTask).toBe(false);
      expect(diff.statusChanged).toBe(false);
      expect(diff.criteriaChanged).toBe(false);
      expect(diff.newLogEntries).toHaveLength(0);
    });
  });

  describe('hasMeaningfulChanges', () => {
    it('should return true for new task', () => {
      const diff = diffTasks(null, createMockTask());
      expect(hasMeaningfulChanges(diff)).toBe(true);
    });

    it('should return true for status change', () => {
      const oldTask = createMockTask();
      const newTask = createMockTask({
        metadata: { ...oldTask.metadata, status: 'COMPLETE' },
      });
      const diff = diffTasks(oldTask, newTask);
      expect(hasMeaningfulChanges(diff)).toBe(true);
    });

    it('should return false when no changes', () => {
      const task = createMockTask();
      const diff = diffTasks(task, task);
      expect(hasMeaningfulChanges(diff)).toBe(false);
    });
  });
});
