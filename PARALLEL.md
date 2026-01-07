# Parallel Claude Code Coordination

## Purpose
This file coordinates multiple Claude Code instances working simultaneously.
READ THIS BEFORE STARTING ANY WORK.

## Current Session
Status: INACTIVE
Instances: 0

---

## File Ownership Rules

### Bot (oads-discord-bot)

| File/Directory | Owner | Notes |
|----------------|-------|-------|
| src/bot/commands/*.ts | EXCLUSIVE | Each new command = one owner |
| src/bot/events/*.ts | EXCLUSIVE | Each event = one owner |
| src/bot/services/*.ts | EXCLUSIVE | Each service = one owner |
| src/bot/utils/*.ts | EXCLUSIVE | Each utility = one owner |
| src/bot/client.ts | SHARED | Append only - add imports + listeners at end |
| src/bot/slash-commands.ts | SHARED | Append only - add to switch statement |
| src/utils/logger.ts | LOCKED | Do not modify during parallel work |
| src/utils/security.ts | LOCKED | Do not modify during parallel work |

---

## Parallel Session Template

When starting parallel work, copy this to top of file:

```
## Active Session
Started: YYYY-MM-DD HH:MM
Coordinator: CC-5 (or human)

| Instance | Branch | Task | Owned Files | Status |
|----------|--------|------|-------------|--------|
| CC-1 | feat/xxx | Description | file1.ts, file2.ts | WORKING |
| CC-2 | feat/yyy | Description | file3.ts, file4.ts | WORKING |
| CC-3 | feat/zzz | Description | file5.ts, file6.ts | WORKING |
| CC-4 | feat/aaa | Description | file7.ts, file8.ts | WORKING |
| CC-5 | master | QC/Coordinator | PARALLEL.md | WATCHING |
```

---

## Instance Prompt Template

Each parallel instance should receive this header in their prompt:

```
## PARALLEL WORK PROTOCOL

**BEFORE ANY WORK:**
1. Read C:\Users\Alexander\code\oads-discord-bot\PARALLEL.md
2. Run: git checkout [your-branch]
3. Run: git status (confirm clean state)
4. Confirm your owned files list

**YOUR ASSIGNMENT:**
- Instance: CC-[X]
- Branch: feat/[name]
- Owned files (modify freely): [list]
- Shared files (append only): [list]
- Locked files (do not touch): logger.ts, security.ts, config.ts

**RULES:**
1. ONLY modify files in your "Owned" list
2. For "Shared" files: APPEND to end only, never restructure
3. If you need a "Locked" file: STOP and report to coordinator
4. If build fails: STOP and report
5. Commit to YOUR branch only

**WHEN DONE:**
1. Run: npm run build
2. If build passes: git add . && git commit -m "feat: [description]"
3. Report completion to coordinator
```

---

## Merge Order (QC/Coordinator Reference)

Always merge in this order to minimize conflicts:

1. Isolated branches first (no shared file changes)
2. Branches touching client.ts (minimal shared)
3. Branches touching slash-commands.ts (most shared)

---

## Conflict Resolution Patterns

### Import conflicts
```typescript
// KEEP ALL IMPORTS FROM BOTH BRANCHES
import { A } from './a';  // from branch 1
import { B } from './b';  // from branch 2
```

### Switch statement conflicts (slash-commands.ts)
```typescript
switch (subcommand) {
  case 'unsubscribe':  // from branch 1
    // ...
    break;
  case 'feedback':     // from branch 2
    // ...
    break;
}
```

### Client.ts listener conflicts
```typescript
// Add all event listeners - order doesn't matter
client.on('guildCreate', handleGuildCreate);  // from branch 1
client.on('customEvent', handleCustom);       // from branch 2
```

---

## Post-Merge Checklist

- [ ] All branches merged to master
- [ ] `npm run build` passes
- [ ] `npm run lint` passes (or only pre-existing errors)
- [ ] No duplicate imports
- [ ] All switch cases have unique names
- [ ] All new commands registered
- [ ] Session status set to INACTIVE
