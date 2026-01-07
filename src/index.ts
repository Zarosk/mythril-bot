import { config } from './config';
import { OadsBot } from './bot/client';
import logger from './utils/logger';

async function main(): Promise<void> {
  logger.info('================================');
  logger.info('  Mythril Orchestration Bot');
  logger.info('================================');

  const bot = new OadsBot(config);

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    logger.info('Received SIGINT, shutting down...');
    await bot.stop();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    logger.info('Received SIGTERM, shutting down...');
    await bot.stop();
    process.exit(0);
  });

  try {
    await bot.start();
  } catch (error) {
    logger.error('Failed to start bot', { error });
    process.exit(1);
  }
}

main();
