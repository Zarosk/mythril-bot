# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2026-01-05

### Added
- Execution control commands:
  - `!oads start` - Trigger Claude Code execution on active task
  - `!oads stop [reason]` - Gracefully halt Claude Code execution
- Approval workflow commands:
  - `!oads approve [notes]` - Approve task completion and move to completed folder
  - `!oads reject <reason>` - Reject task and request retry (reason required)
- Task state machine with valid transitions:
  - IN_PROGRESS -> EXECUTING -> PENDING_REVIEW -> COMPLETED
  - Support for BLOCKED state
- Process manager for Claude Code subprocess control
- Approval service with file moving capabilities
- New Discord embeds for execution and approval events
- State machine tests
- Approval workflow tests

### Changed
- Updated README with new commands documentation
- Updated help command to show all available commands

## [0.1.0] - 2026-01-05

### Added
- Initial release of OADS Discord Orchestration Bot
- Discord.js v14 integration with gateway intents
- Vault monitoring using chokidar file watcher
- Markdown task parser with support for:
  - Task ID and title extraction
  - Metadata table parsing
  - Acceptance criteria checkboxes
  - Execution log entries
- Change detection with content hashing
- Discord commands:
  - `!oads status` - Show current active task
  - `!oads queue` - List queued tasks
  - `!oads help` - Show available commands
- Rich Discord embeds for status updates
- Thread creation for execution log updates
- Environment-based configuration
- TypeScript with strict mode
- ESLint configuration
- Jest test suite with 19 tests
