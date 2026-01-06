import { ApprovalService } from '../src/workflow/approval-service';
import { ParsedTask } from '../src/types';
import * as fs from 'fs';
import * as path from 'path';

// Mock fs module
jest.mock('fs');

const mockFs = fs as jest.Mocked<typeof fs>;

describe('ApprovalService', () => {
  const testVaultPath = '/test/vault';
  let approvalService: ApprovalService;

  const createMockTask = (overrides: Partial<ParsedTask> = {}): ParsedTask => ({
    id: 'TEST-001',
    title: 'Test Task',
    metadata: {
      status: 'PENDING_REVIEW',
      project: 'test-project',
      trustLevel: 'PROTOTYPE',
      priority: 'NORMAL',
      created: '2026-01-05',
      activated: '2026-01-05',
      branch: 'main',
      repoPath: '/test/repo',
    },
    description: 'Test description',
    acceptanceCriteria: [
      { text: 'Criterion 1', completed: true },
      { text: 'Criterion 2', completed: true },
    ],
    executionLog: ['[2026-01-05] Started'],
    rawContent: `# Task: TEST-001 - Test Task

## Metadata
| Field | Value |
|-------|-------|
| Status | PENDING_REVIEW |
| Project | test-project |

## Task Description

Test description

## Acceptance Criteria
- [x] Criterion 1
- [x] Criterion 2

## Execution Log

- [2026-01-05] Started
`,
    contentHash: 'abc123',
    ...overrides,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    approvalService = new ApprovalService(testVaultPath);

    // Setup default mock behaviors
    mockFs.existsSync.mockReturnValue(true);
    mockFs.writeFileSync.mockImplementation(() => {});
    mockFs.mkdirSync.mockImplementation(() => undefined);
  });

  describe('approve', () => {
    it('should approve a task in PENDING_REVIEW status', async () => {
      const task = createMockTask();

      const result = await approvalService.approve(task, 'user#1234', 'Good work!');

      expect(result.success).toBe(true);
      expect(result.message).toContain('approved');
      expect(mockFs.writeFileSync).toHaveBeenCalled();
    });

    it('should warn but allow approval with incomplete criteria', async () => {
      const task = createMockTask({
        acceptanceCriteria: [
          { text: 'Criterion 1', completed: true },
          { text: 'Criterion 2', completed: false },
        ],
      });

      const result = await approvalService.approve(task, 'user#1234');

      expect(result.success).toBe(true);
      expect(result.message).toContain('Warning');
      expect(result.message).toContain('1 criteria');
    });

    it('should fail for unknown status', async () => {
      const task = createMockTask({
        metadata: {
          ...createMockTask().metadata,
          status: 'INVALID_STATUS',
        },
      });

      const result = await approvalService.approve(task, 'user#1234');

      expect(result.success).toBe(false);
      expect(result.message).toContain('Unknown task status');
    });
  });

  describe('reject', () => {
    it('should reject a task with reason', async () => {
      const task = createMockTask();

      const result = await approvalService.reject(task, 'user#1234', 'Needs more tests');

      expect(result.success).toBe(true);
      expect(result.message).toContain('rejected');
      expect(result.message).toContain('Needs more tests');
      expect(result.retryCount).toBe(1);
    });

    it('should fail rejection without reason', async () => {
      const task = createMockTask();

      const result = await approvalService.reject(task, 'user#1234', '');

      expect(result.success).toBe(false);
      expect(result.message).toContain('requires a reason');
    });

    it('should fail rejection with only whitespace reason', async () => {
      const task = createMockTask();

      const result = await approvalService.reject(task, 'user#1234', '   ');

      expect(result.success).toBe(false);
      expect(result.message).toContain('requires a reason');
    });

    it('should increment retry count on subsequent rejections', async () => {
      const taskWithRetry = createMockTask({
        rawContent: `# Task: TEST-001 - Test Task

## Metadata
| Field | Value |
|-------|-------|
| Status | PENDING_REVIEW |
| Retry Count | 2 |

## Execution Log

- [2026-01-05] Started
`,
      });

      const result = await approvalService.reject(taskWithRetry, 'user#1234', 'Still not right');

      expect(result.success).toBe(true);
      expect(result.retryCount).toBe(3);
    });

    it('should fail for unknown status', async () => {
      const task = createMockTask({
        metadata: {
          ...createMockTask().metadata,
          status: 'INVALID_STATUS',
        },
      });

      const result = await approvalService.reject(task, 'user#1234', 'Some reason');

      expect(result.success).toBe(false);
      expect(result.message).toContain('Unknown task status');
    });
  });
});
