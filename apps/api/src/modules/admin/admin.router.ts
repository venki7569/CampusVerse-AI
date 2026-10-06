import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { AdminRepository } from './admin.repository';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { AdminAuditService } from './admin.audit.service';
import { validate } from '../../middleware/validate.middleware';
import { sendSuccess } from '../../utils/apiResponse';
import { getReadinessReport } from '../health/health.service';
import { adminRateLimiter } from '../../middleware/rateLimiter.middleware';
import { authenticate, requireRole, requirePermission } from '../../middleware/auth.middleware';
import {
  adminIdParamSchema,
  createAdminUserSchema,
  createRoleSchema,
  listAdminAuditSchema,
  listAdminUsersSchema,
  listPermissionsSchema,
  listRolesSchema,
  resetUserPasswordSchema,
  roleIdParamSchema,
  updateAdminUserSchema,
  updateRolePermissionsSchema,
  updateRoleSchema,
  updateUserStatusSchema,
} from './admin.dto';

const ADMIN_ROLES = ['SUPER_ADMIN', 'CAMPUS_ADMIN', 'DEPARTMENT_ADMIN'] as const;

export function adminRouter(db: PrismaClient): Router {
  const repo = new AdminRepository(db);
  const audit = new AdminAuditService();
  const service = new AdminService(repo, audit);
  const controller = new AdminController(service);
  const router = Router();
  router.use(adminRateLimiter);

  router.use(authenticate, requireRole(...ADMIN_ROLES));

  /**
   * @openapi
   * /api/v1/admin/users:
   *   get:
   *     summary: List users
   *     tags: [Admin Users]
   *     security:
   *       - bearerAuth: []
   *     description: Requires permission users.read
   *     parameters:
   *       - in: query
   *         name: page
   *         schema: { type: integer }
   *       - in: query
   *         name: limit
   *         schema: { type: integer }
   *       - in: query
   *         name: search
   *         schema: { type: string }
   *       - in: query
   *         name: roleId
   *         schema: { type: string, format: uuid }
   *       - in: query
   *         name: departmentId
   *         schema: { type: string, format: uuid }
   *       - in: query
   *         name: status
   *         schema: { type: string, enum: [ACTIVE, INACTIVE] }
   *     responses:
   *       200:
   *         description: Paginated users without password hashes
   *       401:
   *         description: Authentication required
   *       403:
   *         description: Missing users.read permission
   */
  router.get('/users', requirePermission('users.read'), validate(listAdminUsersSchema), controller.listUsers);

  /**
   * @openapi
   * /api/v1/admin/users/{id}:
   *   get:
   *     summary: Get user details
   *     tags: [Admin Users]
   *     security:
   *       - bearerAuth: []
   */
  router.get('/users/:id', requirePermission('users.read'), validate(adminIdParamSchema), controller.getUser);

  /**
   * @openapi
   * /api/v1/admin/users:
   *   post:
   *     summary: Create a user
   *     tags: [Admin Users]
   *     security:
   *       - bearerAuth: []
   *     description: Requires permission users.create
   */
  router.post('/users', requirePermission('users.create'), validate(createAdminUserSchema), controller.createUser);

  /**
   * @openapi
   * /api/v1/admin/users/{id}:
   *   patch:
   *     summary: Update a user
   *     tags: [Admin Users]
   *     security:
   *       - bearerAuth: []
   */
  router.patch(
    '/users/:id',
    requirePermission('users.update'),
    validate(adminIdParamSchema),
    validate(updateAdminUserSchema),
    controller.updateUser,
  );

  /**
   * @openapi
   * /api/v1/admin/users/{id}/status:
   *   patch:
   *     summary: Activate or deactivate a user
   *     tags: [Admin Users]
   *     security:
   *       - bearerAuth: []
   */
  router.patch(
    '/users/:id/status',
    requirePermission('users.manage'),
    validate(adminIdParamSchema),
    validate(updateUserStatusSchema),
    controller.updateUserStatus,
  );

  /**
   * @openapi
   * /api/v1/admin/users/{id}/password:
   *   patch:
   *     summary: Reset a user password
   *     tags: [Admin Users]
   *     security:
   *       - bearerAuth: []
   */
  router.patch(
    '/users/:id/password',
    requirePermission('users.manage'),
    validate(adminIdParamSchema),
    validate(resetUserPasswordSchema),
    controller.resetUserPassword,
  );

  /**
   * @openapi
   * /api/v1/admin/users/{id}:
   *   delete:
   *     summary: Deactivate a user (soft delete)
   *     tags: [Admin Users]
   *     security:
   *       - bearerAuth: []
   */
  router.delete('/users/:id', requirePermission('users.manage'), validate(adminIdParamSchema), controller.deleteUser);

  /**
   * @openapi
   * /api/v1/admin/roles:
   *   get:
   *     summary: List roles
   *     tags: [Admin Roles]
   *     security:
   *       - bearerAuth: []
   */
  router.get('/roles', requirePermission('roles.read'), validate(listRolesSchema), controller.listRoles);

  /**
   * @openapi
   * /api/v1/admin/roles/{id}:
   *   get:
   *     summary: Get a role
   *     tags: [Admin Roles]
   *     security:
   *       - bearerAuth: []
   */
  router.get('/roles/:id', requirePermission('roles.read'), validate(adminIdParamSchema), controller.getRole);

  /**
   * @openapi
   * /api/v1/admin/roles:
   *   post:
   *     summary: Create a system catalog role
   *     tags: [Admin Roles]
   *     security:
   *       - bearerAuth: []
   */
  router.post('/roles', requirePermission('roles.create'), validate(createRoleSchema), controller.createRole);

  /**
   * @openapi
   * /api/v1/admin/roles/{id}:
   *   patch:
   *     summary: Update a role description
   *     tags: [Admin Roles]
   *     security:
   *       - bearerAuth: []
   */
  router.patch(
    '/roles/:id',
    requirePermission('roles.update'),
    validate(adminIdParamSchema),
    validate(updateRoleSchema),
    controller.updateRole,
  );

  /**
   * @openapi
   * /api/v1/admin/roles/{id}:
   *   delete:
   *     summary: Delete a non-system role
   *     tags: [Admin Roles]
   *     security:
   *       - bearerAuth: []
   */
  router.delete('/roles/:id', requirePermission('roles.manage'), validate(adminIdParamSchema), controller.deleteRole);

  /**
   * @openapi
   * /api/v1/admin/roles/{roleId}/permissions:
   *   put:
   *     summary: Replace permissions assigned to a role
   *     tags: [Admin Permissions]
   *     security:
   *       - bearerAuth: []
   *     description: Requires permission permissions.manage. Uses a transaction.
   */
  router.put(
    '/roles/:roleId/permissions',
    requirePermission('permissions.manage'),
    validate(roleIdParamSchema),
    validate(updateRolePermissionsSchema),
    controller.updateRolePermissions,
  );

  /**
   * @openapi
   * /api/v1/admin/permissions:
   *   get:
   *     summary: List permissions
   *     tags: [Admin Permissions]
   *     security:
   *       - bearerAuth: []
   */
  router.get(
    '/permissions',
    requirePermission('permissions.read'),
    validate(listPermissionsSchema),
    controller.listPermissions,
  );

  /**
   * @openapi
   * /api/v1/admin/permissions/{id}:
   *   get:
   *     summary: Get a permission
   *     tags: [Admin Permissions]
   *     security:
   *       - bearerAuth: []
   */
  router.get(
    '/permissions/:id',
    requirePermission('permissions.read'),
    validate(adminIdParamSchema),
    controller.getPermission,
  );

  /**
   * @openapi
   * /api/v1/admin/audit:
   *   get:
   *     summary: List RBAC audit events
   *     tags: [Admin Users]
   *     security:
   *       - bearerAuth: []
   */
  router.get('/audit', requirePermission('audit.read'), validate(listAdminAuditSchema), controller.listAudit);

  router.get(
    '/system-health',
    requireRole('SUPER_ADMIN', 'CAMPUS_ADMIN'),
    async (_req, res, next) => {
      try {
        sendSuccess(res, await getReadinessReport(db));
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}
