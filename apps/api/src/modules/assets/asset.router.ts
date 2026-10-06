import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { AssetRepository } from './asset.repository';
import { AssetAuditService } from './asset.audit.service';
import { AssetService } from './asset.service';
import { AssetController } from './asset.controller';
import { validate } from '../../middleware/validate.middleware';
import { authenticate, requireRole } from '../../middleware/auth.middleware';
import {
  createAssetSchema,
  updateAssetSchema,
  listAssetsSchema,
} from './asset.dto';

export function assetRouter(db: PrismaClient): Router {
  const repo = new AssetRepository(db);
  const audit = new AssetAuditService();
  const service = new AssetService(repo, audit, db);
  const controller = new AssetController(service);

  const router = Router();

  /**
   * @openapi
   * /api/v1/assets/categories:
   *   get:
   *     summary: List all asset categories
   *     tags: [Assets]
   */
  router.get('/categories', authenticate, controller.getCategories);

  /**
   * @openapi
   * /api/v1/assets/vendors:
   *   get:
   *     summary: List all asset vendors
   *     tags: [Assets]
   */
  router.get('/vendors', authenticate, controller.getVendors);

  /**
   * @openapi
   * /api/v1/assets:
   *   get:
   *     summary: List campus assets with filtering, pagination, and search
   *     tags: [Assets]
   */
  router.get(
    '/',
    authenticate,
    requireRole('SUPER_ADMIN', 'CAMPUS_ADMIN', 'DEPARTMENT_ADMIN', 'FACULTY', 'MAINTENANCE_STAFF'),
    validate(listAssetsSchema),
    controller.list,
  );

  /**
   * @openapi
   * /api/v1/assets/{id}:
   *   get:
   *     summary: Get asset details with location, vendor, and maintenance history
   *     tags: [Assets]
   */
  router.get(
    '/:id',
    authenticate,
    requireRole('SUPER_ADMIN', 'CAMPUS_ADMIN', 'DEPARTMENT_ADMIN', 'FACULTY', 'MAINTENANCE_STAFF'),
    controller.getById,
  );

  /**
   * @openapi
   * /api/v1/assets:
   *   post:
   *     summary: Create a new asset
   *     tags: [Assets]
   */
  router.post(
    '/',
    authenticate,
    requireRole('SUPER_ADMIN', 'CAMPUS_ADMIN', 'DEPARTMENT_ADMIN'),
    validate(createAssetSchema),
    controller.create,
  );

  /**
   * @openapi
   * /api/v1/assets/{id}:
   *   patch:
   *     summary: Update an asset
   *     tags: [Assets]
   */
  router.patch(
    '/:id',
    authenticate,
    requireRole('SUPER_ADMIN', 'CAMPUS_ADMIN', 'DEPARTMENT_ADMIN'),
    validate(updateAssetSchema),
    controller.update,
  );

  /**
   * @openapi
   * /api/v1/assets/{id}:
   *   delete:
   *     summary: Archive (soft-delete) an asset (sets operationalStatus to RETIRED)
   *     tags: [Assets]
   */
  router.delete(
    '/:id',
    authenticate,
    requireRole('SUPER_ADMIN', 'CAMPUS_ADMIN'),
    controller.archive,
  );

  return router;
}
