import { config } from './config';
import { OadsBot } from './bot/client';

async function main(): Promise<void> {
  console.log('=================================');
  console.log('  OADS Discord Orchestration Bot');
  console.log('=================================');
  console.log();

  const bot = new OadsBot(config);

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\nReceived SIGINT, shutting down...');
    await bot.stop();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('\nReceived SIGTERM, shutting down...');
    await bot.stop();
    process.exit(0);
  });

  try {
    await bot.start();
  } catch (error) {
    console.error('Failed to start bot:', error);
    process.exit(1);
  }
}

main();
