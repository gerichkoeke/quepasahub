import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/client';
import { authMiddleware } from '../middlewares/auth.middleware';
import { logger } from '../utils/logger';
import { config } from '../config';
import { wahaClient } from '../clients/waha.client';
import { generateWebhookToken } from '../utils/token';

const router = Router();

const createMappingSchema = z.object({
  // Accept both camelCase (new) and snake_case (frontend) formats
  sessionId: z.string().optional(),
  session_name: z.string().optional(),
  typebotFlowId: z.string().optional(),
  typebot_id: z.string().optional(),
  typebotHost: z.string().optional(),
  typebot_url: z.string().optional(),
  typebotApiKey: z.string().optional(),
  restartKeyword: z.string().optional(),
  restart_keyword: z.string().optional(),
  sessionTimeout: z.number().int().positive().optional(),
  session_timeout: z.number().int().positive().optional(),
  pauseOnTakeover: z.boolean().optional(),
  pause_on_takeover: z.boolean().optional(),
  ownerResumeKeyword: z.string().optional(),
  owner_resume_keyword: z.string().optional(),
  enableGroups: z.boolean().optional(),
  enable_groups: z.boolean().optional(),
  active: z.boolean().optional(),
}).refine(
  (data) => data.sessionId || data.session_name,
  { message: 'sessionId or session_name is required' }
).refine(
  (data) => data.typebotFlowId || data.typebot_id,
  { message: 'typebotFlowId or typebot_id is required' }
);

const updateMappingSchema = z.object({
  typebotFlowId: z.string().optional(),
  typebotHost: z.string().url().optional(),
  typebotApiKey: z.string().optional(),
  restartKeyword: z.string().optional(),
  sessionTimeout: z.number().int().positive().optional(),
  pauseOnTakeover: z.boolean().optional(),
  ownerResumeKeyword: z.string().optional(),
  enableGroups: z.boolean().optional(),
  active: z.boolean().optional(),
});

// List all mappings
router.get('/mappings', authMiddleware, async (req, res, next) => {
  try {
    const { active } = req.query;

    const where: any = {};
    if (active === 'true') {
      where.active = true;
    } else if (active === 'false') {
      where.active = false;
    }

    const mappings = await prisma.sessionMapping.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    // Mask API keys and tokens, map to frontend format
    const sanitized = mappings.map((mapping) => ({
      id: mapping.id,
      session_name: mapping.sessionId,
      typebot_id: mapping.typebotFlowId,
      typebot_url: mapping.typebotHost,
      restart_keyword: mapping.restartKeyword,
      session_timeout: mapping.sessionTimeout,
      pause_on_takeover: mapping.pauseOnTakeover,
      owner_resume_keyword: mapping.ownerResumeKeyword,
      enable_groups: mapping.enableGroups,
      public_token: mapping.publicToken,
      public_url: mapping.publicToken ? `${process.env.PUBLIC_URL || 'https://astrahub.seudominio.com.br'}/connect/${mapping.publicToken}` : null,
      active: mapping.active,
      created_at: mapping.createdAt,
      updated_at: mapping.updatedAt,
    }));

    res.json(sanitized);
  } catch (error) {
    next(error);
  }
});

// Get mapping by ID
router.get('/mappings/:id', authMiddleware, async (req, res, next) => {
  try {
    const { id } = req.params;

    const mapping = await prisma.sessionMapping.findUnique({
      where: { id },
    });

    if (!mapping) {
      return res.status(404).json({ error: 'Mapping not found' });
    }

    res.json({
      id: mapping.id,
      session_name: mapping.sessionId,
      typebot_id: mapping.typebotFlowId,
      typebot_url: mapping.typebotHost,
      restart_keyword: mapping.restartKeyword,
      session_timeout: mapping.sessionTimeout,
      pause_on_takeover: mapping.pauseOnTakeover,
      owner_resume_keyword: mapping.ownerResumeKeyword,
      enable_groups: mapping.enableGroups,
      public_token: mapping.publicToken,
      public_url: mapping.publicToken ? `${process.env.PUBLIC_URL || 'https://astrahub.seudominio.com.br'}/connect/${mapping.publicToken}` : null,
      active: mapping.active,
      created_at: mapping.createdAt,
      updated_at: mapping.updatedAt,
    });
  } catch (error) {
    next(error);
  }
});

// Get mapping by session ID
router.get('/mappings/session/:sessionId', authMiddleware, async (req, res, next) => {
  try {
    const { sessionId } = req.params;

    const mappings = await prisma.sessionMapping.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'desc' },
    });

    const sanitized = mappings.map((mapping) => ({
      id: mapping.id,
      session_name: mapping.sessionId,
      typebot_id: mapping.typebotFlowId,
      typebot_url: mapping.typebotHost,
      restart_keyword: mapping.restartKeyword,
      session_timeout: mapping.sessionTimeout,
      pause_on_takeover: mapping.pauseOnTakeover,
      owner_resume_keyword: mapping.ownerResumeKeyword,
      enable_groups: mapping.enableGroups,
      public_token: mapping.publicToken,
      public_url: mapping.publicToken ? `${process.env.PUBLIC_URL || 'https://astrahub.seudominio.com.br'}/connect/${mapping.publicToken}` : null,
      active: mapping.active,
      created_at: mapping.createdAt,
      updated_at: mapping.updatedAt,
    }));

    res.json(sanitized);
  } catch (error) {
    next(error);
  }
});

// Create connection-only mapping (no typebot required) - MUST be before POST /mappings
router.post('/mappings/connection-only', authMiddleware, async (req, res, next) => {
  try {
    const { session_name } = req.body;

    if (!session_name) {
      return res.status(400).json({ error: 'session_name is required' });
    }

    // Check if a connection-only mapping already exists (mappings without typebot)
    const existingConnectionMapping = await prisma.sessionMapping.findFirst({
      where: {
        sessionId: session_name,
        typebotFlowId: 'connection-only',
        active: true
      }
    });

    if (existingConnectionMapping) {
      // Return existing mapping
      return res.json({
        id: existingConnectionMapping.id,
        session_name: existingConnectionMapping.sessionId,
        typebot_id: existingConnectionMapping.typebotFlowId,
        typebot_url: existingConnectionMapping.typebotHost,
        public_token: existingConnectionMapping.publicToken,
        public_url: existingConnectionMapping.publicToken ? `${process.env.PUBLIC_URL || 'https://integrador.seudominio.com.br'}/connect/${existingConnectionMapping.publicToken}` : null,
        active: existingConnectionMapping.active,
        created_at: existingConnectionMapping.createdAt,
        updated_at: existingConnectionMapping.updatedAt,
      });
    }

    // Generate tokens
    const webhookToken = generateWebhookToken();
    const publicToken = generateWebhookToken();

    // Create connection-only mapping (no typebot integration)
    const mapping = await prisma.sessionMapping.create({
      data: {
        sessionId: session_name,
        typebotFlowId: 'connection-only',
        typebotHost: 'connection-only',
        typebotApiKey: null,
        webhookToken,
        publicToken,
        restartKeyword: null,
        sessionTimeout: null,
        pauseOnTakeover: true,
        ownerResumeKeyword: null,
        active: true,
      },
    });

    logger.info({ sessionId: session_name, mappingId: mapping.id }, 'Connection-only mapping created');

    res.status(201).json({
      id: mapping.id,
      session_name: mapping.sessionId,
      typebot_id: mapping.typebotFlowId,
      typebot_url: mapping.typebotHost,
      public_token: mapping.publicToken,
      public_url: mapping.publicToken ? `${process.env.PUBLIC_URL || 'https://astrahub.seudominio.com.br'}/connect/${mapping.publicToken}` : null,
      active: mapping.active,
      created_at: mapping.createdAt,
      updated_at: mapping.updatedAt,
    });
  } catch (error) {
    next(error);
  }
});

// Create or update mapping
router.post('/mappings', authMiddleware, async (req, res, next) => {
  try {
    const validatedData = createMappingSchema.parse(req.body);

    // Normalize field names (support both camelCase and snake_case)
    const sessionId = validatedData.sessionId || validatedData.session_name || '';
    const typebotFlowId = validatedData.typebotFlowId || validatedData.typebot_id || '';
    const typebotHost = validatedData.typebotHost || validatedData.typebot_url || config.typebot.host;
    const typebotApiKey = validatedData.typebotApiKey || null;
    const restartKeyword = validatedData.restartKeyword || validatedData.restart_keyword || null;
    const sessionTimeout = validatedData.sessionTimeout || validatedData.session_timeout || null;
    const pauseOnTakeover = validatedData.pauseOnTakeover !== undefined ? validatedData.pauseOnTakeover : (validatedData.pause_on_takeover !== undefined ? validatedData.pause_on_takeover : true);
    const ownerResumeKeyword = validatedData.ownerResumeKeyword || validatedData.owner_resume_keyword || null;
    const enableGroups = validatedData.enableGroups !== undefined ? validatedData.enableGroups : (validatedData.enable_groups !== undefined ? validatedData.enable_groups : false);
    const active = validatedData.active !== undefined ? validatedData.active : true;

    // Deactivate existing mappings for this session
    await prisma.sessionMapping.updateMany({
      where: { sessionId, active: true },
      data: { active: false },
    });

    // Generate webhook token and public token
    const webhookToken = generateWebhookToken();
    const publicToken = generateWebhookToken();

    // Create new mapping
    const mapping = await prisma.sessionMapping.create({
      data: {
        sessionId,
        typebotFlowId,
        typebotHost,
        typebotApiKey,
        webhookToken,
        publicToken,
        restartKeyword,
        sessionTimeout,
        pauseOnTakeover,
        ownerResumeKeyword,
        enableGroups,
        active,
      },
    });

    // Configure webhook in Waha
    const webhookUrl = `${process.env.PUBLIC_URL || 'https://astrahub.seudominio.com.br'}/api/webhooks/waha/${sessionId}/${webhookToken}`;

    try {
      await wahaClient.initialize();
      await wahaClient.updateWebhook(sessionId, webhookUrl);
      logger.info({ sessionId, webhookUrl }, 'Configured webhook in Waha');
    } catch (error: any) {
      logger.error({
        error: error.message,
        sessionId,
        webhookUrl
      }, 'Failed to configure webhook in Waha (continuing anyway)');
    }

    logger.info({ sessionId, mappingId: mapping.id, webhookUrl }, 'Session mapping created');

    res.status(201).json({
      id: mapping.id,
      session_name: mapping.sessionId,
      typebot_id: mapping.typebotFlowId,
      typebot_url: mapping.typebotHost,
      restart_keyword: mapping.restartKeyword,
      session_timeout: mapping.sessionTimeout,
      pause_on_takeover: mapping.pauseOnTakeover,
      owner_resume_keyword: mapping.ownerResumeKeyword,
      enable_groups: mapping.enableGroups,
      active: mapping.active,
      created_at: mapping.createdAt,
      updated_at: mapping.updatedAt,
      webhookUrl,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid mapping data', details: error.errors });
    }
    next(error);
  }
});

// Update mapping
router.patch('/mappings/:id', authMiddleware, async (req, res, next) => {
  try {
    const { id } = req.params;
    const updates = updateMappingSchema.parse(req.body);

    const existing = await prisma.sessionMapping.findUnique({
      where: { id },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Mapping not found' });
    }

    const mapping = await prisma.sessionMapping.update({
      where: { id },
      data: updates,
    });

    logger.info({ mappingId: id }, 'Session mapping updated');

    res.json({
      id: mapping.id,
      session_name: mapping.sessionId,
      typebot_id: mapping.typebotFlowId,
      typebot_url: mapping.typebotHost,
      restart_keyword: mapping.restartKeyword,
      session_timeout: mapping.sessionTimeout,
      pause_on_takeover: mapping.pauseOnTakeover,
      owner_resume_keyword: mapping.ownerResumeKeyword,
      enable_groups: mapping.enableGroups,
      public_token: mapping.publicToken,
      public_url: mapping.publicToken ? `${process.env.PUBLIC_URL || 'https://astrahub.seudominio.com.br'}/connect/${mapping.publicToken}` : null,
      active: mapping.active,
      created_at: mapping.createdAt,
      updated_at: mapping.updatedAt,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid update data', details: error.errors });
    }
    next(error);
  }
});

// Delete mapping
router.delete('/mappings/:id', authMiddleware, async (req, res, next) => {
  try {
    const { id } = req.params;

    await prisma.sessionMapping.delete({
      where: { id },
    });

    logger.info({ mappingId: id }, 'Session mapping deleted');

    res.json({ success: true, message: 'Mapping deleted successfully' });
  } catch (error) {
    next(error);
  }
});

export default router;
