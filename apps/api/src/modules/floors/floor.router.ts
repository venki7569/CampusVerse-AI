import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { FloorRepository } from './floor.repository';
import { FloorService } from './floor.service';
import { FloorController } from './floor.controller';
import { validate } from '../../middleware/validate.middleware';
import { authenticate, requireRole } from '../../middleware/auth.middleware';
import { createFloorSchema, updateFloorSchema, listFloorsSchema } from './floor.dto';

export function floorRouter(db: PrismaClient): Router {
  const repo = new FloorRepository(db);
  const service = new FloorService(repo, db);
  const controller = new FloorController(service);

  const router = Router();

  /**
   * @openapi
   * /api/v1/floors:
   *   get:
   *     summary: List floors (optionally filter by buildingId)
   *     tags: [Floors]
   */
  router.get('/', authenticate, validate(listFloorsSchema), controller.list);
  router.get('/:id', authenticate, controller.getById);

  router.post(
    '/',
    authenticate,
    requireRole('SUPER_ADMIN', 'CAMPUS_ADMIN'),
    validate(createFloorSchema),
    controller.create,
  );

  router.patch(
    '/:id',
    authenticate,
    requireRole('SUPER_ADMIN', 'CAMPUS_ADMIN'),
    validate(updateFloorSchema),
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
