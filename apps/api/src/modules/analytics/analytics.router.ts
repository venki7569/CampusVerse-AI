import { Router, Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { AnalyticsRepository } from './analytics.repository';
import { AnalyticsService } from './analytics.service';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsAuditService } from './analytics.audit.service';
import { AnalyticsSnapshotService } from './analytics.snapshot.service';
import { ElectricityRepository } from '../electricity/electricity.repository';
import { WaterRepository } from '../water/water.repository';
import { DigitalTwinRepository } from '../digital-twin/digital-twin.repository';
import { OccupancyIntelligenceService } from '../digital-twin/occupancy-intelligence.service';
import { validate } from '../../middleware/validate.middleware';
import { authenticate, requirePermission } from '../../middleware/auth.middleware';
import { sendSuccess } from '../../utils/apiResponse';
import {
  analyticsBaseQuerySchema,
  analyticsBuildingsQuerySchema,
  analyticsDepartmentsQuerySchema,
  analyticsExportSchema,
  analyticsReportQuerySchema,
  analyticsTrendsQuerySchema,
} from './analytics.dto';

export function analyticsRouter(db: PrismaClient): Router {
  const repo = new AnalyticsRepository(db);
  const electricityRepo = new ElectricityRepository(db);
  const waterRepo = new WaterRepository(db);
  const audit = new AnalyticsAuditService();
  const snapshots = new AnalyticsSnapshotService();
  const service = new AnalyticsService(repo, electricityRepo, waterRepo, audit, snapshots);
  const controller = new AnalyticsController(service, db);
  const occupancyIntel = new OccupancyIntelligenceService(new DigitalTwinRepository(db));
  const router = Router();

  router.use(authenticate);

  router.get('/overview', requirePermission('analytics.view'), validate(analyticsBaseQuerySchema), controller.getOverview);
  router.get('/trends', requirePermission('analytics.view'), validate(analyticsTrendsQuerySchema), controller.getTrends);
  router.get(
    '/buildings',
    requirePermission('analytics.view'),
    validate(analyticsBuildingsQuerySchema),
    controller.getBuildings,
  );
  router.get(
    '/departments',
    requirePermission('analytics.view'),
    validate(analyticsDepartmentsQuerySchema),
    controller.getDepartments,
  );
  router.get(
    '/utilities',
    requirePermission('analytics.view'),
    validate(analyticsBaseQuerySchema),
    controller.getUtilities,
  );
  router.get(
    '/maintenance',
    requirePermission('analytics.view'),
    validate(analyticsBaseQuerySchema),
    controller.getMaintenance,
  );
  router.get('/assets', requirePermission('analytics.view'), validate(analyticsBaseQuerySchema), controller.getAssets);
  router.get(
    '/occupancy',
    requirePermission('analytics.view'),
    validate(analyticsBaseQuerySchema),
    controller.getOccupancy,
  );
  router.get('/occupancy-insights', requirePermission('analytics.view'), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const buildingId = typeof req.query['buildingId'] === 'string' ? req.query['buildingId'] : undefined;
      const insight = buildingId
        ? await occupancyIntel.getBuildingInsight(buildingId)
        : await occupancyIntel.getCampusInsight();
      sendSuccess(res, insight ?? { scope: 'building', trend: 'insufficient_data', explanation: 'Building not found or no rooms.' });
    } catch (err) {
      next(err);
    }
  });
  router.get('/parking', requirePermission('analytics.view'), validate(analyticsBaseQuerySchema), controller.getParking);
  router.get(
    '/reports',
    requirePermission('analytics.report'),
    validate(analyticsReportQuerySchema),
    controller.getReport,
  );
  router.get(
    '/export',
    requirePermission('analytics.report'),
    validate(analyticsExportSchema),
    controller.exportReport,
  );

  return router;
}
