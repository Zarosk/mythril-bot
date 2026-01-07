# Mythril Orchestration Bot

Discord bot that serves as the orchestration layer for Mythril, an AI-powered development system. Monitors the Obsidian vault for task changes and posts status updates to Discord.

## Features

- **Vault Monitoring** - Watches `_orchestra/ACTIVE.md` for changes using chokidar
- **Status Broadcasting** - Posts task status updates to Discord with rich embeds
- **Slash Commands** - Modern `/oads` commands with autocomplete support
- **Real-time Streaming** - Streams Claude Code output to Discord in real-time
- **Execution Logging** - Posts execution log updates to a thread per task
- **Approval Workflow** - Approve or reject completed tasks with notes

## Installation

```bash
# Clone the repository
git clone <repo-url>
cd oads-discord-bot

# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Edit .env with your credentials
```

## Configuration

Create a `.env` file with the following variables:

```env
# Required Discord Configuration
DISCORD_BOT_TOKEN=your_bot_token
DISCORD_GUILD_ID=your_server_id
DISCORD_COMMANDS_CHANNEL_ID=channel_for_commands
DISCORD_STATUS_CHANNEL_ID=channel_for_status_updates
DISCORD_ALERTS_CHANNEL_ID=channel_for_alerts
DISCORD_DECISIONS_CHANNEL_ID=channel_for_decisions

# Required Paths
OBSIDIAN_VAULT_PATH=C:\path\to\your\vault
CODE_PROJECTS_PATH=C:\path\to\projects

# Optional: Streaming Configuration
STREAMING_ENABLED=true              # Enable real-time output streaming
STREAM_BUFFER_MS=1500               # Buffer interval in ms
STREAM_MAX_CHARS=1500               # Force flush threshold

# Optional: Slash Command Configuration
REGISTER_SLASH_COMMANDS=true        # Auto-register slash commands
DEPRECATE_PREFIX_COMMANDS=true      # Show deprecation warnings for !oads
```

## Usage

```bash
# Development mode
npm run dev

# Build for production
npm run build

# Run production build
npm start
```

## Discord Commands

### Slash Commands (Recommended)

| Command | Description |
|---------|-------------|
| `/oads status` | Show current active task status |
| `/oads queue` | List queued tasks |
| `/oads list [filter]` | List tasks with optional filter |
| `/oads start` | Start Claude Code execution on active task |
| `/oads stop [reason]` | Stop Claude Code execution gracefully |
| `/oads approve [notes]` | Approve task completion |
| `/oads reject <reason>` | Reject task and request retry |
| `/oads pick <task>` | Pick a task from the queue (Tab for autocomplete) |
| `/oads help [command]` | Show help for commands |

### Prefix Commands (Deprecated)

Prefix commands (`!oads`) are still supported for backwards compatibility but will show a deprecation warning. Use slash commands instead.

| Command | Description |
|---------|-------------|
| `!oads status` | Show current active task status |
| `!oads queue` | List queued tasks |
| `!oads help` | Show available commands |
| `!oads start` | Start Claude Code execution |
| `!oads stop [reason]` | Stop Claude Code execution |
| `!oads approve [notes]` | Approve task completion |
| `!oads reject <reason>` | Reject task (reason required) |

## Output Streaming

When Claude Code is running, output is streamed to Discord in real-time:

- Output is buffered for 1-2 seconds before posting (avoids spam)
- Long outputs are automatically split into multiple messages
- Code block formatting is applied automatically
- Typing indicator shows while execution is active
- Final summary message shows completion status and duration

## How It Works

1. Bot connects to Discord and registers slash commands
2. Bot starts watching the vault's `_orchestra` directory
3. When `ACTIVE.md` changes, the bot parses the markdown and detects changes
4. Status changes and acceptance criteria updates are posted to the status channel
5. When `/oads start` is called, Claude Code begins execution with real-time streaming
6. Execution log entries are posted to a thread associated with the task
7. When tasks are moved to `completed/` or `blocked/`, appropriate messages are posted

## Development

```bash
# Run tests
npm test

# Run linting
npm run lint

# Build
npm run build
```

## Project Structure

```
oads-discord-bot/
├── src/
│   ├── index.ts              # Bot entry point
│   ├── config.ts             # Configuration loader
│   ├── types.ts              # TypeScript interfaces
│   ├── bot/
│   │   ├── client.ts         # Discord.js client setup
│   │   ├── commands.ts       # Prefix command handlers (deprecated)
│   │   ├── slash-commands.ts # Slash command handlers
│   │   └── embeds.ts         # Message formatting
│   ├── executor/
│   │   ├── process-manager.ts  # Claude Code subprocess control
│   │   ├── output-parser.ts    # Parse execution output
│   │   ├── stream-buffer.ts    # Buffer for output streaming
│   │   └── discord-streamer.ts # Stream output to Discord
│   ├── workflow/
│   │   ├── state-machine.ts    # Task state transitions
│   │   ├── approval-service.ts # Approve/reject logic
│   │   └── file-mover.ts       # Move completed/blocked tasks
│   └── watcher/
│       ├── vault-monitor.ts  # File system watcher
│       ├── parser.ts         # Markdown task parser
│       └── differ.ts         # Change detection
├── tests/
│   ├── parser.test.ts
│   ├── differ.test.ts
│   ├── state-machine.test.ts
│   ├── approval.test.ts
│   ├── stream-buffer.test.ts
│   └── slash-commands.test.ts
├── package.json
├── tsconfig.json
├── CHANGELOG.md
└── CLAUDE.md
```

## License

MIT
