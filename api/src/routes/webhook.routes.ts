import { Router } from 'express';
import { prisma } from '../db/client';
import { wahaClient } from '../clients/waha.client';
import { typebotClient, ProcessedMessage } from '../clients/typebot.client';
import { logger } from '../utils/logger';

const router = Router();

// Webhook endpoint with token authentication
router.post('/webhooks/waha/:sessionId/:token', async (req, res, next) => {
  try {
    const { sessionId, token } = req.params;
    const payload = req.body;

    logger.info({ sessionId, hasToken: !!token }, 'Received webhook from Waha with token');

    // 1. Validate token
    const mapping = await prisma.sessionMapping.findFirst({
      where: {
        sessionId,
        webhookToken: token,
        active: true,
      },
    });

    if (!mapping) {
      logger.warn({ sessionId, token }, 'Invalid token or inactive mapping');
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // 2. Extract message data
    // Support both formats: direct payload and nested payload.payload
    const messageData = payload.payload || payload;
    const messageId = messageData.id || payload.id || payload.messageId;
    const fromMe = messageData.fromMe || payload.fromMe || false;
    const source = messageData.source || payload.source;

    // When fromMe=true (owner sent message), 'from' is actually the customer (recipient)
    // When fromMe=false (customer sent message), 'from' is the customer (sender)
    // So 'from' is always the customer number
    const phone = messageData.from || payload.from || payload.chatId;

    const text = messageData.body || messageData.text || payload.body || payload.text || payload.message?.text || '';

    if (!phone || !text) {
      logger.warn({ payload, messageData, fromMe, source }, 'Incomplete webhook payload');
      return res.status(400).json({ error: 'Invalid webhook payload' });
    }

    // Check if this is a group message
    const isGroup = phone.endsWith('@g.us');

    // If this is a group message and groups are not enabled, ignore it
    if (isGroup && !mapping.enableGroups) {
      logger.info({ sessionId, phone, isGroup, enableGroups: mapping.enableGroups }, 'Group message received but groups are disabled, ignoring');
      return res.json({ success: true, message: 'Groups are not enabled for this mapping' });
    }

    // Log incoming event
    await prisma.eventLog.create({
      data: {
        direction: 'in',
        provider: 'waha',
        sessionId,
        peer: phone,
        payload: payload,
      },
    });

    // 3. Check idempotency
    let existingSession = await prisma.typebotSession.findUnique({
      where: {
        sessionId_phone: {
          sessionId,
          phone,
        },
      },
    });

    if (existingSession?.lastMessageId === messageId && messageId) {
      logger.info({ sessionId, phone, messageId }, 'Duplicate message detected, skipping');
      return res.json({ success: true, cached: true });
    }

    // Handle owner intervention (fromMe messages from app, not api)
    // source: "app" = manual message from owner
    // source: "api" = message sent by bot via API
    if (fromMe && source === 'app') {
      logger.info({ sessionId, phone, hasSession: !!existingSession, fromMe: true, source, pauseOnTakeover: mapping.pauseOnTakeover, ownerResumeKeyword: mapping.ownerResumeKeyword }, 'Owner sent manual message');

      // Check if this is the owner resume keyword
      const isOwnerResumeKeyword = mapping.ownerResumeKeyword &&
        text.toLowerCase().trim() === mapping.ownerResumeKeyword.toLowerCase().trim();

      if (isOwnerResumeKeyword && existingSession) {
        logger.info({ sessionId, phone, keyword: text }, 'Owner resume keyword detected, deleting customer session');

        // Delete the session so when customer sends next message, it starts fresh
        await prisma.typebotSession.delete({
          where: { id: existingSession.id },
        });

        await prisma.eventLog.create({
          data: {
            direction: 'in',
            provider: 'waha',
            sessionId,
            peer: phone,
            payload: { action: 'owner_resumed_bot', fromMe: true, source, keyword: text },
          },
        });

        logger.info({ sessionId, phone }, 'Session deleted, bot will start fresh when customer sends next message');

        // Return immediately - don't send any messages
        // When customer sends next message, it will create a new session and start from beginning
        return res.json({ success: true, message: 'Bot resumed, session reset' });
      } else if (mapping.pauseOnTakeover && existingSession && !isOwnerResumeKeyword) {
        // Only pause if pauseOnTakeover is enabled and this is NOT the resume keyword
        logger.info({ sessionId, phone }, 'Owner sent message, pausing bot for this customer');

        await prisma.typebotSession.update({
          where: { id: existingSession.id },
          data: { botPaused: true },
        });

        await prisma.eventLog.create({
          data: {
            direction: 'in',
            provider: 'waha',
            sessionId,
            peer: phone,
            payload: { action: 'bot_paused', fromMe: true, source, text },
          },
        });

        return res.json({ success: true, message: 'Bot paused for customer' });
      } else if (!mapping.pauseOnTakeover && !isOwnerResumeKeyword) {
        logger.info({ sessionId, phone }, 'Owner sent message but pauseOnTakeover is disabled, ignoring');
        // Don't pause, just ignore this owner message
        return res.json({ success: true, message: 'Owner message ignored (pause disabled)' });
      } else if (!existingSession && !isOwnerResumeKeyword) {
        logger.info({ sessionId, phone }, 'Owner sent message but no active session exists for this customer');
        return res.json({ success: true, message: 'No active session' });
      }
    }

    // Ignore messages sent by bot via API (fromMe=true, source=api)
    if (fromMe && source === 'api') {
      logger.debug({ sessionId, phone, source }, 'Ignoring bot message sent via API');
      return res.json({ success: true, message: 'Bot message ignored' });
    }

    // Check if bot is paused for this session
    if (existingSession?.botPaused) {
      // Check for resume keyword (case insensitive)
      const resumeKeywords = ['bot', 'retomar', 'continuar', 'resume'];
      const shouldResume = resumeKeywords.some(keyword =>
        text.toLowerCase().trim() === keyword.toLowerCase()
      );

      if (shouldResume) {
        logger.info({ sessionId, phone, keyword: text }, 'Resume keyword detected, resuming bot');

        await prisma.typebotSession.update({
          where: { id: existingSession.id },
          data: { botPaused: false },
        });

        await prisma.eventLog.create({
          data: {
            direction: 'in',
            provider: 'waha',
            sessionId,
            peer: phone,
            payload: { action: 'bot_resumed', keyword: text },
          },
        });

        // Continue processing this message as normal (will restart conversation below)
      } else {
        logger.info({ sessionId, phone }, 'Bot is paused for this customer, skipping');

        await prisma.eventLog.create({
          data: {
            direction: 'in',
            provider: 'waha',
            sessionId,
            peer: phone,
            payload: { action: 'bot_paused_skip', botPaused: true, text },
          },
        });

        return res.json({ success: true, message: 'Bot paused, message ignored' });
      }
    }

    // Initialize clients
    await wahaClient.initialize();
    await typebotClient.initialize();

    // Check if message matches restart keyword
    const shouldRestart = mapping.restartKeyword &&
      text.toLowerCase().trim() === mapping.restartKeyword.toLowerCase().trim();

    if (shouldRestart && existingSession) {
      logger.info({ sessionId, phone, keyword: text }, 'Restart keyword detected, deleting session');

      // Delete existing session to force restart
      await prisma.typebotSession.delete({
        where: { id: existingSession.id },
      });

      // Set to null so it creates a new session below
      existingSession = null;
    }

    // Check if session expired based on sessionTimeout
    if (existingSession && mapping.sessionTimeout) {
      const sessionAgeMinutes = (Date.now() - existingSession.updatedAt.getTime()) / (1000 * 60);

      if (sessionAgeMinutes > mapping.sessionTimeout) {
        logger.info({
          sessionId,
          phone,
          sessionAgeMinutes: Math.floor(sessionAgeMinutes),
          timeoutMinutes: mapping.sessionTimeout
        }, 'Session expired due to timeout, deleting session');

        // Delete expired session to force restart
        await prisma.typebotSession.delete({
          where: { id: existingSession.id },
        });

        // Set to null so it creates a new session below
        existingSession = null;
      }
    }

    let messages: ProcessedMessage[];
    let typebotSessionId: string;
    let clientSideActions: any[] | undefined;

    try {
      if (!existingSession) {
        // First message - startChat
        logger.info({ sessionId, phone, flowId: mapping.typebotFlowId }, 'Starting new Typebot chat');

        const result = await typebotClient.startChat(
          mapping.typebotFlowId,
          phone,
          text,
          mapping.typebotHost,
          mapping.typebotApiKey || undefined
        );

        typebotSessionId = result.sessionId;
        messages = result.messages;
        clientSideActions = result.clientSideActions;

        // Create TypebotSession
        await prisma.typebotSession.create({
          data: {
            sessionId,
            phone,
            typebotSessionId,
            lastMessageId: messageId || '',
          },
        });

        logger.info({ sessionId, phone, typebotSessionId }, 'Created new TypebotSession');
      } else {
        // Continue conversation - continueChat
        logger.info({ sessionId, phone, typebotSessionId: existingSession.typebotSessionId }, 'Continuing Typebot chat');

        try {
          const result = await typebotClient.continueChat(
            existingSession.typebotSessionId,
            text,
            mapping.typebotHost,
            mapping.typebotApiKey || undefined
          );

          typebotSessionId = existingSession.typebotSessionId;
          messages = result.messages;
          clientSideActions = result.clientSideActions;

          // Update lastMessageId
          await prisma.typebotSession.update({
            where: { id: existingSession.id },
            data: { lastMessageId: messageId || '' },
          });
        } catch (continueError: any) {
          // If session expired (404), delete old session and start new one
          if (continueError.message.includes('404')) {
            logger.warn({ sessionId, phone, oldSessionId: existingSession.typebotSessionId }, 'Typebot session expired, starting new chat');

            // Delete expired session
            await prisma.typebotSession.delete({
              where: { id: existingSession.id },
            });

            // Start new chat
            const result = await typebotClient.startChat(
              mapping.typebotFlowId,
              phone,
              text,
              mapping.typebotHost,
              mapping.typebotApiKey || undefined
            );

            typebotSessionId = result.sessionId;
            messages = result.messages;
            clientSideActions = result.clientSideActions;

            // Create new TypebotSession
            await prisma.typebotSession.create({
              data: {
                sessionId,
                phone,
                typebotSessionId,
                lastMessageId: messageId || '',
              },
            });

            logger.info({ sessionId, phone, newSessionId: typebotSessionId }, 'Created new TypebotSession after expiration');
          } else {
            // Re-throw other errors
            throw continueError;
          }
        }
      }

      // Log Typebot interaction
      await prisma.eventLog.create({
        data: {
          direction: 'out',
          provider: 'typebot',
          sessionId,
          peer: phone,
          payload: {
            typebotSessionId,
            messages: messages.map(m => ({ type: m.type, content: m.content, caption: m.caption })),
          },
        },
      });

      // Helper function to add delay
      const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

      // Build a map of message IDs to wait times from clientSideActions
      const waitMap = new Map<string, number>();
      if (clientSideActions) {
        for (const action of clientSideActions) {
          if (action.type === 'wait' && action.lastBubbleBlockId && action.wait?.secondsToWaitFor) {
            waitMap.set(action.lastBubbleBlockId, action.wait.secondsToWaitFor * 1000);
          }
        }
      }

      // Send responses back via Waha
      for (const message of messages) {
        if (message.type === 'text') {
          await wahaClient.sendMessage(sessionId, phone, message.content);

          await prisma.eventLog.create({
            data: {
              direction: 'out',
              provider: 'waha',
              sessionId,
              peer: phone,
              payload: { type: 'text', text: message.content },
            },
          });
        } else if (message.type === 'image') {
          await wahaClient.sendImage(sessionId, phone, message.content, message.caption);

          await prisma.eventLog.create({
            data: {
              direction: 'out',
              provider: 'waha',
              sessionId,
              peer: phone,
              payload: { type: 'image', url: message.content, caption: message.caption },
            },
          });
        } else if (message.type === 'video') {
          await wahaClient.sendVideo(sessionId, phone, message.content, message.caption);

          await prisma.eventLog.create({
            data: {
              direction: 'out',
              provider: 'waha',
              sessionId,
              peer: phone,
              payload: { type: 'video', url: message.content, caption: message.caption },
            },
          });
        } else if (message.type === 'audio') {
          await wahaClient.sendAudio(sessionId, phone, message.content);

          await prisma.eventLog.create({
            data: {
              direction: 'out',
              provider: 'waha',
              sessionId,
              peer: phone,
              payload: { type: 'audio', url: message.content },
            },
          });
        }

        // Check if there's a wait action after this message
        const waitTime = waitMap.get(message.id);
        if (waitTime) {
          logger.info({ messageId: message.id, waitTime }, 'Waiting before next message');
          await delay(waitTime);
        }
      }

      logger.info({ sessionId, phone, messagesSent: messages.length }, 'Messages sent via Waha');

      res.json({ success: true, messagesSent: messages.length });
    } catch (error: any) {
      logger.error({ error, sessionId, phone }, 'Typebot or Waha processing failed');

      // Log error but don't send any message to user
      await prisma.eventLog.create({
        data: {
          direction: 'out',
          provider: 'waha',
          sessionId,
          peer: phone,
          payload: {
            error: error.message,
            errorType: 'processing_failed',
            noMessageSent: true,
          },
        },
      });

      return res.status(200).json({ success: false, error: error.message, fallbackSent: false });
    }
  } catch (error) {
    logger.error({ error }, 'Webhook processing failed');
    next(error);
  }
});

// Webhook endpoint for Waha messages
router.post('/webhooks/waha', async (req, res, next) => {
  try {
    const payload = req.body;

    logger.info({ payload }, 'Received webhook from Waha');

    // Log incoming event
    await prisma.eventLog.create({
      data: {
        direction: 'in',
        provider: 'waha',
        sessionId: payload.session || payload.sessionId,
        peer: payload.from || payload.chatId,
        payload: payload,
      },
    });

    // Extract message data
    const sessionId = payload.session || payload.sessionId;
    const from = payload.from || payload.chatId;
    const messageText = payload.body || payload.text || payload.message?.text || '';

    if (!sessionId || !from || !messageText) {
      logger.warn({ payload }, 'Incomplete webhook payload');
      return res.status(400).json({ error: 'Invalid webhook payload' });
    }

    // Find active mapping for this session
    const mapping = await prisma.sessionMapping.findFirst({
      where: {
        sessionId,
        active: true,
      },
    });

    if (!mapping) {
      logger.warn({ sessionId }, 'No active mapping found for session');
      return res.status(200).json({ message: 'No mapping configured' });
    }

    // Initialize clients
    await wahaClient.initialize();
    await typebotClient.initialize();

    // Send message to Typebot
    const userId = from.replace(/\D/g, ''); // Clean phone number for userId

    const typebotResponse = await typebotClient.sendUserMessage(
      mapping.typebotFlowId,
      userId,
      messageText,
      undefined,
      mapping.typebotApiKey || undefined
    );

    logger.info(
      { sessionId, userId, responseCount: typebotResponse.messages.length },
      'Received response from Typebot'
    );

    // Log Typebot interaction
    await prisma.eventLog.create({
      data: {
        direction: 'out',
        provider: 'typebot',
        sessionId,
        peer: userId,
        payload: {
          flowId: mapping.typebotFlowId,
          messages: typebotResponse.messages.map(m => ({ type: m.type, content: m.content, caption: m.caption })),
        },
      },
    });

    // Send responses back via Waha
    for (const message of typebotResponse.messages) {
      if (message.type === 'text') {
        await wahaClient.sendMessage(sessionId, from, message.content);

        await prisma.eventLog.create({
          data: {
            direction: 'out',
            provider: 'waha',
            sessionId,
            peer: from,
            payload: { type: 'text', text: message.content },
          },
        });
      } else if (message.type === 'image') {
        await wahaClient.sendImage(sessionId, from, message.content, message.caption);

        await prisma.eventLog.create({
          data: {
            direction: 'out',
            provider: 'waha',
            sessionId,
            peer: from,
            payload: { type: 'image', url: message.content, caption: message.caption },
          },
        });
      } else if (message.type === 'video') {
        await wahaClient.sendVideo(sessionId, from, message.content, message.caption);

        await prisma.eventLog.create({
          data: {
            direction: 'out',
            provider: 'waha',
            sessionId,
            peer: from,
            payload: { type: 'video', url: message.content, caption: message.caption },
          },
        });
      }
    }

    logger.info({ sessionId, from, messagesSent: typebotResponse.messages.length }, 'Messages sent via Waha');

    res.json({ success: true, messagesSent: typebotResponse.messages.length });
  } catch (error) {
    logger.error({ error }, 'Webhook processing failed');
    next(error);
  }
});

export default router;
