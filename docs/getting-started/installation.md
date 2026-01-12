---
sidebar_position: 2
---

# Installation

Get Mythril up and running on your machine.

## Prerequisites

Before installing Mythril, ensure you have:

- **Node.js 18+** - [Download](https://nodejs.org/)
- **npm** - Comes with Node.js
- **Git** - [Download](https://git-scm.com/)
- **Claude Code CLI** - `npm install -g @anthropic-ai/claude-code`
- **Discord Bot Token** - From [Discord Developer Portal](https://discord.com/developers/applications)
- **Anthropic API Key** - From [Anthropic Console](https://console.anthropic.com/)

## Quick Start

### 1. Clone the Repository

```bash
git clone https://github.com/Zarosk/mythril-bot.git
cd mythril-bot
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your tokens and paths. See [Configuration](/getting-started/configuration) for details.

### 4. Authenticate Claude Code

```bash
claude auth
```

### 5. Validate Setup

```bash
npm run setup-check
```

This checks all prerequisites and configuration.

### 6. Start the Bot

```bash
npm run dev
```

## Troubleshooting

### "Claude Code CLI not found"

```bash
npm install -g @anthropic-ai/claude-code
claude auth
```

### "DISCORD_BOT_TOKEN not set"

Make sure `.env` file exists and has the token:

```env
DISCORD_BOT_TOKEN=your_token_here
```

### Bot doesn't respond to commands

1. Check bot has correct permissions in Discord
2. Verify intents are enabled in Developer Portal (MESSAGE CONTENT intent required)
3. Check console for errors
4. Ensure bot is in the correct channels

### "Cannot find module" errors

```bash
npm install
npm run build
```

### Setup check fails

Run `npm run setup-check` to see which prerequisites are missing, then install them.

## Next Steps

- [Configuration Guide](/getting-started/configuration)
- [Your First Task](/getting-started/first-task)
