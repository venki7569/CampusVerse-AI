import { PrismaClient, User, RoleName, RefreshToken } from '@prisma/client';
import type { RegisterDto } from './auth.dto';

export type UserWithRoles = User & {
  userRoles: {
    role: {
      name: RoleName;
    };
  }[];
};

export class AuthRepository {
  constructor(private readonly db: PrismaClient) {}

  async findByEmail(email: string): Promise<UserWithRoles | null> {
    return this.db.user.findUnique({
      where: { email },
      include: {
        userRoles: {
          include: {
            role: true,
          },
        },
      },
    });
  }

  async findById(id: string): Promise<UserWithRoles | null> {
    return this.db.user.findUnique({
      where: { id },
      include: {
        userRoles: {
          include: {
            role: true,
          },
        },
      },
    });
  }

  async createUserWithRole(
    dto: RegisterDto,
    passwordHash: string,
  ): Promise<UserWithRoles> {
    // Ensure role exists or create it
    const roleName = dto.roleName || 'STUDENT';
    const role = await this.db.role.upsert({
      where: { name: roleName },
      update: {},
      create: { name: roleName, description: `${roleName} role` },
    });

    return this.db.user.create({
      data: {
        email: dto.email,
        passwordHash,
        firstName: dto.firstName,
        lastName: dto.lastName,
        departmentId: dto.departmentId ?? null,
        userRoles: {
          create: {
            roleId: role.id,
          },
        },
      },
      include: {
        userRoles: {
          include: {
            role: true,
          },
        },
      },
    });
  }

  async saveRefreshToken(
    userId: string,
    token: string,
    expiresAt: Date,
  ): Promise<RefreshToken> {
    return this.db.refreshToken.create({
      data: {
        userId,
        token,
        expiresAt,
      },
    });
  }

  async findRefreshToken(token: string): Promise<RefreshToken | null> {
    return this.db.refreshToken.findUnique({
      where: { token },
    });
  }

  async deleteRefreshToken(token: string): Promise<void> {
    await this.db.refreshToken.deleteMany({
      where: { token },
    });
  }

  async deleteAllUserRefreshTokens(userId: string): Promise<void> {
    await this.db.refreshToken.deleteMany({
      where: { userId },
    });
  }

  async listActiveDepartments(): Promise<Array<{ id: string; name: string; code: string }>> {
    return this.db.department.findMany({
      select: { id: true, name: true, code: true },
      orderBy: { name: 'asc' },
      take: 200,
    });
  }

  async departmentExists(id: string): Promise<boolean> {
    const dept = await this.db.department.findUnique({
      where: { id },
      select: { id: true },
    });
    return !!dept;
  }

  async updatePassword(userId: string, newPasswordHash: string): Promise<void> {
    await this.db.user.update({
      where: { id: userId },
      data: { passwordHash: newPasswordHash },
    });
  }

  async updateProfile(
    userId: string,
    data: { firstName?: string; lastName?: string },
  ): Promise<UserWithRoles> {
    return this.db.user.update({
      where: { id: userId },
      data,
      include: {
        userRoles: { include: { role: true } },
      },
    });
  }
}
