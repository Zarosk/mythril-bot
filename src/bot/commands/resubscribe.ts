/**
 * /resubscribe command
 * Reactivates notifications for a previously unsubscribed user.
 */

import {
  ChatInputCommandInteraction,
  SlashCommandSubcommandBuilder,
} from 'discord.js';
import logger from '../../utils/logger';
import { resubscribeUser } from '../brain-client';

export const subcommand = (sub: SlashCommandSubcommandBuilder): SlashCommandSubcommandBuilder =>
  sub
    .setName('resubscribe')
    .setDescription('Start receiving notifications again');

export async function handleResubscribe(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  const userId = interaction.user.id;
  const userTag = interaction.user.tag;

  await interaction.deferReply({ ephemeral: true });

  try {
    const result = await resubscribeUser(userId);

    if (result.success) {
      logger.info('User resubscribed', { userId, userTag });
      await interaction.editReply({
        content: 'Welcome back! You are now subscribed to notifications.',
      });
    } else if (result.alreadySubscribed) {
      await interaction.editReply({
        content: 'You are already subscribed to notifications.',
      });
    } else {
      await interaction.editReply({
        content: `Failed to resubscribe: ${result.error || 'Unknown error'}`,
      });
    }
  } catch (error) {
    logger.error('Resubscribe command failed', { userId, error });
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    await interaction.editReply({
      content: `An error occurred: ${errorMsg}`,
    });
  }
}
