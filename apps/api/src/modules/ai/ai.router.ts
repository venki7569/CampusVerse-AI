import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { AIRepository } from './ai.repository';
import { AIService } from './ai.service';
import { AIController } from './ai.controller';
import { GeminiProvider } from './ai.provider';
import { CampusTools } from './ai.tools';
import { AIAuditService } from './ai.audit.service';
import { DashboardRepository } from '../dashboard/dashboard.repository';
import { DashboardService } from '../dashboard/dashboard.service';
import { ElectricityRepository } from '../electricity/electricity.repository';
import { WaterRepository } from '../water/water.repository';
import { AnalyticsRepository } from '../analytics/analytics.repository';
import { AnalyticsService } from '../analytics/analytics.service';
import { AnalyticsAuditService } from '../analytics/analytics.audit.service';
import { AnalyticsSnapshotService } from '../analytics/analytics.snapshot.service';
import { ParkingRepository } from '../parking/parking.repository';
import { ParkingService } from '../parking/parking.service';
import { ParkingAuditService } from '../parking/parking.audit.service';
import { MaintenanceRepository } from '../maintenance/maintenance.repository';
import { MaintenanceService } from '../maintenance/maintenance.service';
import { MaintenanceAuditService } from '../maintenance/maintenance.audit.service';
import { AnnouncementRepository } from '../announcements/announcement.repository';
import { AnnouncementService } from '../announcements/announcement.service';
import { AnnouncementAuditService } from '../announcements/announcement.audit.service';
import { DigitalTwinRepository } from '../digital-twin/digital-twin.repository';
import { MaintenanceRiskService } from '../digital-twin/maintenance-risk.service';
import { UtilityIntelligenceService } from '../digital-twin/utility-intelligence.service';
import { OccupancyIntelligenceService } from '../digital-twin/occupancy-intelligence.service';
import { CampusHealthService } from '../digital-twin/campus-health.service';
import { RecommendationRepository } from '../digital-twin/recommendation.repository';
import { RecommendationService } from '../digital-twin/recommendation.service';
import { DigitalTwinAuditService } from '../digital-twin/digital-twin.audit.service';
import { DigitalTwinService } from '../digital-twin/digital-twin.service';
import { IoTRepository } from '../iot/iot.repository';
import { MongoTelemetryRepository } from '../iot/telemetry.repository';
import { DefaultTelemetryProcessor } from '../iot/telemetry.processor';
import { DeviceHealthService } from '../iot/device-health.service';
import { OperationalRuleEngine } from '../iot/rule-engine.service';
import { OperationalActionService } from '../iot/operational-action.service';
import { IoTAuditService } from '../iot/iot.audit.service';
import { IoTService } from '../iot/iot.service';
import { validate } from '../../middleware/validate.middleware';
import { authenticate, requirePermission } from '../../middleware/auth.middleware';
import { aiRateLimiter } from '../../middleware/rateLimiter.middleware';
import {
  chatRequestSchema,
  conversationIdParamSchema,
  listConversationsSchema,
} from './ai.dto';

export function aiRouter(db: PrismaClient): Router {
  const repo = new AIRepository();
  const provider = new GeminiProvider();
  const audit = new AIAuditService();

  const dashboardRepo = new DashboardRepository(db);
  const electricityRepo = new ElectricityRepository(db);
  const waterRepo = new WaterRepository(db);
  const dashboard = new DashboardService(dashboardRepo, electricityRepo, waterRepo);

  const analyticsRepo = new AnalyticsRepository(db);
  const analytics = new AnalyticsService(
    analyticsRepo,
    electricityRepo,
    waterRepo,
    new AnalyticsAuditService(),
    new AnalyticsSnapshotService(),
  );

  const parkingRepo = new ParkingRepository(db);
  const parking = new ParkingService(parkingRepo, new ParkingAuditService());

  const maintenanceRepo = new MaintenanceRepository(db);
  const maintenance = new MaintenanceService(maintenanceRepo, new MaintenanceAuditService(), db);

  const announcementRepo = new AnnouncementRepository(db);
  const announcements = new AnnouncementService(announcementRepo, new AnnouncementAuditService());

  const twinRepo = new DigitalTwinRepository(db);
  const twinAudit = new DigitalTwinAuditService();
  const maintenanceRisk = new MaintenanceRiskService(twinRepo);
  const utilityIntel = new UtilityIntelligenceService(twinRepo);
  const occupancyIntel = new OccupancyIntelligenceService(twinRepo);
  const campusHealth = new CampusHealthService(twinRepo, maintenanceRisk, utilityIntel, occupancyIntel);
  const recommendationRepo = new RecommendationRepository();
  const recommendations = new RecommendationService(
    recommendationRepo,
    twinRepo,
    maintenanceRisk,
    utilityIntel,
    campusHealth,
    twinAudit,
  );
  const digitalTwin = new DigitalTwinService(
    twinRepo,
    maintenanceRisk,
    utilityIntel,
    occupancyIntel,
    campusHealth,
    recommendationRepo,
    twinAudit,
  );

  const iotRepo = new IoTRepository(db);
  const iotAudit = new IoTAuditService();
  const iotActionService = new OperationalActionService(db, iotAudit);
  const iotService = new IoTService(
    iotRepo,
    new MongoTelemetryRepository(),
    new DefaultTelemetryProcessor(),
    new DeviceHealthService(),
    new OperationalRuleEngine(),
    iotActionService,
    iotAudit,
    db,
  );

  const tools = new CampusTools(db, dashboard, analytics, parking, maintenance, announcements, {
    twin: digitalTwin,
    maintenanceRisk,
    utilityIntel,
    campusHealth,
    occupancyIntel,
    recommendations,
    iot: iotService,
    actions: iotActionService,
  });
  const service = new AIService(repo, provider, tools, audit);
  const controller = new AIController(service);

  const router = Router();
  router.use(authenticate);
  router.use(requirePermission('ai.use'));

  /**
   * @openapi
   * /api/v1/ai/status:
   *   get:
   *     summary: AI assistant configuration status
   *     tags: [AI Assistant]
   *     security:
   *       - bearerAuth: []
   */
  router.get('/status', controller.getStatus);

  /**
   * @openapi
   * /api/v1/ai/chat:
   *   post:
   *     summary: Send a message to CampusVerse AI
   *     tags: [AI Assistant]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [message]
   *             properties:
   *               conversationId: { type: string }
   *               message: { type: string }
   *     responses:
   *       201:
   *         description: Assistant response with optional source references
   */
  router.post('/chat', aiRateLimiter, validate(chatRequestSchema), controller.chat);

  /**
   * @openapi
   * /api/v1/ai/conversations:
   *   get:
   *     summary: List AI conversations for the authenticated user
   *     tags: [AI Assistant]
   *     security:
   *       - bearerAuth: []
   */
  router.get('/conversations', validate(listConversationsSchema), controller.listConversations);

  /**
   * @openapi
   * /api/v1/ai/conversations/{id}:
   *   get:
   *     summary: Get conversation history
   *     tags: [AI Assistant]
   *     security:
   *       - bearerAuth: []
   */
  router.get(
    '/conversations/:id',
    validate(conversationIdParamSchema),
    controller.getConversation,
  );

  /**
   * @openapi
   * /api/v1/ai/conversations/{id}:
   *   delete:
   *     summary: Delete a conversation
   *     tags: [AI Assistant]
   *     security:
   *       - bearerAuth: []
   */
  router.delete(
    '/conversations/:id',
    validate(conversationIdParamSchema),
    controller.deleteConversation,
  );

  return router;
}
