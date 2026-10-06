import { Router } from 'express';
import type { PrismaClient } from '@prisma/client';
import { DashboardRepository } from './dashboard.repository';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';
import { ElectricityRepository } from '../electricity/electricity.repository';
import { WaterRepository } from '../water/water.repository';
import { AnnouncementRepository } from '../announcements/announcement.repository';
import { AnnouncementService } from '../announcements/announcement.service';
import { AnnouncementAuditService } from '../announcements/announcement.audit.service';
import { validate } from '../../middleware/validate.middleware';
import { authenticate } from '../../middleware/auth.middleware';
import { dashboardOverviewQuerySchema } from './dashboard.dto';

export function dashboardRouter(db: PrismaClient): Router {
  const repo = new DashboardRepository(db);
  const electricityRepo = new ElectricityRepository(db);
  const waterRepo = new WaterRepository(db);
  const service = new DashboardService(repo, electricityRepo, waterRepo);
  const announcementService = new AnnouncementService(
    new AnnouncementRepository(db),
    new AnnouncementAuditService(),
  );
  const controller = new DashboardController(service, announcementService);

  const router = Router();

  /**
   * @openapi
   * /api/v1/dashboard/overview:
   *   get:
   *     summary: Live smart campus operations overview
   *     tags: [Dashboard]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: from
   *         schema: { type: string, format: date-time }
   *         description: Inclusive start of the analytics window
   *       - in: query
   *         name: to
   *         schema: { type: string, format: date-time }
   *         description: Inclusive end of the analytics window
   *       - in: query
   *         name: buildingId
   *         schema: { type: string, format: uuid }
   *       - in: query
   *         name: departmentId
   *         schema: { type: string, format: uuid }
   *       - in: query
   *         name: floorId
   *         schema: { type: string, format: uuid }
   *     responses:
   *       200:
   *         description: Aggregated campus KPIs, occupancy, utilities, maintenance, assets, and activity
   *       401:
   *         description: Authentication required
   */
  router.get('/overview', authenticate, validate(dashboardOverviewQuerySchema), controller.getOverview);

  return router;
}
