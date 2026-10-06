import { Request, Response, NextFunction } from 'express';
import { ZodError, ZodType } from 'zod';
import { AppError } from '../utils/AppError';

/** Express 5 re-parses query/params from the URL; replace the property so validated values persist. */
function setValidatedRequestRecord(
  req: Request,
  key: 'query' | 'params',
  value: Record<string, unknown>,
): void {
  Object.defineProperty(req, key, {
    value,
    writable: true,
    configurable: true,
    enumerable: true,
  });
}

/**
 * Middleware factory that validates req.body, req.params, and req.query
 * against a Zod schema. Passes a ZodError to next() on failure.
 *
 * Usage:
 *   router.post('/departments', validate(createDepartmentSchema), controller.create);
 */
export function validate(schema: ZodType) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = await schema.parseAsync({
        body: req.body,
        params: req.params,
        query: req.query,
      }) as { body?: unknown; params?: Record<string, string>; query?: Record<string, string> };

      if (parsed.body !== undefined) req.body = parsed.body;
      if (parsed.params !== undefined) {
        setValidatedRequestRecord(req, 'params', parsed.params);
      }
      if (parsed.query !== undefined) {
        setValidatedRequestRecord(req, 'query', parsed.query);
      }

      next();
    } catch (err) {
      if (err instanceof ZodError) {
        next(AppError.validationError('Input validation failed', err.issues));
        return;
      }
      next(err);
    }
  };
}

/**
 * Validates only req.body.
 */
export function validateBody(schema: ZodType) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      req.body = await schema.parseAsync(req.body);
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        next(AppError.validationError('Input validation failed', err.issues));
        return;
      }
      next(err);
    }
  };
}

/**
 * Validates only req.query.
 */
export function validateQuery(schema: ZodType) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = (await schema.parseAsync(req.query)) as Record<string, unknown>;
      setValidatedRequestRecord(req, 'query', parsed);
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        next(AppError.validationError('Invalid query parameters', err.issues));
        return;
      }
      next(err);
    }
  };
}
