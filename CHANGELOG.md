# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.0] - 2026-01-06

### Added

#### Output Streaming
- Real-time streaming of Claude Code output to Discord
- `StreamBuffer` class for intelligent output batching (1.5s interval, 1500 char threshold)
- `DiscordStreamer` class for posting buffered output with:
  - Automatic message splitting for Discord's 2000 char limit
  - Code block formatting for all output
  - Typing indicator during execution
  - Execution summary on completion (duration, message count, total chars)
  - Rate limit handling with automatic retry

#### Slash Commands
- Migrated all commands to Discord slash commands (`/oads`)
- New subcommands:
  - `/oads status` - Show current active task status
  - `/oads queue` - List queued tasks
  - `/oads list [filter]` - List tasks with optional filter (all/queued/active/completed)
  - `/oads start` - Start Claude Code execution
  - `/oads stop [reason]` - Stop execution gracefully
  - `/oads approve [notes]` - Approve task completion
  - `/oads reject <reason>` - Reject task for retry (reason required)
  - `/oads pick <task>` - Pick task from queue with autocomplete
  - `/oads help [command]` - Detailed help for each command
- Autocomplete support for task selection in `/oads pick`
- Automatic slash command registration on bot startup

#### Configuration
- New environment variables:
  - `STREAMING_ENABLED` - Toggle real-time streaming
  - `STREAM_BUFFER_MS` - Buffer flush interval
  - `STREAM_MAX_CHARS` - Force flush threshold
  - `REGISTER_SLASH_COMMANDS` - Toggle auto-registration
  - `DEPRECATE_PREFIX_COMMANDS` - Show deprecation warnings

#### Tests
- Added tests for `StreamBuffer` class (10 tests)
- Added tests for slash command registration (5 tests)

### Changed
- Prefix commands (`!oads`) now show deprecation warning when used
- Updated README with slash command documentation

### Deprecated
- Prefix commands (`!oads`) are deprecated in favor of slash commands (`/oads`)

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
