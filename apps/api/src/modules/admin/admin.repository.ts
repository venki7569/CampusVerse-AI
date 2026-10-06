import { Prisma, PrismaClient, RoleName } from '@prisma/client';
import { getPrismaSkip, buildOrderBy } from '../../utils/pagination';
import { toPermissionCode } from './admin.permissions';
import type {
  ListAdminUsersQuery,
  ListRolesQuery,
  ListPermissionsQuery,
  CreateRoleDto,
  UpdateRoleDto,
} from './admin.dto';

const userListInclude = {
  department: { select: { id: true, code: true, name: true } },
  userRoles: {
    include: {
      role: { select: { id: true, name: true, description: true } },
    },
  },
} as const;

const userDetailInclude = {
  department: { select: { id: true, code: true, name: true } },
  userRoles: {
    include: {
      role: {
        include: {
          rolePermissions: {
            include: {
              permission: true,
            },
          },
        },
      },
    },
  },
} as const;

export type UserListRecord = Prisma.UserGetPayload<{ include: typeof userListInclude }>;
export type UserDetailRecord = Prisma.UserGetPayload<{ include: typeof userDetailInclude }>;

export class AdminRepository {
  constructor(private readonly db: PrismaClient) {}

  getDb(): PrismaClient {
    return this.db;
  }

  async findUsers(query: ListAdminUsersQuery): Promise<{
    data: UserListRecord[];
    total: number;
    page: number;
    limit: number;
  }> {
    const { page, limit, sortBy, sortOrder, search, roleId, departmentId, status } = query;
    const skip = getPrismaSkip(page, limit);
    const allowedSort = new Set(['createdAt', 'email', 'firstName', 'lastName', 'isActive']);
    const orderBy = buildOrderBy(sortBy && allowedSort.has(sortBy) ? sortBy : 'createdAt', sortOrder ?? 'desc');

    const where: Prisma.UserWhereInput = {};

    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (roleId) {
      where.userRoles = { some: { roleId } };
    }
    if (departmentId) {
      where.departmentId = departmentId;
    }
    if (status === 'ACTIVE') where.isActive = true;
    if (status === 'INACTIVE') where.isActive = false;

    const [data, total] = await Promise.all([
      this.db.user.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: userListInclude,
      }),
      this.db.user.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  async findUserById(id: string): Promise<UserDetailRecord | null> {
    return this.db.user.findUnique({
      where: { id },
      include: userDetailInclude,
    });
  }

  async findUserByEmail(email: string) {
    return this.db.user.findUnique({ where: { email } });
  }

  async findDepartmentById(id: string) {
    return this.db.department.findUnique({ where: { id }, select: { id: true, code: true, name: true } });
  }

  async findRoleById(id: string) {
    return this.db.role.findUnique({
      where: { id },
      include: {
        _count: { select: { userRoles: true, rolePermissions: true } },
        rolePermissions: { include: { permission: true } },
      },
    });
  }

  async findRoleByName(name: RoleName) {
    return this.db.role.findUnique({ where: { name } });
  }

  async countActiveSuperAdmins(excludeUserId?: string): Promise<number> {
    return this.db.user.count({
      where: {
        isActive: true,
        ...(excludeUserId ? { id: { not: excludeUserId } } : {}),
        userRoles: { some: { role: { name: 'SUPER_ADMIN' } } },
      },
    });
  }

  async userHasRole(userId: string, roleName: RoleName): Promise<boolean> {
    const found = await this.db.userRole.findFirst({
      where: { userId, role: { name: roleName } },
    });
    return Boolean(found);
  }

  async createUser(input: {
    email: string;
    passwordHash: string;
    firstName: string;
    lastName: string;
    isActive: boolean;
    departmentId: string | null;
    roleId: string;
  }): Promise<UserDetailRecord> {
    return this.db.user.create({
      data: {
        email: input.email,
        passwordHash: input.passwordHash,
        firstName: input.firstName,
        lastName: input.lastName,
        isActive: input.isActive,
        departmentId: input.departmentId,
        userRoles: { create: { roleId: input.roleId } },
      },
      include: userDetailInclude,
    });
  }

  async updateUser(
    id: string,
    data: {
      email?: string;
      firstName?: string;
      lastName?: string;
      isActive?: boolean;
      departmentId?: string | null;
      passwordHash?: string;
    },
  ): Promise<UserDetailRecord> {
    return this.db.user.update({
      where: { id },
      data,
      include: userDetailInclude,
    });
  }

  async replaceUserRole(userId: string, roleId: string): Promise<void> {
    await this.db.$transaction([
      this.db.userRole.deleteMany({ where: { userId } }),
      this.db.userRole.create({ data: { userId, roleId } }),
    ]);
  }

  async revokeRefreshTokens(userId: string): Promise<void> {
    await this.db.refreshToken.deleteMany({ where: { userId } });
  }

  async findRoles(query: ListRolesQuery) {
    const { page, limit, sortBy, sortOrder, search } = query;
    const skip = getPrismaSkip(page, limit);
    const allowedSort = new Set(['createdAt', 'name']);
    const orderBy = buildOrderBy(sortBy && allowedSort.has(sortBy) ? sortBy : 'name', sortOrder ?? 'asc');

    const where: Prisma.RoleWhereInput = search
      ? {
          OR: [
            { name: { equals: search as RoleName } },
            { description: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {};

    const [data, total] = await Promise.all([
      this.db.role.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          _count: { select: { userRoles: true, rolePermissions: true } },
          rolePermissions: { include: { permission: true } },
        },
      }),
      this.db.role.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  async createRole(dto: CreateRoleDto) {
    return this.db.role.create({
      data: {
        name: dto.name,
        description: dto.description ?? `${dto.name} role`,
      },
      include: {
        _count: { select: { userRoles: true, rolePermissions: true } },
        rolePermissions: { include: { permission: true } },
      },
    });
  }

  async updateRole(id: string, dto: UpdateRoleDto) {
    return this.db.role.update({
      where: { id },
      data: { description: dto.description },
      include: {
        _count: { select: { userRoles: true, rolePermissions: true } },
        rolePermissions: { include: { permission: true } },
      },
    });
  }

  async deleteRole(id: string) {
    return this.db.role.delete({ where: { id } });
  }

  async findPermissions(query: ListPermissionsQuery) {
    const { page, limit, sortBy, sortOrder, search, resource } = query;
    const skip = getPrismaSkip(page, limit);
    const allowedSort = new Set(['createdAt', 'resource', 'action']);
    const orderBy = buildOrderBy(sortBy && allowedSort.has(sortBy) ? sortBy : 'resource', sortOrder ?? 'asc');

    const where: Prisma.PermissionWhereInput = {};
    if (resource) where.resource = resource;
    if (search) {
      where.OR = [
        { action: { contains: search, mode: 'insensitive' } },
        { resource: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.db.permission.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          rolePermissions: { include: { role: { select: { id: true, name: true } } } },
        },
      }),
      this.db.permission.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  async findPermissionById(id: string) {
    return this.db.permission.findUnique({
      where: { id },
      include: {
        rolePermissions: { include: { role: { select: { id: true, name: true } } } },
      },
    });
  }

  async findPermissionsByIds(ids: string[]) {
    return this.db.permission.findMany({ where: { id: { in: ids } } });
  }

  async replaceRolePermissions(roleId: string, permissionIds: string[]) {
    const uniqueIds = [...new Set(permissionIds)];
    return this.db.$transaction(async (tx) => {
      await tx.rolePermission.deleteMany({ where: { roleId } });
      if (uniqueIds.length > 0) {
        await tx.rolePermission.createMany({
          data: uniqueIds.map((permissionId) => ({ roleId, permissionId })),
        });
      }
      return tx.role.findUnique({
        where: { id: roleId },
        include: {
          _count: { select: { userRoles: true, rolePermissions: true } },
          rolePermissions: { include: { permission: true } },
        },
      });
    });
  }

  async findUserIdsByRoleName(name: RoleName): Promise<string[]> {
    const rows = await this.db.userRole.findMany({
      where: { role: { name }, user: { isActive: true } },
      select: { userId: true },
    });
    return rows.map((row) => row.userId);
  }

  permissionCode(action: string, resource: string): string {
    return toPermissionCode(resource, action);
  }
}
