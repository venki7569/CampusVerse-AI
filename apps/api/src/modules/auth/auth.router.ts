import { Router } from 'express';
import type { PrismaClient } from '@prisma/client';
import { AuthRepository } from './auth.repository';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { validate } from '../../middleware/validate.middleware';
import { authenticate } from '../../middleware/auth.middleware';
import { authRateLimiter } from '../../middleware/rateLimiter.middleware';
import {
  registerSchema,
  loginSchema,
  refreshTokenSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  googleAuthSchema,
  updateProfileSchema,
  changePasswordSchema,
} from './auth.dto';

export function authRouter(db: PrismaClient): Router {
  const repo = new AuthRepository(db);
  const service = new AuthService(repo);
  const controller = new AuthController(service);

  const router = Router();

  /**
   * @openapi
   * /api/v1/auth/register-options:
   *   get:
   *     summary: List roles and departments available for self-registration
   *     tags: [Auth]
   */
  router.get('/register-options', controller.registerOptions);

  /**
   * @openapi
   * /api/v1/auth/register:
   *   post:
   *     summary: Register a new user
   *     tags: [Auth]
   */
  router.post('/register', authRateLimiter, validate(registerSchema), controller.register);

  /**
   * @openapi
   * /api/v1/auth/login:
   *   post:
   *     summary: User login
   *     tags: [Auth]
   */
  router.post('/login', authRateLimiter, validate(loginSchema), controller.login);

  /**
   * @openapi
   * /api/v1/auth/refresh:
   *   post:
   *     summary: Rotate refresh token and obtain new access token
   *     tags: [Auth]
   */
  router.post('/refresh', authRateLimiter, validate(refreshTokenSchema), controller.refresh);

  /**
   * @openapi
   * /api/v1/auth/logout:
   *   post:
   *     summary: Logout user and revoke refresh token
   *     tags: [Auth]
   */
  router.post('/logout', authRateLimiter, controller.logout);

  /**
   * @openapi
   * /api/v1/auth/forgot-password:
   *   post:
   *     summary: Request password reset link
   *     tags: [Auth]
   */
  router.post('/forgot-password', authRateLimiter, validate(forgotPasswordSchema), controller.forgotPassword);

  /**
   * @openapi
   * /api/v1/auth/reset-password:
   *   post:
   *     summary: Reset password using reset token
   *     tags: [Auth]
   */
  router.post('/reset-password', authRateLimiter, validate(resetPasswordSchema), controller.resetPassword);

  /**
   * @openapi
   * /api/v1/auth/google:
   *   post:
   *     summary: OAuth 2.0 Google login
   *     tags: [Auth]
   */
  router.post('/google', authRateLimiter, validate(googleAuthSchema), controller.google);

  /**
   * @openapi
   * /api/v1/auth/me:
   *   get:
   *     summary: Get current authenticated user profile
   *     tags: [Auth]
   *     security:
   *       - bearerAuth: []
   */
  router.get('/me', authenticate, controller.me);

  /**
   * @openapi
   * /api/v1/auth/me:
   *   patch:
   *     summary: Update current user profile (safe fields only)
   *     tags: [Auth]
   *     security:
   *       - bearerAuth: []
   */
  router.patch('/me', authenticate, validate(updateProfileSchema), controller.updateMe);

  /**
   * @openapi
   * /api/v1/auth/me/password:
   *   patch:
   *     summary: Change current user password
   *     tags: [Auth]
   *     security:
   *       - bearerAuth: []
   */
  router.patch('/me/password', authenticate, validate(changePasswordSchema), controller.changePassword);

  return router;
}
