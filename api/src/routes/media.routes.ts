import { Router } from 'express';
import { existsSync } from 'fs';
import * as path from 'path';
import { logger } from '../utils/logger';

const router = Router();

/**
 * Serve converted audio files
 * Public route - no auth required
 */
router.get('/media/:filename', (req, res) => {
  try {
    const { filename } = req.params;

    // Security: Only allow .oga files and validate filename
    if (!filename.endsWith('.oga') || filename.includes('..') || filename.includes('/')) {
      logger.warn({ filename }, 'Invalid media file request');
      return res.status(400).json({ error: 'Invalid filename' });
    }

    const audioDir = process.env.AUDIO_CACHE_DIR || '/tmp';
    const filePath = path.join(audioDir, filename);

    // Check if file exists
    if (!existsSync(filePath)) {
      logger.warn({ filename, filePath }, 'Media file not found');
      return res.status(404).json({ error: 'File not found' });
    }

    logger.info({ filename }, 'Serving media file');

    // Serve the file with correct headers
    res.setHeader('Content-Type', 'audio/ogg');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.sendFile(filePath);
  } catch (error: any) {
    logger.error({ error: error.message }, 'Failed to serve media file');
    res.status(500).json({ error: 'Failed to serve file' });
  }
});

export default router;
