import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/AppError';

/**
 * Catches 404s for any route not matched by the router.
 * Must be registered AFTER all route handlers.
 */
export function notFoundHandler(req: Request, _res: Response, next: NextFunction): void {
  next(AppError.notFound(`Route ${req.method} ${req.originalUrl}`));
}
