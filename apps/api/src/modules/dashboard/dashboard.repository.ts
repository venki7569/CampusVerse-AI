import {
  PrismaClient,
  Prisma,
  MaintenanceStatus,
  MaintenancePriority,
} from '@prisma/client';
import mongoose from 'mongoose';
import { AuditLog } from '../database/mongodb/schemas/auditLog.schema';
import { Notification } from '../database/mongodb/schemas/notification.schema';
import { createLogger } from '../../utils/logger';
import type { DashboardOverviewQuery } from './dashboard.dto';

const log = createLogger('DashboardRepository');

const OPEN_MAINTENANCE: MaintenanceStatus[] = [
  MaintenanceStatus.REPORTED,
  MaintenanceStatus.ASSIGNED,
  MaintenanceStatus.IN_PROGRESS,
];

export class DashboardRepository {
  constructor(private readonly db: PrismaClient) {}

  private roomWhere(query: DashboardOverviewQuery): Prisma.RoomWhereInput {
    return {
      ...(query.floorId ? { floorId: query.floorId } : {}),
      ...(query.departmentId ? { departmentId: query.departmentId } : {}),
      ...(query.buildingId ? { floor: { buildingId: query.buildingId } } : {}),
    };
  }

  private assetWhere(query: DashboardOverviewQuery): Prisma.AssetWhereInput {
    return {
      ...(query.buildingId ? { buildingId: query.buildingId } : {}),
      ...(query.departmentId ? { departmentId: query.departmentId } : {}),
      ...(query.floorId ? { room: { floorId: query.floorId } } : {}),
    };
  }

  private maintenanceWhere(query: DashboardOverviewQuery): Prisma.MaintenanceRequestWhereInput {
    const locationFilters: Prisma.MaintenanceRequestWhereInput[] = [];

    if (query.buildingId) {
      locationFilters.push({
        OR: [
          { room: { floor: { buildingId: query.buildingId } } },
          { asset: { buildingId: query.buildingId } },
        ],
      });
    }
    if (query.departmentId) {
      locationFilters.push({
        OR: [
          { room: { departmentId: query.departmentId } },
          { asset: { departmentId: query.departmentId } },
        ],
      });
    }
    if (query.floorId) {
      locationFilters.push({ room: { floorId: query.floorId } });
    }

    const createdAt =
      query.from || query.to
        ? {
            createdAt: {
              ...(query.from ? { gte: query.from } : {}),
              ...(query.to ? { lte: query.to } : {}),
            },
          }
        : {};

    return {
      ...createdAt,
      ...(locationFilters.length > 0 ? { AND: locationFilters } : {}),
    };
  }

  async countBuildings(query: DashboardOverviewQuery): Promise<number> {
    if (query.buildingId) {
      return this.db.building.count({ where: { id: query.buildingId } });
    }
    return this.db.building.count();
  }

  async countDepartments(query: DashboardOverviewQuery): Promise<number> {
    if (query.buildingId || query.floorId) {
      const rooms = await this.db.room.findMany({
        where: {
          departmentId: { not: null },
          ...this.roomWhere(query),
        },
        select: { departmentId: true },
        distinct: ['departmentId'],
      });
      return rooms.length;
    }
    if (query.departmentId) {
      return this.db.department.count({ where: { id: query.departmentId } });
    }
    return this.db.department.count();
  }

  async countRooms(query: DashboardOverviewQuery, extra?: Prisma.RoomWhereInput): Promise<number> {
    return this.db.room.count({ where: { ...this.roomWhere(query), ...extra } });
  }

  async groupRoomsByOccupancy(query: DashboardOverviewQuery) {
    return this.db.room.groupBy({
      by: ['occupancyStatus'],
      where: this.roomWhere(query),
      _count: { _all: true },
    });
  }

  async findRoomsForBuildingOccupancy(query: DashboardOverviewQuery) {
    return this.db.room.findMany({
      where: this.roomWhere(query),
      select: {
        occupancyStatus: true,
        floor: {
          select: {
            buildingId: true,
            building: { select: { id: true, name: true, code: true } },
          },
        },
      },
    });
  }

  async groupAssetsByStatus(query: DashboardOverviewQuery) {
    return this.db.asset.groupBy({
      by: ['operationalStatus'],
      where: this.assetWhere(query),
      _count: { _all: true },
    });
  }

  async groupMaintenanceByStatus(query: DashboardOverviewQuery) {
    return this.db.maintenanceRequest.groupBy({
      by: ['status'],
      where: this.maintenanceWhere(query),
      _count: { _all: true },
    });
  }

  async countCriticalOpenMaintenance(query: DashboardOverviewQuery): Promise<number> {
    return this.db.maintenanceRequest.count({
      where: {
        ...this.maintenanceWhere(query),
        priority: MaintenancePriority.CRITICAL,
        status: { in: OPEN_MAINTENANCE },
      },
    });
  }

  async findHighPriorityOpenMaintenance(query: DashboardOverviewQuery, take = 8) {
    return this.db.maintenanceRequest.findMany({
      where: {
        ...this.maintenanceWhere(query),
        status: { in: OPEN_MAINTENANCE },
        priority: { in: [MaintenancePriority.CRITICAL, MaintenancePriority.HIGH] },
      },
      orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }],
      take,
      select: {
        id: true,
        title: true,
        priority: true,
        status: true,
        createdAt: true,
        room: {
          select: {
            roomNumber: true,
            floor: { select: { building: { select: { name: true } } } },
          },
        },
      },
    });
  }

  async findCompletedMaintenanceForAverage(query: DashboardOverviewQuery) {
    return this.db.maintenanceRequest.findMany({
      where: {
        ...this.maintenanceWhere(query),
        status: { in: [MaintenanceStatus.RESOLVED, MaintenanceStatus.CLOSED] },
        completedAt: { not: null },
      },
      select: { createdAt: true, completedAt: true },
      take: 500,
      orderBy: { completedAt: 'desc' },
    });
  }

  async findRecentActivity(limit = 20): Promise<
    Array<{
      id: string;
      actorId: string;
      action: string;
      entityName: string;
      entityId: string;
      metadata: Record<string, unknown>;
      createdAt: Date;
    }>
  > {
    if (mongoose.connection.readyState !== 1) {
      return [];
    }
    try {
      const rows = await AuditLog.find({})
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean()
        .exec();
      return rows.map((row) => ({
        id: String(row._id),
        actorId: row.actorId,
        action: row.action,
        entityName: row.entityName,
        entityId: row.entityId,
        metadata: (row.metadata ?? {}) as Record<string, unknown>,
        createdAt: row.createdAt,
      }));
    } catch (err) {
      log.warn('Failed to load dashboard activity from MongoDB', { err });
      return [];
    }
  }

  async findUtilityAnomalyNotifications(typePrefix: 'Electricity' | 'Water', limit = 8) {
    if (mongoose.connection.readyState !== 1) {
      return [];
    }
    try {
      const rows = await Notification.find({
        type: 'UTILITY_ANOMALY',
        title: { $regex: typePrefix, $options: 'i' },
      })
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean()
        .exec();

      const seen = new Set<string>();
      return rows
        .filter((row) => {
          const key = `${row.title}:${row.message}:${row.metadata?.['meterId'] ?? ''}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        })
        .map((row) => ({
          id: String(row._id),
          title: row.title,
          message: row.message,
          severity: (row.metadata?.['severity'] as string | undefined) ?? 'MEDIUM',
          timestamp: row.createdAt,
          link: row.link,
        }));
    } catch (err) {
      log.warn('Failed to load utility anomaly notifications', { err, typePrefix });
      return [];
    }
  }

  async countParkingAreas(query: DashboardOverviewQuery): Promise<number> {
    return this.db.parkingArea.count({
      where: query.buildingId ? { buildingId: query.buildingId } : undefined,
    });
  }

  async countActiveParkingAreas(query: DashboardOverviewQuery): Promise<number> {
    return this.db.parkingArea.count({
      where: {
        isActive: true,
        ...(query.buildingId ? { buildingId: query.buildingId } : {}),
      },
    });
  }

  async groupParkingSlotsByStatus(query: DashboardOverviewQuery) {
    return this.db.parkingSlot.groupBy({
      by: ['status'],
      where: query.buildingId ? { area: { buildingId: query.buildingId } } : undefined,
      _count: { _all: true },
    });
  }
}

export { OPEN_MAINTENANCE };
