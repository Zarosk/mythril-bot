# Mythril

AI-powered Discord bot for development orchestration. Self-hosted, open source, free forever.

## Features

- **Claude Code Integration** - Orchestrate AI coding sessions from Discord
- **Brain/Memory** - Persistent notes and context across sessions
- **Task Management** - Queue, track, and approve development tasks
- **Real-time Streaming** - Stream Claude Code output to Discord in real-time
- **Approval Workflow** - Approve or reject completed tasks with notes
- **BYOK** - Bring your own Anthropic API key

## Quick Start

```bash
git clone https://github.com/Zarosk/mythril-bot.git
cd mythril-bot
cp .env.example .env
# Edit .env with your Discord token and Anthropic API key
npm install
npm run dev
```

## Documentation

Full docs: https://mythril-docs.vercel.app

## Commands

| Command | Description |
|---------|-------------|
| `/mythril status` | Show current task status |
| `/mythril queue` | List queued tasks |
| `/mythril start` | Start Claude Code execution |
| `/mythril stop [reason]` | Stop execution gracefully |
| `/mythril approve [notes]` | Approve task completion |
| `/mythril reject <reason>` | Reject task and request retry |
| `/mythril pick <task>` | Pick a task from the queue |
| `/mythril brain <note>` | Add a note to the brain |
| `/mythril help` | Show all commands |

## Requirements

- Node.js 18+
- Discord Bot Token
- Anthropic API Key

## Configuration

Create a `.env` file with:

```env
DISCORD_BOT_TOKEN=your_bot_token
DISCORD_GUILD_ID=your_server_id
DISCORD_COMMANDS_CHANNEL_ID=channel_for_commands
DISCORD_STATUS_CHANNEL_ID=channel_for_status_updates
OBSIDIAN_VAULT_PATH=C:\path\to\your\vault
CODE_PROJECTS_PATH=C:\path\to\projects
ANTHROPIC_API_KEY=sk-ant-...
```

See `.env.example` for all options.

## Project Structure

```
mythril-bot/
├── src/
│   ├── bot/           # Discord client, commands, embeds
│   ├── executor/      # Claude Code process management
│   ├── workflow/      # Task state machine, approvals
│   └── watcher/       # Vault file monitoring
├── tests/
└── ...
```

## Links

- [Website](https://mythril-web.vercel.app)
- [Documentation](https://mythril-docs.vercel.app)
- [Core API](https://github.com/Zarosk/mythril-core)
- [Report Issues](https://github.com/Zarosk/mythril-bot/issues)

## License

MIT
