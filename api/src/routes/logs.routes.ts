import { Router } from 'express';
import { prisma } from '../db/client';
import { authMiddleware } from '../middlewares/auth.middleware';

const router = Router();

// Get event logs
router.get('/logs', authMiddleware, async (req, res, next) => {
  try {
    const { limit = '100', offset = '0', sessionId, direction, provider } = req.query;

    const where: any = {};

    if (sessionId) {
      where.sessionId = sessionId as string;
    }

    if (direction && (direction === 'in' || direction === 'out')) {
      where.direction = direction;
    }

    if (provider && (provider === 'waha' || provider === 'typebot')) {
      where.provider = provider;
    }

    const logs = await prisma.eventLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit as string, 10),
      skip: parseInt(offset as string, 10),
    });

    const total = await prisma.eventLog.count({ where });

    res.json({
      logs,
      total,
      limit: parseInt(limit as string, 10),
      offset: parseInt(offset as string, 10),
    });
  } catch (error) {
    next(error);
  }
});

// Get specific log
router.get('/logs/:id', authMiddleware, async (req, res, next) => {
  try {
    const { id } = req.params;

    const log = await prisma.eventLog.findUnique({
      where: { id },
    });

    if (!log) {
      return res.status(404).json({ error: 'Log not found' });
    }

    res.json(log);
  } catch (error) {
    next(error);
  }
});

export default router;
