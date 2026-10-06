import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { AnnouncementRepository } from './announcement.repository';
import { AnnouncementService } from './announcement.service';
import { AnnouncementController } from './announcement.controller';
import { AnnouncementAuditService } from './announcement.audit.service';
import { validate } from '../../middleware/validate.middleware';
import { authenticate, requirePermission } from '../../middleware/auth.middleware';
import {
  announcementIdParamSchema,
  createAnnouncementSchema,
  listAnnouncementsSchema,
  publishAnnouncementSchema,
  scheduleAnnouncementSchema,
  updateAnnouncementSchema,
} from './announcement.dto';

export function announcementRouter(db: PrismaClient): Router {
  const repo = new AnnouncementRepository(db);
  const audit = new AnnouncementAuditService();
  const service = new AnnouncementService(repo, audit);
  const controller = new AnnouncementController(service);
  const router = Router();

  router.use(authenticate);
  router.use(requirePermission('announcement.view'));

  /**
   * @openapi
   * /api/v1/announcements/unread-count:
   *   get:
   *     summary: Unread announcement count for the authenticated user
   *     tags: [Announcements]
   *     security:
   *       - bearerAuth: []
   */
  router.get('/unread-count', controller.unreadCount);

  /**
   * @openapi
   * /api/v1/announcements/feed-summary:
   *   get:
   *     summary: Latest announcements and unread summary
   *     tags: [Announcements]
   *     security:
   *       - bearerAuth: []
   */
  router.get('/feed-summary', controller.feedSummary);

  /**
   * @openapi
   * /api/v1/announcements:
   *   get:
   *     summary: List announcements (user feed or admin view)
   *     tags: [Announcements]
   *     security:
   *       - bearerAuth: []
   */
  router.get('/', validate(listAnnouncementsSchema), controller.list);

  /**
   * @openapi
   * /api/v1/announcements:
   *   post:
   *     summary: Create announcement draft or scheduled announcement
   *     tags: [Announcements]
   *     security:
   *       - bearerAuth: []
   */
  router.post(
    '/',
    requirePermission('announcement.create'),
    validate(createAnnouncementSchema),
    controller.create,
  );

  /**
   * @openapi
   * /api/v1/announcements/{id}:
   *   get:
   *     summary: Get announcement by id
   *     tags: [Announcements]
   */
  router.get('/:id', validate(announcementIdParamSchema), controller.getById);

  /**
   * @openapi
   * /api/v1/announcements/{id}:
   *   patch:
   *     summary: Update draft or scheduled announcement
   *     tags: [Announcements]
   */
  router.patch(
    '/:id',
    requirePermission('announcement.update'),
    validate(updateAnnouncementSchema),
    controller.update,
  );

  /**
   * @openapi
   * /api/v1/announcements/{id}/read:
   *   patch:
   *     summary: Mark announcement as read
   *     tags: [Announcements]
   */
  router.patch('/:id/read', validate(announcementIdParamSchema), controller.markRead);

  /**
   * @openapi
   * /api/v1/announcements/{id}/publish:
   *   post:
   *     summary: Publish announcement immediately
   *     tags: [Announcements]
   */
  router.post(
    '/:id/publish',
    requirePermission('announcement.publish'),
    validate(publishAnnouncementSchema),
    controller.publish,
  );

  /**
   * @openapi
   * /api/v1/announcements/{id}/schedule:
   *   post:
   *     summary: Schedule announcement for future publication
   *     tags: [Announcements]
   */
  router.post(
    '/:id/schedule',
    requirePermission('announcement.publish'),
    validate(scheduleAnnouncementSchema),
    controller.schedule,
  );

  /**
   * @openapi
   * /api/v1/announcements/{id}/cancel:
   *   post:
   *     summary: Cancel scheduled announcement
   *     tags: [Announcements]
   */
  router.post(
    '/:id/cancel',
    requirePermission('announcement.update'),
    validate(publishAnnouncementSchema),
    controller.cancel,
  );

  /**
   * @openapi
   * /api/v1/announcements/{id}/archive:
   *   post:
   *     summary: Archive announcement
   *     tags: [Announcements]
   */
  router.post(
    '/:id/archive',
    requirePermission('announcement.update'),
    validate(publishAnnouncementSchema),
    controller.archive,
  );

  /**
   * @openapi
   * /api/v1/announcements/{id}:
   *   delete:
   *     summary: Delete announcement
   *     tags: [Announcements]
   */
  router.delete(
    '/:id',
    requirePermission('announcement.delete'),
    validate(announcementIdParamSchema),
    controller.delete,
  );

  return router;
}
