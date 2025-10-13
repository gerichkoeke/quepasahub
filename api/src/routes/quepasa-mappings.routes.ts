import { Router } from 'express';
import { z } from 'zod';
import { randomBytes } from 'crypto';
import { prisma } from '../db/client';
import { authMiddleware } from '../middlewares/auth.middleware';
import { logger } from '../utils/logger';
import { quepasaClient } from '../clients/quepasa.client';
import { chatwootClient } from '../clients/chatwoot.client';

const router = Router();

/**
 * Generate a unique token for Quepasa connection (X-QUEPASA-TOKEN)
 */
function generateQuepasaToken(): string {
  const randomPart = randomBytes(8).toString('hex');
  return `quepasa-${randomPart}`;
}

const quepasaMappingSchema = z.object({
  phoneNumber: z.string().min(1).optional(), // Optional - will be filled after QR scan
  name: z.string().min(1),
  chatwootBaseUrl: z.string().url().optional(),
  chatwootApiToken: z.string().min(1).optional(),
  chatwootAccountId: z.string().min(1).optional(),
  chatwootInboxId: z.string().min(1).optional(),
  chatwootInboxName: z.string().optional(), // Custom name for Chatwoot inbox
  enableGroups: z.boolean().optional(), // Enable receiving messages from WhatsApp groups
  reopenClosedTickets: z.boolean().optional(), // Reopen closed tickets for returning customers
  showAgentName: z.boolean().optional(), // Show agent name in messages sent to WhatsApp
  active: z.boolean().optional(),
});

// Get all Quepasa mappings
router.get('/quepasa-mappings', authMiddleware, async (req, res, next) => {
  try {
    const { active } = req.query;

    const where: any = {};
    if (active !== undefined) {
      where.active = active === 'true';
    }

    const mappings = await prisma.quepasaMapping.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        quepasaToken: true,
        phoneNumber: true,
        name: true,
        chatwootBaseUrl: true,
        chatwootAccountId: true,
        chatwootInboxId: true,
        chatwootInboxName: true,
        successNotificationSent: true,
        enableGroups: true,
        reopenClosedTickets: true,
        showAgentName: true,
        active: true,
        createdAt: true,
        updatedAt: true,
        // Don't expose the Chatwoot API token
      },
    });

    // Auto-configure webhook for connected sessions with Chatwoot (in background, non-blocking)
    // This works regardless of where QR was scanned (panel or Chatwoot)
    // Also fixes connections that were marked active by sync without webhook config
    (async () => {
      try {
        await quepasaClient.initialize();
      } catch (error: any) {
        // Quepasa not configured - skip webhook auto-configuration
        logger.debug({ error: error.message }, 'Quepasa not configured, skipping webhook auto-configuration');
        return;
      }

      for (const mapping of mappings) {
        // Configure webhook for connections that:
        // 1. Have phone number (connected)
        // 2. Have Chatwoot configured (not 'pending')
        // This is idempotent and will fix broken connections
        if (mapping.phoneNumber && mapping.chatwootInboxId && mapping.chatwootInboxId !== 'pending') {
          try {
            const systemBaseUrl = process.env.SYSTEM_BASE_URL || 'https://astrahub.seudominio.com.br';
            const webhookUrl = `${systemBaseUrl}/api/webhooks/quepasa/${mapping.quepasaToken}`;

            const webhookConfig = {
              url: webhookUrl,
              forwardinternal: true,
              trackid: mapping.name,
              extra: {
                mappingId: mapping.id,
                name: mapping.name,
              },
            };

            await quepasaClient.configureWebhook(mapping.quepasaToken, webhookConfig);

            // Ensure connection is marked as active after successful webhook configuration
            if (!mapping.active) {
              await prisma.quepasaMapping.update({
                where: { id: mapping.id },
                data: { active: true },
              });
              logger.info({ mappingId: mapping.id, webhookUrl, phoneNumber: mapping.phoneNumber }, '✅ Auto-configured Quepasa webhook and activated connection');
            } else {
              logger.info({ mappingId: mapping.id, webhookUrl, phoneNumber: mapping.phoneNumber }, '✅ Verified/updated Quepasa webhook for active connection');
            }

            // Send success notification to Chatwoot if not sent yet
            if (!mapping.successNotificationSent) {
              try {
                const chatwootConfig = {
                  baseUrl: mapping.chatwootBaseUrl,
                  apiAccessToken: (await prisma.quepasaMapping.findUnique({
                    where: { id: mapping.id },
                    select: { chatwootApiToken: true },
                  }))!.chatwootApiToken,
                  accountId: mapping.chatwootAccountId,
                  inboxId: mapping.chatwootInboxId,
                };

                // Find conversation with "Gerador de QR" contact (+55654321)
                const { conversation } = await chatwootClient.findOrCreateConversation(
                  chatwootConfig,
                  '+55654321',
                  'Gerador de QR'
                );

                // Clean phone number: extract only digits from WhatsApp JID format
                // Example: "556793363369:47@s.whatsapp.net" -> "556793363369"
                const cleanPhoneNumber = mapping.phoneNumber?.split(':')[0] || mapping.phoneNumber;

                // Send success message
                const successMessage = `✅ *Conexão estabelecida com sucesso!*\n\n` +
                  `📱 Número: ${cleanPhoneNumber}\n` +
                  `📝 Nome: ${mapping.name}\n\n` +
                  `Sua instância do WhatsApp está conectada e pronta para uso. As mensagens já estão sendo recebidas no Chatwoot.`;

                await chatwootClient.sendMessage(
                  chatwootConfig,
                  conversation.id,
                  successMessage,
                  'incoming'
                );

                // Mark notification as sent
                await prisma.quepasaMapping.update({
                  where: { id: mapping.id },
                  data: { successNotificationSent: true },
                });

                logger.info({ mappingId: mapping.id, conversationId: conversation.id, phoneNumber: cleanPhoneNumber }, '📨 Sent connection success notification to Chatwoot');
              } catch (notificationError: any) {
                // Don't fail if notification fails - it's not critical
                logger.warn({ error: notificationError.message, mappingId: mapping.id }, '⚠️  Failed to send connection notification to Chatwoot (non-critical)');
              }
            }
          } catch (webhookError: any) {
            logger.warn({ error: webhookError.message, mappingId: mapping.id }, '❌ Failed to configure webhook (will retry next time)');
            // Don't fail - will retry on next listing
          }
        }
      }
    })();

    res.json(mappings);
  } catch (error) {
    next(error);
  }
});

// Get specific Quepasa mapping
router.get('/quepasa-mappings/:id', authMiddleware, async (req, res, next) => {
  try {
    const { id } = req.params;

    const mapping = await prisma.quepasaMapping.findUnique({
      where: { id },
      select: {
        id: true,
        quepasaToken: true,
        phoneNumber: true,
        name: true,
        chatwootBaseUrl: true,
        chatwootAccountId: true,
        chatwootInboxId: true,
        chatwootInboxName: true,
        enableGroups: true,
        reopenClosedTickets: true,
        showAgentName: true,
        active: true,
        createdAt: true,
        updatedAt: true,
        // Don't expose the Chatwoot API token
      },
    });

    if (!mapping) {
      return res.status(404).json({ error: 'Quepasa mapping not found' });
    }

    res.json(mapping);
  } catch (error) {
    next(error);
  }
});

// Create Quepasa mapping
router.post('/quepasa-mappings', authMiddleware, async (req, res, next) => {
  try {
    const validated = quepasaMappingSchema.parse(req.body);

    // Check if phone number already exists (only if provided)
    if (validated.phoneNumber) {
      const existing = await prisma.quepasaMapping.findUnique({
        where: { phoneNumber: validated.phoneNumber },
      });

      if (existing) {
        return res.status(400).json({ error: 'Phone number already mapped' });
      }
    }

    // Generate unique token for this connection
    const quepasaToken = generateQuepasaToken();

    const mapping = await prisma.quepasaMapping.create({
      data: {
        quepasaToken,
        phoneNumber: validated.phoneNumber || null,
        name: validated.name,
        chatwootBaseUrl: validated.chatwootBaseUrl || 'pending',
        chatwootApiToken: validated.chatwootApiToken || 'pending',
        chatwootAccountId: validated.chatwootAccountId || 'pending',
        chatwootInboxId: validated.chatwootInboxId || 'pending',
        chatwootInboxName: validated.chatwootInboxName || null,
        enableGroups: validated.enableGroups ?? false,
        reopenClosedTickets: validated.reopenClosedTickets ?? false,
        showAgentName: validated.showAgentName ?? false,
        active: validated.active ?? false, // Default to inactive until Chatwoot is configured
      },
      select: {
        id: true,
        quepasaToken: true,
        phoneNumber: true,
        name: true,
        chatwootBaseUrl: true,
        chatwootAccountId: true,
        chatwootInboxId: true,
        chatwootInboxName: true,
        enableGroups: true,
        reopenClosedTickets: true,
        showAgentName: true,
        active: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    logger.info({ mappingId: mapping.id, phoneNumber: mapping.phoneNumber }, 'Created Quepasa mapping');

    res.status(201).json(mapping);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid data', details: error.errors });
    }
    next(error);
  }
});

// Update Quepasa mapping
router.put('/quepasa-mappings/:id', authMiddleware, async (req, res, next) => {
  try {
    const { id } = req.params;
    const validated = quepasaMappingSchema.partial().parse(req.body);

    // Check if mapping exists
    const existing = await prisma.quepasaMapping.findUnique({
      where: { id },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Quepasa mapping not found' });
    }

    // If updating phone number, check for conflicts
    if (validated.phoneNumber && validated.phoneNumber !== existing.phoneNumber) {
      const conflict = await prisma.quepasaMapping.findUnique({
        where: { phoneNumber: validated.phoneNumber },
      });

      if (conflict) {
        return res.status(400).json({ error: 'Phone number already mapped' });
      }
    }

    const mapping = await prisma.quepasaMapping.update({
      where: { id },
      data: validated,
      select: {
        id: true,
        quepasaToken: true,
        phoneNumber: true,
        name: true,
        chatwootBaseUrl: true,
        chatwootAccountId: true,
        chatwootInboxId: true,
        chatwootInboxName: true,
        enableGroups: true,
        reopenClosedTickets: true,
        showAgentName: true,
        active: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    logger.info({ mappingId: mapping.id, phoneNumber: mapping.phoneNumber }, 'Updated Quepasa mapping');

    res.json(mapping);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid data', details: error.errors });
    }
    next(error);
  }
});

// Delete Quepasa mapping
router.delete('/quepasa-mappings/:id', authMiddleware, async (req, res, next) => {
  try {
    const { id } = req.params;

    // Get full mapping data (including Chatwoot config for notification)
    const existing = await prisma.quepasaMapping.findUnique({
      where: { id },
      select: {
        id: true,
        quepasaToken: true,
        phoneNumber: true,
        name: true,
        chatwootBaseUrl: true,
        chatwootApiToken: true,
        chatwootAccountId: true,
        chatwootInboxId: true,
      },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Quepasa mapping not found' });
    }

    // Try to delete session from Quepasa API first
    try {
      await quepasaClient.initialize();
      await quepasaClient.deleteSession(existing.quepasaToken);
      logger.info({ mappingId: id, phoneNumber: existing.phoneNumber }, 'Deleted Quepasa session from API');
    } catch (error: any) {
      // Log the error but continue with database deletion
      logger.warn({ error: error.message, mappingId: id }, 'Failed to delete Quepasa session from API, continuing with database deletion');
    }

    // Send deletion notification to Chatwoot before deleting from database (non-blocking)
    (async () => {
      try {
        if (existing.chatwootInboxId && existing.chatwootInboxId !== 'pending') {
          const chatwootConfig = {
            baseUrl: existing.chatwootBaseUrl,
            apiAccessToken: existing.chatwootApiToken,
            accountId: existing.chatwootAccountId,
            inboxId: existing.chatwootInboxId,
          };

          // Find conversation with "Gerador de QR" contact (+55654321)
          const { conversation } = await chatwootClient.findOrCreateConversation(
            chatwootConfig,
            '+55654321',
            'Gerador de QR'
          );

          // Clean phone number
          const cleanPhoneNumber = existing.phoneNumber?.split(':')[0] || existing.phoneNumber || 'N/A';

          // Send deletion message
          const deletionMessage = `🗑️ *Conexão excluída*\n\n` +
            `📱 Número: ${cleanPhoneNumber}\n` +
            `📝 Nome: ${existing.name}\n\n` +
            `A conexão foi removida permanentemente do sistema.`;

          await chatwootClient.sendMessage(
            chatwootConfig,
            conversation.id,
            deletionMessage,
            'incoming'
          );

          logger.info({ mappingId: id, conversationId: conversation.id }, '📨 Sent deletion notification to Chatwoot');
        }
      } catch (notificationError: any) {
        logger.warn({ error: notificationError.message, mappingId: id }, '⚠️  Failed to send deletion notification to Chatwoot (non-critical)');
      }
    })();

    // Delete from database
    await prisma.quepasaMapping.delete({
      where: { id },
    });

    logger.info({ mappingId: id, phoneNumber: existing.phoneNumber }, 'Deleted Quepasa mapping from database');

    res.json({ success: true, message: 'Quepasa mapping deleted' });
  } catch (error) {
    next(error);
  }
});

// Setup Chatwoot integration for a Quepasa mapping
router.post('/quepasa-mappings/:id/setup-integration', authMiddleware, async (req, res, next) => {
  try {
    const { id } = req.params;

    // Get the mapping
    const mapping = await prisma.quepasaMapping.findUnique({
      where: { id },
    });

    if (!mapping) {
      return res.status(404).json({ error: 'Quepasa mapping not found' });
    }

    // Check if phone number is set
    if (!mapping.phoneNumber) {
      return res.status(400).json({ error: 'Phone number not set. Please scan QR code first.' });
    }

    // Get system base URL from environment
    const systemBaseUrl = process.env.SYSTEM_BASE_URL || 'https://astrahub.seudominio.com.br';

    // Build Chatwoot config
    const chatwootConfig = {
      baseUrl: mapping.chatwootBaseUrl,
      apiAccessToken: mapping.chatwootApiToken,
      accountId: mapping.chatwootAccountId,
      inboxId: mapping.chatwootInboxId, // May be 'pending', will be updated
    };

    // Create API inbox in Chatwoot if not already created
    let inboxId = mapping.chatwootInboxId;
    if (inboxId === 'pending' || !inboxId) {
      try {
        // Use custom inbox name if provided, otherwise use mapping name with phone number
        const inboxName = mapping.chatwootInboxName || `Quepasa - ${mapping.name} (${mapping.phoneNumber})`;
        const webhookUrl = `${systemBaseUrl}/api/webhooks/chatwoot/${mapping.quepasaToken}`;

        const inbox = await chatwootClient.createInbox(chatwootConfig, inboxName, webhookUrl);
        inboxId = inbox.id.toString();

        logger.info({ mappingId: id, inboxId, inboxName, customName: !!mapping.chatwootInboxName }, 'Created Chatwoot API inbox');
      } catch (error: any) {
        logger.error({ error: error.message, mappingId: id }, 'Failed to create Chatwoot inbox');
        return res.status(500).json({ error: `Failed to create Chatwoot inbox: ${error.message}` });
      }
    }

    // Configure webhook in Quepasa
    try {
      await quepasaClient.initialize();

      const webhookUrl = `${systemBaseUrl}/api/webhooks/quepasa/${mapping.quepasaToken}`;
      const webhookConfig = {
        url: webhookUrl,
        forwardinternal: true,
        trackid: mapping.phoneNumber, // Use phone number for tracking
        extra: {
          mappingId: id,
          phoneNumber: mapping.phoneNumber,
          name: mapping.name,
        },
      };

      await quepasaClient.configureWebhook(mapping.quepasaToken, webhookConfig);

      logger.info({ mappingId: id, webhookUrl, trackid: mapping.phoneNumber }, 'Configured Quepasa webhook');
    } catch (error: any) {
      logger.error({ error: error.message, mappingId: id }, 'Failed to configure Quepasa webhook');
      return res.status(500).json({ error: `Failed to configure Quepasa webhook: ${error.message}` });
    }

    // Update mapping with inbox ID and activate
    const updatedMapping = await prisma.quepasaMapping.update({
      where: { id },
      data: {
        chatwootInboxId: inboxId,
        active: true,
      },
      select: {
        id: true,
        quepasaToken: true,
        phoneNumber: true,
        name: true,
        chatwootBaseUrl: true,
        chatwootAccountId: true,
        chatwootInboxId: true,
        chatwootInboxName: true,
        enableGroups: true,
        reopenClosedTickets: true,
        showAgentName: true,
        active: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    logger.info({ mappingId: id, inboxId, phoneNumber: mapping.phoneNumber }, 'Successfully set up Chatwoot integration');

    res.json({
      success: true,
      message: 'Chatwoot integration configured successfully',
      mapping: updatedMapping,
      chatwootInboxId: inboxId,
    });
  } catch (error) {
    next(error);
  }
});

// Create Quepasa mapping with Chatwoot integration and send QR code to Chatwoot
router.post('/quepasa-mappings/with-chatwoot', authMiddleware, async (req, res, next) => {
  try {
    const schema = z.object({
      name: z.string().min(1),
      chatwootBaseUrl: z.string().url(),
      chatwootApiToken: z.string().min(1),
      chatwootAccountId: z.string().min(1),
      chatwootInboxName: z.string().optional(),
      enableGroups: z.boolean().optional(),
      sendQRToChatwoot: z.boolean(),
    });

    const validated = schema.parse(req.body);

    if (!validated.sendQRToChatwoot) {
      return res.status(400).json({ error: 'sendQRToChatwoot must be true for this endpoint' });
    }

    // Step 1: Generate unique token for Quepasa connection
    const quepasaToken = generateQuepasaToken();
    logger.info({ quepasaToken, name: validated.name }, 'Generated Quepasa token for new mapping with Chatwoot');

    // Step 2: Create mapping in database with Chatwoot credentials
    const mapping = await prisma.quepasaMapping.create({
      data: {
        quepasaToken,
        phoneNumber: null, // Will be filled after QR scan
        name: validated.name,
        chatwootBaseUrl: validated.chatwootBaseUrl,
        chatwootApiToken: validated.chatwootApiToken,
        chatwootAccountId: validated.chatwootAccountId,
        chatwootInboxId: 'pending', // Will be updated after inbox creation
        chatwootInboxName: validated.chatwootInboxName || null,
        enableGroups: validated.enableGroups ?? false,
        showAgentName: false, // Default to false
        active: false, // Will be activated after everything is set up
      },
    });

    logger.info({ mappingId: mapping.id, name: validated.name }, 'Created Quepasa mapping with Chatwoot credentials');

    try {
      // Step 3: Get QR code from Quepasa as Buffer
      await quepasaClient.initialize();
      const qrCodeBuffer = await quepasaClient.getQRCode(quepasaToken);
      logger.info({ mappingId: mapping.id }, 'Retrieved QR code from Quepasa');

      // Step 4: Create Chatwoot inbox
      const systemBaseUrl = process.env.SYSTEM_BASE_URL || 'https://astrahub.seudominio.com.br';
      const inboxName = validated.chatwootInboxName || `Quepasa - ${validated.name}`;
      const webhookUrl = `${systemBaseUrl}/api/webhooks/chatwoot/${quepasaToken}`;

      const chatwootConfig = {
        baseUrl: validated.chatwootBaseUrl,
        apiAccessToken: validated.chatwootApiToken,
        accountId: validated.chatwootAccountId,
        inboxId: 'pending', // Temporary, will be updated
      };

      const inbox = await chatwootClient.createInbox(chatwootConfig, inboxName, webhookUrl);
      const inboxId = inbox.id.toString();

      logger.info({ mappingId: mapping.id, inboxId, inboxName }, 'Created Chatwoot inbox');

      // Update config with real inbox ID
      chatwootConfig.inboxId = inboxId;

      // Step 5: Skip webhook configuration for now (will be configured after QR scan in webhook)
      // Quepasa rejects webhook configuration for unconnected sessions
      logger.info({ mappingId: mapping.id }, 'Skipping Quepasa webhook configuration until connection is established');

      // Step 6: Create special contact "Gerador de QR" with phone +55654321
      const { conversation, contact } = await chatwootClient.findOrCreateConversation(
        chatwootConfig,
        '+55654321',
        'Gerador de QR'
      );

      logger.info({ mappingId: mapping.id, conversationId: conversation.id, contactId: contact.id }, 'Created/found conversation with "Gerador de QR"');

      // Step 7: Send QR code PNG to the conversation
      await chatwootClient.sendMessageWithFileUpload(
        chatwootConfig,
        conversation.id,
        '📱 Escaneie este QR code para conectar sua instância do WhatsApp. Após escanear, a conexão será ativada automaticamente.',
        qrCodeBuffer,
        'qr-code.png',
        'image/png',
        'incoming'
      );

      logger.info({ mappingId: mapping.id, conversationId: conversation.id }, 'Sent QR code to Chatwoot conversation');

      // Step 8: Update mapping with inbox ID (keep inactive until QR is scanned)
      const updatedMapping = await prisma.quepasaMapping.update({
        where: { id: mapping.id },
        data: {
          chatwootInboxId: inboxId,
        },
        select: {
          id: true,
          quepasaToken: true,
          phoneNumber: true,
          name: true,
          chatwootBaseUrl: true,
          chatwootAccountId: true,
          chatwootInboxId: true,
          chatwootInboxName: true,
          enableGroups: true,
          reopenClosedTickets: true,
          showAgentName: true,
          active: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      logger.info({ mappingId: mapping.id, inboxId }, 'Successfully created Quepasa mapping with Chatwoot integration and sent QR to conversation');

      res.status(201).json({
        success: true,
        message: 'Conexão criada e QR code enviado para Chatwoot',
        mapping: updatedMapping,
        chatwootInboxId: inboxId,
        qrSentToConversation: conversation.id,
      });
    } catch (error: any) {
      // If something fails, try to delete the mapping to avoid orphaned records
      try {
        const exists = await prisma.quepasaMapping.findUnique({ where: { id: mapping.id } });
        if (exists) {
          await prisma.quepasaMapping.delete({ where: { id: mapping.id } });
          logger.warn({ error: error.message, mappingId: mapping.id }, 'Failed to complete Quepasa+Chatwoot setup, rolled back mapping');
        }
      } catch (deleteError: any) {
        logger.warn({ deleteError: deleteError.message, originalError: error.message, mappingId: mapping.id }, 'Failed to rollback mapping (non-critical)');
      }
      throw error;
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid data', details: error.errors });
    }
    next(error);
  }
});

export default router;
