import { prisma } from './client';
import { logger } from '../utils/logger';

async function seed() {
  try {
    logger.info('Starting database seed...');

    // Seed default settings
    await prisma.appSetting.upsert({
      where: { key: 'waha_host' },
      update: {},
      create: {
        key: 'waha_host',
        value: process.env.WAHA_HOST || '',
      },
    });

    await prisma.appSetting.upsert({
      where: { key: 'waha_api_key' },
      update: {},
      create: {
        key: 'waha_api_key',
        value: process.env.WAHA_API_KEY || '',
      },
    });

    await prisma.appSetting.upsert({
      where: { key: 'typebot_host' },
      update: {},
      create: {
        key: 'typebot_host',
        value: process.env.TYPEBOT_HOST || '',
      },
    });

    logger.info('Database seeded successfully');
  } catch (error) {
    logger.error({ error }, 'Seed failed');
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

seed();
