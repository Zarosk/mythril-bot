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
│   ├── commands.ts       # !oads command handlers (deprecated)
│   ├── slash-commands.ts # /oads slash command handlers
│   ├── chat-handler.ts   # Conversational AI message handler
│   ├── brain-client.ts   # Brain API client for context
│   └── embeds.ts         # Discord embed builders
├── executor/
│   ├── process-manager.ts  # Claude Code subprocess control
│   ├── output-parser.ts    # Parse execution output
│   ├── stream-buffer.ts    # Buffer for output streaming
│   └── discord-streamer.ts # Stream output to Discord
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
- Thread per task: Execution log updates and real-time streaming
- Commands channel: Responds to `/oads` slash commands

### Output Streaming
When Claude Code executes, output is streamed to Discord:
1. `StreamBuffer` batches output (1.5s interval, 1500 char threshold)
2. `DiscordStreamer` posts to thread with code block formatting
3. Long outputs are split into multiple messages
4. Typing indicator shows during execution
5. Summary message on completion

### Conversational AI Mode
Messages in #oads-chat trigger Claude API responses with Brain context:
1. User sends message in chat channel
2. Bot shows typing indicator
3. Brain API searched for relevant notes, recent notes, active tasks
4. Claude API called with context + user question
5. Response posted to channel (split if > 2000 chars)

## Commands

### Slash Commands (Recommended)
| Command | Description |
|---------|-------------|
| `/oads status` | Show current active task |
| `/oads queue` | List queued tasks |
| `/oads list [filter]` | List tasks with optional filter |
| `/oads start` | Start Claude Code execution |
| `/oads stop [reason]` | Stop execution gracefully |
| `/oads approve [notes]` | Approve task completion |
| `/oads reject <reason>` | Reject task (reason required) |
| `/oads pick <task>` | Pick task from queue (Tab for autocomplete) |
| `/oads help [command]` | Show help |
| `/oads brain <content> [project]` | Add a note to the brain |

### Prefix Commands (Deprecated)
- `!oads status`, `!oads queue`, `!oads help`
- `!oads start`, `!oads stop [reason]`
- `!oads approve [notes]`, `!oads reject <reason>`

## Environment Variables
Required in `.env`:
- `DISCORD_BOT_TOKEN`
- `DISCORD_GUILD_ID`
- `DISCORD_COMMANDS_CHANNEL_ID`
- `DISCORD_STATUS_CHANNEL_ID`
- `DISCORD_ALERTS_CHANNEL_ID`
- `DISCORD_DECISIONS_CHANNEL_ID`
- `OBSIDIAN_VAULT_PATH`
- `CODE_PROJECTS_PATH`

Optional:
- `STREAMING_ENABLED=true` - Enable real-time streaming
- `STREAM_BUFFER_MS=1500` - Buffer flush interval
- `STREAM_MAX_CHARS=1500` - Force flush threshold
- `REGISTER_SLASH_COMMANDS=true` - Auto-register slash commands
- `DEPRECATE_PREFIX_COMMANDS=true` - Show deprecation warnings
- `BRAIN_API_URL=http://localhost:3000` - Brain API base URL
- `BRAIN_API_KEY` - API key for Brain authentication
- `DISCORD_CHAT_CHANNEL_ID` - Channel for conversational AI mode
- `ANTHROPIC_API_KEY` - Claude API key for conversational mode

## Testing
```bash
npm test        # Run all tests
npm run lint    # Run ESLint
```
