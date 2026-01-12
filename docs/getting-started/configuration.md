---
sidebar_position: 3
---

# Configuration

Complete guide to configuring Mythril.

## Environment Variables

### Required

| Variable | Description | Example |
|----------|-------------|---------|
| `DISCORD_BOT_TOKEN` | Your Discord bot token | `MTQ1...` |
| `ANTHROPIC_API_KEY` | Your Anthropic API key | `sk-ant-...` |

### Paths

| Variable | Description | Example |
|----------|-------------|---------|
| `OBSIDIAN_VAULT_PATH` | Path to your Obsidian vault | `C:\Users\You\Vault` |
| `CODE_PROJECTS_PATH` | Where your code projects live | `C:\Users\You\code` |
| `CLAUDE_CODE_PATH` | Claude Code CLI path (if not in PATH) | `claude` |

### Brain API (Optional)

| Variable | Description | Example |
|----------|-------------|---------|
| `BRAIN_API_URL` | URL to mythril-core | `http://localhost:3000` |
| `BRAIN_API_KEY` | API key for brain | `mythril_live_xxx` |

### Discord Channels

| Variable | Description |
|----------|-------------|
| `DISCORD_GUILD_ID` | Your server ID |
| `DISCORD_COMMANDS_CHANNEL_ID` | Channel for commands |
| `DISCORD_STATUS_CHANNEL_ID` | Channel for status updates |
| `DISCORD_ALERTS_CHANNEL_ID` | Channel for alerts |
| `DISCORD_DECISIONS_CHANNEL_ID` | Channel for approval decisions |
| `DISCORD_CHAT_CHANNEL_ID` | Channel for AI chat |

### Streaming Options

| Variable | Default | Description |
|----------|---------|-------------|
| `STREAMING_ENABLED` | `true` | Enable real-time output streaming |
| `STREAM_BUFFER_MS` | `1500` | Buffer flush interval (ms) |
| `STREAM_MAX_CHARS` | `1500` | Force flush threshold |

### Bot Behavior

| Variable | Default | Description |
|----------|---------|-------------|
| `REGISTER_SLASH_COMMANDS` | `true` | Auto-register slash commands on startup |
| `DEPRECATE_PREFIX_COMMANDS` | `true` | Show warnings for `!mythril` commands |

## Obsidian Vault Setup

Mythril uses an Obsidian vault for task management. Create this structure:

```
your-vault/
└── _orchestra/
    ├── queue/          # Pending tasks go here
    ├── completed/      # Finished tasks
    └── blocked/        # Rejected tasks
```

### Task File Format

Tasks are Markdown files with this structure:

```markdown
# Task: TASK-001 - Implement feature

| Field | Value |
|-------|-------|
| Status | queued |
| Priority | high |
| Project | my-project |

## Description

What needs to be done.

## Acceptance Criteria

- [ ] First requirement
- [ ] Second requirement

## Execution Log

<!-- Claude Code output appears here -->
```

## Discord Server Setup

### Required Channels

Create these channels in your Discord server:

1. **#mythril-commands** - Where you run `/mythril` commands
2. **#mythril-status** - Bot posts task updates here
3. **#mythril-alerts** - Important notifications
4. **#mythril-chat** - Conversational AI mode

### Bot Permissions

The bot needs these permissions:
- Send Messages
- Embed Links
- Read Message History
- Use Slash Commands
- Create Public Threads
- Send Messages in Threads

### Getting Channel IDs

1. Enable Developer Mode in Discord (User Settings > App Settings > Advanced)
2. Right-click a channel > Copy ID

## Example .env File

```env
# Discord
DISCORD_BOT_TOKEN=your_bot_token
DISCORD_GUILD_ID=123456789
DISCORD_COMMANDS_CHANNEL_ID=123456789
DISCORD_STATUS_CHANNEL_ID=123456789
DISCORD_ALERTS_CHANNEL_ID=123456789
DISCORD_DECISIONS_CHANNEL_ID=123456789
DISCORD_CHAT_CHANNEL_ID=123456789

# Anthropic
ANTHROPIC_API_KEY=sk-ant-your-key

# Paths
OBSIDIAN_VAULT_PATH=C:\Users\You\Obsidian\Vault
CODE_PROJECTS_PATH=C:\Users\You\code

# Brain (optional)
BRAIN_API_URL=http://localhost:3000
BRAIN_API_KEY=mythril_live_xxx

# Streaming
STREAMING_ENABLED=true
STREAM_BUFFER_MS=1500
STREAM_MAX_CHARS=1500
```

## Next Steps

- [Your First Task](/getting-started/first-task)
- [Commands Reference](/commands)
