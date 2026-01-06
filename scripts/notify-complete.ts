#!/usr/bin/env tsx
/**
 * notify-complete.ts
 *
 * Standalone script to notify Discord when a Claude Code session completes.
 * Works for both manual runs and bot-triggered runs.
 *
 * Usage: npm run notify
 * Or: npm run notify --prefix C:\Users\Alexander\code\oads-discord-bot
 */

import * as fs from 'fs';
import * as path from 'path';

const ACTIVE_TASK_PATH = 'C:\\Users\\Alexander\\oads-vault\\_orchestra\\ACTIVE.md';
const DISCORD_WEBHOOK_URL = 'https://discordapp.com/api/webhooks/1457907118886621319/Uoziz_0LFKasaPJRaYjPuBma7grkp_P2WErtoGYHSXoTeyMi_mFCjPMGlXYS-Ui9Y-nL';

interface TaskInfo {
  id: string;
  title: string;
  project: string;
  status: string;
}

function parseTaskTitle(content: string): { id: string; title: string } {
  const titleMatch = content.match(/^# Task:\s*(\S+)\s*-\s*(.+)$/m);
  if (titleMatch) {
    return { id: titleMatch[1], title: titleMatch[2].trim() };
  }
  const simpleTitleMatch = content.match(/^# Task:\s*(.+)$/m);
  if (simpleTitleMatch) {
    return { id: 'UNKNOWN', title: simpleTitleMatch[1].trim() };
  }
  return { id: 'UNKNOWN', title: 'Unknown Task' };
}

function parseMetadataField(content: string, field: string): string {
  const regex = new RegExp(`\\|\\s*${field}\\s*\\|\\s*([^|]+)\\s*\\|`, 'i');
  const match = content.match(regex);
  return match ? match[1].trim() : '';
}

function updateStatusInContent(content: string, newStatus: string): string {
  // Replace the status in the metadata table
  return content.replace(
    /(\|\s*Status\s*\|\s*)([^|]+)(\s*\|)/i,
    `$1${newStatus}$3`
  );
}

function addLogEntry(content: string, entry: string): string {
  const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
  const logEntry = `- [${timestamp}] ${entry}`;

  // Find the Execution Log section and add entry
  const logMatch = content.match(/(## Execution Log\s*\n)/);
  if (logMatch) {
    return content.replace(logMatch[0], `${logMatch[0]}${logEntry}\n`);
  }

  // If no log section, add one at the end
  return content + `\n## Execution Log\n${logEntry}\n`;
}

async function postToDiscord(task: TaskInfo): Promise<void> {
  const embed = {
    title: `Task Ready for Review`,
    description: `**${task.id}** - ${task.title}`,
    color: 0xFFA500, // Orange for pending review
    fields: [
      {
        name: 'Project',
        value: task.project || 'Unknown',
        inline: true
      },
      {
        name: 'Status',
        value: 'PENDING_REVIEW',
        inline: true
      },
      {
        name: 'Action Required',
        value: 'Use `/oads approve` or `/oads reject <reason>` to process',
        inline: false
      }
    ],
    footer: {
      text: 'Claude Code execution completed'
    },
    timestamp: new Date().toISOString()
  };

  const response = await fetch(DISCORD_WEBHOOK_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ embeds: [embed] })
  });

  if (!response.ok) {
    throw new Error(`Discord webhook failed: ${response.status} ${response.statusText}`);
  }
}

async function main(): Promise<void> {
  console.log('OADS Completion Notifier');
  console.log('========================\n');

  // Check if ACTIVE.md exists
  if (!fs.existsSync(ACTIVE_TASK_PATH)) {
    console.log('No active task found at:', ACTIVE_TASK_PATH);
    console.log('Nothing to notify.');
    process.exit(0);
  }

  // Read the active task
  let content = fs.readFileSync(ACTIVE_TASK_PATH, 'utf-8');
  const { id, title } = parseTaskTitle(content);
  const project = parseMetadataField(content, 'Project');
  const currentStatus = parseMetadataField(content, 'Status');

  console.log(`Task: ${id} - ${title}`);
  console.log(`Project: ${project}`);
  console.log(`Current Status: ${currentStatus}\n`);

  // Check if already in review
  if (currentStatus === 'PENDING_REVIEW') {
    console.log('Task is already in PENDING_REVIEW status.');
    console.log('Sending notification anyway...\n');
  } else {
    // Update status to PENDING_REVIEW
    content = updateStatusInContent(content, 'PENDING_REVIEW');
    content = addLogEntry(content, 'Execution completed - awaiting review');

    fs.writeFileSync(ACTIVE_TASK_PATH, content);
    console.log('Updated status to PENDING_REVIEW');
  }

  // Post to Discord
  console.log('Posting to Discord...');

  try {
    await postToDiscord({
      id,
      title,
      project,
      status: 'PENDING_REVIEW'
    });
    console.log('Discord notification sent successfully!');
  } catch (error) {
    console.error('Failed to send Discord notification:', error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
