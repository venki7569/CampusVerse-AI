import { Router } from 'express';
import { NotificationRepository } from './notification.repository';
import { NotificationService } from './notification.service';
import { NotificationController } from './notification.controller';
import { validate } from '../../middleware/validate.middleware';
import { notificationRateLimiter } from '../../middleware/rateLimiter.middleware';
import { authenticate } from '../../middleware/auth.middleware';
import { listNotificationsSchema, notificationIdParamSchema } from './notification.dto';

export function notificationRouter(): Router {
  const repo = new NotificationRepository();
  const service = new NotificationService(repo);
  const controller = new NotificationController(service);

  const router = Router();
  router.use(notificationRateLimiter);

  /**
   * @openapi
   * /api/v1/notifications:
   *   get:
   *     summary: List notifications for the authenticated user
   *     tags: [Notifications]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: page
   *         schema: { type: integer }
   *       - in: query
   *         name: limit
   *         schema: { type: integer }
   *       - in: query
   *         name: unreadOnly
   *         schema: { type: boolean }
   *       - in: query
   *         name: type
   *         schema: { type: string }
   *       - in: query
   *         name: severity
   *         schema: { type: string }
   *       - in: query
   *         name: search
   *         schema: { type: string }
   *     responses:
   *       200:
   *         description: Paginated notification list owned by the caller
   *       401:
   *         description: Authentication required
   */
  router.get('/', authenticate, validate(listNotificationsSchema), controller.list);

  /**
   * @openapi
   * /api/v1/notifications/unread-count:
   *   get:
   *     summary: Unread notification count for the authenticated user
   *     tags: [Notifications]
   *     security:
   *       - bearerAuth: []
   */
  router.get('/unread-count', authenticate, controller.getUnreadCount);

  /**
   * @openapi
   * /api/v1/notifications/read-all:
   *   patch:
   *     summary: Mark all notifications as read for the authenticated user
   *     tags: [Notifications]
   *     security:
   *       - bearerAuth: []
   */
  router.patch('/read-all', authenticate, controller.markAllRead);

  /**
   * @openapi
   * /api/v1/notifications/{id}:
   *   get:
   *     summary: Get a single notification owned by the authenticated user
   *     tags: [Notifications]
   *     security:
   *       - bearerAuth: []
   */
  router.get('/:id', authenticate, validate(notificationIdParamSchema), controller.getById);

  /**
   * @openapi
   * /api/v1/notifications/{id}/read:
   *   patch:
   *     summary: Mark one notification as read
   *     tags: [Notifications]
   *     security:
   *       - bearerAuth: []
   */
  router.patch('/:id/read', authenticate, validate(notificationIdParamSchema), controller.markRead);

  /**
   * @openapi
   * /api/v1/notifications/{id}:
   *   delete:
   *     summary: Delete/dismiss a notification owned by the authenticated user
   *     tags: [Notifications]
   *     security:
   *       - bearerAuth: []
   */
  router.delete('/:id', authenticate, validate(notificationIdParamSchema), controller.delete);

  return router;
}
