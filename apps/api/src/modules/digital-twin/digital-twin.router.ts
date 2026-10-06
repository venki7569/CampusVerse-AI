import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, requirePermission } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validate.middleware';
import { DigitalTwinRepository } from './digital-twin.repository';
import { MaintenanceRiskService } from './maintenance-risk.service';
import { UtilityIntelligenceService } from './utility-intelligence.service';
import { OccupancyIntelligenceService } from './occupancy-intelligence.service';
import { CampusHealthService } from './campus-health.service';
import { RecommendationRepository } from './recommendation.repository';
import { RecommendationService } from './recommendation.service';
import { DigitalTwinAuditService } from './digital-twin.audit.service';
import { DigitalTwinService } from './digital-twin.service';
import { DigitalTwinController } from './digital-twin.controller';
import {
  digitalTwinIdParamSchema,
  listRecommendationsSchema,
  recommendationIdParamSchema,
} from './digital-twin.dto';

export function digitalTwinRouter(db: PrismaClient): Router {
  const repo = new DigitalTwinRepository(db);
  const audit = new DigitalTwinAuditService();
  const maintenanceRisk = new MaintenanceRiskService(repo);
  const utilityIntel = new UtilityIntelligenceService(repo);
  const occupancyIntel = new OccupancyIntelligenceService(repo);
  const campusHealth = new CampusHealthService(repo, maintenanceRisk, utilityIntel, occupancyIntel);
  const recommendationRepo = new RecommendationRepository();
  const recommendationService = new RecommendationService(
    recommendationRepo,
    repo,
    maintenanceRisk,
    utilityIntel,
    campusHealth,
    audit,
  );
  const twinService = new DigitalTwinService(
    repo,
    maintenanceRisk,
    utilityIntel,
    occupancyIntel,
    campusHealth,
    recommendationRepo,
    audit,
  );
  const controller = new DigitalTwinController(twinService, recommendationService);

  const router = Router();
  router.use(authenticate);

  router.get('/overview', requirePermission('digital_twin.view'), controller.getOverview);
  router.get('/occupancy', requirePermission('digital_twin.view'), controller.getOccupancy);
  router.get('/health', requirePermission('digital_twin.view'), controller.getCampusHealth);
  router.get(
    '/buildings/:id',
    requirePermission('digital_twin.view'),
    validate(digitalTwinIdParamSchema),
    controller.getBuilding,
  );
  router.get(
    '/rooms/:id',
    requirePermission('digital_twin.view'),
    validate(digitalTwinIdParamSchema),
    controller.getRoom,
  );
  router.get(
    '/assets/:id',
    requirePermission('digital_twin.view'),
    validate(digitalTwinIdParamSchema),
    controller.getAsset,
  );

  router.get(
    '/recommendations',
    requirePermission('recommendation.view'),
    validate(listRecommendationsSchema),
    controller.listRecommendations,
  );
  router.post(
    '/recommendations/sync',
    requirePermission('recommendation.manage'),
    controller.syncRecommendations,
  );
  router.patch(
    '/recommendations/:id/acknowledge',
    requirePermission('recommendation.manage'),
    validate(recommendationIdParamSchema),
    controller.acknowledgeRecommendation,
  );
  router.patch(
    '/recommendations/:id/dismiss',
    requirePermission('recommendation.manage'),
    validate(recommendationIdParamSchema),
    controller.dismissRecommendation,
  );
  router.patch(
    '/recommendations/:id/resolve',
    requirePermission('recommendation.manage'),
    validate(recommendationIdParamSchema),
    controller.resolveRecommendation,
  );

  return router;
}
