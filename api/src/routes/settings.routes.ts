import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/client';
import { authMiddleware } from '../middlewares/auth.middleware';
import { logger } from '../utils/logger';
import { wahaClient } from '../clients/waha.client';
import { quepasaClient } from '../clients/quepasa.client';

const router = Router();

const settingsSchema = z.object({
  waha_host: z.string().url().optional(),
  waha_api_key: z.string().optional(),
  waha_api_base_path: z.string().optional(),
  quepasa_url: z.string().url().optional(),
  quepasa_user: z.string().email().optional(),
  quepasa_password: z.string().optional(),
});

// Get all settings
router.get('/settings', authMiddleware, async (req, res, next) => {
  try {
    const settings = await prisma.appSetting.findMany();

    const settingsMap = settings.reduce((acc, setting) => {
      // Don't expose sensitive keys - return empty string if exists
      if (setting.key.includes('api_key') || setting.key.includes('token') || setting.key.includes('password')) {
        acc[setting.key] = '';
      } else {
        acc[setting.key] = setting.value;
      }
      return acc;
    }, {} as Record<string, string>);

    res.json(settingsMap);
  } catch (error) {
    next(error);
  }
});

// Update settings
router.post('/settings', authMiddleware, async (req, res, next) => {
  try {
    const validated = settingsSchema.parse(req.body);

    // Filter out undefined and empty strings (to keep existing values for sensitive fields)
    const updates = Object.entries(validated).filter(
      ([_, value]) => value !== undefined && value !== ''
    );

    await Promise.all(
      updates.map(([key, value]) =>
        prisma.appSetting.upsert({
          where: { key },
          update: { value: value as string },
          create: { key, value: value as string },
        })
      )
    );

    logger.info({ keys: updates.map(([k]) => k) }, 'Settings updated');

    res.json({ success: true, message: 'Settings updated successfully' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid settings data', details: error.errors });
    }
    next(error);
  }
});

// Test Waha connection (must come before /settings/:key to avoid route conflict)
router.get('/settings/test-waha', authMiddleware, async (req, res, next) => {
  try {
    await wahaClient.initialize();
    const result = await wahaClient.testConnection();
    res.json(result);
  } catch (error: any) {
    logger.warn({ error: error.message }, 'Waha connection test failed');
    res.status(500).json({ success: false, message: 'Failed to connect to Waha' });
  }
});

// Test Quepasa connection
router.get('/settings/test-quepasa', authMiddleware, async (req, res, next) => {
  try {
    const result = await quepasaClient.testConnection();
    res.json(result);
  } catch (error: any) {
    logger.warn({ error: error.message }, 'Quepasa connection test failed');
    res.status(500).json({ success: false, message: 'Failed to connect to Quepasa' });
  }
});

// Get specific setting (must come after specific routes to avoid catching them)
router.get('/settings/:key', authMiddleware, async (req, res, next) => {
  try {
    const { key } = req.params;

    const setting = await prisma.appSetting.findUnique({
      where: { key },
    });

    if (!setting) {
      return res.status(404).json({ error: 'Setting not found' });
    }

    // Don't expose sensitive keys
    const value =
      key.includes('api_key') || key.includes('token') || key.includes('password') ? (setting.value ? '***' : '') : setting.value;

    res.json({ key: setting.key, value });
  } catch (error) {
    next(error);
  }
});

export default router;
