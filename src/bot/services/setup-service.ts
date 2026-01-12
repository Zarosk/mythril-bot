import {
  Guild,
  TextChannel,
  ChannelType,
  PermissionFlagsBits,
  EmbedBuilder,
} from 'discord.js';
import logger from '../../utils/logger';

export interface GuildConfig {
  guildId: string;
  categoryId: string;
  channels: {
    commands: string;
    status: string;
    alerts: string;
    decisions: string;
    chat: string;
  };
  createdAt: Date;
}

// In-memory store for guild configurations
const guildConfigs = new Map<string, GuildConfig>();

const CATEGORY_NAME = 'Mythril';
const CHANNELS = [
  { name: 'commands', topic: 'Send Mythril commands here (/mythril help)' },
  { name: 'status', topic: 'Task status updates and execution logs' },
  { name: 'alerts', topic: 'Important alerts and notifications' },
  { name: 'decisions', topic: 'Decisions requiring human approval' },
  { name: 'chat', topic: 'Chat with Mythril AI assistant' },
] as const;

/**
 * Check if the bot has required permissions to create channels
 */
export function hasRequiredPermissions(guild: Guild): boolean {
  const me = guild.members.me;
  if (!me) return false;

  return me.permissions.has([
    PermissionFlagsBits.ManageChannels,
    PermissionFlagsBits.SendMessages,
    PermissionFlagsBits.ViewChannel,
  ]);
}

/**
 * Create the Mythril category and channels for a guild
 */
export async function setupGuildChannels(guild: Guild): Promise<GuildConfig | null> {
  logger.info('Setting up Mythril channels', { guildId: guild.id, guildName: guild.name });

  try {
    // Create the category
    const category = await guild.channels.create({
      name: CATEGORY_NAME,
      type: ChannelType.GuildCategory,
      reason: 'Mythril Bot auto-setup',
    });

    logger.info('Created Mythril category', { categoryId: category.id });

    // Create channels under the category
    const channelIds: Record<string, string> = {};

    for (const channelDef of CHANNELS) {
      const channel = await guild.channels.create({
        name: channelDef.name,
        type: ChannelType.GuildText,
        parent: category.id,
        topic: channelDef.topic,
        reason: 'Mythril Bot auto-setup',
      });

      channelIds[channelDef.name] = channel.id;
      logger.info('Created channel', { name: channelDef.name, channelId: channel.id });
    }

    // Build the config
    const config: GuildConfig = {
      guildId: guild.id,
      categoryId: category.id,
      channels: {
        commands: channelIds['commands'],
        status: channelIds['status'],
        alerts: channelIds['alerts'],
        decisions: channelIds['decisions'],
        chat: channelIds['chat'],
      },
      createdAt: new Date(),
    };

    // Store in memory
    guildConfigs.set(guild.id, config);

    // Send welcome message to commands channel
    const commandsChannel = guild.channels.cache.get(config.channels.commands) as TextChannel;
    if (commandsChannel) {
      await sendWelcomeMessage(commandsChannel);
    }

    logger.info('Guild setup complete', { guildId: guild.id });
    return config;
  } catch (error) {
    logger.error('Failed to setup guild channels', {
      guildId: guild.id,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * Send a welcome message with setup instructions
 */
async function sendWelcomeMessage(channel: TextChannel): Promise<void> {
  const embed = new EmbedBuilder()
    .setTitle('Mythril Bot Setup Complete')
    .setColor(0x00ff00)
    .setDescription(
      'The Mythril AI development orchestration bot has been set up in this server.'
    )
    .addFields(
      {
        name: 'Channels Created',
        value: [
          '**#commands** - Send bot commands here',
          '**#status** - Task status updates',
          '**#alerts** - Important notifications',
          '**#decisions** - Approval requests',
          '**#chat** - AI chat assistant',
        ].join('\n'),
      },
      {
        name: 'Getting Started',
        value: [
          'Use `/mythril help` to see available commands',
          'Use `/mythril status` to check the current task',
          'Use `/mythril queue` to see queued tasks',
        ].join('\n'),
      },
      {
        name: 'Configuration',
        value:
          'To connect this bot to your Obsidian vault and code projects, update the `.env` file with the appropriate paths.',
      }
    )
    .setFooter({ text: 'Mythril Bot' })
    .setTimestamp();

  await channel.send({ embeds: [embed] });
}

/**
 * Send a DM to the guild owner about missing permissions
 */
export async function notifyOwnerMissingPermissions(guild: Guild): Promise<void> {
  try {
    const owner = await guild.fetchOwner();

    const embed = new EmbedBuilder()
      .setTitle('Mythril Bot - Missing Permissions')
      .setColor(0xff0000)
      .setDescription(
        `The Mythril bot was added to **${guild.name}** but doesn't have the required permissions to set up channels.`
      )
      .addFields({
        name: 'Required Permissions',
        value: ['- Manage Channels', '- Send Messages', '- View Channels'].join('\n'),
      })
      .addFields({
        name: 'What to do',
        value:
          'Please update the bot\'s role permissions and use `/mythril setup` in the server to retry channel creation.',
      })
      .setTimestamp();

    await owner.send({ embeds: [embed] });
    logger.info('Sent missing permissions DM to owner', {
      guildId: guild.id,
      ownerId: owner.id,
    });
  } catch (error) {
    logger.warn('Could not DM guild owner', {
      guildId: guild.id,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Get the stored config for a guild
 */
export function getGuildConfig(guildId: string): GuildConfig | undefined {
  return guildConfigs.get(guildId);
}

/**
 * Check if a guild has been set up
 */
export function isGuildSetUp(guildId: string): boolean {
  return guildConfigs.has(guildId);
}
