# OADS Discord Orchestration Bot

Discord bot that serves as the orchestration layer for OADS (Obsidian-Augmented Development System). Monitors the Obsidian vault for task changes and posts status updates to Discord.

## Features

- **Vault Monitoring** - Watches `_orchestra/ACTIVE.md` for changes using chokidar
- **Status Broadcasting** - Posts task status updates to Discord with rich embeds
- **Command Interface** - Accepts commands to check status and queue
- **Execution Logging** - Posts execution log updates to a thread per task

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
DISCORD_BOT_TOKEN=your_bot_token
DISCORD_GUILD_ID=your_server_id
DISCORD_COMMANDS_CHANNEL_ID=channel_for_commands
DISCORD_STATUS_CHANNEL_ID=channel_for_status_updates
DISCORD_ALERTS_CHANNEL_ID=channel_for_alerts
DISCORD_DECISIONS_CHANNEL_ID=channel_for_decisions
OBSIDIAN_VAULT_PATH=C:\path\to\your\vault
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

### Status & Info
| Command | Description |
|---------|-------------|
| `!oads status` | Show current active task status |
| `!oads queue` | List queued tasks |
| `!oads help` | Show available commands |

### Execution Control
| Command | Description |
|---------|-------------|
| `!oads start` | Start Claude Code execution on active task |
| `!oads stop [reason]` | Stop Claude Code execution gracefully |

### Approval Workflow
| Command | Description |
|---------|-------------|
| `!oads approve [notes]` | Approve task completion and move to completed |
| `!oads reject <reason>` | Reject task and request retry (reason required) |

## How It Works

1. Bot connects to Discord and starts watching the vault's `_orchestra` directory
2. When `ACTIVE.md` changes, the bot parses the markdown and detects changes
3. Status changes and new acceptance criteria completions are posted to the status channel
4. Execution log entries are posted to a thread associated with the task
5. When tasks are moved to `completed/` or `blocked/`, appropriate messages are posted

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
│   │   ├── commands.ts       # Command handlers
│   │   └── embeds.ts         # Message formatting
│   ├── executor/
│   │   ├── process-manager.ts # Claude Code subprocess control
│   │   └── output-parser.ts   # Parse execution output
│   ├── workflow/
│   │   ├── state-machine.ts   # Task state transitions
│   │   ├── approval-service.ts # Approve/reject logic
│   │   └── file-mover.ts      # Move completed/blocked tasks
│   └── watcher/
│       ├── vault-monitor.ts  # File system watcher
│       ├── parser.ts         # Markdown task parser
│       └── differ.ts         # Change detection
├── tests/
│   ├── parser.test.ts
│   ├── differ.test.ts
│   ├── state-machine.test.ts
│   └── approval.test.ts
├── package.json
├── tsconfig.json
└── CLAUDE.md
```

## License

MIT
