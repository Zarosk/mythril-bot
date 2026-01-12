# Mythril

AI-powered Discord bot for development orchestration. Self-hosted, open source, free forever.

## Features

- **Claude Code Integration** - Orchestrate AI coding sessions from Discord
- **Brain/Memory** - Persistent notes and context across sessions
- **Task Management** - Queue, track, and approve development tasks
- **Notifications** - Real-time updates on task progress
- **BYOK** - Bring your own Anthropic API key

## Quick Start

```bash
# Clone
git clone https://github.com/Zarosk/mythril-bot.git
cd mythril-bot

# Configure
cp .env.example .env
# Edit .env with your Discord token and Anthropic API key

# Run with Docker
docker-compose up

# Or run directly
npm install
npm run dev:all
```

## Documentation

Full docs: https://mythril-docs.vercel.app

## Commands

| Command | Description |
|---------|-------------|
| `/mythril status` | Show current task status |
| `/mythril queue` | List queued tasks |
| `/mythril start` | Start Claude Code execution |
| `/mythril stop` | Stop execution gracefully |
| `/mythril brain <note>` | Add a note to the brain |
| `/mythril help` | Show all commands |

## Requirements

- Node.js 18+
- Discord Bot Token ([create one](https://discord.com/developers/applications))
- Anthropic API Key ([get one](https://console.anthropic.com/))

## Community

https://discord.gg/kkbTmW8QF2

## Support

- [Report bugs](https://github.com/Zarosk/mythril-bot/issues)
- [Discussions](https://github.com/Zarosk/mythril-bot/discussions)

## License

MIT - Use it however you want.
