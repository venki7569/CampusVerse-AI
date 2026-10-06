import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { BuildingRepository } from './building.repository';
import { BuildingService } from './building.service';
import { BuildingController } from './building.controller';
import { validate } from '../../middleware/validate.middleware';
import { authenticate, requireRole } from '../../middleware/auth.middleware';
import {
  createBuildingSchema,
  updateBuildingSchema,
  listBuildingsSchema,
} from './building.dto';

export function buildingRouter(db: PrismaClient): Router {
  const repo = new BuildingRepository(db);
  const service = new BuildingService(repo);
  const controller = new BuildingController(service);

  const router = Router();

  /**
   * @openapi
   * /api/v1/buildings:
   *   get:
   *     summary: List all campus buildings
   *     tags: [Buildings]
   */
  router.get('/', authenticate, validate(listBuildingsSchema), controller.list);

  /**
   * @openapi
   * /api/v1/buildings/{id}:
   *   get:
   *     summary: Get a building with its floors and rooms
   *     tags: [Buildings]
   */
  router.get('/:id', authenticate, controller.getById);

  router.post(
    '/',
    authenticate,
    requireRole('SUPER_ADMIN', 'CAMPUS_ADMIN'),
    validate(createBuildingSchema),
    controller.create,
  );

  router.patch(
    '/:id',
    authenticate,
    requireRole('SUPER_ADMIN', 'CAMPUS_ADMIN'),
    validate(updateBuildingSchema),
    controller.update,
  );

  router.delete(
    '/:id',
    authenticate,
    requireRole('SUPER_ADMIN'),
    controller.delete,
  );

  return router;
}
