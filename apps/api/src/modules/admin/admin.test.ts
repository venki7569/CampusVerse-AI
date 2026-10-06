import assert from 'node:assert';
import { RoleName } from '@prisma/client';
import { AdminService } from './admin.service';
import { canAssignRole, DEFAULT_ROLE_PERMISSIONS, isSystemRole } from './admin.permissions';
import { AuthorizationService } from './authorization.service';
import type { ActorContext, ListAdminUsersQuery, ListPermissionsQuery, ListRolesQuery } from './admin.dto';
import type { AdminAuditAction } from './admin.audit.service';

let passed = 0;
let total = 0;

async function test(name: string, fn: () => Promise<void> | void): Promise<void> {
  total += 1;
  try {
    await fn();
    passed += 1;
    console.log(`  PASS  ${name}`);
  } catch (err) {
    console.error(`  FAIL  ${name}`);
    console.error(err);
  }
}

type RoleRow = {
  id: string;
  name: RoleName;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type PermissionRow = {
  id: string;
  action: string;
  resource: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type UserRow = {
  id: string;
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
  departmentId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

const auditEvents: Array<{
  actorId: string;
  action: AdminAuditAction;
  entityName: string;
  entityId: string;
  metadata?: Record<string, unknown>;
}> = [];

const notifications: Array<{ userId: string; title: string; message: string }> = [];

function makeId(prefix: string): string {
  return `${prefix}-${Math.random().toString(16).slice(2, 10)}`;
}

function buildHarness() {
  const roles: RoleRow[] = [
    {
      id: 'role-super',
      name: 'SUPER_ADMIN',
      description: 'Super',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'role-campus',
      name: 'CAMPUS_ADMIN',
      description: 'Campus',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'role-dept',
      name: 'DEPARTMENT_ADMIN',
      description: 'Dept',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'role-faculty',
      name: 'FACULTY',
      description: 'Faculty',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'role-maint',
      name: 'MAINTENANCE_STAFF',
      description: 'Maintenance',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  const permissions: PermissionRow[] = [
    {
      id: 'perm-users-read',
      action: 'read',
      resource: 'users',
      description: 'View users',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'perm-users-create',
      action: 'create',
      resource: 'users',
      description: 'Create users',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'perm-users-update',
      action: 'update',
      resource: 'users',
      description: 'Update users',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'perm-users-manage',
      action: 'manage',
      resource: 'users',
      description: 'Manage users',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'perm-roles-read',
      action: 'read',
      resource: 'roles',
      description: 'View roles',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  const rolePermissions: Array<{ roleId: string; permissionId: string }> = [
    { roleId: 'role-super', permissionId: 'perm-users-read' },
    { roleId: 'role-super', permissionId: 'perm-users-create' },
    { roleId: 'role-super', permissionId: 'perm-users-update' },
    { roleId: 'role-super', permissionId: 'perm-users-manage' },
    { roleId: 'role-super', permissionId: 'perm-roles-read' },
    { roleId: 'role-campus', permissionId: 'perm-users-read' },
    { roleId: 'role-campus', permissionId: 'perm-users-create' },
    { roleId: 'role-campus', permissionId: 'perm-users-update' },
    { roleId: 'role-campus', permissionId: 'perm-users-manage' },
    { roleId: 'role-campus', permissionId: 'perm-roles-read' },
    { roleId: 'role-dept', permissionId: 'perm-users-read' },
    { roleId: 'role-dept', permissionId: 'perm-roles-read' },
  ];

  const users: UserRow[] = [
    {
      id: 'user-super',
      email: 'super@campus.edu',
      passwordHash: 'hash-super',
      firstName: 'Super',
      lastName: 'Admin',
      isActive: true,
      departmentId: 'dept-1',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    },
  ];

  const userRoles: Array<{ userId: string; roleId: string }> = [
    { userId: 'user-super', roleId: 'role-super' },
  ];

  const departments = [{ id: 'dept-1', code: 'CS', name: 'Computer Science' }];

  function roleById(id: string) {
    return roles.find((r) => r.id === id) ?? null;
  }

  function attachUser(user: UserRow, detail = false) {
    const assigned = userRoles
      .filter((ur) => ur.userId === user.id)
      .map((ur) => {
        const role = roleById(ur.roleId)!;
        if (!detail) {
          return { role: { id: role.id, name: role.name, description: role.description } };
        }
        return {
          role: {
            id: role.id,
            name: role.name,
            description: role.description,
            rolePermissions: rolePermissions
              .filter((rp) => rp.roleId === role.id)
              .map((rp) => ({
                permission: permissions.find((p) => p.id === rp.permissionId)!,
              })),
          },
        };
      });

    return {
      ...user,
      department: departments.find((d) => d.id === user.departmentId) ?? null,
      userRoles: assigned,
    };
  }

  const repo = {
    findUsers: async (query: ListAdminUsersQuery) => {
      let rows = [...users];
      if (query.search) {
        const q = query.search.toLowerCase();
        rows = rows.filter(
          (u) =>
            u.email.toLowerCase().includes(q) ||
            u.firstName.toLowerCase().includes(q) ||
            u.lastName.toLowerCase().includes(q),
        );
      }
      if (query.roleId) {
        const ids = new Set(userRoles.filter((ur) => ur.roleId === query.roleId).map((ur) => ur.userId));
        rows = rows.filter((u) => ids.has(u.id));
      }
      if (query.departmentId) {
        rows = rows.filter((u) => u.departmentId === query.departmentId);
      }
      if (query.status === 'ACTIVE') rows = rows.filter((u) => u.isActive);
      if (query.status === 'INACTIVE') rows = rows.filter((u) => !u.isActive);
      const total = rows.length;
      const start = (query.page - 1) * query.limit;
      const data = rows.slice(start, start + query.limit).map((u) => attachUser(u, false));
      return { data, total, page: query.page, limit: query.limit };
    },
    findUserById: async (id: string) => {
      const user = users.find((u) => u.id === id);
      return user ? attachUser(user, true) : null;
    },
    findUserByEmail: async (email: string) => users.find((u) => u.email === email) ?? null,
    findDepartmentById: async (id: string) => departments.find((d) => d.id === id) ?? null,
    findRoleById: async (id: string) => {
      const role = roleById(id);
      if (!role) return null;
      return {
        ...role,
        _count: {
          userRoles: userRoles.filter((ur) => ur.roleId === id).length,
          rolePermissions: rolePermissions.filter((rp) => rp.roleId === id).length,
        },
        rolePermissions: rolePermissions
          .filter((rp) => rp.roleId === id)
          .map((rp) => ({ permission: permissions.find((p) => p.id === rp.permissionId)! })),
      };
    },
    findRoleByName: async (name: RoleName) => roles.find((r) => r.name === name) ?? null,
    countActiveSuperAdmins: async (excludeUserId?: string) => {
      return users.filter((u) => {
        if (!u.isActive) return false;
        if (excludeUserId && u.id === excludeUserId) return false;
        return userRoles.some(
          (ur) => ur.userId === u.id && roleById(ur.roleId)?.name === 'SUPER_ADMIN',
        );
      }).length;
    },
    userHasRole: async (userId: string, roleName: RoleName) =>
      userRoles.some((ur) => ur.userId === userId && roleById(ur.roleId)?.name === roleName),
    createUser: async (input: {
      email: string;
      passwordHash: string;
      firstName: string;
      lastName: string;
      isActive: boolean;
      departmentId: string | null;
      roleId: string;
    }) => {
      const user: UserRow = {
        id: makeId('user'),
        email: input.email,
        passwordHash: input.passwordHash,
        firstName: input.firstName,
        lastName: input.lastName,
        isActive: input.isActive,
        departmentId: input.departmentId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      users.push(user);
      userRoles.push({ userId: user.id, roleId: input.roleId });
      return attachUser(user, true);
    },
    updateUser: async (
      id: string,
      data: Partial<{
        email: string;
        firstName: string;
        lastName: string;
        isActive: boolean;
        departmentId: string | null;
        passwordHash: string;
      }>,
    ) => {
      const user = users.find((u) => u.id === id)!;
      Object.assign(user, data, { updatedAt: new Date() });
      return attachUser(user, true);
    },
    replaceUserRole: async (userId: string, roleId: string) => {
      for (let i = userRoles.length - 1; i >= 0; i -= 1) {
        if (userRoles[i]?.userId === userId) userRoles.splice(i, 1);
      }
      userRoles.push({ userId, roleId });
    },
    revokeRefreshTokens: async () => undefined,
    findRoles: async (query: ListRolesQuery) => {
      let rows = [...roles];
      if (query.search) {
        const q = query.search.toLowerCase();
        rows = rows.filter(
          (r) => r.name.toLowerCase().includes(q) || (r.description ?? '').toLowerCase().includes(q),
        );
      }
      const total = rows.length;
      const start = (query.page - 1) * query.limit;
      const data = rows.slice(start, start + query.limit).map((role) => ({
        ...role,
        _count: {
          userRoles: userRoles.filter((ur) => ur.roleId === role.id).length,
          rolePermissions: rolePermissions.filter((rp) => rp.roleId === role.id).length,
        },
        rolePermissions: rolePermissions
          .filter((rp) => rp.roleId === role.id)
          .map((rp) => ({ permission: permissions.find((p) => p.id === rp.permissionId)! })),
      }));
      return { data, total, page: query.page, limit: query.limit };
    },
    createRole: async (dto: { name: RoleName; description?: string | null }) => {
      const role: RoleRow = {
        id: makeId('role'),
        name: dto.name,
        description: dto.description ?? null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      roles.push(role);
      return {
        ...role,
        _count: { userRoles: 0, rolePermissions: 0 },
        rolePermissions: [],
      };
    },
    updateRole: async (id: string, dto: { description?: string | null }) => {
      const role = roleById(id)!;
      role.description = dto.description ?? null;
      role.updatedAt = new Date();
      return {
        ...role,
        _count: {
          userRoles: userRoles.filter((ur) => ur.roleId === id).length,
          rolePermissions: rolePermissions.filter((rp) => rp.roleId === id).length,
        },
        rolePermissions: rolePermissions
          .filter((rp) => rp.roleId === id)
          .map((rp) => ({ permission: permissions.find((p) => p.id === rp.permissionId)! })),
      };
    },
    deleteRole: async (id: string) => {
      const idx = roles.findIndex((r) => r.id === id);
      if (idx >= 0) roles.splice(idx, 1);
    },
    findPermissions: async (query: ListPermissionsQuery) => {
      let rows = [...permissions];
      if (query.resource) rows = rows.filter((p) => p.resource === query.resource);
      if (query.search) {
        const q = query.search.toLowerCase();
        rows = rows.filter(
          (p) =>
            p.action.toLowerCase().includes(q) ||
            p.resource.toLowerCase().includes(q) ||
            (p.description ?? '').toLowerCase().includes(q),
        );
      }
      const total = rows.length;
      const start = (query.page - 1) * query.limit;
      const data = rows.slice(start, start + query.limit).map((permission) => ({
        ...permission,
        rolePermissions: rolePermissions
          .filter((rp) => rp.permissionId === permission.id)
          .map((rp) => ({ role: { id: rp.roleId, name: roleById(rp.roleId)!.name } })),
      }));
      return { data, total, page: query.page, limit: query.limit };
    },
    findPermissionById: async (id: string) => {
      const permission = permissions.find((p) => p.id === id);
      if (!permission) return null;
      return {
        ...permission,
        rolePermissions: rolePermissions
          .filter((rp) => rp.permissionId === id)
          .map((rp) => ({ role: { id: rp.roleId, name: roleById(rp.roleId)!.name } })),
      };
    },
    findPermissionsByIds: async (ids: string[]) => permissions.filter((p) => ids.includes(p.id)),
    replaceRolePermissions: async (roleId: string, permissionIds: string[]) => {
      for (let i = rolePermissions.length - 1; i >= 0; i -= 1) {
        if (rolePermissions[i]?.roleId === roleId) rolePermissions.splice(i, 1);
      }
      const unique = [...new Set(permissionIds)];
      for (const permissionId of unique) {
        rolePermissions.push({ roleId, permissionId });
      }
      return repo.findRoleById(roleId);
    },
    findUserIdsByRoleName: async (name: RoleName) =>
      userRoles
        .filter((ur) => roleById(ur.roleId)?.name === name)
        .map((ur) => ur.userId)
        .filter((userId) => users.find((u) => u.id === userId)?.isActive),
    permissionCode: (action: string, resource: string) => `${resource}.${action}`,
  };

  const audit = {
    logEvent: async (entry: {
      actorId: string;
      action: AdminAuditAction;
      entityName: string;
      entityId: string;
      metadata?: Record<string, unknown>;
    }) => {
      auditEvents.push(entry);
    },
    listEvents: async () => ({ data: [], total: 0, page: 1, limit: 20 }),
    notifyUser: async (input: { userId: string; title: string; message: string }) => {
      notifications.push(input);
    },
    getDb: () => ({
      user: {
        findUnique: async ({ where }: { where: { id: string } }) => {
          const user = users.find((u) => u.id === where.id);
          if (user) return { departmentId: user.departmentId };
          if (where.id === 'actor-dept') return { departmentId: 'dept-1' };
          return null;
        },
      },
    }),
  };

  const service = new AdminService(repo as never, audit as never);
  return { service, users, roles, permissions, rolePermissions, userRoles };
}

const superActor: ActorContext = {
  id: 'user-super',
  email: 'super@campus.edu',
  roles: ['SUPER_ADMIN'],
};

const campusActor: ActorContext = {
  id: 'actor-campus',
  email: 'campus@campus.edu',
  roles: ['CAMPUS_ADMIN'],
};

const deptActor: ActorContext = {
  id: 'actor-dept',
  email: 'dept@campus.edu',
  roles: ['DEPARTMENT_ADMIN'],
};

const facultyActor: ActorContext = {
  id: 'actor-faculty',
  email: 'faculty@campus.edu',
  roles: ['FACULTY'],
};

const maintActor: ActorContext = {
  id: 'actor-maint',
  email: 'maint@campus.edu',
  roles: ['MAINTENANCE_STAFF'],
};

const defaultUserQuery: ListAdminUsersQuery = {
  page: 1,
  limit: 20,
  sortOrder: 'desc',
  search: undefined,
  sortBy: undefined,
  roleId: undefined,
  departmentId: undefined,
  status: undefined,
};

async function runTests(): Promise<void> {
  console.log('\n============================================================');
  console.log('ADMIN / RBAC SERVICE TESTS');
  console.log('============================================================\n');

  auditEvents.length = 0;
  notifications.length = 0;
  const { service, users, roles, permissions, rolePermissions } = buildHarness();

  await test('List users', async () => {
    const result = await service.listUsers(defaultUserQuery);
    assert.ok(result.data.length >= 1);
    assert.ok(result.data.every((u) => !('passwordHash' in u)));
  });

  await test('Pagination', async () => {
    await service.createUser(superActor, {
      email: 'page1@campus.edu',
      password: 'Password123!',
      firstName: 'Page',
      lastName: 'One',
      roleName: 'FACULTY',
      isActive: true,
    });
    await service.createUser(superActor, {
      email: 'page2@campus.edu',
      password: 'Password123!',
      firstName: 'Page',
      lastName: 'Two',
      roleName: 'FACULTY',
      isActive: true,
    });
    const page1 = await service.listUsers({ ...defaultUserQuery, page: 1, limit: 1 });
    assert.strictEqual(page1.data.length, 1);
    assert.ok(page1.meta.pagination.total >= 2);
  });

  await test('Search', async () => {
    const result = await service.listUsers({ ...defaultUserQuery, search: 'super@' });
    assert.ok(result.data.some((u) => u.email.includes('super@')));
  });

  await test('Role filtering', async () => {
    const result = await service.listUsers({ ...defaultUserQuery, roleId: 'role-super' });
    assert.ok(result.data.every((u) => u.roles.some((r) => r.id === 'role-super')));
  });

  await test('Department filtering', async () => {
    const result = await service.listUsers({ ...defaultUserQuery, departmentId: 'dept-1' });
    assert.ok(result.data.every((u) => u.departmentId === 'dept-1'));
  });

  await test('Status filtering', async () => {
    const result = await service.listUsers({ ...defaultUserQuery, status: 'ACTIVE' });
    assert.ok(result.data.every((u) => u.status === 'ACTIVE'));
  });

  await test('Get user', async () => {
    const user = await service.getUser('user-super');
    assert.strictEqual(user.id, 'user-super');
    assert.ok(user.permissions && user.permissions.length > 0);
  });

  let createdUserId = '';
  await test('Create user', async () => {
    const created = await service.createUser(superActor, {
      email: 'new.user@campus.edu',
      password: 'Password123!',
      firstName: 'New',
      lastName: 'User',
      roleName: 'FACULTY',
      departmentId: 'dept-1',
      isActive: true,
    });
    createdUserId = created.id;
    assert.strictEqual(created.email, 'new.user@campus.edu');
    assert.ok(!('passwordHash' in created));
  });

  await test('Duplicate email rejection', async () => {
    let rejected = false;
    try {
      await service.createUser(superActor, {
        email: 'new.user@campus.edu',
        password: 'Password123!',
        firstName: 'Dup',
        lastName: 'User',
        roleName: 'FACULTY',
        isActive: true,
      });
    } catch {
      rejected = true;
    }
    assert.strictEqual(rejected, true);
  });

  await test('Update user', async () => {
    const updated = await service.updateUser(superActor, createdUserId, { firstName: 'Updated' });
    assert.strictEqual(updated.firstName, 'Updated');
  });

  await test('Activate user', async () => {
    await service.updateUserStatus(superActor, createdUserId, { status: 'INACTIVE' });
    const activated = await service.updateUserStatus(superActor, createdUserId, { status: 'ACTIVE' });
    assert.strictEqual(activated.isActive, true);
  });

  await test('Deactivate user', async () => {
    const deactivated = await service.updateUserStatus(superActor, createdUserId, {
      status: 'INACTIVE',
    });
    assert.strictEqual(deactivated.isActive, false);
  });

  await test('Password never returned', async () => {
    const user = await service.getUser(createdUserId);
    assert.ok(!Object.prototype.hasOwnProperty.call(user, 'passwordHash'));
    assert.ok(!Object.prototype.hasOwnProperty.call(user, 'password'));
  });

  await test('Last SUPER_ADMIN protection', async () => {
    let rejected = false;
    try {
      await service.updateUserStatus(superActor, 'user-super', { status: 'INACTIVE' });
    } catch {
      rejected = true;
    }
    assert.strictEqual(rejected, true);
  });

  await test('List roles', async () => {
    const result = await service.listRoles({
      page: 1,
      limit: 20,
      sortOrder: 'asc',
      search: undefined,
      sortBy: undefined,
    });
    assert.ok(result.data.length >= 4);
    assert.ok(result.data.every((r) => r.isSystem === true));
  });

  await test('Get role', async () => {
    const role = await service.getRole('role-campus');
    assert.strictEqual(role.name, 'CAMPUS_ADMIN');
  });

  await test('Create role', async () => {
    const created = await service.createRole(superActor, {
      name: 'SECURITY_STAFF',
      description: 'Security staff',
    });
    assert.strictEqual(created.name, 'SECURITY_STAFF');
  });

  await test('Update role', async () => {
    const updated = await service.updateRole(superActor, 'role-faculty', {
      description: 'Teaching staff',
    });
    assert.strictEqual(updated.description, 'Teaching staff');
  });

  await test('Delete protected role rejection', async () => {
    let rejected = false;
    try {
      await service.deleteRole(superActor, 'role-super');
    } catch {
      rejected = true;
    }
    assert.strictEqual(rejected, true);
    assert.strictEqual(isSystemRole('SUPER_ADMIN'), true);
  });

  await test('List permissions', async () => {
    const result = await service.listPermissions({
      page: 1,
      limit: 20,
      sortOrder: 'asc',
      search: undefined,
      sortBy: undefined,
      resource: undefined,
    });
    assert.ok(result.data.some((p) => p.code === 'users.read'));
  });

  await test('Get permission', async () => {
    const permission = await service.getPermission('perm-users-read');
    assert.strictEqual(permission.code, 'users.read');
  });

  await test('Assign permission to role', async () => {
    const updated = await service.updateRolePermissions(superActor, 'role-faculty', {
      permissionIds: ['perm-users-read', 'perm-roles-read'],
    });
    assert.ok(updated.permissions?.some((p) => p.code === 'users.read'));
  });

  await test('Remove permission', async () => {
    const updated = await service.updateRolePermissions(superActor, 'role-faculty', {
      permissionIds: ['perm-roles-read'],
    });
    assert.ok(!updated.permissions?.some((p) => p.code === 'users.read'));
    assert.ok(updated.permissions?.some((p) => p.code === 'roles.read'));
  });

  await test('Duplicate permission protection', async () => {
    const updated = await service.updateRolePermissions(superActor, 'role-faculty', {
      permissionIds: ['perm-roles-read', 'perm-roles-read'],
    });
    assert.strictEqual(updated.permissionCount, 1);
  });

  await test('SUPER_ADMIN access', async () => {
    const created = await service.createUser(superActor, {
      email: 'by-super@campus.edu',
      password: 'Password123!',
      firstName: 'By',
      lastName: 'Super',
      roleName: 'FACULTY',
      isActive: true,
    });
    assert.ok(created.id);
  });

  await test('CAMPUS_ADMIN permissions', async () => {
    assert.ok(DEFAULT_ROLE_PERMISSIONS.CAMPUS_ADMIN.includes('users.create'));
    assert.ok(!DEFAULT_ROLE_PERMISSIONS.CAMPUS_ADMIN.includes('permissions.manage'));
    const created = await service.createUser(campusActor, {
      email: 'by-campus@campus.edu',
      password: 'Password123!',
      firstName: 'By',
      lastName: 'Campus',
      roleName: 'FACULTY',
      isActive: true,
    });
    assert.ok(created.id);
  });

  await test('DEPARTMENT_ADMIN restrictions', async () => {
    let rejected = false;
    try {
      await service.createUser(deptActor, {
        email: 'by-dept@campus.edu',
        password: 'Password123!',
        firstName: 'By',
        lastName: 'Dept',
        roleName: 'FACULTY',
        isActive: true,
      });
    } catch {
      rejected = true;
    }
    assert.strictEqual(rejected, true);
  });

  await test('FACULTY rejection', async () => {
    let rejected = false;
    try {
      await service.createUser(facultyActor, {
        email: 'by-faculty@campus.edu',
        password: 'Password123!',
        firstName: 'By',
        lastName: 'Faculty',
        roleName: 'STUDENT',
        isActive: true,
      });
    } catch {
      rejected = true;
    }
    assert.strictEqual(rejected, true);
  });

  await test('MAINTENANCE_STAFF rejection', async () => {
    let rejected = false;
    try {
      await service.updateUserStatus(maintActor, createdUserId, { status: 'ACTIVE' });
    } catch {
      rejected = true;
    }
    assert.strictEqual(rejected, true);
  });

  await test('Unauthorized request rejection', async () => {
    let rejected = false;
    try {
      await service.createUser({ id: '', email: '', roles: [] }, {
        email: 'noauth@campus.edu',
        password: 'Password123!',
        firstName: 'No',
        lastName: 'Auth',
        roleName: 'FACULTY',
        isActive: true,
      });
    } catch {
      rejected = true;
    }
    assert.strictEqual(rejected, true);
  });

  await test('Cross-user protection', async () => {
    let rejected = false;
    try {
      await service.updateUser(campusActor, 'user-super', { firstName: 'Hacked' });
    } catch {
      rejected = true;
    }
    assert.strictEqual(rejected, true);
  });

  await test('Privilege escalation prevention', async () => {
    assert.strictEqual(canAssignRole(['CAMPUS_ADMIN'], 'SUPER_ADMIN'), false);
    let rejected = false;
    try {
      await service.createUser(campusActor, {
        email: 'escalate@campus.edu',
        password: 'Password123!',
        firstName: 'Escalate',
        lastName: 'Attempt',
        roleName: 'SUPER_ADMIN',
        isActive: true,
      });
    } catch {
      rejected = true;
    }
    assert.strictEqual(rejected, true);
  });

  await test('User creation audit', async () => {
    assert.ok(auditEvents.some((e) => e.action === 'createUser'));
  });

  await test('Role change audit', async () => {
    assert.ok(auditEvents.some((e) => e.action === 'updateRole' || e.action === 'createRole'));
  });

  await test('Permission change audit', async () => {
    assert.ok(auditEvents.some((e) => e.action === 'updateRolePermissions'));
  });

  await test('Relevant admin notification generation', async () => {
    assert.ok(notifications.some((n) => n.title.includes('deactivated') || n.title.includes('activated')));
  });

  await test('AuthorizationService SUPER_ADMIN bypass', async () => {
    const authz = new AuthorizationService({
      rolePermission: {
        findMany: async () => [],
      },
    } as never);
    const codes = await authz.getPermissionCodes(['SUPER_ADMIN']);
    assert.strictEqual(authz.hasPermission(codes, 'users.manage', ['SUPER_ADMIN']), true);
  });

  await test('AuthorizationService CAMPUS_ADMIN uses RolePermission', async () => {
    const authz = new AuthorizationService({
      rolePermission: {
        findMany: async () => [
          { permission: { action: 'read', resource: 'users' } },
          { permission: { action: 'create', resource: 'users' } },
        ],
      },
    } as never);
    const codes = await authz.getPermissionCodes(['CAMPUS_ADMIN']);
    assert.strictEqual(authz.hasPermission(codes, 'users.read', ['CAMPUS_ADMIN']), true);
    assert.strictEqual(authz.hasPermission(codes, 'permissions.manage', ['CAMPUS_ADMIN']), false);
  });

  assert.ok(users.length > 0);
  assert.ok(roles.length > 0);
  assert.ok(permissions.length > 0);
  assert.ok(rolePermissions.length > 0);

  console.log('\n============================================================');
  console.log(`ADMIN / RBAC RESULTS: ${passed} / ${total} TESTS PASSED`);
  console.log('============================================================\n');

  if (passed !== total) process.exit(1);
}

void runTests();
