import { PrismaClient, MaintenanceRequest, Prisma } from '@prisma/client';
import type { CreateMaintenanceRequestDto, UpdateMaintenanceRequestDto, ListMaintenanceRequestsQuery } from './maintenance.dto';
import { getPrismaSkip, buildOrderBy } from '../../utils/pagination';

export class MaintenanceRepository {
  constructor(private readonly db: PrismaClient) {}

  async findAll(query: ListMaintenanceRequestsQuery): Promise<{
    data: any[];
    total: number;
    page: number;
    limit: number;
  }> {
    const {
      page,
      limit,
      sortBy,
      sortOrder,
      search,
      status,
      priority,
      categoryId,
      buildingId,
      roomId,
      assetId,
      technicianId,
      reporterId,
      departmentId,
    } = query;

    const skip = getPrismaSkip(page, limit);
    const orderBy = buildOrderBy(sortBy, sortOrder);

    const where: Prisma.MaintenanceRequestWhereInput = {
      ...(status ? { status } : {}),
      ...(priority ? { priority } : {}),
      ...(categoryId ? { categoryId } : {}),
      ...(assetId ? { assetId } : {}),
      ...(roomId ? { roomId } : {}),
      ...(reporterId ? { reporterId } : {}),
      ...(buildingId
        ? {
            OR: [
              { room: { floor: { buildingId } } },
              { asset: { buildingId } },
              { asset: { room: { floor: { buildingId } } } },
            ],
          }
        : {}),
      ...(technicianId
        ? {
            assignments: {
              some: { technicianId },
            },
          }
        : {}),
      ...(departmentId
        ? {
            OR: [
              { room: { departmentId } },
              { asset: { departmentId } },
            ],
          }
        : {}),
      ...(search
        ? {
            OR: [
              { title: { contains: search, mode: 'insensitive' } },
              { description: { contains: search, mode: 'insensitive' } },
              { asset: { assetTag: { contains: search, mode: 'insensitive' } } },
              { asset: { name: { contains: search, mode: 'insensitive' } } },
              { room: { roomNumber: { contains: search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      this.db.maintenanceRequest.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          reporter: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
          room: {
            select: {
              id: true,
              roomNumber: true,
              roomType: true,
              floor: {
                select: {
                  id: true,
                  level: true,
                  building: { select: { id: true, name: true, code: true } },
                },
              },
            },
          },
          asset: {
            select: {
              id: true,
              assetTag: true,
              name: true,
              operationalStatus: true,
              category: { select: { id: true, name: true } },
            },
          },
          assignments: {
            include: {
              technician: {
                select: { id: true, firstName: true, lastName: true, email: true },
              },
            },
          },
          _count: {
            select: { comments: true },
          },
        },
      }),
      this.db.maintenanceRequest.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  async findById(id: string) {
    return this.db.maintenanceRequest.findUnique({
      where: { id },
      include: {
        reporter: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        room: {
          include: {
            floor: {
              include: { building: true },
            },
            department: true,
          },
        },
        asset: {
          include: {
            category: true,
            vendor: true,
            building: true,
            room: {
              include: {
                floor: { include: { building: true } },
              },
            },
          },
        },
        assignments: {
          include: {
            technician: {
              select: { id: true, firstName: true, lastName: true, email: true },
            },
          },
          orderBy: { assignedAt: 'desc' },
        },
        comments: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });
  }

  async create(data: CreateMaintenanceRequestDto & { reporterId: string }): Promise<MaintenanceRequest> {
    return this.db.maintenanceRequest.create({
      data: {
        title: data.title,
        description: data.description,
        categoryId: data.categoryId,
        priority: data.priority,
        reporterId: data.reporterId,
        roomId: data.roomId,
        assetId: data.assetId,
        images: data.images ?? [],
        status: 'REPORTED',
      },
    });
  }

  async update(id: string, data: UpdateMaintenanceRequestDto): Promise<MaintenanceRequest> {
    return this.db.maintenanceRequest.update({
      where: { id },
      data: {
        ...(data.title !== undefined ? { title: data.title } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.categoryId !== undefined ? { categoryId: data.categoryId } : {}),
        ...(data.priority !== undefined ? { priority: data.priority } : {}),
        ...(data.roomId !== undefined ? { roomId: data.roomId } : {}),
        ...(data.assetId !== undefined ? { assetId: data.assetId } : {}),
        ...(data.images !== undefined ? { images: data.images } : {}),
      },
    });
  }

  async updateStatus(
    id: string,
    status: Prisma.EnumMaintenanceStatusFilter['equals'],
    completedAt?: Date | null,
  ): Promise<MaintenanceRequest> {
    return this.db.maintenanceRequest.update({
      where: { id },
      data: {
        status,
        ...(completedAt !== undefined ? { completedAt } : {}),
      },
    });
  }

  async assignTechnician(requestId: string, technicianId: string) {
    return this.db.$transaction(async (tx) => {
      // Remove any existing assignment or create new
      await tx.maintenanceAssignment.deleteMany({
        where: { requestId },
      });

      const assignment = await tx.maintenanceAssignment.create({
        data: {
          requestId,
          technicianId,
        },
        include: {
          technician: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
        },
      });

      const updatedRequest = await tx.maintenanceRequest.update({
        where: { id: requestId },
        data: { status: 'ASSIGNED' },
      });

      return { assignment, updatedRequest };
    });
  }

  async addComment(requestId: string, authorId: string, content: string) {
    return this.db.maintenanceComment.create({
      data: {
        requestId,
        authorId,
        content,
      },
    });
  }

  async getComments(requestId: string) {
    const comments = await this.db.maintenanceComment.findMany({
      where: { requestId },
      orderBy: { createdAt: 'asc' },
    });

    // Resolve authors
    const authorIds = [...new Set(comments.map((c) => c.authorId))];
    const authors = await this.db.user.findMany({
      where: { id: { in: authorIds } },
      select: { id: true, firstName: true, lastName: true, email: true },
    });
    const authorMap = new Map(authors.map((a) => [a.id, a]));

    return comments.map((c) => ({
      ...c,
      author: authorMap.get(c.authorId) || { id: c.authorId, firstName: 'User', lastName: '', email: '' },
    }));
  }

  async recordAssetHistory(data: {
    assetId: string;
    action: string;
    technicianId?: string | null;
    cost?: number | null;
    notes?: string | null;
    performedAt: Date;
  }) {
    return this.db.maintenanceHistory.create({
      data: {
        assetId: data.assetId,
        action: data.action,
        technicianId: data.technicianId,
        cost: data.cost,
        notes: data.notes,
        performedAt: data.performedAt,
      },
    });
  }

  async getMetrics() {
    const [total, reported, assigned, inProgress, resolved, closed, critical] = await Promise.all([
      this.db.maintenanceRequest.count(),
      this.db.maintenanceRequest.count({ where: { status: 'REPORTED' } }),
      this.db.maintenanceRequest.count({ where: { status: 'ASSIGNED' } }),
      this.db.maintenanceRequest.count({ where: { status: 'IN_PROGRESS' } }),
      this.db.maintenanceRequest.count({ where: { status: 'RESOLVED' } }),
      this.db.maintenanceRequest.count({ where: { status: 'CLOSED' } }),
      this.db.maintenanceRequest.count({ where: { priority: 'CRITICAL', status: { notIn: ['CLOSED', 'CANCELLED', 'REJECTED'] } } }),
    ]);

    return {
      total,
      reported,
      assigned,
      inProgress,
      resolved,
      closed,
      critical,
    };
  }
}
