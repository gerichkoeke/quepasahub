import { Router } from 'express';
import { prisma } from '../db/client';
import { wahaClient } from '../clients/waha.client';
import { logger } from '../utils/logger';
import { generateWebhookToken } from '../utils/token';

const router = Router();

// Get session info by public token (no auth required)
router.get('/public/session/:token', async (req, res, next) => {
  try {
    const { token } = req.params;

    const mapping = await prisma.sessionMapping.findFirst({
      where: {
        publicToken: token,
        active: true,
      },
    });

    if (!mapping) {
      return res.status(404).json({ error: 'Session not found or has been removed by administrator' });
    }

    // Get session status from Waha
    await wahaClient.initialize();

    try {
      const session = await wahaClient.getSession(mapping.sessionId);

      res.json({
        sessionId: mapping.sessionId,
        status: session.status,
        publicUrl: `${process.env.PUBLIC_URL || 'https://astrahub.seudominio.com.br'}/connect/${token}`,
      });
    } catch (wahaError: any) {
      // If session doesn't exist in Waha (404), return STOPPED status
      if (wahaError.message?.includes('404') || wahaError.message?.includes('not found')) {
        logger.info({ sessionId: mapping.sessionId }, 'Session not found in Waha, returning STOPPED status');
        return res.json({
          sessionId: mapping.sessionId,
          status: 'STOPPED',
          publicUrl: `${process.env.PUBLIC_URL || 'https://astrahub.seudominio.com.br'}/connect/${token}`,
        });
      }
      // For other Waha errors, throw to be handled by outer catch
      throw wahaError;
    }
  } catch (error: any) {
    logger.error({ error }, 'Failed to get public session info');
    next(error);
  }
});

// Get QR code by public token (no auth required)
router.get('/public/session/:token/qr', async (req, res, next) => {
  try {
    const { token } = req.params;

    const mapping = await prisma.sessionMapping.findFirst({
      where: {
        publicToken: token,
        active: true,
      },
    });

    if (!mapping) {
      return res.status(404).json({ error: 'Session not found or has been removed by administrator' });
    }

    await wahaClient.initialize();
    const qrBuffer = await wahaClient.getQRCode(mapping.sessionId);

    res.set('Content-Type', 'image/png');
    res.send(qrBuffer);
  } catch (error: any) {
    logger.error({ error }, 'Failed to get public session QR code');
    next(error);
  }
});

// Start session by public token (no auth required)
router.post('/public/session/:token/start', async (req, res, next) => {
  try {
    const { token } = req.params;

    const mapping = await prisma.sessionMapping.findFirst({
      where: {
        publicToken: token,
        active: true,
      },
    });

    if (!mapping) {
      return res.status(404).json({ error: 'Session not found or has been removed by administrator' });
    }

    await wahaClient.initialize();

    // Check if session already exists
    try {
      const existingSession = await wahaClient.getSession(mapping.sessionId);

      if (existingSession.status === 'WORKING') {
        return res.json({
          success: true,
          message: 'Session already connected',
          status: 'WORKING'
        });
      }
    } catch (error) {
      // Session doesn't exist, create it
    }

    const session = await wahaClient.createSession(mapping.sessionId);

    logger.info({ sessionId: mapping.sessionId }, 'Session started via public token');

    res.json({
      success: true,
      status: session.status,
      message: 'Session started successfully'
    });
  } catch (error: any) {
    logger.error({ error }, 'Failed to start public session');
    next(error);
  }
});

// Stop session by public token (no auth required)
router.post('/public/session/:token/stop', async (req, res, next) => {
  try {
    const { token } = req.params;

    const mapping = await prisma.sessionMapping.findFirst({
      where: {
        publicToken: token,
        active: true,
      },
    });

    if (!mapping) {
      return res.status(404).json({ error: 'Session not found or has been removed by administrator' });
    }

    await wahaClient.initialize();
    await wahaClient.logout(mapping.sessionId);

    logger.info({ sessionId: mapping.sessionId }, 'Session logged out via public token');

    res.json({
      success: true,
      message: 'Session disconnected successfully'
    });
  } catch (error: any) {
    logger.error({ error }, 'Failed to logout public session');
    next(error);
  }
});

// Restart session by public token (no auth required)
router.post('/public/session/:token/restart', async (req, res, next) => {
  try {
    const { token } = req.params;

    const mapping = await prisma.sessionMapping.findFirst({
      where: {
        publicToken: token,
        active: true,
      },
    });

    if (!mapping) {
      return res.status(404).json({ error: 'Session not found or has been removed by administrator' });
    }

    await wahaClient.initialize();
    const session = await wahaClient.restart(mapping.sessionId);

    logger.info({ sessionId: mapping.sessionId }, 'Session restarted via public token');

    res.json({
      success: true,
      status: session.status,
      message: 'Session restarted successfully'
    });
  } catch (error: any) {
    logger.error({ error }, 'Failed to restart public session');
    next(error);
  }
});

// Generate/regenerate public token for a session (requires auth)
router.post('/sessions/:sessionId/public-token', async (req, res, next) => {
  try {
    const { sessionId } = req.params;

    // Find active mapping for this session
    const mapping = await prisma.sessionMapping.findFirst({
      where: {
        sessionId,
        active: true,
      },
    });

    if (!mapping) {
      return res.status(404).json({ error: 'Session mapping not found' });
    }

    // Generate new public token
    const publicToken = generateWebhookToken();

    // Update mapping with new public token
    await prisma.sessionMapping.update({
      where: { id: mapping.id },
      data: { publicToken },
    });

    const publicUrl = `${process.env.PUBLIC_URL || 'https://astrahub.seudominio.com.br'}/connect/${publicToken}`;

    logger.info({ sessionId, publicToken }, 'Generated public token for session');

    res.json({
      success: true,
      publicToken,
      publicUrl,
    });
  } catch (error: any) {
    logger.error({ error }, 'Failed to generate public token');
    next(error);
  }
});

export default router;
