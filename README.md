# Mythril

AI-powered Discord bot that orchestrates Claude Code execution. Self-hosted, open source, free forever.

## What It Does

```
/mythril start
    ↓
claude --dangerously-skip-permissions -p "task prompt"
    ↓
Output streams to Discord thread
    ↓
/mythril approve
```

Control Claude Code from Discord. The AI runs on your machine, in your codebase.

## Features

- **Claude Code Orchestration** - Trigger Claude Code from Discord, watch output in real-time
- **Task Management** - Queue tasks in Obsidian, pick and execute from Discord
- **Brain/Memory** - Persistent notes and context across sessions
- **BYOK** - Bring your own Anthropic API key

## Requirements

- Node.js 18+
- [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code) installed locally
- Obsidian (for task management)
- Discord Bot Token
- Anthropic API Key

## Quick Start

```bash
git clone https://github.com/Zarosk/mythril-bot.git
cd mythril-bot
cp .env.example .env
# Edit .env with your tokens and paths
npm install
npm run dev:all
```

**Note:** Docker won't work for this use case. Claude Code must run locally on your machine.

## Commands

| Command | Description |
|---------|-------------|
| `/mythril start` | Start Claude Code execution |
| `/mythril stop` | Stop execution gracefully |
| `/mythril approve` | Approve completed task |
| `/mythril reject` | Reject task |
| `/mythril status` | Show current task |
| `/mythril queue` | List queued tasks |
| `/mythril pick` | Activate a task |
| `/mythril brain` | Add a note |
| `/mythril help` | Show all commands |

## Documentation

Full docs: https://mythril-docs.vercel.app

## Links

- [Website](https://mythril-web.vercel.app)
- [Documentation](https://mythril-docs.vercel.app)
- [Discord Community](https://discord.gg/kkbTmW8QF2)
- [Report Issues](https://github.com/Zarosk/mythril-bot/issues)

## License

MIT - Use it however you want.
