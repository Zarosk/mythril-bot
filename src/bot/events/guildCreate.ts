import { Guild } from 'discord.js';
import {
  hasRequiredPermissions,
  setupGuildChannels,
  notifyOwnerMissingPermissions,
} from '../services/setup-service';
import logger from '../../utils/logger';

/**
 * Handle the guildCreate event when the bot joins a new server
 */
export async function handleGuildCreate(guild: Guild): Promise<void> {
  logger.info('Bot joined new guild', {
    guildId: guild.id,
    guildName: guild.name,
    memberCount: guild.memberCount,
  });

  // Check if we have the required permissions
  if (!hasRequiredPermissions(guild)) {
    logger.warn('Missing required permissions in guild', { guildId: guild.id });
    await notifyOwnerMissingPermissions(guild);
    return;
  }

  // Set up the channels
  const config = await setupGuildChannels(guild);

  if (config) {
    logger.info('Successfully set up guild', {
      guildId: guild.id,
      categoryId: config.categoryId,
      channels: config.channels,
    });
  } else {
    logger.error('Failed to set up guild', { guildId: guild.id });
    await notifyOwnerMissingPermissions(guild);
  }
}
