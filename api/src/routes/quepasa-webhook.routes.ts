import { Router } from 'express';
import { prisma } from '../db/client';
import { quepasaClient } from '../clients/quepasa.client';
import { chatwootClient } from '../clients/chatwoot.client';
import { logger } from '../utils/logger';

const router = Router();

/**
 * Webhook endpoint to receive incoming messages from Quepasa (with token in path)
 * Quepasa sends WhatsApp messages here, we forward them to Chatwoot
 * URL format: /webhooks/quepasa/{quepasaToken}
 */
router.post('/webhooks/quepasa/:token', async (req, res, next) => {
  try {
    const { token } = req.params;
    const payload = req.body;

    logger.info({ hasToken: !!token, payloadKeys: Object.keys(payload), payload: JSON.stringify(payload) }, 'Received webhook from Quepasa with token');

    // Extract message data from Quepasa webhook
    // Quepasa sends: chat.id, chat.phone, text, fromme (lowercase!)
    const fromNumber = payload.chat?.id || payload.chat?.phone || payload.from || payload.chatId;
    let messageText = payload.text || payload.body || payload.message?.text || '';
    const fromMe = payload.fromme || payload.fromMe || false; // Note: Quepasa uses lowercase 'fromme'
    const senderName = payload.chat?.title || payload.senderName || payload.pushname || fromNumber;

    // Check if message has media attachment
    const messageType = payload.type || 'text';
    const hasAttachment = !!payload.attachment;
    const messageId = payload.id;
    const inreplyQuepasaId = payload.inreply; // ID of the message being replied to

    // Extract message timestamp (Quepasa sends timestamp in seconds or milliseconds)
    const messageTimestamp = payload.timestamp || payload.time || payload.t;

    // CRITICAL: Reject messages without timestamp (likely sync/status events)
    if (!messageTimestamp) {
      logger.warn(
        { fromNumber, messageType, hasMessageId: !!messageId, payloadKeys: Object.keys(payload) },
        '⚠️ Ignoring message without timestamp - likely sync/status event during connection'
      );
      return res.json({ success: true, message: 'Message without timestamp ignored (sync event)' });
    }

    // Filter out non-message event types (status updates, read receipts, presence, contact sync, etc.)
    // 'contact' type is sent during initial sync when connecting Quepasa (all contacts from device)
    const ignoredEventTypes = ['ack', 'read', 'delivered', 'presence', 'status', 'typing', 'recording', 'contact'];
    if (messageType && ignoredEventTypes.includes(messageType.toLowerCase())) {
      logger.info(
        { fromNumber, messageType },
        '🔕 Ignoring non-message event type (sync/status event)'
      );
      return res.json({ success: true, message: `Non-message event type ignored: ${messageType}` });
    }

    // DEBUG: Log message ID from Quepasa payload
    logger.info({ messageId, hasMessageId: !!messageId, payloadId: payload.id, inreply: inreplyQuepasaId }, '📋 DEBUG: Message ID from Quepasa');

    // Check if this is a reply to another message (WhatsApp → Chatwoot)
    let chatwootReplyToId: number | undefined;
    if (inreplyQuepasaId) {
      try {
        const messageMapping = await prisma.messageMapping.findFirst({
          where: {
            quepasaMessageId: inreplyQuepasaId,
          },
        });

        if (messageMapping) {
          chatwootReplyToId = messageMapping.chatwootMessageId;
          logger.info({ inreplyQuepasaId, chatwootReplyToId }, '✅ Found Chatwoot message ID from database for WhatsApp reply');
        } else {
          logger.warn({ inreplyQuepasaId }, 'No message mapping found in database for this Quepasa reply');
        }
      } catch (error: any) {
        logger.warn({ error: error.message, inreplyQuepasaId }, 'Failed to lookup Chatwoot message ID from database');
      }
    }

    // Check if this is a group message
    const isGroup = fromNumber.includes('@g.us') || payload.isGroup;

    // For group messages, prepend participant info (who sent the message)
    if (isGroup && payload.participant) {
      const participantName = payload.participant.title || payload.participant.name || 'Membro';
      const participantPhone = payload.participant.phone || payload.participant.id || '';

      // Prepend participant info to message
      const participantInfo = `📱 *${participantName}*${participantPhone ? ` (${participantPhone})` : ''}`;
      messageText = messageText ? `${participantInfo}\n${messageText}` : participantInfo;

      logger.info({ participantName, participantPhone, isGroup }, 'Group message with participant info');
    }

    // Log incoming event
    await prisma.eventLog.create({
      data: {
        direction: 'in',
        provider: 'quepasa',
        sessionId: token || 'quepasa',
        peer: fromNumber || 'unknown',
        payload: payload,
      },
    });

    // Validate required fields (accept messages with attachment but no text)
    if (!fromNumber) {
      logger.warn({ payload }, 'Incomplete Quepasa webhook payload - missing phone number');
      return res.status(400).json({ error: 'Invalid webhook payload - missing phone number' });
    }

    // Must have either text or attachment
    if (!messageText && !hasAttachment) {
      logger.warn({ payload }, 'Incomplete Quepasa webhook payload - no text or attachment');
      return res.status(400).json({ error: 'Invalid webhook payload - no content' });
    }

    if (!token) {
      logger.warn({ payload }, 'No token in Quepasa webhook URL');
      return res.status(400).json({ error: 'Missing token in URL path' });
    }

    // Ignore messages sent by bot owner (fromMe = true)
    if (fromMe) {
      logger.info({ fromNumber, fromMe }, 'Ignoring message from bot owner');
      return res.json({ success: true, message: 'Message from owner ignored' });
    }

    // Find QuepasaMapping by Quepasa token (MUCH faster than phone number lookup!)
    const quepasaMapping = await prisma.quepasaMapping.findFirst({
      where: {
        quepasaToken: token,
        active: true,
      },
      select: {
        id: true,
        quepasaToken: true,
        phoneNumber: true,
        name: true,
        chatwootBaseUrl: true,
        chatwootApiToken: true,
        chatwootAccountId: true,
        chatwootInboxId: true,
        enableGroups: true,
        reopenClosedTickets: true,
        showAgentName: true,
        maxMessageAgeMinutes: true,
        active: true,
      },
    });

    if (!quepasaMapping) {
      logger.warn({ token }, 'No active Quepasa mapping found for token');
      return res.status(404).json({ error: 'Quepasa mapping not found for this token' });
    }

    // Now check message age using the configured max age from QuepasaMapping
    if (messageTimestamp) {
      let messageDate: Date;

      // Convert timestamp to Date (handle both seconds and milliseconds)
      if (messageTimestamp > 10000000000) {
        // Milliseconds
        messageDate = new Date(messageTimestamp);
      } else {
        // Seconds
        messageDate = new Date(messageTimestamp * 1000);
      }

      const now = new Date();
      const ageMinutes = (now.getTime() - messageDate.getTime()) / (1000 * 60);

      if (ageMinutes > quepasaMapping.maxMessageAgeMinutes) {
        logger.info(
          { fromNumber, messageTimestamp, ageMinutes: ageMinutes.toFixed(2), maxAge: quepasaMapping.maxMessageAgeMinutes, mappingId: quepasaMapping.id },
          '⏰ Ignoring old message (likely from sync after connection)'
        );
        return res.json({ success: true, message: 'Old message ignored (from sync)' });
      }

      logger.info(
        { fromNumber, messageTimestamp, ageMinutes: ageMinutes.toFixed(2), maxAge: quepasaMapping.maxMessageAgeMinutes },
        '✅ Message is recent, will process'
      );
    }

    // Check idempotency - has this message been processed before?
    if (messageId) {
      const existingMessage = await prisma.processedMessage.findUnique({
        where: {
          quepasaMappingId_externalId_source: {
            quepasaMappingId: quepasaMapping.id,
            externalId: messageId,
            source: 'quepasa',
          },
        },
      });

      if (existingMessage) {
        logger.info(
          { messageId, fromNumber, processedAt: existingMessage.processedAt },
          '✅ Message already processed (idempotency check) - ignoring'
        );
        return res.json({ success: true, message: 'Message already processed' });
      }
    }

    // Check if groups are enabled - ignore group messages if not
    if (isGroup && !quepasaMapping.enableGroups) {
      logger.info({ fromNumber, isGroup, mappingId: quepasaMapping.id }, 'Ignoring group message - groups not enabled for this mapping');
      return res.json({ success: true, message: 'Group message ignored (groups not enabled)' });
    }

    // Build Chatwoot config from mapping
    const chatwootConfig = {
      baseUrl: quepasaMapping.chatwootBaseUrl,
      apiAccessToken: quepasaMapping.chatwootApiToken,
      accountId: quepasaMapping.chatwootAccountId,
      inboxId: quepasaMapping.chatwootInboxId,
    };

    // Process message in Chatwoot
    try {
      let result: { conversationId: number; messageId: number };

      if (hasAttachment && messageId) {
        // Handle media message - download from Quepasa and upload to Chatwoot
        logger.info({ messageId, messageType, fromNumber }, 'Processing media message');

        // Initialize Quepasa client
        await quepasaClient.initialize();

        // Download media from Quepasa
        const media = await quepasaClient.downloadMedia(token, messageId);

        // Special handling for location messages - convert to Google Maps link
        if (messageType === 'location' || media.mimeType.includes('location')) {
          logger.info({ messageId, messageType, mimeType: media.mimeType, fromNumber }, '📍 Processing location message');

          // Parse location data from buffer
          const locationData = media.buffer.toString('utf-8');
          logger.info({ locationData, fromNumber }, '📍 Location data received');

          // Extract latitude and longitude from location data
          // Format can be: "geo:-15.7801,-47.9292" or just "-15.7801,-47.9292"
          const geoMatch = locationData.match(/geo:([-\d.]+),([-\d.]+)/i) || locationData.match(/([-\d.]+),([-\d.]+)/);

          if (geoMatch) {
            const latitude = geoMatch[1];
            const longitude = geoMatch[2];
            const mapsLink = `https://www.google.com/maps?q=${latitude},${longitude}`;

            // Create location message text
            const locationMessage = `📍 Localização compartilhada:\n${mapsLink}`;

            logger.info({ latitude, longitude, mapsLink, fromNumber }, '📍 Created Google Maps link for location');

            // Send as text message instead of file
            const displayName = isGroup ? `${senderName} (Grupo)` : senderName;
            result = await chatwootClient.processIncomingMessage(chatwootConfig, fromNumber, locationMessage, displayName, messageId, chatwootReplyToId, quepasaMapping.reopenClosedTickets);

            logger.info(
              { conversationId: result.conversationId, messageId: result.messageId, fromNumber, quepasaToken: token },
              '📍 Location message forwarded to Chatwoot as text with Google Maps link'
            );
          } else {
            logger.warn({ locationData, fromNumber }, '📍 Failed to parse location coordinates');

            // Fallback: send location data as text
            const displayName = isGroup ? `${senderName} (Grupo)` : senderName;
            result = await chatwootClient.processIncomingMessage(chatwootConfig, fromNumber, `📍 Localização: ${locationData}`, displayName, messageId, chatwootReplyToId, quepasaMapping.reopenClosedTickets);

            logger.info(
              { conversationId: result.conversationId, messageId: result.messageId, fromNumber, quepasaToken: token },
              '📍 Location message forwarded to Chatwoot as raw text (parse failed)'
            );
          }
        } else if (messageType === 'vcard' || media.mimeType.includes('vcard') || media.mimeType.includes('contact')) {
          // Special handling for contact messages (vCard) - parse and format nicely
          logger.info({ messageId, messageType, mimeType: media.mimeType, fromNumber }, '👤 Processing vCard contact message');

          // Parse vCard data from buffer
          const vcardData = media.buffer.toString('utf-8');
          logger.info({ vcardData, fromNumber }, '👤 vCard data received');

          try {
            // Extract contact name (FN field)
            const nameMatch = vcardData.match(/FN:(.+)/i);
            const contactName = nameMatch ? nameMatch[1].trim() : 'Contato';

            // Extract all phone numbers (TEL fields)
            const phoneMatches = vcardData.matchAll(/TEL[^:]*:(.+)/gi);
            const phones: string[] = [];
            for (const match of phoneMatches) {
              phones.push(match[1].trim());
            }

            // Extract email if available
            const emailMatch = vcardData.match(/EMAIL[^:]*:(.+)/i);
            const email = emailMatch ? emailMatch[1].trim() : null;

            // Extract organization if available
            const orgMatch = vcardData.match(/ORG:(.+)/i);
            const organization = orgMatch ? orgMatch[1].trim() : null;

            // Build formatted contact message
            let contactMessage = `👤 Contato compartilhado:\n\n`;
            contactMessage += `**Nome:** ${contactName}\n`;

            if (phones.length > 0) {
              contactMessage += `**Telefone(s):**\n`;
              phones.forEach(phone => {
                contactMessage += `  • ${phone}\n`;
              });
            }

            if (email) {
              contactMessage += `**Email:** ${email}\n`;
            }

            if (organization) {
              contactMessage += `**Empresa:** ${organization}\n`;
            }

            logger.info({ contactName, phones, email, organization, fromNumber }, '👤 Parsed vCard contact');

            // Send as text message instead of file
            const displayName = isGroup ? `${senderName} (Grupo)` : senderName;
            result = await chatwootClient.processIncomingMessage(chatwootConfig, fromNumber, contactMessage, displayName, messageId, chatwootReplyToId, quepasaMapping.reopenClosedTickets);

            logger.info(
              { conversationId: result.conversationId, messageId: result.messageId, fromNumber, quepasaToken: token },
              '👤 vCard contact forwarded to Chatwoot as formatted text'
            );
          } catch (error: any) {
            logger.warn({ error: error.message, vcardData, fromNumber }, '👤 Failed to parse vCard');

            // Fallback: send vCard data as text
            const displayName = isGroup ? `${senderName} (Grupo)` : senderName;
            result = await chatwootClient.processIncomingMessage(chatwootConfig, fromNumber, `👤 Contato compartilhado:\n${vcardData}`, displayName, messageId, chatwootReplyToId, quepasaMapping.reopenClosedTickets);

            logger.info(
              { conversationId: result.conversationId, messageId: result.messageId, fromNumber, quepasaToken: token },
              '👤 vCard contact forwarded to Chatwoot as raw text (parse failed)'
            );
          }
        } else {
          // Regular media message (not a location)
          // Find or create conversation and contact
          // Add (Grupo) suffix to name if it's a group
          const displayName = isGroup ? `${senderName} (Grupo)` : senderName;
          const { conversation, contact } = await chatwootClient.findOrCreateConversation(
            chatwootConfig,
            fromNumber,
            displayName,
            quepasaMapping.reopenClosedTickets
          );

          // Generate filename from type and timestamp
          const extension = media.mimeType.split('/')[1]?.split(';')[0] || 'bin';
          const filename = `${messageType}_${Date.now()}.${extension}`;

          // Upload media to Chatwoot with Quepasa message ID as external_id
          const chatwootMessage = await chatwootClient.sendMessageWithFileUpload(
            chatwootConfig,
            conversation.id,
            messageText || '', // Send empty caption if no text
            media.buffer,
            filename,
            media.mimeType,
            'incoming',
            messageId,  // Store Quepasa message ID for reply support
            chatwootReplyToId  // Reply to message ID (if this is a reply)
          );

          result = {
            conversationId: conversation.id,
            messageId: chatwootMessage.id,
          };

          logger.info(
            { conversationId: result.conversationId, messageId: result.messageId, messageType, fromNumber, quepasaToken: token },
            'Media message forwarded to Chatwoot'
          );

          // Update contact avatar with WhatsApp profile picture (async, non-blocking)
          // Works for both individual contacts and groups
          // Always update to sync profile picture changes
          if (fromNumber) {
            (async () => {
              try {
                // Get profile picture URL from Quepasa
                const profilePictureUrl = await quepasaClient.getProfilePictureUrl(token, fromNumber);

                if (profilePictureUrl) {
                  // Update contact avatar in Chatwoot
                  await chatwootClient.updateContactAvatar(chatwootConfig, contact.id, profilePictureUrl);
                  const contactType = isGroup ? 'grupo' : 'contato';
                  logger.info({ contactId: contact.id, fromNumber, hasAvatar: !!contact.thumbnail, isGroup }, `📸 Updated ${contactType} avatar from WhatsApp profile picture (media message)`);
                } else {
                  const contactType = isGroup ? 'grupo' : 'contato';
                  logger.info({ contactId: contact.id, fromNumber, isGroup }, `📸 No profile picture found on WhatsApp for ${contactType} (media message)`);
                }
              } catch (error: any) {
                const contactType = isGroup ? 'grupo' : 'contato';
                logger.warn({ error: error.message, fromNumber, isGroup }, `Failed to update ${contactType} avatar (non-critical, media message)`);
              }
            })();
          }
        }
      } else {
        // Handle text message
        // Add (Grupo) suffix to name if it's a group
        const displayName = isGroup ? `${senderName} (Grupo)` : senderName;
        result = await chatwootClient.processIncomingMessage(chatwootConfig, fromNumber, messageText, displayName, messageId, chatwootReplyToId, quepasaMapping.reopenClosedTickets);

        logger.info(
          { conversationId: result.conversationId, messageId: result.messageId, fromNumber, quepasaToken: token },
          'Text message forwarded to Chatwoot'
        );
      }

      // Update contact avatar with WhatsApp profile picture (async, non-blocking)
      // Works for both individual contacts and groups
      // Always update to sync profile picture changes
      if (fromNumber) {
        (async () => {
          try {
            // Get contact to check if avatar already exists
            const { contact } = await chatwootClient.findOrCreateConversation(chatwootConfig, fromNumber, senderName, quepasaMapping.reopenClosedTickets);

            // Get profile picture URL from Quepasa (always check for updates)
            await quepasaClient.initialize();
            const profilePictureUrl = await quepasaClient.getProfilePictureUrl(token, fromNumber);

            if (profilePictureUrl) {
              // Update contact avatar in Chatwoot
              await chatwootClient.updateContactAvatar(chatwootConfig, contact.id, profilePictureUrl);
              const contactType = isGroup ? 'grupo' : 'contato';
              logger.info({ contactId: contact.id, fromNumber, hadAvatar: !!contact.thumbnail, isGroup }, `📸 Updated ${contactType} avatar from WhatsApp profile picture`);
            } else {
              const contactType = isGroup ? 'grupo' : 'contato';
              logger.info({ contactId: contact.id, fromNumber, isGroup }, `📸 No profile picture found on WhatsApp for ${contactType}`);
            }
          } catch (error: any) {
            const contactType = isGroup ? 'grupo' : 'contato';
            logger.warn({ error: error.message, fromNumber, isGroup }, `Failed to update ${contactType} avatar (non-critical)`);
          }
        })();
      }

      // Store message mapping in database for reply functionality (if we have Quepasa message ID)
      if (messageId && result.messageId) {
        try {
          await prisma.messageMapping.create({
            data: {
              chatwootMessageId: result.messageId,
              quepasaMessageId: messageId,
              conversationId: result.conversationId,
            },
          });
          logger.info({ chatwootMessageId: result.messageId, quepasaMessageId: messageId, conversationId: result.conversationId }, '💾 Stored message mapping for reply functionality');
        } catch (error: any) {
          logger.warn({ error: error.message, chatwootMessageId: result.messageId, quepasaMessageId: messageId }, 'Failed to store message mapping (non-critical)');
        }
      }

      // Log outgoing event to Chatwoot
      await prisma.eventLog.create({
        data: {
          direction: 'out',
          provider: 'chatwoot',
          sessionId: token,
          peer: fromNumber,
          payload: {
            conversationId: result.conversationId,
            messageId: result.messageId,
            text: messageText,
            messageType,
            hasAttachment,
          },
        },
      });

      // Mark message as processed (idempotency)
      if (messageId) {
        try {
          await prisma.processedMessage.create({
            data: {
              quepasaMappingId: quepasaMapping.id,
              externalId: messageId,
              source: 'quepasa',
              direction: 'incoming',
            },
          });
          logger.info({ messageId, fromNumber }, '💾 Marked message as processed (idempotency)');
        } catch (error: any) {
          // Ignore unique constraint errors (race condition)
          if (!error.message?.includes('Unique constraint')) {
            logger.warn({ error: error.message, messageId }, 'Failed to mark message as processed (non-critical)');
          }
        }
      }

      res.json({
        success: true,
        conversationId: result.conversationId,
        messageId: result.messageId,
      });
    } catch (error: any) {
      logger.error({ error: error.message, fromNumber, quepasaToken: token }, 'Failed to process message in Chatwoot');

      // Log error
      await prisma.eventLog.create({
        data: {
          direction: 'out',
          provider: 'chatwoot',
          sessionId: token,
          peer: fromNumber,
          payload: {
            error: error.message,
            errorType: 'chatwoot_processing_failed',
          },
        },
      });

      return res.status(500).json({ success: false, error: error.message });
    }
  } catch (error: any) {
    logger.error({ error }, 'Quepasa webhook processing failed');
    next(error);
  }
});

/**
 * FALLBACK: Webhook endpoint without token (for backward compatibility)
 * This is the old method using trackid from payload
 * NEW integrations should use /webhooks/quepasa/:token instead
 */
router.post('/webhooks/quepasa', async (req, res, next) => {
  try {
    const payload = req.body;

    logger.info({ payloadKeys: Object.keys(payload) }, 'Received webhook from Quepasa');

    // Extract Quepasa phone number from webhook extra data (configured when setting up webhook)
    const quepasaPhoneNumber = payload.trackid || payload.extra?.phoneNumber;

    // Log incoming event
    await prisma.eventLog.create({
      data: {
        direction: 'in',
        provider: 'quepasa',
        sessionId: quepasaPhoneNumber || 'quepasa',
        peer: payload.chat?.id || payload.chat?.phone || payload.from || payload.chatId || 'unknown',
        payload: payload,
      },
    });

    // Extract message data from Quepasa webhook
    // Quepasa sends: chat.id, chat.phone, text, fromme (lowercase!)
    const fromNumber = payload.chat?.id || payload.chat?.phone || payload.from || payload.chatId;
    const messageText = payload.text || payload.body || payload.message?.text || '';
    const fromMe = payload.fromme || payload.fromMe || false; // Note: Quepasa uses lowercase 'fromme'
    const senderName = payload.chat?.title || payload.senderName || payload.pushname || fromNumber;

    // Validate required fields
    if (!fromNumber || !messageText) {
      logger.warn({ payload }, 'Incomplete Quepasa webhook payload');
      return res.status(400).json({ error: 'Invalid webhook payload' });
    }

    // Ignore messages sent by bot owner (fromMe = true)
    if (fromMe) {
      logger.info({ fromNumber, fromMe }, 'Ignoring message from bot owner');
      return res.json({ success: true, message: 'Message from owner ignored' });
    }

    // Check if this is a group message
    const isGroup = fromNumber.includes('@g.us') || payload.isGroup;

    if (isGroup) {
      logger.info({ fromNumber, isGroup }, 'Group message received [LEGACY], will create ticket with (Grupo) suffix');
    }

    // Find QuepasaMapping configuration
    if (!quepasaPhoneNumber) {
      logger.warn({ payload }, 'No Quepasa phone number in webhook payload');
      return res.status(400).json({ error: 'Missing Quepasa phone number identifier' });
    }

    const quepasaMapping = await prisma.quepasaMapping.findFirst({
      where: {
        phoneNumber: quepasaPhoneNumber,
        active: true,
      },
      select: {
        id: true,
        quepasaToken: true,
        phoneNumber: true,
        name: true,
        chatwootBaseUrl: true,
        chatwootApiToken: true,
        chatwootAccountId: true,
        chatwootInboxId: true,
        reopenClosedTickets: true,
        showAgentName: true,
        active: true,
      },
    });

    if (!quepasaMapping) {
      logger.warn({ quepasaPhoneNumber }, 'No active Quepasa mapping found');
      return res.status(404).json({ error: 'Quepasa mapping not found' });
    }

    // Build Chatwoot config from mapping
    const chatwootConfig = {
      baseUrl: quepasaMapping.chatwootBaseUrl,
      apiAccessToken: quepasaMapping.chatwootApiToken,
      accountId: quepasaMapping.chatwootAccountId,
      inboxId: quepasaMapping.chatwootInboxId,
    };

    // Process message in Chatwoot
    try {
      // Add (Grupo) suffix to name if it's a group
      const displayName = isGroup ? `${senderName} (Grupo)` : senderName;
      const result = await chatwootClient.processIncomingMessage(chatwootConfig, fromNumber, messageText, displayName, undefined, undefined, quepasaMapping.reopenClosedTickets);

      logger.info(
        { conversationId: result.conversationId, messageId: result.messageId, fromNumber, quepasaPhoneNumber },
        'Message forwarded to Chatwoot'
      );

      // Log outgoing event to Chatwoot
      await prisma.eventLog.create({
        data: {
          direction: 'out',
          provider: 'chatwoot',
          sessionId: quepasaPhoneNumber,
          peer: fromNumber,
          payload: {
            conversationId: result.conversationId,
            messageId: result.messageId,
            text: messageText,
          },
        },
      });

      res.json({
        success: true,
        conversationId: result.conversationId,
        messageId: result.messageId,
      });
    } catch (error: any) {
      logger.error({ error: error.message, fromNumber, quepasaPhoneNumber }, 'Failed to process message in Chatwoot');

      // Log error
      await prisma.eventLog.create({
        data: {
          direction: 'out',
          provider: 'chatwoot',
          sessionId: quepasaPhoneNumber,
          peer: fromNumber,
          payload: {
            error: error.message,
            errorType: 'chatwoot_processing_failed',
          },
        },
      });

      return res.status(500).json({ success: false, error: error.message });
    }
  } catch (error: any) {
    logger.error({ error }, 'Quepasa webhook processing failed');
    next(error);
  }
});

/**
 * Webhook endpoint to receive outgoing messages from Chatwoot (with token in path)
 * Chatwoot sends agent responses here, we forward them to Quepasa (WhatsApp)
 * URL format: /webhooks/chatwoot/{quepasaToken}
 */
router.post('/webhooks/chatwoot/:token', async (req, res, next) => {
  try {
    const { token } = req.params;
    const payload = req.body;

    logger.info({ event: payload.event, hasToken: !!token }, 'Received webhook from Chatwoot with token');

    // Log incoming event
    await prisma.eventLog.create({
      data: {
        direction: 'in',
        provider: 'chatwoot',
        sessionId: token || 'chatwoot',
        peer: payload.conversation?.meta?.sender?.phone_number || 'unknown',
        payload: payload,
      },
    });

    // We only care about message_created events with outgoing messages
    if (payload.event !== 'message_created') {
      logger.debug({ event: payload.event }, 'Ignoring non-message event');
      return res.json({ success: true, message: 'Event ignored' });
    }

    // Extract message data
    const messageType = payload.message_type || payload.content_attributes?.message_type;
    let messageContent = payload.content || '';
    const conversationId = payload.conversation?.id;
    // Use identifier as fallback for groups (phone_number is null for groups)
    const phoneNumber = payload.conversation?.meta?.sender?.phone_number || payload.conversation?.meta?.sender?.identifier;
    const isPrivate = payload.private || false;
    const attachments = payload.attachments || [];
    const hasAttachments = attachments.length > 0;

    // Extract agent name from Chatwoot payload
    const agentName = payload.sender?.name || payload.sender?.available_name || payload.conversation?.meta?.assignee?.name || 'Atendente';

    // Check if this is a reply to another message (for WhatsApp quote/reply functionality)
    const inReplyTo = payload.content_attributes?.in_reply_to || payload.in_reply_to;
    const chatwootMessageId = payload.id; // Chatwoot message ID from webhook
    let quepasaReplyId: string | undefined;

    // DEBUG: Log all payload details to understand Chatwoot's reply structure
    logger.info({
      'payload.id': payload.id,
      'payload.content_attributes': payload.content_attributes,
      'payload.in_reply_to': payload.in_reply_to,
      'inReplyTo': inReplyTo,
      'conversationId': conversationId,
      'messageContent': messageContent,
    }, '🔍 DEBUG: Chatwoot webhook payload for reply detection');

    // Only process outgoing messages (agent responses)
    if (messageType !== 'outgoing') {
      logger.debug({ messageType }, 'Ignoring non-outgoing message');
      return res.json({ success: true, message: 'Not an outgoing message' });
    }

    // Log if this is a private note (but send it anyway with reply support)
    if (isPrivate) {
      logger.info({ conversationId }, '📝 Processing private note (will be sent to customer with reply support)');
    }

    // Validate required fields (accept messages with attachments but no text)
    if (!phoneNumber) {
      logger.warn({ payload }, 'Incomplete Chatwoot webhook payload - missing phone number');
      return res.status(400).json({ error: 'Invalid webhook payload - missing phone number' });
    }

    // Must have either text or attachment
    if (!messageContent && !hasAttachments) {
      logger.warn({ payload }, 'Incomplete Chatwoot webhook payload - no content or attachments');
      return res.status(400).json({ error: 'Invalid webhook payload - no content' });
    }

    if (!token) {
      logger.warn({ payload }, 'No token in Chatwoot webhook URL');
      return res.status(400).json({ error: 'Missing token in URL path' });
    }

    // Find QuepasaMapping by Quepasa token (MUCH faster than inbox ID lookup!)
    const quepasaMapping = await prisma.quepasaMapping.findFirst({
      where: {
        quepasaToken: token,
        active: true,
      },
      select: {
        id: true,
        quepasaToken: true,
        phoneNumber: true,
        name: true,
        chatwootBaseUrl: true,
        chatwootApiToken: true,
        chatwootAccountId: true,
        chatwootInboxId: true,
        showAgentName: true,
        active: true,
      },
    });

    if (!quepasaMapping) {
      logger.warn({ token }, 'No active Quepasa mapping found for token');
      return res.status(404).json({ error: 'Quepasa mapping not found for this token' });
    }

    // If showAgentName is enabled, prepend agent name to message content
    if (quepasaMapping.showAgentName && messageContent && agentName) {
      messageContent = `*${agentName}:*\n${messageContent}`;
      logger.info({ agentName, mappingId: quepasaMapping.id }, '👤 Prepended agent name to message');
    }

    // Build Chatwoot config from mapping
    const chatwootConfig = {
      baseUrl: quepasaMapping.chatwootBaseUrl,
      apiAccessToken: quepasaMapping.chatwootApiToken,
      accountId: quepasaMapping.chatwootAccountId,
      inboxId: quepasaMapping.chatwootInboxId,
    };

    // If this is a reply, lookup the Quepasa message ID from our database
    if (inReplyTo && conversationId) {
      try {
        const messageMapping = await prisma.messageMapping.findUnique({
          where: {
            chatwootMessageId: parseInt(inReplyTo),
          },
        });

        if (messageMapping) {
          quepasaReplyId = messageMapping.quepasaMessageId;
          logger.info({ inReplyTo, quepasaReplyId, conversationId }, '✅ Found Quepasa message ID from database for reply');
        } else {
          logger.warn({ inReplyTo, conversationId }, 'No message mapping found in database for this Chatwoot message');
        }
      } catch (error: any) {
        logger.warn({ error: error.message, inReplyTo, conversationId }, 'Failed to lookup message mapping from database');
      }
    }

    // Initialize Quepasa client
    await quepasaClient.initialize();

    // Format phone number for Quepasa
    // For groups: Keep full ID with @g.us suffix (required by Quepasa)
    // For individuals: Remove @s.whatsapp.net or @c.us suffix
    let isGroup = phoneNumber.includes('@g.us');
    let chatId = phoneNumber;

    if (isGroup) {
      // New format: Already has @g.us, keep it
      chatId = phoneNumber;
      logger.info({ phoneNumber, chatId, isGroup: true }, 'Detected group (has @g.us)');
    } else if (!phoneNumber.includes('@') && !phoneNumber.startsWith('+') && phoneNumber.length > 10) {
      // Old format: Numeric ID without suffix (from old contacts) - probably a group
      isGroup = true;
      chatId = `${phoneNumber}@g.us`;
      logger.info({ phoneNumber, chatId, isGroup: true }, 'Detected group (old format, added @g.us)');
    } else {
      // Individual contact: Remove WhatsApp suffixes
      chatId = phoneNumber.replace(/@.*$/, '');
      logger.info({ phoneNumber, chatId, isGroup: false }, 'Detected individual contact');
    }

    // Send message via Quepasa
    try {
      let result;

      if (hasAttachments) {
        // Send media message with first attachment
        const attachment = attachments[0];
        const mediaUrl = attachment.data_url || attachment.file_url;

        // Extract extension from URL to determine correct MIME type
        const urlExtension = mediaUrl.match(/\.([a-z0-9]+)(?:\?|$)/i)?.[1]?.toLowerCase();
        const mimeTypeMap: Record<string, string> = {
          'mp3': 'audio/mpeg',
          'ogg': 'audio/ogg',
          'oga': 'audio/ogg',  // OGG Audio (common extension)
          'opus': 'audio/opus',
          'wav': 'audio/wav',
          'mp4': 'video/mp4',
          'jpg': 'image/jpeg',
          'jpeg': 'image/jpeg',
          'png': 'image/png',
          'gif': 'image/gif',
          'pdf': 'application/pdf',
        };
        let mimeType = (urlExtension && mimeTypeMap[urlExtension]) || attachment.file_type || 'application/octet-stream';
        const filename = attachment.file_name || `file.${urlExtension || 'bin'}`;

        // DEBUG: Log detecção de áudio
        logger.info({
          mediaUrl,
          urlExtension,
          'attachment.file_type': attachment.file_type,
          'attachment.file_name': attachment.file_name,
          'attachment.data_url': attachment.data_url,
          'attachment.file_url': attachment.file_url,
          mimeType,
          'isAudio_fileType': attachment.file_type === 'audio',
          'isAudio_mimeType': mimeType.startsWith('audio'),
        }, '🎧 DEBUG: Detectando tipo de arquivo');

        // For audio files, download, convert to .oga, and send converted file URL
        // Chatwoot sends file_type as "audio" (without slash), so check both cases
        if (attachment.file_type === 'audio' || mimeType.startsWith('audio')) {
          logger.info({ mediaUrl, mimeType, urlExtension }, '🎧 Processing audio: download + convert to .oga + send');

          // Import required modules
          const axios = require('axios');
          const { convertAudioToPTT } = require('../utils/audio');
          const { config } = require('../config');

          // 1. Download audio from Chatwoot
          logger.info({ mediaUrl }, '📥 Downloading audio from Chatwoot');
          const audioResponse = await axios.get(mediaUrl, { responseType: 'arraybuffer' });
          const audioBuffer = Buffer.from(audioResponse.data);
          logger.info({ size: audioBuffer.length }, '✅ Audio downloaded');

          // 2. Convert to PTT format (.oga)
          logger.info('🔄 Converting audio to .oga PTT format');
          const { filePath: convertedFilePath, duration } = await convertAudioToPTT(audioBuffer);
          const filename = require('path').basename(convertedFilePath);
          logger.info({ filename, duration, filePath: convertedFilePath }, '✅ Audio converted to .oga');

          // 3. Build public URL for converted file
          const publicUrl = `${config.systemBaseUrl}/api/media/${filename}`;
          logger.info({ publicUrl }, '🌐 Public URL created for converted audio');

          // 4. Send converted file URL to Quepasa
          logger.info({ publicUrl }, '📤 Sending converted .oga URL to Quepasa');
          result = await quepasaClient.sendAudioByURL(quepasaMapping.quepasaToken, chatId, publicUrl);

          logger.info({ chatId, audioUrl: publicUrl, quepasaResponse: result }, '✅ Audio PTT sent by URL - converted .oga file');

          // 5. Schedule automatic deletion after 3 minutes
          const { unlink } = require('fs/promises');
          setTimeout(async () => {
            try {
              await unlink(convertedFilePath);
              logger.info({ filename, filePath: convertedFilePath }, '🗑️ Audio file deleted after 3 minutes');
            } catch (error: any) {
              logger.warn({ error: error.message, filename, filePath: convertedFilePath }, 'Failed to delete audio file (may already be deleted)');
            }
          }, 180000); // 3 minutes = 180000ms
          logger.info({ filename, filePath: convertedFilePath, deleteAfterMs: 180000 }, '⏰ Scheduled audio file deletion in 3 minutes')
        } else {
          // For non-audio files, use regular media message
          logger.info({ chatId, mediaUrl, mimeType, filename, urlExtension }, 'Sending media message via Quepasa');

          result = await quepasaClient.sendMediaMessage(quepasaMapping.quepasaToken, chatId, {
            url: mediaUrl,
            mime: mimeType,
            filename: filename,
            text: messageContent, // Caption for the media
          });
        }
      } else {
        // Send text message (with optional reply-to)
        result = await quepasaClient.sendTextMessage(quepasaMapping.quepasaToken, chatId, messageContent, quepasaReplyId);
      }

      logger.info({ chatId, conversationId, quepasaPhone: quepasaMapping.phoneNumber, success: result.success, hasMedia: hasAttachments }, 'Message sent via Quepasa to WhatsApp');

      // Store message mapping in database for reply functionality (if we have both IDs)
      const quepasaMessageId = result.message?.id;
      if (chatwootMessageId && quepasaMessageId && conversationId) {
        try {
          await prisma.messageMapping.create({
            data: {
              chatwootMessageId: chatwootMessageId,
              quepasaMessageId: quepasaMessageId,
              conversationId: conversationId,
            },
          });
          logger.info({ chatwootMessageId, quepasaMessageId, conversationId }, '💾 Stored Chatwoot→WhatsApp message mapping for reply functionality');
        } catch (error: any) {
          logger.warn({ error: error.message, chatwootMessageId, quepasaMessageId }, 'Failed to store Chatwoot→WhatsApp message mapping (non-critical)');
        }
      } else {
        logger.warn({ chatwootMessageId, quepasaMessageId, conversationId, hasQuepasaId: !!quepasaMessageId }, 'Missing IDs for message mapping - cannot store for reply functionality');
      }

      // Log outgoing event to Quepasa
      await prisma.eventLog.create({
        data: {
          direction: 'out',
          provider: 'quepasa',
          sessionId: quepasaMapping.phoneNumber,
          peer: chatId,
          payload: {
            conversationId,
            text: messageContent,
            hasAttachments,
            attachmentCount: attachments.length,
            quepasaResponse: JSON.parse(JSON.stringify(result)),
          },
        },
      });

      res.json({
        success: true,
        quepasaMessageId: result.message?.id,
      });
    } catch (error: any) {
      logger.error({ error: error.message, chatId, conversationId }, 'Failed to send message via Quepasa');

      // Log error
      await prisma.eventLog.create({
        data: {
          direction: 'out',
          provider: 'quepasa',
          sessionId: quepasaMapping.phoneNumber,
          peer: chatId,
          payload: {
            error: error.message,
            errorType: 'quepasa_send_failed',
            conversationId,
          },
        },
      });

      return res.status(500).json({ success: false, error: error.message });
    }
  } catch (error: any) {
    logger.error({ error }, 'Chatwoot webhook processing failed');
    next(error);
  }
});

/**
 * FALLBACK: Webhook endpoint without token (for backward compatibility)
 * This is the old method using inbox ID from payload
 * NEW integrations should use /webhooks/chatwoot/:token instead
 */
router.post('/webhooks/chatwoot', async (req, res, next) => {
  try {
    const payload = req.body;

    logger.info({ event: payload.event }, 'Received webhook from Chatwoot (legacy method without token)');

    // Extract inbox ID to find the corresponding Quepasa mapping
    const inboxId = payload.inbox?.id?.toString() || payload.conversation?.inbox_id?.toString();

    // Log incoming event
    await prisma.eventLog.create({
      data: {
        direction: 'in',
        provider: 'chatwoot',
        sessionId: inboxId || 'chatwoot',
        peer: payload.conversation?.meta?.sender?.phone_number || 'unknown',
        payload: payload,
      },
    });

    // We only care about message_created events with outgoing messages
    if (payload.event !== 'message_created') {
      logger.debug({ event: payload.event }, 'Ignoring non-message event');
      return res.json({ success: true, message: 'Event ignored' });
    }

    // Extract message data
    const messageType = payload.message_type || payload.content_attributes?.message_type;
    let messageContent = payload.content || '';
    const conversationId = payload.conversation?.id;
    // Use identifier as fallback for groups (phone_number is null for groups)
    const phoneNumber = payload.conversation?.meta?.sender?.phone_number || payload.conversation?.meta?.sender?.identifier;
    const isPrivate = payload.private || false;
    const attachments = payload.attachments || [];
    const hasAttachments = attachments.length > 0;

    // Extract agent name from Chatwoot payload (legacy)
    const agentName = payload.sender?.name || payload.sender?.available_name || payload.conversation?.meta?.assignee?.name || 'Atendente';

    // Check if this is a reply to another message (for WhatsApp quote/reply functionality)
    const inReplyTo = payload.content_attributes?.in_reply_to || payload.in_reply_to;
    const chatwootMessageId = payload.id; // Chatwoot message ID from webhook
    let quepasaReplyId: string | undefined;

    // DEBUG: Log all payload details to understand Chatwoot's reply structure
    logger.info({
      'payload.id': payload.id,
      'payload.content_attributes': payload.content_attributes,
      'payload.in_reply_to': payload.in_reply_to,
      'inReplyTo': inReplyTo,
      'conversationId': conversationId,
      'messageContent': messageContent,
    }, '🔍 DEBUG: Chatwoot webhook payload for reply detection');

    // Only process outgoing messages (agent responses)
    if (messageType !== 'outgoing') {
      logger.debug({ messageType }, 'Ignoring non-outgoing message');
      return res.json({ success: true, message: 'Not an outgoing message' });
    }

    // Log if this is a private note (but send it anyway with reply support)
    if (isPrivate) {
      logger.info({ conversationId }, '📝 Processing private note (will be sent to customer with reply support)');
    }

    // Validate required fields (accept messages with attachments but no text)
    if (!phoneNumber) {
      logger.warn({ payload }, 'Incomplete Chatwoot webhook payload - missing phone number');
      return res.status(400).json({ error: 'Invalid webhook payload - missing phone number' });
    }

    // Must have either text or attachment
    if (!messageContent && !hasAttachments) {
      logger.warn({ payload }, 'Incomplete Chatwoot webhook payload - no content or attachments');
      return res.status(400).json({ error: 'Invalid webhook payload - no content' });
    }

    if (!inboxId) {
      logger.warn({ payload }, 'No inbox ID in Chatwoot webhook');
      return res.status(400).json({ error: 'Missing inbox ID' });
    }

    // Find QuepasaMapping by Chatwoot inbox ID
    const quepasaMapping = await prisma.quepasaMapping.findFirst({
      where: {
        chatwootInboxId: inboxId,
        active: true,
      },
      select: {
        id: true,
        quepasaToken: true,
        phoneNumber: true,
        name: true,
        chatwootBaseUrl: true,
        chatwootApiToken: true,
        chatwootAccountId: true,
        chatwootInboxId: true,
        showAgentName: true,
        active: true,
      },
    });

    if (!quepasaMapping) {
      logger.warn({ inboxId }, 'No active Quepasa mapping found for Chatwoot inbox');
      return res.status(404).json({ error: 'Quepasa mapping not found for this inbox' });
    }

    // If showAgentName is enabled, prepend agent name to message content (legacy)
    if (quepasaMapping.showAgentName && messageContent && agentName) {
      messageContent = `*${agentName}:*\n${messageContent}`;
      logger.info({ agentName, mappingId: quepasaMapping.id }, '👤 [LEGACY] Prepended agent name to message');
    }

    // Build Chatwoot config from mapping
    const chatwootConfig = {
      baseUrl: quepasaMapping.chatwootBaseUrl,
      apiAccessToken: quepasaMapping.chatwootApiToken,
      accountId: quepasaMapping.chatwootAccountId,
      inboxId: quepasaMapping.chatwootInboxId,
    };

    // If this is a reply, lookup the Quepasa message ID from our database [LEGACY]
    if (inReplyTo && conversationId) {
      try {
        const messageMapping = await prisma.messageMapping.findUnique({
          where: {
            chatwootMessageId: parseInt(inReplyTo),
          },
        });

        if (messageMapping) {
          quepasaReplyId = messageMapping.quepasaMessageId;
          logger.info({ inReplyTo, quepasaReplyId, conversationId }, '✅ [LEGACY] Found Quepasa message ID from database for reply');
        } else {
          logger.warn({ inReplyTo, conversationId }, '[LEGACY] No message mapping found in database for this Chatwoot message');
        }
      } catch (error: any) {
        logger.warn({ error: error.message, inReplyTo, conversationId }, '[LEGACY] Failed to lookup message mapping from database');
      }
    }

    // Initialize Quepasa client
    await quepasaClient.initialize();

    // Format phone number for Quepasa
    // For groups: Keep full ID with @g.us suffix (required by Quepasa)
    // For individuals: Remove @s.whatsapp.net or @c.us suffix
    let isGroup = phoneNumber.includes('@g.us');
    let chatId = phoneNumber;

    if (isGroup) {
      // New format: Already has @g.us, keep it
      chatId = phoneNumber;
      logger.info({ phoneNumber, chatId, isGroup: true }, 'Detected group (has @g.us)');
    } else if (!phoneNumber.includes('@') && !phoneNumber.startsWith('+') && phoneNumber.length > 10) {
      // Old format: Numeric ID without suffix (from old contacts) - probably a group
      isGroup = true;
      chatId = `${phoneNumber}@g.us`;
      logger.info({ phoneNumber, chatId, isGroup: true }, 'Detected group (old format, added @g.us)');
    } else {
      // Individual contact: Remove WhatsApp suffixes
      chatId = phoneNumber.replace(/@.*$/, '');
      logger.info({ phoneNumber, chatId, isGroup: false }, 'Detected individual contact');
    }

    // Send message via Quepasa
    try {
      let result;

      if (hasAttachments) {
        // Send media message with first attachment
        const attachment = attachments[0];
        const mediaUrl = attachment.data_url || attachment.file_url;
        let mimeType = attachment.file_type || 'application/octet-stream';
        const filename = attachment.file_name || 'file';

        // DEBUG: Log detecção de áudio (legacy)
        logger.info({
          mediaUrl,
          'attachment.file_type': attachment.file_type,
          'attachment.file_name': attachment.file_name,
          'attachment.data_url': attachment.data_url,
          'attachment.file_url': attachment.file_url,
          mimeType,
          'isAudio_fileType': attachment.file_type === 'audio',
          'isAudio_mimeType': mimeType.startsWith('audio'),
        }, '🎧 DEBUG [LEGACY]: Detectando tipo de arquivo');

        // For audio files, download, convert to .oga, and send converted file URL
        // Chatwoot sends file_type as "audio" (without slash), so check both cases
        if (attachment.file_type === 'audio' || mimeType.startsWith('audio')) {
          logger.info({ mediaUrl, mimeType }, '🎧 [LEGACY] Processing audio: download + convert to .oga + send');

          // Import required modules
          const axios = require('axios');
          const { convertAudioToPTT } = require('../utils/audio');
          const { config } = require('../config');

          // 1. Download audio from Chatwoot
          logger.info({ mediaUrl }, '📥 [LEGACY] Downloading audio from Chatwoot');
          const audioResponse = await axios.get(mediaUrl, { responseType: 'arraybuffer' });
          const audioBuffer = Buffer.from(audioResponse.data);
          logger.info({ size: audioBuffer.length }, '✅ [LEGACY] Audio downloaded');

          // 2. Convert to PTT format (.oga)
          logger.info('🔄 [LEGACY] Converting audio to .oga PTT format');
          const { filePath: convertedFilePath, duration } = await convertAudioToPTT(audioBuffer);
          const filename = require('path').basename(convertedFilePath);
          logger.info({ filename, duration, filePath: convertedFilePath }, '✅ [LEGACY] Audio converted to .oga');

          // 3. Build public URL for converted file
          const publicUrl = `${config.systemBaseUrl}/api/media/${filename}`;
          logger.info({ publicUrl }, '🌐 [LEGACY] Public URL created for converted audio');

          // 4. Send converted file URL to Quepasa
          logger.info({ publicUrl }, '📤 [LEGACY] Sending converted .oga URL to Quepasa');
          result = await quepasaClient.sendAudioByURL(quepasaMapping.quepasaToken, chatId, publicUrl);

          logger.info({ chatId, audioUrl: publicUrl, quepasaResponse: result }, '✅ [LEGACY] Audio PTT sent by URL - converted .oga file');

          // 5. Schedule automatic deletion after 3 minutes
          const { unlink } = require('fs/promises');
          setTimeout(async () => {
            try {
              await unlink(convertedFilePath);
              logger.info({ filename, filePath: convertedFilePath }, '🗑️ [LEGACY] Audio file deleted after 3 minutes');
            } catch (error: any) {
              logger.warn({ error: error.message, filename, filePath: convertedFilePath }, '[LEGACY] Failed to delete audio file (may already be deleted)');
            }
          }, 180000); // 3 minutes = 180000ms
          logger.info({ filename, filePath: convertedFilePath, deleteAfterMs: 180000 }, '⏰ [LEGACY] Scheduled audio file deletion in 3 minutes')
        } else {
          // For non-audio files, use regular media message
          logger.info({ chatId, mediaUrl, mimeType, filename }, 'Sending media message via Quepasa (legacy)');

          result = await quepasaClient.sendMediaMessage(quepasaMapping.quepasaToken, chatId, {
            url: mediaUrl,
            mime: mimeType,
            filename: filename,
            text: messageContent, // Caption for the media
          });
        }
      } else {
        // Send text message (with optional reply-to)
        result = await quepasaClient.sendTextMessage(quepasaMapping.quepasaToken, chatId, messageContent, quepasaReplyId);
      }

      logger.info({ chatId, conversationId, quepasaPhone: quepasaMapping.phoneNumber, success: result.success, hasMedia: hasAttachments }, 'Message sent via Quepasa to WhatsApp');

      // Store message mapping in database for reply functionality (if we have both IDs)
      const quepasaMessageId = result.message?.id;
      if (chatwootMessageId && quepasaMessageId && conversationId) {
        try {
          await prisma.messageMapping.create({
            data: {
              chatwootMessageId: chatwootMessageId,
              quepasaMessageId: quepasaMessageId,
              conversationId: conversationId,
            },
          });
          logger.info({ chatwootMessageId, quepasaMessageId, conversationId }, '💾 Stored Chatwoot→WhatsApp message mapping for reply functionality');
        } catch (error: any) {
          logger.warn({ error: error.message, chatwootMessageId, quepasaMessageId }, 'Failed to store Chatwoot→WhatsApp message mapping (non-critical)');
        }
      } else {
        logger.warn({ chatwootMessageId, quepasaMessageId, conversationId, hasQuepasaId: !!quepasaMessageId }, 'Missing IDs for message mapping - cannot store for reply functionality');
      }

      // Log outgoing event to Quepasa
      await prisma.eventLog.create({
        data: {
          direction: 'out',
          provider: 'quepasa',
          sessionId: quepasaMapping.phoneNumber,
          peer: chatId,
          payload: {
            conversationId,
            text: messageContent,
            hasAttachments,
            attachmentCount: attachments.length,
            quepasaResponse: JSON.parse(JSON.stringify(result)),
          },
        },
      });

      res.json({
        success: true,
        quepasaMessageId: result.message?.id,
      });
    } catch (error: any) {
      logger.error({ error: error.message, chatId, conversationId }, 'Failed to send message via Quepasa');

      // Log error
      await prisma.eventLog.create({
        data: {
          direction: 'out',
          provider: 'quepasa',
          sessionId: quepasaMapping.phoneNumber,
          peer: chatId,
          payload: {
            error: error.message,
            errorType: 'quepasa_send_failed',
            conversationId,
          },
        },
      });

      return res.status(500).json({ success: false, error: error.message });
    }
  } catch (error: any) {
    logger.error({ error }, 'Chatwoot webhook processing failed (legacy method)');
    next(error);
  }
});

export default router;
