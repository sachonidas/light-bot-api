import { Request, Response, NextFunction } from 'express';
import { logger } from '../lib/logger';

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction) {
  logger.error(err);
  res.status(500).json({ error: 'Error interno del servidor' });
}
