import bcrypt from 'bcryptjs';
import { RoleName } from '@prisma/client';
import { AppError } from '../../utils/AppError';
import { buildPaginationMeta } from '../../utils/pagination';
import { createLogger } from '../../utils/logger';
import { canAssignRole, isSystemRole, toPermissionCode } from './admin.permissions';
import { invalidateAuthorizationCache } from './authorization.service';
import { invalidateUserStatus } from '../../services/user-status.service';
import {
  applyDepartmentQueryFilter,
  assertDepartmentAccess,
  resolveDepartmentScope,
} from '../../services/department-scope.service';
import type { AdminRepository, UserDetailRecord, UserListRecord } from './admin.repository';
import type { AdminAuditService } from './admin.audit.service';
import type {
  ActorContext,
  AdminPermissionDto,
  AdminRoleDto,
  AdminUserDto,
  CreateAdminUserDto,
  CreateRoleDto,
  ListAdminAuditQuery,
  ListAdminUsersQuery,
  ListPermissionsQuery,
  ListRolesQuery,
  ResetUserPasswordDto,
  UpdateAdminUserDto,
  UpdateRoleDto,
  UpdateRolePermissionsDto,
  UpdateUserStatusDto,
} from './admin.dto';

const log = createLogger('AdminService');

function statusFromActive(isActive: boolean): 'ACTIVE' | 'INACTIVE' {
  return isActive ? 'ACTIVE' : 'INACTIVE';
}

function resolveActiveFlag(input: { isActive?: boolean; status?: 'ACTIVE' | 'INACTIVE' }): boolean | undefined {
  if (typeof input.isActive === 'boolean') return input.isActive;
  if (input.status === 'ACTIVE') return true;
  if (input.status === 'INACTIVE') return false;
  return undefined;
}

export class AdminService {
  constructor(
    private readonly repo: AdminRepository,
    private readonly audit: AdminAuditService,
  ) {}

  private toUserDto(user: UserListRecord | UserDetailRecord, includePermissions: boolean): AdminUserDto {
    const roles = user.userRoles.map((ur) => ({
      id: ur.role.id,
      name: ur.role.name,
      description: 'description' in ur.role ? ur.role.description : null,
    }));

    const dto: AdminUserDto = {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      isActive: user.isActive,
      status: statusFromActive(user.isActive),
      departmentId: user.departmentId,
      department: user.department,
      roles,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    };

    if (includePermissions && 'userRoles' in user) {
      const seen = new Map<
        string,
        { id: string; code: string; action: string; resource: string; description: string | null }
      >();
      for (const ur of user.userRoles) {
        const role = ur.role as UserDetailRecord['userRoles'][number]['role'];
        if (!('rolePermissions' in role)) continue;
        for (const rp of role.rolePermissions) {
          const code = toPermissionCode(rp.permission.resource, rp.permission.action);
          if (!seen.has(code)) {
            seen.set(code, {
              id: rp.permission.id,
              code,
              action: rp.permission.action,
              resource: rp.permission.resource,
              description: rp.permission.description,
            });
          }
        }
      }
      dto.permissions = [...seen.values()];
    }

    return dto;
  }

  private toRoleDto(role: {
    id: string;
    name: RoleName;
    description: string | null;
    createdAt: Date;
    updatedAt: Date;
    _count: { userRoles: number; rolePermissions: number };
    rolePermissions?: Array<{
      permission: { id: string; action: string; resource: string; description: string | null };
    }>;
  }): AdminRoleDto {
    return {
      id: role.id,
      name: role.name,
      description: role.description,
      isSystem: isSystemRole(role.name),
      userCount: role._count.userRoles,
      permissionCount: role._count.rolePermissions,
      permissions: role.rolePermissions?.map((rp) => ({
        id: rp.permission.id,
        code: toPermissionCode(rp.permission.resource, rp.permission.action),
        action: rp.permission.action,
        resource: rp.permission.resource,
        description: rp.permission.description,
      })),
      createdAt: role.createdAt.toISOString(),
      updatedAt: role.updatedAt.toISOString(),
    };
  }

  private toPermissionDto(permission: {
    id: string;
    action: string;
    resource: string;
    description: string | null;
    createdAt: Date;
    updatedAt: Date;
    rolePermissions: Array<{ role: { id: string; name: RoleName } }>;
  }): AdminPermissionDto {
    return {
      id: permission.id,
      code: toPermissionCode(permission.resource, permission.action),
      action: permission.action,
      resource: permission.resource,
      description: permission.description,
      assignedRoles: permission.rolePermissions.map((rp) => ({
        id: rp.role.id,
        name: rp.role.name,
      })),
      createdAt: permission.createdAt.toISOString(),
      updatedAt: permission.updatedAt.toISOString(),
    };
  }

  private assertActor(actor: ActorContext): void {
    if (!actor.id) {
      throw AppError.unauthorized('Authentication required');
    }
  }

  private assertUserManagers(actor: ActorContext): void {
    this.assertActor(actor);
    if (!actor.roles.some((role) => role === 'SUPER_ADMIN' || role === 'CAMPUS_ADMIN')) {
      throw AppError.forbidden('User management requires CAMPUS_ADMIN or SUPER_ADMIN');
    }
  }

  private assertSuperAdmin(actor: ActorContext): void {
    this.assertActor(actor);
    if (!actor.roles.includes('SUPER_ADMIN')) {
      throw AppError.forbidden('This action requires SUPER_ADMIN');
    }
  }

  private async resolveRole(roleId?: string, roleName?: RoleName) {
    if (roleId) {
      const role = await this.repo.findRoleById(roleId);
      if (!role) throw AppError.badRequest('Invalid role');
      return role;
    }
    if (roleName) {
      const role = await this.repo.findRoleByName(roleName);
      if (!role) throw AppError.badRequest(`Role '${roleName}' does not exist`);
      return role;
    }
    throw AppError.badRequest('A role is required');
  }

  private async assertCanAssign(actor: ActorContext, targetRoleName: RoleName): Promise<void> {
    if (!canAssignRole(actor.roles, targetRoleName)) {
      throw AppError.forbidden('Privilege escalation is not allowed for this role assignment');
    }
  }

  private async assertNotLastSuperAdmin(userId: string, nextActive: boolean, nextRoleName?: RoleName): Promise<void> {
    const isSuper = await this.repo.userHasRole(userId, 'SUPER_ADMIN');
    if (!isSuper) return;

    const removingRole = nextRoleName !== undefined && nextRoleName !== 'SUPER_ADMIN';
    const deactivating = nextActive === false;
    if (!removingRole && !deactivating) return;

    const remaining = await this.repo.countActiveSuperAdmins(userId);
    if (remaining < 1) {
      throw AppError.conflict('Cannot remove or deactivate the last SUPER_ADMIN');
    }
  }

  async listUsers(query: ListAdminUsersQuery, actor?: ActorContext) {
    let scopedQuery = query;
    if (actor) {
      const scope = await resolveDepartmentScope(this.repo.getDb(), {
        userId: actor.id,
        roles: actor.roles,
      });
      scopedQuery = applyDepartmentQueryFilter(scope, query);
    }
    const result = await this.repo.findUsers(scopedQuery);
    return {
      data: result.data.map((user) => this.toUserDto(user, false)),
      meta: { pagination: buildPaginationMeta(result.total, result.page, result.limit) },
    };
  }

  async getUser(id: string, actor?: ActorContext): Promise<AdminUserDto> {
    const user = await this.repo.findUserById(id);
    if (!user) throw AppError.notFound('User');
    if (actor) {
      const scope = await resolveDepartmentScope(this.repo.getDb(), {
        userId: actor.id,
        roles: actor.roles,
      });
      assertDepartmentAccess(scope, user.departmentId);
    }
    return this.toUserDto(user, true);
  }

  async createUser(actor: ActorContext, dto: CreateAdminUserDto): Promise<AdminUserDto> {
    this.assertUserManagers(actor);

    const existing = await this.repo.findUserByEmail(dto.email);
    if (existing) {
      throw AppError.conflict('User with this email already exists');
    }

    const role = await this.resolveRole(dto.roleId, dto.roleName);
    await this.assertCanAssign(actor, role.name);

    let departmentId: string | null = dto.departmentId ?? null;
    if (departmentId) {
      const department = await this.repo.findDepartmentById(departmentId);
      if (!department) throw AppError.badRequest('Invalid department');
    }

    const isActive = resolveActiveFlag(dto) ?? true;
    const passwordHash = await bcrypt.hash(dto.password, 10);

    const created = await this.repo.createUser({
      email: dto.email,
      passwordHash,
      firstName: dto.firstName,
      lastName: dto.lastName,
      isActive,
      departmentId,
      roleId: role.id,
    });

    log.info(`Admin created user ${created.id} (${created.email})`);
    await this.audit.logEvent({
      actorId: actor.id,
      action: 'createUser',
      entityName: 'User',
      entityId: created.id,
      metadata: { email: created.email, role: role.name, isActive },
    });

    return this.toUserDto(created, true);
  }

  async updateUser(actor: ActorContext, id: string, dto: UpdateAdminUserDto): Promise<AdminUserDto> {
    this.assertUserManagers(actor);
    const existing = await this.repo.findUserById(id);
    if (!existing) throw AppError.notFound('User');

    const targetIsSuper = existing.userRoles.some((ur) => ur.role.name === 'SUPER_ADMIN');
    if (targetIsSuper && !actor.roles.includes('SUPER_ADMIN')) {
      throw AppError.forbidden('Cannot modify SUPER_ADMIN accounts');
    }

    if (dto.email && dto.email !== existing.email) {
      const duplicate = await this.repo.findUserByEmail(dto.email);
      if (duplicate) throw AppError.conflict('User with this email already exists');
    }

    let nextRoleName: RoleName | undefined;
    if (dto.roleId || dto.roleName) {
      const role = await this.resolveRole(dto.roleId, dto.roleName);
      await this.assertCanAssign(actor, role.name);
      nextRoleName = role.name;
      await this.assertNotLastSuperAdmin(id, existing.isActive, nextRoleName);
      await this.repo.replaceUserRole(id, role.id);
    }

    if (dto.departmentId) {
      const department = await this.repo.findDepartmentById(dto.departmentId);
      if (!department) throw AppError.badRequest('Invalid department');
    }

    const nextActive = resolveActiveFlag(dto);
    if (nextActive === false) {
      await this.assertNotLastSuperAdmin(id, false, nextRoleName);
    }

    const passwordHash = dto.password ? await bcrypt.hash(dto.password, 10) : undefined;
    const updated = await this.repo.updateUser(id, {
      email: dto.email,
      firstName: dto.firstName,
      lastName: dto.lastName,
      isActive: nextActive,
      departmentId: dto.departmentId,
      passwordHash,
    });

    if (passwordHash) {
      await this.repo.revokeRefreshTokens(id);
    }

    if (nextActive === false && existing.isActive) {
      await this.repo.revokeRefreshTokens(id);
      await this.audit.logEvent({
        actorId: actor.id,
        action: 'deactivateUser',
        entityName: 'User',
        entityId: id,
      });
      await this.audit.notifyUser({
        userId: id,
        title: 'Account deactivated',
        message: 'Your CampusVerse account has been deactivated by an administrator.',
        severity: 'WARNING',
      });
    } else if (nextActive === true && !existing.isActive) {
      await this.audit.logEvent({
        actorId: actor.id,
        action: 'activateUser',
        entityName: 'User',
        entityId: id,
      });
      await this.audit.notifyUser({
        userId: id,
        title: 'Account activated',
        message: 'Your CampusVerse account has been activated.',
        severity: 'SUCCESS',
      });
    }

    await this.audit.logEvent({
      actorId: actor.id,
      action: 'updateUser',
      entityName: 'User',
      entityId: id,
      metadata: {
        fields: Object.keys(dto).filter((key) => key !== 'password'),
        role: nextRoleName,
      },
    });

    if (nextRoleName && !existing.userRoles.some((ur) => ur.role.name === nextRoleName)) {
      await this.audit.notifyUser({
        userId: id,
        title: 'Role updated',
        message: `Your role has been changed to ${nextRoleName}.`,
        severity: 'INFO',
        metadata: { role: nextRoleName },
      });
    }

    const fresh = await this.repo.findUserById(id);
    log.info(`Admin updated user ${id}`);
    return this.toUserDto(fresh ?? updated, true);
  }

  async updateUserStatus(actor: ActorContext, id: string, dto: UpdateUserStatusDto): Promise<AdminUserDto> {
    this.assertUserManagers(actor);
    const existing = await this.repo.findUserById(id);
    if (!existing) throw AppError.notFound('User');

    const targetIsSuper = existing.userRoles.some((ur) => ur.role.name === 'SUPER_ADMIN');
    if (targetIsSuper && !actor.roles.includes('SUPER_ADMIN')) {
      throw AppError.forbidden('Cannot modify SUPER_ADMIN accounts');
    }

    const nextActive = resolveActiveFlag(dto);
    if (nextActive === undefined) {
      throw AppError.badRequest('Status or isActive is required');
    }

    if (nextActive === false) {
      await this.assertNotLastSuperAdmin(id, false);
    }

    const updated = await this.repo.updateUser(id, { isActive: nextActive });
    if (!nextActive) {
      await this.repo.revokeRefreshTokens(id);
      await invalidateUserStatus(id);
    } else {
      await invalidateUserStatus(id);
    }

    await this.audit.logEvent({
      actorId: actor.id,
      action: nextActive ? 'activateUser' : 'deactivateUser',
      entityName: 'User',
      entityId: id,
    });

    await this.audit.notifyUser({
      userId: id,
      title: nextActive ? 'Account activated' : 'Account deactivated',
      message: nextActive
        ? 'Your CampusVerse account has been activated.'
        : 'Your CampusVerse account has been deactivated by an administrator.',
      severity: nextActive ? 'SUCCESS' : 'WARNING',
    });

    return this.toUserDto(updated, true);
  }

  async resetUserPassword(actor: ActorContext, id: string, dto: ResetUserPasswordDto): Promise<AdminUserDto> {
    this.assertUserManagers(actor);
    const existing = await this.repo.findUserById(id);
    if (!existing) throw AppError.notFound('User');

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const updated = await this.repo.updateUser(id, { passwordHash });
    await this.repo.revokeRefreshTokens(id);

    await this.audit.logEvent({
      actorId: actor.id,
      action: 'resetUserPassword',
      entityName: 'User',
      entityId: id,
    });

    return this.toUserDto(updated, true);
  }

  async deactivateUser(actor: ActorContext, id: string): Promise<void> {
    await this.updateUserStatus(actor, id, { isActive: false, status: 'INACTIVE' });
  }

  async listRoles(query: ListRolesQuery) {
    const result = await this.repo.findRoles(query);
    return {
      data: result.data.map((role) => this.toRoleDto(role)),
      meta: { pagination: buildPaginationMeta(result.total, result.page, result.limit) },
    };
  }

  async getRole(id: string): Promise<AdminRoleDto> {
    const role = await this.repo.findRoleById(id);
    if (!role) throw AppError.notFound('Role');
    return this.toRoleDto(role);
  }

  async createRole(actor: ActorContext, dto: CreateRoleDto): Promise<AdminRoleDto> {
    this.assertSuperAdmin(actor);
    const existing = await this.repo.findRoleByName(dto.name);
    if (existing) {
      throw AppError.conflict(`Role '${dto.name}' already exists`);
    }
    const created = await this.repo.createRole(dto);
    await this.audit.logEvent({
      actorId: actor.id,
      action: 'createRole',
      entityName: 'Role',
      entityId: created.id,
      metadata: { name: created.name },
    });
    return this.toRoleDto(created);
  }

  async updateRole(actor: ActorContext, id: string, dto: UpdateRoleDto): Promise<AdminRoleDto> {
    this.assertSuperAdmin(actor);
    const existing = await this.repo.findRoleById(id);
    if (!existing) throw AppError.notFound('Role');
    const updated = await this.repo.updateRole(id, dto);
    await this.audit.logEvent({
      actorId: actor.id,
      action: 'updateRole',
      entityName: 'Role',
      entityId: id,
    });
    return this.toRoleDto(updated);
  }

  async deleteRole(actor: ActorContext, id: string): Promise<void> {
    this.assertSuperAdmin(actor);
    const existing = await this.repo.findRoleById(id);
    if (!existing) throw AppError.notFound('Role');
    if (isSystemRole(existing.name)) {
      throw AppError.conflict('System roles cannot be deleted');
    }
    if (existing._count.userRoles > 0) {
      throw AppError.conflict('Cannot delete a role that is still assigned to users');
    }
    await this.repo.deleteRole(id);
    invalidateAuthorizationCache();
    await this.audit.logEvent({
      actorId: actor.id,
      action: 'deleteRole',
      entityName: 'Role',
      entityId: id,
      metadata: { name: existing.name },
    });
  }

  async listPermissions(query: ListPermissionsQuery) {
    const result = await this.repo.findPermissions(query);
    return {
      data: result.data.map((permission) => this.toPermissionDto(permission)),
      meta: { pagination: buildPaginationMeta(result.total, result.page, result.limit) },
    };
  }

  async getPermission(id: string): Promise<AdminPermissionDto> {
    const permission = await this.repo.findPermissionById(id);
    if (!permission) throw AppError.notFound('Permission');
    return this.toPermissionDto(permission);
  }

  async updateRolePermissions(
    actor: ActorContext,
    roleId: string,
    dto: UpdateRolePermissionsDto,
  ): Promise<AdminRoleDto> {
    this.assertSuperAdmin(actor);

    const role = await this.repo.findRoleById(roleId);
    if (!role) throw AppError.notFound('Role');

    const uniqueIds = [...new Set(dto.permissionIds)];
    if (uniqueIds.length !== dto.permissionIds.length) {
      // Duplicates are stripped; assignment remains idempotent.
      log.info('Duplicate permission ids stripped from role permission update');
    }

    const found = uniqueIds.length > 0 ? await this.repo.findPermissionsByIds(uniqueIds) : [];
    if (found.length !== uniqueIds.length) {
      throw AppError.badRequest('One or more permissions are invalid');
    }

    const previousIds = role.rolePermissions.map((rp) => rp.permission.id).sort();
    const nextIds = [...uniqueIds].sort();

    const updated = await this.repo.replaceRolePermissions(roleId, uniqueIds);
    if (!updated) throw AppError.notFound('Role');

    invalidateAuthorizationCache();

    await this.audit.logEvent({
      actorId: actor.id,
      action: 'updateRolePermissions',
      entityName: 'RolePermission',
      entityId: roleId,
      metadata: {
        role: role.name,
        previousCount: previousIds.length,
        nextCount: nextIds.length,
      },
    });

    const added = nextIds.filter((id) => !previousIds.includes(id)).length;
    const removed = previousIds.filter((id) => !nextIds.includes(id)).length;
    if (added > 0 || removed > 0) {
      const affectedUserIds = await this.repo.findUserIdsByRoleName(role.name);
      const sample = affectedUserIds.slice(0, 25);
      await Promise.all(
        sample.map((userId) =>
          this.audit.notifyUser({
            userId,
            title: 'Role permissions updated',
            message: `Permissions for role ${role.name} were changed by an administrator.`,
            severity: 'INFO',
            metadata: { role: role.name },
          }),
        ),
      );
    }

    return this.toRoleDto(updated);
  }

  async listAudit(query: ListAdminAuditQuery) {
    const result = await this.audit.listEvents(query);
    return {
      data: result.data,
      meta: { pagination: buildPaginationMeta(result.total, result.page, result.limit) },
    };
  }
}
