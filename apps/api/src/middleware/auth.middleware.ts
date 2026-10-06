import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/env';
import { AppError } from '../utils/AppError';
import { createLogger } from '../utils/logger';
import type { JwtPayload, RoleName } from '../types';
import { getAuthorizationService } from '../modules/admin/authorization.service';
import { isUserActive } from '../services/user-status.service';

const log = createLogger('Auth');

/**
 * Authenticates requests using Bearer JWT token in Authorization header
 * or httpOnly accessToken cookie.
 */
export async function authenticate(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  let token: string | undefined;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  } else if (req.cookies && req.cookies['accessToken']) {
    token = req.cookies['accessToken'] as string;
  }

  if (!token) {
    next(AppError.unauthorized('Authentication token is missing'));
    return;
  }

  try {
    const decoded = jwt.verify(token, config.jwt.accessSecret) as JwtPayload;
    const active = await isUserActive(decoded.sub);
    if (active === false) {
      log.warn('Deactivated user attempted access', { userId: decoded.sub, path: req.path });
      next(AppError.forbidden('Account has been deactivated'));
      return;
    }
    if (active === null) {
      next(AppError.serviceUnavailable('Unable to verify account status'));
      return;
    }
    req.user = decoded;
    next();
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      next(AppError.unauthorized('Access token has expired'));
      return;
    }
    if (err instanceof AppError) {
      next(err);
      return;
    }
    next(AppError.unauthorized('Invalid access token'));
  }
}

/**
 * RBAC authorization middleware — checks if the authenticated user has at least
 * one of the required roles.
 * MUST be used AFTER `authenticate` middleware.
 */
export function requireRole(...allowedRoles: RoleName[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(AppError.unauthorized('Authentication required'));
      return;
    }

    const userRoles = req.user.roles || [];
    const hasRole = allowedRoles.some((role) => userRoles.includes(role));

    if (!hasRole) {
      next(
        AppError.forbidden(
          `Access denied. Requires one of roles: ${allowedRoles.join(', ')}`,
        ),
      );
      return;
    }

    next();
  };
}

/**
 * Permission authorization — Role → RolePermission → Permission.
 * Loaded once per request and cached in-process by role. JWT is not the authority.
 * MUST be used AFTER `authenticate` middleware.
 */
export function requirePermission(...required: string[]) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        next(AppError.unauthorized('Authentication required'));
        return;
      }

      const authz = getAuthorizationService();
      const codes = await authz.getPermissionCodes(req.user.roles);
      req.permissionCodes = codes;

      const allowed = required.some((code) => authz.hasPermission(codes, code, req.user!.roles));
      if (!allowed) {
        log.warn('Permission denied', {
          userId: req.user!.sub,
          path: req.path,
          required,
        });
        next(
          AppError.forbidden(
            `Access denied. Requires permission: ${required.join(' or ')}`,
          ),
        );
        return;
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}
