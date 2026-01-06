/**
 * /delete-my-data command
 * Permanently deletes all user data after confirmation.
 */

import {
  ChatInputCommandInteraction,
  SlashCommandSubcommandBuilder,
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ModalActionRowComponentBuilder,
} from 'discord.js';
import logger from '../../utils/logger';
import { deleteUserData } from '../brain-client';

const CONFIRMATION_PHRASE = 'CONFIRM DELETE';

export const subcommand = (sub: SlashCommandSubcommandBuilder): SlashCommandSubcommandBuilder =>
  sub
    .setName('delete-my-data')
    .setDescription('Permanently delete all your data (requires confirmation)');

export async function handleDeleteData(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  const userId = interaction.user.id;
  const userTag = interaction.user.tag;

  // Show modal for confirmation
  const modal = new ModalBuilder()
    .setCustomId(`delete-data-confirm-${userId}`)
    .setTitle('Delete All Your Data');

  const confirmInput = new TextInputBuilder()
    .setCustomId('confirmation')
    .setLabel(`Type "${CONFIRMATION_PHRASE}" to confirm`)
    .setPlaceholder(CONFIRMATION_PHRASE)
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMinLength(CONFIRMATION_PHRASE.length)
    .setMaxLength(CONFIRMATION_PHRASE.length + 5);

  const row = new ActionRowBuilder<ModalActionRowComponentBuilder>()
    .addComponents(confirmInput);

  modal.addComponents(row);

  await interaction.showModal(modal);

  // Wait for modal submission
  try {
    const modalInteraction = await interaction.awaitModalSubmit({
      filter: (i) => i.customId === `delete-data-confirm-${userId}`,
      time: 60000, // 1 minute timeout
    });

    const confirmation = modalInteraction.fields.getTextInputValue('confirmation');

    if (confirmation.trim().toUpperCase() !== CONFIRMATION_PHRASE) {
      await modalInteraction.reply({
        content: `Deletion cancelled. You typed "${confirmation}" instead of "${CONFIRMATION_PHRASE}".`,
        ephemeral: true,
      });
      return;
    }

    await modalInteraction.deferReply({ ephemeral: true });

    try {
      const result = await deleteUserData(userId);

      if (result.success) {
        logger.info('User data deleted', {
          userId,
          userTag,
          deletedCounts: result.deleted,
        });

        const deletedSummary = result.deleted
          ? Object.entries(result.deleted)
              .filter(([, count]) => (count as number) > 0)
              .map(([type, count]) => `- ${type}: ${count}`)
              .join('\n')
          : 'No data found';

        await modalInteraction.editReply({
          content: 'Your data has been permanently deleted.\n\n' +
            '**Deleted:**\n' +
            (deletedSummary || '- No data found') +
            '\n\nThis action cannot be undone.',
        });
      } else {
        await modalInteraction.editReply({
          content: `Failed to delete data: ${result.error || 'Unknown error'}`,
        });
      }
    } catch (error) {
      logger.error('Delete data command failed', { userId, error });
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      await modalInteraction.editReply({
        content: `An error occurred: ${errorMsg}`,
      });
    }
  } catch {
    // Modal timed out or was dismissed
    logger.debug('Delete data modal timed out or dismissed', { userId });
  }
}
