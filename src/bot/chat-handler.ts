import Anthropic from '@anthropic-ai/sdk';
import { Message, TextChannel } from 'discord.js';
import { config } from '../config';
import { searchBrain, getRecentNotes, getActiveTasks, RateLimitError } from './brain-client';
import logger from '../utils/logger';

const SYSTEM_PROMPT = `You are an AI development assistant integrated with the user's personal knowledge base (Brain).

You have access to:
- Their notes and ideas
- Their project contexts
- Their active and queued tasks

Your role:
- Answer questions about their work and ideas
- Help them find things they noted before
- Suggest creating tasks when appropriate
- Be concise and helpful

Current context will be provided with each message.`;

let anthropicClient: Anthropic | null = null;

function getAnthropicClient(): Anthropic {
  if (!anthropicClient) {
    if (!config.anthropic.apiKey) {
      throw new Error('Anthropic API key not configured');
    }
    anthropicClient = new Anthropic({
      apiKey: config.anthropic.apiKey,
    });
  }
  return anthropicClient;
}

/**
 * Check if an error is an Anthropic rate limit error
 */
function isAnthropicRateLimitError(error: unknown): boolean {
  if (error instanceof Anthropic.RateLimitError) {
    return true;
  }
  // Also check for the status code in case the SDK wraps it differently
  if (error && typeof error === 'object' && 'status' in error) {
    return (error as { status: number }).status === 429;
  }
  return false;
}

/**
 * Format Anthropic rate limit error message for Discord
 */
function formatAnthropicRateLimitMessage(): string {
  return [
    '**Anthropic API Rate Limit Hit**',
    '',
    "This is your API key's limit, not ours.",
    'Check usage: https://console.anthropic.com',
    '',
    'Try again in a minute or consider upgrading your plan.',
  ].join('\n');
}

export async function handleChatMessage(message: Message): Promise<void> {
  // Show typing indicator
  const channel = message.channel;
  if (channel instanceof TextChannel || 'sendTyping' in channel) {
    await (channel as TextChannel).sendTyping();
  }

  try {
    // Gather context from Brain
    const context = await gatherContext(message.content);

    // Build messages for Claude
    const messages: Anthropic.MessageParam[] = [
      {
        role: 'user',
        content: `Context from Brain:\n${context}\n\n---\n\nUser question: ${message.content}`,
      },
    ];

    // Call Claude API
    const client = getAnthropicClient();
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages,
    });

    // Extract text response
    const textContent = response.content.find((c) => c.type === 'text');
    const reply = textContent?.text || 'I could not generate a response.';

    // Send response (split if too long for Discord)
    if (reply.length > 2000) {
      const chunks = splitMessage(reply, 2000);
      for (const chunk of chunks) {
        await message.reply(chunk);
      }
    } else {
      await message.reply(reply);
    }
  } catch (error) {
    // Handle Anthropic rate limit errors specially
    if (isAnthropicRateLimitError(error)) {
      logger.warn('Anthropic API rate limit hit', {
        userId: message.author.id,
      });
      await message.reply(formatAnthropicRateLimitMessage());
      return;
    }

    // Handle Brain API rate limit errors
    if (error instanceof RateLimitError) {
      logger.warn('Brain API rate limit hit during chat', {
        userId: message.author.id,
        resetIn: error.rateLimit.resetIn,
      });
      await message.reply(
        `**Brain API Rate Limit**\nToo many requests. Resets in ${error.rateLimit.resetIn} seconds.`
      );
      return;
    }

    logger.error('Error handling chat message', { userId: message.author.id, error });

    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    await message.reply(
      `Sorry, I encountered an error: ${errorMessage}`
    );
  }
}

async function gatherContext(query: string): Promise<string> {
  const parts: string[] = [];

  try {
    // Search brain for relevant notes
    const searchResults = await searchBrain(query);
    if (searchResults.length > 0) {
      parts.push('**Relevant Notes:**');
      for (const note of searchResults.slice(0, 5)) {
        const preview = note.content.slice(0, 200);
        const suffix = note.content.length > 200 ? '...' : '';
        parts.push(`- ${preview}${suffix}`);
      }
    }

    // Get recent notes
    const recent = await getRecentNotes(5);
    if (recent.length > 0) {
      parts.push('\n**Recent Notes:**');
      for (const note of recent) {
        const preview = note.content.slice(0, 100);
        const suffix = note.content.length > 100 ? '...' : '';
        parts.push(`- [${note.created_at}] ${preview}${suffix}`);
      }
    }

    // Get active tasks
    const tasks = await getActiveTasks();
    if (tasks.length > 0) {
      parts.push('\n**Active Tasks:**');
      for (const task of tasks) {
        parts.push(`- ${task.id}: ${task.title} (${task.status})`);
      }
    }
  } catch (error) {
    // If Brain API fails (including rate limits), continue without context
    if (error instanceof RateLimitError) {
      logger.warn('Brain API rate limited during context gathering', {
        resetIn: error.rateLimit.resetIn,
      });
      parts.push('*Brain API rate limited - proceeding without context*');
    } else {
      logger.warn('Failed to gather Brain context', { error });
    }
  }

  return parts.join('\n') || 'No context available from Brain.';
}

function splitMessage(text: string, maxLength: number): string[] {
  const chunks: string[] = [];
  let current = '';

  for (const line of text.split('\n')) {
    if (current.length + line.length + 1 > maxLength) {
      if (current) {
        chunks.push(current);
      }
      // If a single line is longer than maxLength, split it
      if (line.length > maxLength) {
        let remaining = line;
        while (remaining.length > maxLength) {
          chunks.push(remaining.slice(0, maxLength));
          remaining = remaining.slice(maxLength);
        }
        current = remaining;
      } else {
        current = line;
      }
    } else {
      current += (current ? '\n' : '') + line;
    }
  }

  if (current) {
    chunks.push(current);
  }

  return chunks;
}
