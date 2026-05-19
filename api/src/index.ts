import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import { config } from './config';
import { logger } from './utils/logger';
import { connectDatabase, disconnectDatabase } from './db/client';
import { errorMiddleware } from './middlewares/error.middleware';

// Import routes
import healthRoutes from './routes/health.routes';
import settingsRoutes from './routes/settings.routes';
import mappingsRoutes from './routes/mappings.routes';
import quepasaRoutes from './routes/quepasa.routes';
import quepasaWebhookRoutes from './routes/quepasa-webhook.routes';
import quepasaMappingsRoutes from './routes/quepasa-mappings.routes';
import metricsRoutes from './routes/metrics.routes';
import logsRoutes from './routes/logs.routes';
import publicRoutes from './routes/public.routes';
import mediaRoutes from './routes/media.routes';

const app = express();

// Middleware
app.use(helmet());
app.use(
  cors({
    origin: config.cors.origin,
    credentials: true,
  })
);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
app.use(
  pinoHttp({
    logger,
    autoLogging: {
      ignore: (req) => req.url === '/health',
    },
  })
);

// Routes
// Note: Traefik strips /api prefix, so routes are registered without it
app.use('/', healthRoutes);
app.use('/', publicRoutes); // Public routes without auth
app.use('/', mediaRoutes); // Serve converted audio files (public)
app.use('/', settingsRoutes);
app.use('/', mappingsRoutes);
app.use('/', quepasaRoutes); // Quepasa connection and QR code routes
app.use('/', quepasaWebhookRoutes); // Quepasa-Chatwoot integration webhooks
app.use('/', quepasaMappingsRoutes); // Quepasa mappings CRUD
app.use('/', metricsRoutes);
app.use('/', logsRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use(errorMiddleware);

// Graceful shutdown
const shutdown = async () => {
  logger.info('Shutting down gracefully...');

  await disconnectDatabase();

  process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Start server
async function start() {
  try {
    await connectDatabase();

    app.listen(config.port, () => {
      logger.info(
        {
          port: config.port,
          env: config.env,
        },
        'Server started successfully'
      );
    });
  } catch (error) {
    logger.error({ error }, 'Failed to start server');
    process.exit(1);
  }
}

start();

export default app;
