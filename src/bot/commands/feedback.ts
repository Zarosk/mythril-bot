/**
 * Feedback Command
 * Allows users to submit feedback, rate-limited and stored in Brain API.
 */

import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  RESTPostAPIChatInputApplicationCommandsJSONBody,
} from 'discord.js';
import { config } from '../../config';
import logger from '../../utils/logger';
import { sanitizeInput } from '../../utils/security';

const MAX_MESSAGE_LENGTH = 1000;

interface FeedbackResponse {
  id: string;
  created_at: string;
}

interface RateLimitInfo {
  remaining: number;
  limit: number;
  resetIn?: number;
}

interface SubmitFeedbackResult {
  feedback: FeedbackResponse | null;
  rateLimit: RateLimitInfo | null;
  error?: string;
}

/**
 * Build the /feedback slash command
 */
export function buildFeedbackCommand(): RESTPostAPIChatInputApplicationCommandsJSONBody {
  return new SlashCommandBuilder()
    .setName('feedback')
    .setDescription('Submit feedback about Mythril')
    .addStringOption(opt =>
      opt
        .setName('message')
        .setDescription('Your feedback (max 1000 characters)')
        .setRequired(true)
        .setMaxLength(MAX_MESSAGE_LENGTH)
    )
    .toJSON();
}

/**
 * Submit feedback to the Brain API
 */
async function submitFeedbackToApi(
  message: string,
  userId: string,
  username: string,
  guildName: string
): Promise<SubmitFeedbackResult> {
  const url = config.brainApi.url;
  const apiKey = config.brainApi.apiKey;

  if (!url || !apiKey) {
    return { feedback: null, rateLimit: null, error: 'Brain API not configured' };
  }

  try {
    const response = await fetch(`${url}/api/v1/feedback`, {
      method: 'POST',
      headers: {
        'X-API-Key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message,
        user_id: userId,
        username,
        guild_name: guildName,
      }),
    });

    // Parse rate limit headers
    const rateLimit: RateLimitInfo = {
      remaining: parseInt(response.headers.get('x-ratelimit-remaining') ?? '2', 10),
      limit: parseInt(response.headers.get('x-ratelimit-limit') ?? '2', 10),
    };

    if (response.status === 429) {
      const body = await response.json().catch(() => ({})) as { resetIn?: number };
      rateLimit.resetIn = body.resetIn;
      return {
        feedback: null,
        rateLimit,
        error: `Rate limit reached. You can submit ${rateLimit.limit} feedback per day. Try again in ${formatDuration(rateLimit.resetIn ?? 86400)}.`,
      };
    }

    if (!response.ok) {
      const body = await response.json().catch(() => ({ error: 'Unknown error' })) as { error?: string };
      return { feedback: null, rateLimit, error: body.error ?? `API error: ${response.status}` };
    }

    const feedback = await response.json() as FeedbackResponse;
    return { feedback, rateLimit };
  } catch (error) {
    logger.error('Failed to submit feedback to API', { error });
    return { feedback: null, rateLimit: null, error: 'Failed to connect to feedback service' };
  }
}

/**
 * Send feedback to Discord webhook
 */
async function sendToWebhook(
  message: string,
  username: string,
  guildName: string
): Promise<boolean> {
  const webhookUrl = process.env.FEEDBACK_WEBHOOK_URL;

  if (!webhookUrl) {
    logger.warn('FEEDBACK_WEBHOOK_URL not configured, skipping webhook');
    return false;
  }

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        embeds: [{
          title: 'New Feedback',
          color: 0x5865f2, // Discord blurple
          fields: [
            { name: 'From', value: `@${username}`, inline: true },
            { name: 'Server', value: guildName, inline: true },
            { name: 'Message', value: message.length > 1024 ? message.substring(0, 1021) + '...' : message },
          ],
          timestamp: new Date().toISOString(),
        }],
      }),
    });

    if (!response.ok) {
      logger.warn('Webhook request failed', { status: response.status });
      return false;
    }

    return true;
  } catch (error) {
    logger.error('Failed to send feedback to webhook', { error });
    return false;
  }
}

/**
 * Format duration in seconds to human-readable string
 */
function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${seconds} seconds`;
  }
  if (seconds < 3600) {
    const minutes = Math.ceil(seconds / 60);
    return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
  }
  const hours = Math.ceil(seconds / 3600);
  return `${hours} hour${hours !== 1 ? 's' : ''}`;
}

/**
 * Handle the /feedback slash command
 */
export async function handleFeedbackCommand(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  const rawMessage = interaction.options.getString('message', true);
  const message = sanitizeInput(rawMessage, MAX_MESSAGE_LENGTH);

  if (!message.trim()) {
    await interaction.reply({
      content: 'Feedback message cannot be empty.',
      ephemeral: true,
    });
    return;
  }

  const userId = interaction.user.id;
  const username = interaction.user.tag;
  const guildName = interaction.guild?.name ?? 'Direct Message';

  await interaction.deferReply({ ephemeral: true });

  // Submit to Brain API
  const result = await submitFeedbackToApi(message, userId, username, guildName);

  if (result.error) {
    await interaction.editReply({
      content: result.error,
    });
    return;
  }

  // Send to webhook (fire and forget, don't block on this)
  sendToWebhook(message, username, guildName).catch(err => {
    logger.error('Webhook send failed', { error: err });
  });

  // Build response message
  let responseMessage = 'Thank you for your feedback!';
  if (result.rateLimit && result.rateLimit.remaining > 0) {
    responseMessage += ` You have ${result.rateLimit.remaining} feedback submission${result.rateLimit.remaining !== 1 ? 's' : ''} remaining today.`;
  } else if (result.rateLimit && result.rateLimit.remaining === 0) {
    responseMessage += ' This was your last submission for today.';
  }

  await interaction.editReply({
    content: responseMessage,
  });

  logger.info('Feedback submitted', {
    userId,
    username,
    feedbackId: result.feedback?.id,
  });
}
