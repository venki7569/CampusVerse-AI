import {
  Prisma,
  PrismaClient,
  AnnouncementStatus,
  type Announcement,
} from '@prisma/client';

const authorSelect = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
} as const;

const includeRelations = {
  author: { select: authorSelect },
  targetDepartment: { select: { id: true, code: true, name: true } },
  targetBuilding: { select: { id: true, code: true, name: true } },
} as const;

import type { ListAnnouncementsQuery } from './announcement.dto';

export type AnnouncementWithRelations = Prisma.AnnouncementGetPayload<{
  include: typeof includeRelations;
}>;

export class AnnouncementRepository {
  constructor(private readonly db: PrismaClient) {}

  async create(data: Prisma.AnnouncementUncheckedCreateInput): Promise<AnnouncementWithRelations> {
    return this.db.announcement.create({ data, include: includeRelations });
  }

  async update(id: string, data: Prisma.AnnouncementUncheckedUpdateInput): Promise<AnnouncementWithRelations> {
    return this.db.announcement.update({ where: { id }, data, include: includeRelations });
  }

  async findById(id: string): Promise<AnnouncementWithRelations | null> {
    return this.db.announcement.findUnique({ where: { id }, include: includeRelations });
  }

  async delete(id: string): Promise<void> {
    await this.db.announcement.delete({ where: { id } });
  }

  async findMany(query: ListAnnouncementsQuery, where: Prisma.AnnouncementWhereInput) {
    const skip = (query.page - 1) * query.limit;
    const orderBy: Prisma.AnnouncementOrderByWithRelationInput[] = [
      { priority: 'desc' },
      { publishedAt: 'desc' },
      { createdAt: 'desc' },
    ];

    const [data, total] = await Promise.all([
      this.db.announcement.findMany({
        where,
        include: includeRelations,
        skip,
        take: query.limit,
        orderBy,
      }),
      this.db.announcement.count({ where }),
    ]);

    return { data, total, page: query.page, limit: query.limit };
  }

  async promoteDueScheduled(now = new Date()): Promise<Announcement[]> {
    const due = await this.db.announcement.findMany({
      where: { status: 'SCHEDULED', scheduledAt: { lte: now } },
    });
    if (due.length === 0) return [];

    await this.db.announcement.updateMany({
      where: { id: { in: due.map((a) => a.id) } },
      data: { status: 'PUBLISHED', publishedAt: now },
    });

    return due.map((a) => ({ ...a, status: 'PUBLISHED' as AnnouncementStatus, publishedAt: now }));
  }

  async markExpired(now = new Date()): Promise<number> {
    const result = await this.db.announcement.updateMany({
      where: {
        status: 'PUBLISHED',
        expiresAt: { lte: now },
      },
      data: { status: 'EXPIRED' },
    });
    return result.count;
  }

  async getReadIds(userId: string, announcementIds: string[]): Promise<Set<string>> {
    if (announcementIds.length === 0) return new Set();
    const rows = await this.db.announcementRead.findMany({
      where: { userId, announcementId: { in: announcementIds } },
      select: { announcementId: true },
    });
    return new Set(rows.map((r) => r.announcementId));
  }

  async markRead(announcementId: string, userId: string): Promise<void> {
    await this.db.announcementRead.upsert({
      where: { announcementId_userId: { announcementId, userId } },
      create: { announcementId, userId },
      update: { readAt: new Date() },
    });
  }

  async countUnreadForUser(userId: string, visibleIds: string[]): Promise<number> {
    if (visibleIds.length === 0) return 0;
    const readCount = await this.db.announcementRead.count({
      where: { userId, announcementId: { in: visibleIds } },
    });
    return visibleIds.length - readCount;
  }

  async resolveAudienceUserIds(announcement: Announcement): Promise<string[]> {
    switch (announcement.audienceType) {
      case 'ALL':
        return this.findActiveUserIds({});
      case 'ROLE':
        if (!announcement.targetRole) return [];
        return this.findActiveUserIds({
          userRoles: { some: { role: { name: announcement.targetRole } } },
        });
      case 'DEPARTMENT':
        if (!announcement.targetDepartmentId) return [];
        return this.findActiveUserIds({ departmentId: announcement.targetDepartmentId });
      case 'BUILDING':
        if (!announcement.targetBuildingId) return [];
        return this.resolveBuildingUserIds(announcement.targetBuildingId);
      case 'USER':
        return announcement.targetUserId ? [announcement.targetUserId] : [];
      default:
        return [];
    }
  }

  private async findActiveUserIds(where: Prisma.UserWhereInput): Promise<string[]> {
    const users = await this.db.user.findMany({
      where: { isActive: true, ...where },
      select: { id: true },
    });
    return users.map((u) => u.id);
  }

  private async resolveBuildingUserIds(buildingId: string): Promise<string[]> {
    const rooms = await this.db.room.findMany({
      where: { floor: { buildingId }, departmentId: { not: null } },
      select: { departmentId: true },
      distinct: ['departmentId'],
    });
    const departmentIds = rooms.map((r) => r.departmentId!).filter(Boolean);
    if (departmentIds.length === 0) return [];

    const users = await this.db.user.findMany({
      where: { isActive: true, departmentId: { in: departmentIds } },
      select: { id: true },
    });
    return users.map((u) => u.id);
  }

  async getUserBuildingIds(userId: string): Promise<string[]> {
    const user = await this.db.user.findUnique({
      where: { id: userId },
      select: { departmentId: true },
    });
    if (!user?.departmentId) return [];

    const rooms = await this.db.room.findMany({
      where: { departmentId: user.departmentId },
      select: { floor: { select: { buildingId: true } } },
    });
    return [...new Set(rooms.map((r) => r.floor.buildingId))];
  }

  async findDepartmentById(id: string) {
    return this.db.department.findUnique({ where: { id } });
  }

  async findBuildingById(id: string) {
    return this.db.building.findUnique({ where: { id } });
  }

  async findUserById(id: string) {
    return this.db.user.findUnique({ where: { id }, select: { id: true, isActive: true, departmentId: true } });
  }
}
