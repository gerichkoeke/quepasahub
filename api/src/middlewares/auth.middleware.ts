import { Request, Response, NextFunction } from 'express';
import { config } from '../config';
import { logger } from '../utils/logger';

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    logger.warn({ path: req.path }, 'Unauthorized access attempt - missing token');
    return res.status(401).json({ error: 'Unauthorized - Bearer token required' });
  }

  const token = authHeader.substring(7);

  if (token !== config.adminToken) {
    logger.warn({ path: req.path }, 'Unauthorized access attempt - invalid token');
    return res.status(401).json({ error: 'Unauthorized - invalid token' });
  }

  next();
}
