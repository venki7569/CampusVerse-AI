import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../utils/AppError';
import { logger } from '../utils/logger';
import { config } from '../config/env';
import type { ApiErrorResponse } from '../utils/apiResponse';

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
): void {
  const requestId = req.headers['x-request-id'] as string | undefined;

  const withRequestId = <T extends Record<string, unknown>>(body: T): T & { requestId?: string } =>
    requestId ? { ...body, requestId } : body;

  // ── Zod validation errors ──────────────────────────────────────────────
  if (err instanceof ZodError) {
    const details = err.issues.map((e) => ({
      field: e.path.join('.'),
      message: e.message,
      code: e.code,
    }));

    res.status(422).json(
      withRequestId({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Input validation failed',
          details,
        },
      } satisfies ApiErrorResponse),
    );
    return;
  }

  // ── Operational AppError ───────────────────────────────────────────────
  if (err instanceof AppError) {
    if (!err.isOperational) {
      logger.error('Non-operational AppError', { message: err.message, url: req.url, requestId });
    }

    res.status(err.statusCode).json(
      withRequestId({
        success: false,
        error: {
          code: err.code,
          message: err.message,
          details: err.details,
        },
      } satisfies ApiErrorResponse),
    );
    return;
  }

  // ── Prisma known errors ────────────────────────────────────────────────
  if (err !== null && typeof err === 'object' && 'code' in err) {
    const prismaErr = err as { code: string; meta?: Record<string, unknown> };
    if (prismaErr.code === 'P2002') {
      res.status(409).json({
        success: false,
        error: {
          code: 'CONFLICT',
          message: 'A record with this value already exists',
          details: [prismaErr.meta ?? {}],
        },
      } satisfies ApiErrorResponse);
      return;
    }
    if (prismaErr.code === 'P2025') {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Record not found',
          details: [],
        },
      } satisfies ApiErrorResponse);
      return;
    }
  }

  // ── Unknown / programmer error ─────────────────────────────────────────
  logger.error('Unhandled error', {
    err: err instanceof Error ? { message: err.message, stack: err.stack } : String(err),
    url: req.url,
    method: req.method,
    requestId,
  });

  res.status(500).json(
    withRequestId({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: config.isProduction
          ? 'An unexpected error occurred'
          : (err instanceof Error ? err.message : 'Unknown error'),
        details: [],
      },
    } satisfies ApiErrorResponse),
  );
}
