import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { DepartmentRepository } from './department.repository';
import { DepartmentService } from './department.service';
import { DepartmentController } from './department.controller';
import { validate } from '../../middleware/validate.middleware';
import { authenticate, requireRole } from '../../middleware/auth.middleware';
import {
  createDepartmentSchema,
  updateDepartmentSchema,
  listDepartmentsSchema,
} from './department.dto';

export function departmentRouter(db: PrismaClient): Router {
  const repo = new DepartmentRepository(db);
  const service = new DepartmentService(repo);
  const controller = new DepartmentController(service);

  const router = Router();

  /**
   * @openapi
   * /api/v1/departments:
   *   get:
   *     summary: List departments with search and pagination
   *     tags: [Departments]
   */
  router.get('/', authenticate, validate(listDepartmentsSchema), controller.list);
  router.get('/:id', authenticate, controller.getById);

  /**
   * @openapi
   * /api/v1/departments:
   *   post:
   *     summary: Create a new department
   *     tags: [Departments]
   *     security: SUPER_ADMIN, CAMPUS_ADMIN
   */
  router.post(
    '/',
    authenticate,
    requireRole('SUPER_ADMIN', 'CAMPUS_ADMIN'),
    validate(createDepartmentSchema),
    controller.create,
  );

  router.patch(
    '/:id',
    authenticate,
    requireRole('SUPER_ADMIN', 'CAMPUS_ADMIN', 'DEPARTMENT_ADMIN'),
    validate(updateDepartmentSchema),
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
