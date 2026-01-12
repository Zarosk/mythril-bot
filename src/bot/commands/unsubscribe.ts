/**
 * /unsubscribe command
 * Marks user as unsubscribed from notifications while preserving their data.
 */

import {
  ChatInputCommandInteraction,
  SlashCommandSubcommandBuilder,
} from 'discord.js';
import logger from '../../utils/logger';
import { unsubscribeUser } from '../brain-client';

export const subcommand = (sub: SlashCommandSubcommandBuilder): SlashCommandSubcommandBuilder =>
  sub
    .setName('unsubscribe')
    .setDescription('Stop receiving notifications (your data is preserved)');

export async function handleUnsubscribe(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  const userId = interaction.user.id;
  const userTag = interaction.user.tag;

  await interaction.deferReply({ ephemeral: true });

  try {
    const result = await unsubscribeUser(userId);

    if (result.success) {
      logger.info('User unsubscribed', { userId, userTag });
      await interaction.editReply({
        content: 'You have been unsubscribed from notifications.\n\n' +
          'Your data has been preserved. Use `/mythril resubscribe` to start receiving notifications again.',
      });
    } else if (result.alreadyUnsubscribed) {
      await interaction.editReply({
        content: 'You are already unsubscribed from notifications.\n\n' +
          'Use `/mythril resubscribe` to start receiving notifications again.',
      });
    } else {
      await interaction.editReply({
        content: `Failed to unsubscribe: ${result.error || 'Unknown error'}`,
      });
    }
  } catch (error) {
    logger.error('Unsubscribe command failed', { userId, error });
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    await interaction.editReply({
      content: `An error occurred: ${errorMsg}`,
    });
  }
}
