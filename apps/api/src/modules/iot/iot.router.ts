import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, requirePermission } from '../../middleware/auth.middleware';
import { iotIngestRateLimiter } from '../../middleware/rateLimiter.middleware';
import { validate } from '../../middleware/validate.middleware';
import { IoTRepository } from './iot.repository';
import { MongoTelemetryRepository } from './telemetry.repository';
import { DefaultTelemetryProcessor } from './telemetry.processor';
import { DeviceHealthService } from './device-health.service';
import { OperationalRuleEngine } from './rule-engine.service';
import { OperationalActionService } from './operational-action.service';
import { IoTAuditService } from './iot.audit.service';
import { IoTService } from './iot.service';
import { IoTController } from './iot.controller';
import {
  actionIdParamSchema,
  createDeviceSchema,
  deviceIdParamSchema,
  ingestDeviceTelemetrySchema,
  ingestTelemetrySchema,
  listActionsSchema,
  listDevicesSchema,
  proposeActionSchema,
  updateDeviceSchema,
} from './iot.dto';

export function iotRouter(db: PrismaClient): Router {
  const repo = new IoTRepository(db);
  const telemetryRepo = new MongoTelemetryRepository();
  const processor = new DefaultTelemetryProcessor();
  const healthService = new DeviceHealthService();
  const ruleEngine = new OperationalRuleEngine();
  const audit = new IoTAuditService();
  const actionService = new OperationalActionService(db, audit);
  const service = new IoTService(
    repo,
    telemetryRepo,
    processor,
    healthService,
    ruleEngine,
    actionService,
    audit,
    db,
  );
  const controller = new IoTController(service, actionService);

  const router = Router();

  /**
   * @openapi
   * /iot/telemetry:
   *   post:
   *     tags: [IoT]
   *     summary: Ingest telemetry (batch or single)
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: header
   *         name: X-Device-Key
   *         schema: { type: string }
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             oneOf:
   *               - $ref: '#/components/schemas/TelemetryPoint'
   *               - type: object
   *                 properties:
   *                   readings:
   *                     type: array
   *                     items:
   *                       $ref: '#/components/schemas/TelemetryPoint'
   *     responses:
   *       200:
   *         description: Ingestion result
   *       401:
   *         description: Unauthorized
   *       403:
   *         description: Missing iot.ingest permission
   */
  router.post(
    '/telemetry',
    iotIngestRateLimiter,
    authenticate,
    requirePermission('iot.ingest'),
    validate(ingestTelemetrySchema),
    controller.ingestTelemetry,
  );

  router.post(
    '/devices/:deviceId/telemetry',
    iotIngestRateLimiter,
    authenticate,
    requirePermission('iot.ingest'),
    validate(ingestDeviceTelemetrySchema),
    controller.ingestDeviceTelemetry,
  );

  router.use(authenticate);

  /**
   * @openapi
   * /iot/summary:
   *   get:
   *     tags: [IoT]
   *     summary: IoT control center summary
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Device counts and alert summary
   */
  router.get('/summary', requirePermission('iot.view'), controller.getSummary);

  router.get('/devices', requirePermission('iot.view'), validate(listDevicesSchema), controller.listDevices);
  router.get('/devices/:id', requirePermission('iot.view'), validate(deviceIdParamSchema), controller.getDevice);
  router.get(
    '/devices/:id/health',
    requirePermission('iot.view'),
    validate(deviceIdParamSchema),
    controller.getDeviceHealth,
  );
  router.get(
    '/devices/:id/telemetry',
    requirePermission('iot.view'),
    validate(deviceIdParamSchema),
    controller.getRecentTelemetry,
  );

  router.post('/devices', requirePermission('iot.manage'), validate(createDeviceSchema), controller.createDevice);
  router.patch(
    '/devices/:id',
    requirePermission('iot.manage'),
    validate(updateDeviceSchema),
    controller.updateDevice,
  );
  router.delete(
    '/devices/:id',
    requirePermission('iot.manage'),
    validate(deviceIdParamSchema),
    controller.archiveDevice,
  );

  router.get(
    '/occupancy/rooms/:roomId',
    requirePermission('iot.view'),
    controller.getOccupancyInsight,
  );
  router.get(
    '/environment/buildings/:buildingId',
    requirePermission('iot.view'),
    controller.getEnvironmentalSummary,
  );

  router.get('/actions', requirePermission('iot.actions'), validate(listActionsSchema), controller.listActions);
  router.post('/actions', requirePermission('iot.actions'), validate(proposeActionSchema), controller.proposeAction);
  router.post(
    '/actions/:id/approve',
    requirePermission('iot.actions'),
    validate(actionIdParamSchema),
    controller.approveAction,
  );
  router.post(
    '/actions/:id/reject',
    requirePermission('iot.actions'),
    validate(actionIdParamSchema),
    controller.rejectAction,
  );

  return router;
}
