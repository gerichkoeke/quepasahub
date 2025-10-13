import { Router } from 'express';
import { z } from 'zod';
import { wahaClient } from '../clients/waha.client';
import { authMiddleware } from '../middlewares/auth.middleware';
import { logger } from '../utils/logger';
import { prisma } from '../db/client';

const router = Router();

const testMessageSchema = z.object({
  sessionId: z.string(),
  to: z.string(),
  message: z.string(),
});

// Test Waha connection
router.get('/waha/test', authMiddleware, async (req, res, next) => {
  try {
    await wahaClient.initialize();
    const result = await wahaClient.testConnection();

    res.json(result);
  } catch (error: any) {
    logger.warn({ error: error.message }, 'Waha connection test failed');
    next(error);
  }
});

// List Waha sessions
router.get('/waha/sessions', authMiddleware, async (req, res, next) => {
  try {
    await wahaClient.initialize();
    const sessions = await wahaClient.listSessions();

    // Transform sessions to include relevant info
    const transformed = sessions.map((session) => ({
      sessionId: session.name,
      name: session.name,
      status: session.status,
      phone: session.me?.id || null,
      pushName: session.me?.pushName || null,
    }));

    res.json(transformed);
  } catch (error: any) {
    // Return friendly response for unconfigured Waha (don't log error, just warn)
    if (error.message?.includes('Invalid URL') || error.message?.includes('getaddrinfo ENOTFOUND')) {
      logger.warn({ error: error.message }, 'Waha not configured yet');
      return res.status(200).json({
        sessions: [],
        configured: false,
        message: 'Waha not configured. Please configure Waha connection in Settings first.'
      });
    }

    logger.error({ error }, 'Failed to list Waha sessions');
    next(error);
  }
});

// Get specific session
router.get('/waha/sessions/:sessionId', authMiddleware, async (req, res, next) => {
  try {
    const { sessionId } = req.params;

    await wahaClient.initialize();
    const session = await wahaClient.getSession(sessionId);

    res.json({
      sessionId: session.name,
      name: session.name,
      status: session.status,
      phone: session.me?.id || null,
      pushName: session.me?.pushName || null,
    });
  } catch (error) {
    logger.error({ error, sessionId: req.params.sessionId }, 'Failed to get Waha session');
    next(error);
  }
});

// Create session
router.post('/waha/sessions', authMiddleware, async (req, res, next) => {
  try {
    const { name } = z.object({ name: z.string().min(1) }).parse(req.body);

    await wahaClient.initialize();
    const session = await wahaClient.createSession(name);

    res.json({
      sessionId: session.name,
      name: session.name,
      status: session.status,
      phone: session.me?.id || null,
      pushName: session.me?.pushName || null,
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request data', details: error.errors });
    }

    // Return friendly error for unconfigured Waha
    if (error.message?.includes('Invalid URL') || error.message?.includes('getaddrinfo ENOTFOUND')) {
      logger.warn({ error: error.message }, 'Attempted to create session but Waha not configured');
      return res.status(400).json({
        error: 'Waha not configured',
        message: 'Por favor, configure a conexão com o Waha nas Configurações antes de criar uma sessão.'
      });
    }

    logger.error({ error }, 'Failed to create Waha session');
    next(error);
  }
});

// Delete session
router.delete('/waha/sessions/:sessionId', authMiddleware, async (req, res, next) => {
  try {
    const { sessionId } = req.params;

    await wahaClient.initialize();
    await wahaClient.deleteSession(sessionId);

    // Deactivate all mappings for this session so public URLs are no longer accessible
    await prisma.sessionMapping.updateMany({
      where: { sessionId },
      data: { active: false },
    });

    logger.info({ sessionId }, 'Session deleted and mappings deactivated');

    res.json({ success: true, message: 'Session deleted successfully' });
  } catch (error) {
    logger.error({ error, sessionId: req.params.sessionId }, 'Failed to delete Waha session');
    next(error);
  }
});

// Get QR code
router.get('/waha/sessions/:sessionId/qr', authMiddleware, async (req, res, next) => {
  try {
    const { sessionId } = req.params;

    await wahaClient.initialize();
    const qrBuffer = await wahaClient.getQRCode(sessionId);

    res.setHeader('Content-Type', 'image/png');
    res.send(qrBuffer);
  } catch (error) {
    logger.error({ error, sessionId: req.params.sessionId }, 'Failed to get QR code');
    next(error);
  }
});

// Send test message
router.post('/messages/test', authMiddleware, async (req, res, next) => {
  try {
    const { sessionId, to, message } = testMessageSchema.parse(req.body);

    await wahaClient.initialize();
    await wahaClient.sendMessage(sessionId, to, message);

    res.json({ success: true, message: 'Test message sent successfully' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request data', details: error.errors });
    }
    logger.error({ error }, 'Failed to send test message');
    next(error);
  }
});

export default router;
