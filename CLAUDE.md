# CLAUDE.md - OADS Discord Bot

## Project Overview
Discord orchestration bot for OADS (Obsidian-Augmented Development System). Monitors the Obsidian vault for task changes and posts status updates to Discord.

## Quick Start
```bash
npm install
npm run dev    # Development with ts-node
npm run build  # Compile TypeScript
npm start      # Run compiled version
```

## Project Structure
```
src/
├── index.ts              # Entry point
├── config.ts             # Configuration loader
├── types.ts              # TypeScript interfaces
├── bot/
│   ├── client.ts         # Discord.js client and event handlers
│   ├── commands.ts       # !oads command handlers
│   └── embeds.ts         # Discord embed builders
├── executor/
│   ├── process-manager.ts # Claude Code subprocess control
│   └── output-parser.ts   # Parse execution output
├── workflow/
│   ├── state-machine.ts   # Task state transitions
│   ├── approval-service.ts # Approve/reject logic
│   └── file-mover.ts      # Move completed/blocked tasks
└── watcher/
    ├── vault-monitor.ts  # File system watcher using chokidar
    ├── parser.ts         # Markdown task parser
    └── differ.ts         # Change detection logic
```

## Key Patterns

### Task Parsing
Tasks are parsed from Markdown files with:
- Title from `# Task: ID - Title`
- Metadata from table (`| Field | Value |`)
- Acceptance criteria from checkboxes (`- [ ]` or `- [x]`)
- Execution log from `## Execution Log` section

### Change Detection
Uses MD5 hash of file content to detect changes. When content changes:
1. Parse old and new task
2. Diff specific fields (status, criteria, log entries)
3. Only emit events for meaningful changes

### Discord Integration
- Main channel: Task activation/completion/blocking messages
- Thread per task: Execution log updates
- Commands channel: Responds to `!oads` commands

## Commands
### Status & Info
- `!oads status` - Show current active task
- `!oads queue` - List queued tasks
- `!oads help` - Show help

### Execution Control
- `!oads start` - Start Claude Code execution on active task
- `!oads stop [reason]` - Stop Claude Code execution gracefully

### Approval Workflow
- `!oads approve [notes]` - Approve task completion
- `!oads reject <reason>` - Reject task for retry (reason required)

## Environment Variables
Required in `.env`:
- `DISCORD_BOT_TOKEN`
- `DISCORD_GUILD_ID`
- `DISCORD_COMMANDS_CHANNEL_ID`
- `DISCORD_STATUS_CHANNEL_ID`
- `OBSIDIAN_VAULT_PATH`

## Testing
```bash
npm test        # Run all tests
npm run lint    # Run ESLint
```
