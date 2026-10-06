import { z } from 'zod';
import { paginationSchema } from '../../utils/pagination';

export const ROLE_NAME_VALUES = [
  'SUPER_ADMIN',
  'CAMPUS_ADMIN',
  'DEPARTMENT_ADMIN',
  'FACULTY',
  'STUDENT',
  'MAINTENANCE_STAFF',
  'SECURITY_STAFF',
] as const;

export const roleNameSchema = z.enum(ROLE_NAME_VALUES);
export type AdminRoleName = z.infer<typeof roleNameSchema>;

export const userStatusSchema = z.enum(['ACTIVE', 'INACTIVE']);

export const listAdminUsersSchema = z.object({
  query: paginationSchema.extend({
    roleId: z.string().uuid().optional(),
    departmentId: z.string().uuid().optional(),
    status: userStatusSchema.optional(),
  }),
});

export type ListAdminUsersQuery = z.infer<typeof listAdminUsersSchema>['query'];

export const adminIdParamSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid id'),
  }),
});

export const roleIdParamSchema = z.object({
  params: z.object({
    roleId: z.string().uuid('Invalid role id'),
  }),
});

export const createAdminUserSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email address').toLowerCase().trim(),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .max(100, 'Password must be at most 100 characters'),
    firstName: z.string().min(1, 'First name is required').max(50).trim(),
    lastName: z.string().min(1, 'Last name is required').max(50).trim(),
    roleId: z.string().uuid().optional(),
    roleName: roleNameSchema.optional(),
    departmentId: z.string().uuid().optional().nullable(),
    isActive: z.boolean().optional().default(true),
    status: userStatusSchema.optional(),
  }),
});

export type CreateAdminUserDto = z.infer<typeof createAdminUserSchema>['body'];

export const updateAdminUserSchema = z.object({
  body: z.object({
    firstName: z.string().min(1).max(50).trim().optional(),
    lastName: z.string().min(1).max(50).trim().optional(),
    email: z.string().email().toLowerCase().trim().optional(),
    roleId: z.string().uuid().optional(),
    roleName: roleNameSchema.optional(),
    departmentId: z.string().uuid().optional().nullable(),
    isActive: z.boolean().optional(),
    status: userStatusSchema.optional(),
    password: z.string().min(8).max(100).optional(),
  }),
});

export type UpdateAdminUserDto = z.infer<typeof updateAdminUserSchema>['body'];

export const updateUserStatusSchema = z.object({
  body: z.object({
    isActive: z.boolean().optional(),
    status: userStatusSchema.optional(),
  }),
});

export type UpdateUserStatusDto = z.infer<typeof updateUserStatusSchema>['body'];

export const resetUserPasswordSchema = z.object({
  body: z.object({
    password: z.string().min(8).max(100),
  }),
});

export type ResetUserPasswordDto = z.infer<typeof resetUserPasswordSchema>['body'];

export const listRolesSchema = z.object({
  query: paginationSchema,
});

export type ListRolesQuery = z.infer<typeof listRolesSchema>['query'];

export const createRoleSchema = z.object({
  body: z.object({
    name: roleNameSchema,
    description: z.string().max(300).trim().optional().nullable(),
  }),
});

export type CreateRoleDto = z.infer<typeof createRoleSchema>['body'];

export const updateRoleSchema = z.object({
  body: z.object({
    description: z.string().max(300).trim().optional().nullable(),
  }),
});

export type UpdateRoleDto = z.infer<typeof updateRoleSchema>['body'];

export const updateRolePermissionsSchema = z.object({
  body: z.object({
    permissionIds: z.array(z.string().uuid()).max(200),
  }),
});

export type UpdateRolePermissionsDto = z.infer<typeof updateRolePermissionsSchema>['body'];

export const listPermissionsSchema = z.object({
  query: paginationSchema.extend({
    resource: z.string().min(1).max(50).optional(),
  }),
});

export type ListPermissionsQuery = z.infer<typeof listPermissionsSchema>['query'];

export const listAdminAuditSchema = z.object({
  query: paginationSchema.extend({
    action: z.string().min(1).max(100).optional(),
  }),
});

export type ListAdminAuditQuery = z.infer<typeof listAdminAuditSchema>['query'];

export type ActorContext = {
  id: string;
  email: string;
  roles: AdminRoleName[];
};

export type AdminUserDto = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
  status: 'ACTIVE' | 'INACTIVE';
  departmentId: string | null;
  department: { id: string; code: string; name: string } | null;
  roles: Array<{ id: string; name: string; description: string | null }>;
  permissions?: Array<{
    id: string;
    code: string;
    action: string;
    resource: string;
    description: string | null;
  }>;
  createdAt: string;
  updatedAt: string;
};

export type AdminRoleDto = {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  userCount: number;
  permissionCount: number;
  permissions?: Array<{
    id: string;
    code: string;
    action: string;
    resource: string;
    description: string | null;
  }>;
  createdAt: string;
  updatedAt: string;
};

export type AdminPermissionDto = {
  id: string;
  code: string;
  action: string;
  resource: string;
  description: string | null;
  assignedRoles: Array<{ id: string; name: string }>;
  createdAt: string;
  updatedAt: string;
};
