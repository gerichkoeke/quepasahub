import { Router } from 'express';
import { z } from 'zod';
import { quepasaClient } from '../clients/quepasa.client';
import { authMiddleware } from '../middlewares/auth.middleware';
import { logger } from '../utils/logger';
import { prisma } from '../db/client';

const router = Router();

// Test Quepasa connection
router.get('/quepasa/test', authMiddleware, async (req, res, next) => {
  try {
    const result = await quepasaClient.testConnection();
    res.json(result);
  } catch (error: any) {
    logger.warn({ error: error.message }, 'Quepasa connection test failed');
    next(error);
  }
});

// Get QR code for scanning (requires mappingId to get unique token)
router.post('/quepasa/qr', authMiddleware, async (req, res, next) => {
  try {
    const { mappingId } = z.object({ mappingId: z.string().min(1) }).parse(req.body);

    // Get mapping to retrieve quepasaToken
    const mapping = await prisma.quepasaMapping.findUnique({
      where: { id: mappingId },
      select: { id: true, quepasaToken: true, phoneNumber: true, active: true },
    });

    if (!mapping) {
      return res.status(404).json({ error: 'Mapping not found' });
    }

    await quepasaClient.initialize();
    const qrBuffer = await quepasaClient.getQRCode(mapping.quepasaToken);

    res.setHeader('Content-Type', 'image/png');
    res.send(qrBuffer);
  } catch (error: any) {
    logger.error({ error: error.message }, 'Failed to get Quepasa QR code');

    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Mapping ID is required', details: error.errors });
    }

    // Return friendly error if not configured
    if (error.message?.includes('not configured')) {
      return res.status(400).json({
        error: 'Quepasa not configured',
        message: 'Por favor, configure o Quepasa nas Configurações primeiro.',
      });
    }

    next(error);
  }
});

// Get connection status (for a specific mapping)
router.get('/quepasa/status/:mappingId', authMiddleware, async (req, res, next) => {
  try {
    const { mappingId } = req.params;

    // Get mapping to retrieve quepasaToken
    const mapping = await prisma.quepasaMapping.findUnique({
      where: { id: mappingId },
      select: { id: true, quepasaToken: true, phoneNumber: true, active: true },
    });

    if (!mapping) {
      return res.status(404).json({ error: 'Mapping not found' });
    }

    // Check status using the unique token
    await quepasaClient.initialize();
    const status = await quepasaClient.getStatus(mapping.quepasaToken);

    // Update phone number, configure webhook, and mark as active if status is ready
    if (status.success && status.status?.toLowerCase() === 'ready') {
      try {
        const info = await quepasaClient.getConnectionInfo(mapping.quepasaToken);
        const updateData: any = {};

        // Update phone number if changed
        // Response format: { success: true, server: { wid: "..." } }
        const phoneNumber = info.server?.wid || info.wid;
        if (phoneNumber && phoneNumber !== mapping.phoneNumber) {
          updateData.phoneNumber = phoneNumber;
        }

        // Configure webhook and mark as active if not already active
        if (!mapping.active) {
          try {
            const fullMapping = await prisma.quepasaMapping.findUnique({
              where: { id: mappingId },
              select: { name: true },
            });

            const systemBaseUrl = process.env.SYSTEM_BASE_URL || 'https://astrahub.seudominio.com.br';
            const webhookUrl = `${systemBaseUrl}/api/webhooks/quepasa/${mapping.quepasaToken}`;

            const webhookConfig = {
              url: webhookUrl,
              forwardinternal: true,
              trackid: fullMapping?.name || mapping.quepasaToken,
              extra: {
                mappingId: mapping.id,
                name: fullMapping?.name,
              },
            };

            await quepasaClient.configureWebhook(mapping.quepasaToken, webhookConfig);
            updateData.active = true;
            logger.info({ mappingId, webhookUrl }, 'Configured webhook and activated connection during status check');
          } catch (webhookError: any) {
            logger.warn({ error: webhookError.message, mappingId }, 'Failed to configure webhook during status check');
            // Still mark as active even if webhook fails - user can reconfigure later
            updateData.active = true;
          }
        }

        // Apply updates if any
        if (Object.keys(updateData).length > 0) {
          await prisma.quepasaMapping.update({
            where: { id: mappingId },
            data: updateData,
          });
          logger.info({ mappingId, updates: updateData }, 'Updated mapping from status check');
        }
      } catch (infoError: any) {
        logger.warn({ error: infoError.message, mappingId }, 'Failed to get connection info during status check');
      }
    }

    // Log the status for debugging
    logger.info({ mappingId, status, phoneNumber: mapping.phoneNumber }, 'Quepasa status checked');

    res.json(status);
  } catch (error: any) {
    logger.warn({ error: error.message, mappingId: req.params.mappingId }, 'Failed to get Quepasa status');

    // Handle common error cases
    if (error.message?.includes('not configured') || error.message?.includes('not found')) {
      return res.status(200).json({
        success: false,
        status: 'not_configured',
      });
    }

    // Handle 400 error - connection not initialized yet (QR code not scanned)
    if (error.message?.includes('status code 400')) {
      logger.info({ mappingId: req.params.mappingId }, 'Quepasa connection not initialized yet (waiting for QR scan)');
      return res.status(200).json({
        success: false,
        status: 'waiting_scan',
      });
    }

    // Handle other errors gracefully
    return res.status(200).json({
      success: false,
      status: 'error',
      message: error.message,
    });
  }
});

// Sync/import existing connections from Quepasa server
router.post('/quepasa/sync', authMiddleware, async (req, res, next) => {
  try {
    // Try to initialize Quepasa client - if not configured, return success without syncing
    try {
      await quepasaClient.initialize();
    } catch (initError: any) {
      if (initError.message?.includes('not configured')) {
        logger.debug('Quepasa not configured, skipping sync');
        return res.json({
          total: 0,
          imported: 0,
          updated: 0,
          skipped: 0,
          deleted: 0,
          errors: [],
          message: 'Quepasa not configured',
        });
      }
      throw initError;
    }

    const bots = await quepasaClient.listAllBots();

    const results = {
      total: bots.length,
      imported: 0,
      updated: 0,
      skipped: 0,
      deleted: 0,
      errors: [] as string[],
    };

    // Get all existing mappings from database
    const allMappings = await prisma.quepasaMapping.findMany({
      select: { id: true, quepasaToken: true, name: true, active: true, phoneNumber: true },
    });

    // Create a Set of tokens that exist in Quepasa
    const quepasaTokens = new Set<string>();

    for (const bot of bots) {
      try {
        // Each bot should have: id (token), wid (phone number), status, etc.
        const botToken = bot.id || bot.token;
        const botPhone = bot.wid;

        if (!botToken) {
          results.errors.push(`Bot without token: ${JSON.stringify(bot)}`);
          results.skipped++;
          continue;
        }

        // Track this token as existing in Quepasa
        quepasaTokens.add(botToken);

        // Check if mapping already exists by token
        const existing = await prisma.quepasaMapping.findFirst({
          where: { quepasaToken: botToken },
        });

        if (existing) {
          // Update existing mapping with latest info
          const updateData: any = {};

          if (botPhone && botPhone !== existing.phoneNumber) {
            updateData.phoneNumber = botPhone;
          }

          // Mark as active if connected AND configure webhook
          if (bot.status?.toLowerCase() === 'ready' && !existing.active) {
            // Configure webhook before marking as active
            try {
              const systemBaseUrl = process.env.SYSTEM_BASE_URL || 'https://astrahub.seudominio.com.br';
              const webhookUrl = `${systemBaseUrl}/api/webhooks/quepasa/${botToken}`;

              const webhookConfig = {
                url: webhookUrl,
                forwardinternal: true,
                trackid: existing.name,
                extra: {
                  mappingId: existing.id,
                  name: existing.name,
                },
              };

              await quepasaClient.configureWebhook(botToken, webhookConfig);
              updateData.active = true;
              logger.info({ mappingId: existing.id, botToken, webhookUrl }, 'Configured webhook and activated connection during sync');
            } catch (webhookError: any) {
              logger.warn({ error: webhookError.message, mappingId: existing.id }, 'Failed to configure webhook during sync, keeping inactive');
              // Don't mark as active if webhook fails
            }
          }

          if (Object.keys(updateData).length > 0) {
            await prisma.quepasaMapping.update({
              where: { id: existing.id },
              data: updateData,
            });
            results.updated++;
            logger.info({ mappingId: existing.id, botToken }, 'Updated existing Quepasa mapping from sync');
          } else {
            results.skipped++;
          }
        } else {
          // Skip bots that don't have a corresponding mapping in database
          // This prevents auto-import from overwriting user-created connections with custom names
          results.skipped++;
          logger.debug({ botToken, botPhone }, 'Skipped bot without corresponding database mapping (auto-import disabled)');
        }
      } catch (error: any) {
        results.errors.push(`Error processing bot: ${error.message}`);
        logger.error({ error: error.message, bot }, 'Error processing bot during sync');
      }
    }

    // Delete mappings that no longer exist in Quepasa
    // BUT: Don't delete inactive connections (they may be waiting for QR scan)
    for (const mapping of allMappings) {
      if (!quepasaTokens.has(mapping.quepasaToken)) {
        // Skip inactive connections - they're waiting for QR scan and don't exist in Quepasa yet
        if (!mapping.active && !mapping.phoneNumber) {
          logger.debug({ mappingId: mapping.id, name: mapping.name }, 'Skipping inactive mapping (waiting for QR scan)');
          continue;
        }

        // Only delete mappings that were previously active but no longer exist in Quepasa
        try {
          await prisma.quepasaMapping.delete({
            where: { id: mapping.id },
          });
          results.deleted++;
          logger.info({ mappingId: mapping.id, name: mapping.name, token: mapping.quepasaToken }, 'Deleted Quepasa mapping (no longer exists in Quepasa)');
        } catch (error: any) {
          results.errors.push(`Error deleting mapping ${mapping.id}: ${error.message}`);
          logger.error({ error: error.message, mappingId: mapping.id }, 'Error deleting orphaned mapping');
        }
      }
    }

    logger.info(results, 'Quepasa sync completed');
    res.json(results);
  } catch (error: any) {
    logger.error({ error: error.message }, 'Failed to sync Quepasa connections');
    next(error);
  }
});

// Get connection info (for a specific mapping)
router.get('/quepasa/info/:mappingId', authMiddleware, async (req, res, next) => {
  try {
    const { mappingId } = req.params;

    // Get mapping to retrieve quepasaToken
    const mapping = await prisma.quepasaMapping.findUnique({
      where: { id: mappingId },
      select: { id: true, quepasaToken: true, phoneNumber: true, active: true },
    });

    if (!mapping) {
      return res.status(404).json({ error: 'Mapping not found' });
    }

    await quepasaClient.initialize();
    const info = await quepasaClient.getConnectionInfo(mapping.quepasaToken);

    // If info contains phone number, update it in database and mark as active
    // Response format: { success: true, server: { wid: "..." } }
    const phoneNumber = info.server?.wid || info.wid;
    if (phoneNumber && phoneNumber !== mapping.phoneNumber) {
      await prisma.quepasaMapping.update({
        where: { id: mappingId },
        data: {
          phoneNumber,
          active: true,  // Mark as active when phone number is detected
        },
      });
      logger.info({ mappingId, phoneNumber }, 'Updated phone number and activated connection');
    }

    res.json(info);
  } catch (error: any) {
    logger.error({ error: error.message, mappingId: req.params.mappingId }, 'Failed to get Quepasa connection info');
    next(error);
  }
});

// Disconnect Quepasa connection (logout from WhatsApp)
router.post('/quepasa/disconnect/:mappingId', authMiddleware, async (req, res, next) => {
  try {
    const { mappingId } = req.params;

    // Get mapping to retrieve quepasaToken
    const mapping = await prisma.quepasaMapping.findUnique({
      where: { id: mappingId },
      select: {
        id: true,
        quepasaToken: true,
        phoneNumber: true,
        active: true,
        name: true,
        chatwootInboxId: true,
        chatwootBaseUrl: true,
        chatwootApiToken: true,
        chatwootAccountId: true,
      },
    });

    if (!mapping) {
      return res.status(404).json({ error: 'Mapping not found' });
    }

    // Delete session from Quepasa (logout from WhatsApp)
    await quepasaClient.initialize();
    await quepasaClient.deleteSession(mapping.quepasaToken);

    // Update mapping: mark as inactive and clear phone number
    await prisma.quepasaMapping.update({
      where: { id: mappingId },
      data: {
        active: false,
        phoneNumber: null,
        successNotificationSent: false, // Reset notification flag for next connection
      },
    });

    logger.info({ mappingId, name: mapping.name, phoneNumber: mapping.phoneNumber }, 'Disconnected Quepasa session');

    // Send disconnect notification to Chatwoot (non-blocking, don't fail if it errors)
    (async () => {
      try {
        // Check if Chatwoot is configured (not 'pending')
        if (mapping.chatwootInboxId && mapping.chatwootInboxId !== 'pending') {
          const { chatwootClient } = await import('../clients/chatwoot.client');

          const chatwootConfig = {
            baseUrl: mapping.chatwootBaseUrl,
            apiAccessToken: mapping.chatwootApiToken,
            accountId: mapping.chatwootAccountId,
            inboxId: mapping.chatwootInboxId,
          };

          // Find conversation with "Gerador de QR" contact (+55654321)
          const { conversation } = await chatwootClient.findOrCreateConversation(
            chatwootConfig,
            '+55654321',
            'Gerador de QR'
          );

          // Clean phone number
          const cleanPhoneNumber = mapping.phoneNumber?.split(':')[0] || mapping.phoneNumber;

          // Send disconnect message
          const disconnectMessage = `⚠️ *Conexão desconectada*\n\n` +
            `📱 Número: ${cleanPhoneNumber}\n` +
            `📝 Nome: ${mapping.name}\n\n` +
            `A instância do WhatsApp foi desconectada. Para reconectar, será necessário escanear o QR code novamente.`;

          await chatwootClient.sendMessage(
            chatwootConfig,
            conversation.id,
            disconnectMessage,
            'incoming'
          );

          logger.info({ mappingId, conversationId: conversation.id }, '📨 Sent disconnect notification to Chatwoot');
        }
      } catch (notificationError: any) {
        logger.warn({ error: notificationError.message, mappingId }, '⚠️  Failed to send disconnect notification to Chatwoot (non-critical)');
      }
    })();

    res.json({
      success: true,
      message: 'Conexão desconectada com sucesso',
    });
  } catch (error: any) {
    logger.error({ error: error.message, mappingId: req.params.mappingId }, 'Failed to disconnect Quepasa session');

    // Handle common error cases gracefully
    if (error.message?.includes('status code 400') || error.message?.includes('not found')) {
      // Session already disconnected or doesn't exist
      await prisma.quepasaMapping.update({
        where: { id: req.params.mappingId },
        data: {
          active: false,
          phoneNumber: null,
          successNotificationSent: false,
        },
      });

      return res.json({
        success: true,
        message: 'Conexão já estava desconectada',
      });
    }

    next(error);
  }
});

export default router;
