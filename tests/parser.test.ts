import {
  parseTaskTitle,
  parseMetadataTable,
  parseAcceptanceCriteria,
  parseExecutionLog,
  parseTask,
  computeHash,
} from '../src/watcher/parser';

describe('parser', () => {
  describe('parseTaskTitle', () => {
    it('should parse task ID and title', () => {
      const content = '# Task: OADS-001 - Create Discord Bot';
      const result = parseTaskTitle(content);

      expect(result.id).toBe('OADS-001');
      expect(result.title).toBe('Create Discord Bot');
    });

    it('should handle simple title without ID', () => {
      const content = '# Task: Some Task Name';
      const result = parseTaskTitle(content);

      expect(result.id).toBe('UNKNOWN');
      expect(result.title).toBe('Some Task Name');
    });

    it('should return unknown for missing title', () => {
      const content = 'No title here';
      const result = parseTaskTitle(content);

      expect(result.id).toBe('UNKNOWN');
      expect(result.title).toBe('Unknown Task');
    });
  });

  describe('parseMetadataTable', () => {
    it('should parse metadata table fields', () => {
      const content = `
## Metadata
| Field | Value |
|-------|-------|
| Status | IN_PROGRESS |
| Project | oads-core |
| Trust Level | PROTOTYPE |
| Priority | HIGH |
`;
      const result = parseMetadataTable(content);

      expect(result.status).toBe('IN_PROGRESS');
      expect(result.project).toBe('oads-core');
      expect(result.trustLevel).toBe('PROTOTYPE');
      expect(result.priority).toBe('HIGH');
    });

    it('should return defaults for missing fields', () => {
      const content = 'No table here';
      const result = parseMetadataTable(content);

      expect(result.status).toBe('UNKNOWN');
      expect(result.project).toBe('');
    });
  });

  describe('parseAcceptanceCriteria', () => {
    it('should parse acceptance criteria checkboxes', () => {
      const content = `
## Acceptance Criteria
- [ ] Repository created
- [x] Bot connects to Discord
- [ ] Status command works
`;
      const result = parseAcceptanceCriteria(content);

      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({ text: 'Repository created', completed: false });
      expect(result[1]).toEqual({ text: 'Bot connects to Discord', completed: true });
      expect(result[2]).toEqual({ text: 'Status command works', completed: false });
    });

    it('should return empty array for no criteria', () => {
      const content = 'No criteria section';
      const result = parseAcceptanceCriteria(content);

      expect(result).toEqual([]);
    });
  });

  describe('parseExecutionLog', () => {
    it('should parse execution log entries', () => {
      const content = `
## Execution Log

*Claude Code will write updates below this line*

- [2026-01-05 Gate 0] ✅ Orientation complete
- [2026-01-05 Gate 1] ✅ Backup branch created

---
`;
      const result = parseExecutionLog(content);

      expect(result).toHaveLength(2);
      expect(result[0]).toContain('Gate 0');
      expect(result[1]).toContain('Gate 1');
    });
  });

  describe('parseTask', () => {
    it('should parse a complete task', () => {
      const content = `# Task: TEST-001 - Test Task

## Metadata
| Field | Value |
|-------|-------|
| Status | IN_PROGRESS |
| Project | test-project |

## Task Description

This is a test task.

## Acceptance Criteria
- [x] First criterion
- [ ] Second criterion

## Execution Log

- [2026-01-05] Started work
`;
      const result = parseTask(content);

      expect(result.id).toBe('TEST-001');
      expect(result.title).toBe('Test Task');
      expect(result.metadata.status).toBe('IN_PROGRESS');
      expect(result.metadata.project).toBe('test-project');
      expect(result.acceptanceCriteria).toHaveLength(2);
      expect(result.executionLog).toHaveLength(1);
      expect(result.contentHash).toBeTruthy();
    });
  });

  describe('computeHash', () => {
    it('should compute consistent hash', () => {
      const content = 'test content';
      const hash1 = computeHash(content);
      const hash2 = computeHash(content);

      expect(hash1).toBe(hash2);
    });

    it('should compute different hash for different content', () => {
      const hash1 = computeHash('content 1');
      const hash2 = computeHash('content 2');

      expect(hash1).not.toBe(hash2);
    });
  });
});
