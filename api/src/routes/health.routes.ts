import { Router } from 'express';
import { prisma } from '../db/client';
import { wahaClient } from '../clients/waha.client';

const router = Router();

router.get('/health', async (req, res) => {
  try {
    // Check database
    let dbStatus = 'up';
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch (error) {
      dbStatus = 'down';
    }

    // Check Waha (optional - don't fail if not configured)
    let wahaStatus = 'not_configured';
    try {
      await wahaClient.initialize();
      const result = await wahaClient.testConnection();
      wahaStatus = result.ok ? 'up' : 'down';
    } catch (error) {
      wahaStatus = 'error';
    }

    const health = {
      ok: dbStatus === 'up',
      db: dbStatus,
      waha: wahaStatus,
      time: new Date().toISOString(),
    };

    res.json(health);
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: 'Health check failed',
      time: new Date().toISOString(),
    });
  }
});

export default router;
