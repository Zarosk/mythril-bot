/**
 * File Delivery Service
 * Zips project output and delivers it via Discord
 */

import {
  TextChannel,
  ThreadChannel,
  AttachmentBuilder,
  EmbedBuilder,
} from 'discord.js';
import logger from '../../utils/logger';
import { createZip, deleteZip, cleanupOldZips, formatBytes } from '../utils/zip';

// Discord file size limit (8 MB for free servers)
const DISCORD_FILE_LIMIT = 8 * 1024 * 1024;

// Cleanup interval (24 hours in ms)
const CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000;

export interface DeliveryResult {
  success: boolean;
  message: string;
  sizeBytes?: number;
  zipPath?: string;
}

type DeliveryChannel = TextChannel | ThreadChannel;

let cleanupIntervalId: ReturnType<typeof setInterval> | null = null;

/**
 * Start periodic cleanup of old zip files
 */
export function startCleanupScheduler(): void {
  if (cleanupIntervalId) {
    return; // Already running
  }

  // Run cleanup immediately on start
  cleanupOldZips(24);

  // Schedule periodic cleanup
  cleanupIntervalId = setInterval(() => {
    cleanupOldZips(24);
  }, CLEANUP_INTERVAL_MS);

  logger.info('Zip cleanup scheduler started', { intervalHours: 24 });
}

/**
 * Stop the cleanup scheduler
 */
export function stopCleanupScheduler(): void {
  if (cleanupIntervalId) {
    clearInterval(cleanupIntervalId);
    cleanupIntervalId = null;
    logger.info('Zip cleanup scheduler stopped');
  }
}

/**
 * Deliver project files as a zip attachment to Discord
 * @param channel Discord channel to send the file to
 * @param projectPath Path to the project directory
 * @param projectName Name of the project (for the zip filename)
 */
export async function deliverProjectFiles(
  channel: DeliveryChannel,
  projectPath: string,
  projectName: string
): Promise<DeliveryResult> {
  logger.info('Starting file delivery', { projectPath, projectName });

  // Create the zip
  const zipResult = await createZip(projectPath, projectName);

  if (!zipResult.success || !zipResult.zipPath) {
    logger.error('Failed to create zip for delivery', {
      projectPath,
      error: zipResult.error,
    });
    return {
      success: false,
      message: `Failed to create zip: ${zipResult.error}`,
    };
  }

  const sizeBytes = zipResult.sizeBytes || 0;
  const formattedSize = formatBytes(sizeBytes);

  // Check file size against Discord limit
  if (sizeBytes > DISCORD_FILE_LIMIT) {
    logger.warn('Zip file exceeds Discord limit', {
      sizeBytes,
      limit: DISCORD_FILE_LIMIT,
      projectName,
    });

    // Send embed about file size
    const embed = createFileTooLargeEmbed(projectName, sizeBytes);
    await channel.send({ embeds: [embed] });

    // Clean up the zip since we can't send it
    deleteZip(zipResult.zipPath);

    return {
      success: false,
      message: `File too large for Discord (${formattedSize}). Discord limit is 8 MB for free servers.`,
      sizeBytes,
    };
  }

  // Send the file
  try {
    const filename = `${projectName.replace(/[^a-zA-Z0-9-_]/g, '_')}.zip`;
    const attachment = new AttachmentBuilder(zipResult.zipPath, {
      name: filename,
      description: `Project files for ${projectName}`,
    });

    const embed = createDeliveryEmbed(projectName, sizeBytes);

    await channel.send({
      embeds: [embed],
      files: [attachment],
    });

    logger.info('File delivered successfully', {
      projectName,
      sizeBytes,
      channel: channel.id,
    });

    // Clean up after successful delivery
    deleteZip(zipResult.zipPath);

    return {
      success: true,
      message: `Delivered ${filename} (${formattedSize})`,
      sizeBytes,
      zipPath: zipResult.zipPath,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Failed to send file to Discord', {
      projectName,
      error: errorMessage,
    });

    // Clean up on error
    deleteZip(zipResult.zipPath);

    return {
      success: false,
      message: `Failed to send file: ${errorMessage}`,
      sizeBytes,
    };
  }
}

/**
 * Create an embed for successful file delivery
 */
function createDeliveryEmbed(projectName: string, sizeBytes: number): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(0x00ff00) // Green
    .setTitle('Project Files Ready')
    .setDescription(`Download the project files for **${projectName}**`)
    .addFields(
      { name: 'Size', value: formatBytes(sizeBytes), inline: true },
      { name: 'Format', value: 'ZIP Archive', inline: true }
    )
    .setTimestamp();
}

/**
 * Create an embed when file is too large
 */
function createFileTooLargeEmbed(projectName: string, sizeBytes: number): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(0xff9900) // Orange
    .setTitle('File Too Large')
    .setDescription(
      `The project files for **${projectName}** exceed Discord's file size limit.`
    )
    .addFields(
      { name: 'File Size', value: formatBytes(sizeBytes), inline: true },
      { name: 'Discord Limit', value: '8 MB', inline: true },
      {
        name: 'Alternatives',
        value:
          'Consider:\n' +
          '- Excluding large files (node_modules, build artifacts)\n' +
          '- Using a cloud storage service\n' +
          '- Splitting the project into smaller parts',
        inline: false,
      }
    )
    .setTimestamp();
}
