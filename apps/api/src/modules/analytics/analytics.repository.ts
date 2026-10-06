import {
  PrismaClient,
  Prisma,
  MaintenanceStatus,
  OperationalStatus,
  RoomOccupancyStatus,
} from '@prisma/client';
import mongoose from 'mongoose';
import { Notification } from '../database/mongodb/schemas/notification.schema';
import { AuditLog } from '../database/mongodb/schemas/auditLog.schema';
import { createLogger } from '../../utils/logger';
import type { AnalyticsBaseQuery, ResolvedDateRange } from './analytics.dto';
import { getPrismaSkip, buildOrderBy } from '../../utils/pagination';

const log = createLogger('AnalyticsRepository');

const OPEN_MAINTENANCE: MaintenanceStatus[] = [
  MaintenanceStatus.REPORTED,
  MaintenanceStatus.ASSIGNED,
  MaintenanceStatus.IN_PROGRESS,
];

export class AnalyticsRepository {
  constructor(private readonly db: PrismaClient) {}

  private roomWhere(query: AnalyticsBaseQuery): Prisma.RoomWhereInput {
    return {
      ...(query.floorId ? { floorId: query.floorId } : {}),
      ...(query.departmentId ? { departmentId: query.departmentId } : {}),
      ...(query.buildingId ? { floor: { buildingId: query.buildingId } } : {}),
    };
  }

  private assetWhere(query: AnalyticsBaseQuery): Prisma.AssetWhereInput {
    return {
      ...(query.buildingId ? { buildingId: query.buildingId } : {}),
      ...(query.departmentId ? { departmentId: query.departmentId } : {}),
      ...(query.floorId ? { room: { floorId: query.floorId } } : {}),
    };
  }

  private maintenanceWhere(
    query: AnalyticsBaseQuery,
    range?: ResolvedDateRange,
  ): Prisma.MaintenanceRequestWhereInput {
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
    if (query.floorId) locationFilters.push({ room: { floorId: query.floorId } });

    const createdAt = range
      ? { createdAt: { gte: range.from, lte: range.to } }
      : {};

    return {
      ...createdAt,
      ...(locationFilters.length > 0 ? { AND: locationFilters } : {}),
    };
  }

  async countBuildings(query: AnalyticsBaseQuery, activeOnly = false): Promise<number> {
    const where: Prisma.BuildingWhereInput = {
      ...(query.buildingId ? { id: query.buildingId } : {}),
      ...(activeOnly ? { operationalStatus: OperationalStatus.ACTIVE } : {}),
    };
    return this.db.building.count({ where });
  }

  async countFloors(query: AnalyticsBaseQuery): Promise<number> {
    return this.db.floor.count({
      where: query.buildingId ? { buildingId: query.buildingId } : undefined,
    });
  }

  async groupRoomsByOccupancy(query: AnalyticsBaseQuery) {
    return this.db.room.groupBy({
      by: ['occupancyStatus'],
      where: this.roomWhere(query),
      _count: { _all: true },
    });
  }

  async groupAssetsByStatus(query: AnalyticsBaseQuery) {
    return this.db.asset.groupBy({
      by: ['operationalStatus'],
      where: this.assetWhere(query),
      _count: { _all: true },
    });
  }

  async groupAssetsByCategory(query: AnalyticsBaseQuery) {
    return this.db.asset.groupBy({
      by: ['categoryId'],
      where: this.assetWhere(query),
      _count: { _all: true },
    });
  }

  async groupAssetsByCondition(query: AnalyticsBaseQuery) {
    const assets = await this.db.asset.findMany({
      where: this.assetWhere(query),
      select: { condition: true },
    });
    const map = new Map<string, number>();
    for (const a of assets) {
      const key = a.condition ?? 'Unknown';
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return [...map.entries()].map(([condition, count]) => ({ condition, count }));
  }

  async countAssetsWarrantyExpiring(query: AnalyticsBaseQuery, withinDays = 30): Promise<number> {
    const deadline = new Date();
    deadline.setDate(deadline.getDate() + withinDays);
    return this.db.asset.count({
      where: {
        ...this.assetWhere(query),
        warrantyExpiry: { gte: new Date(), lte: deadline },
      },
    });
  }

  async groupAssetsByBuilding(query: AnalyticsBaseQuery) {
    return this.db.asset.groupBy({
      by: ['buildingId'],
      where: { ...this.assetWhere(query), buildingId: { not: null } },
      _count: { _all: true },
    });
  }

  async groupAssetsByDepartment(query: AnalyticsBaseQuery) {
    return this.db.asset.groupBy({
      by: ['departmentId'],
      where: { ...this.assetWhere(query), departmentId: { not: null } },
      _count: { _all: true },
    });
  }

  async groupMaintenanceByStatus(query: AnalyticsBaseQuery, range?: ResolvedDateRange) {
    return this.db.maintenanceRequest.groupBy({
      by: ['status'],
      where: this.maintenanceWhere(query, range),
      _count: { _all: true },
    });
  }

  async groupMaintenanceByPriority(query: AnalyticsBaseQuery, range?: ResolvedDateRange) {
    return this.db.maintenanceRequest.groupBy({
      by: ['priority'],
      where: this.maintenanceWhere(query, range),
      _count: { _all: true },
    });
  }

  async groupMaintenanceByCategory(query: AnalyticsBaseQuery, range?: ResolvedDateRange) {
    return this.db.maintenanceRequest.groupBy({
      by: ['categoryId'],
      where: { ...this.maintenanceWhere(query, range), categoryId: { not: null } },
      _count: { _all: true },
    });
  }

  async countMaintenanceAssetRelated(query: AnalyticsBaseQuery, range?: ResolvedDateRange) {
    return this.db.maintenanceRequest.count({
      where: { ...this.maintenanceWhere(query, range), assetId: { not: null } },
    });
  }

  async findCompletedMaintenanceForAverage(query: AnalyticsBaseQuery, range?: ResolvedDateRange) {
    return this.db.maintenanceRequest.findMany({
      where: {
        ...this.maintenanceWhere(query, range),
        status: { in: [MaintenanceStatus.RESOLVED, MaintenanceStatus.CLOSED] },
        completedAt: { not: null },
      },
      select: { createdAt: true, completedAt: true },
      take: 500,
      orderBy: { completedAt: 'desc' },
    });
  }

  async countOpenMaintenance(query: AnalyticsBaseQuery, range?: ResolvedDateRange) {
    return this.db.maintenanceRequest.count({
      where: {
        ...this.maintenanceWhere(query, range),
        status: { in: OPEN_MAINTENANCE },
      },
    });
  }

  async groupMaintenanceByBuilding(query: AnalyticsBaseQuery, range?: ResolvedDateRange) {
    const rows = await this.db.maintenanceRequest.findMany({
      where: this.maintenanceWhere(query, range),
      select: {
        room: { select: { floor: { select: { buildingId: true, building: { select: { name: true } } } } } },
        asset: { select: { buildingId: true, building: { select: { name: true } } } },
      },
    });
    const map = new Map<string, { buildingId: string; name: string; count: number }>();
    for (const row of rows) {
      const buildingId = row.room?.floor?.buildingId ?? row.asset?.buildingId;
      if (!buildingId) continue;
      const name = row.room?.floor?.building?.name ?? row.asset?.building?.name ?? buildingId;
      const entry = map.get(buildingId) ?? { buildingId, name, count: 0 };
      entry.count += 1;
      map.set(buildingId, entry);
    }
    return [...map.values()];
  }

  async groupMaintenanceByDepartment(query: AnalyticsBaseQuery, range?: ResolvedDateRange) {
    const rows = await this.db.maintenanceRequest.findMany({
      where: this.maintenanceWhere(query, range),
      select: {
        room: { select: { departmentId: true, department: { select: { name: true } } } },
        asset: { select: { departmentId: true, department: { select: { name: true } } } },
      },
    });
    const map = new Map<string, { departmentId: string; name: string; count: number }>();
    for (const row of rows) {
      const departmentId = row.room?.departmentId ?? row.asset?.departmentId;
      if (!departmentId) continue;
      const name = row.room?.department?.name ?? row.asset?.department?.name ?? departmentId;
      const entry = map.get(departmentId) ?? { departmentId, name, count: 0 };
      entry.count += 1;
      map.set(departmentId, entry);
    }
    return [...map.values()];
  }

  async groupTechnicianWorkload(query: AnalyticsBaseQuery, range?: ResolvedDateRange) {
    const rows = await this.db.maintenanceAssignment.findMany({
      where: {
        assignedAt: range ? { gte: range.from, lte: range.to } : undefined,
        request: this.maintenanceWhere(query, range),
      },
      select: {
        technicianId: true,
        technician: { select: { firstName: true, lastName: true } },
      },
    });
    const map = new Map<string, { technicianId: string; name: string; assignments: number }>();
    for (const row of rows) {
      const name = `${row.technician.firstName} ${row.technician.lastName}`;
      const entry = map.get(row.technicianId) ?? { technicianId: row.technicianId, name, assignments: 0 };
      entry.assignments += 1;
      map.set(row.technicianId, entry);
    }
    return [...map.values()].sort((a, b) => b.assignments - a.assignments);
  }

  async findMaintenanceInRange(query: AnalyticsBaseQuery, range: ResolvedDateRange) {
    return this.db.maintenanceRequest.findMany({
      where: this.maintenanceWhere(query, range),
      select: { createdAt: true, status: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  async listBuildings(query: AnalyticsBaseQuery) {
    return this.db.building.findMany({
      where: query.buildingId ? { id: query.buildingId } : undefined,
      select: { id: true, code: true, name: true },
      orderBy: { name: 'asc' },
    });
  }

  async listDepartments(query: AnalyticsBaseQuery) {
    return this.db.department.findMany({
      where: query.departmentId ? { id: query.departmentId } : undefined,
      select: { id: true, code: true, name: true },
      orderBy: { name: 'asc' },
    });
  }

  async getBuildingMetrics(buildingId: string, query: AnalyticsBaseQuery, range: ResolvedDateRange) {
    const scoped = { ...query, buildingId };
    const [roomGroups, assetCount, maintenanceCount, parkingGroups] = await Promise.all([
      this.groupRoomsByOccupancy(scoped),
      this.db.asset.count({ where: this.assetWhere(scoped) }),
      this.db.maintenanceRequest.count({ where: this.maintenanceWhere(scoped, range) }),
      this.db.parkingSlot.groupBy({
        by: ['status'],
        where: { area: { buildingId } },
        _count: { _all: true },
      }),
    ]);
    let rooms = 0;
    let occupied = 0;
    for (const g of roomGroups) {
      rooms += g._count._all;
      if (g.occupancyStatus === RoomOccupancyStatus.OCCUPIED) occupied += g._count._all;
    }
    let parkingTotal = 0;
    let parkingAllocated = 0;
    for (const g of parkingGroups) {
      parkingTotal += g._count._all;
      if (g.status === 'OCCUPIED' || g.status === 'RESERVED') parkingAllocated += g._count._all;
    }
    return { rooms, occupied, assetCount, maintenanceCount, parkingTotal, parkingAllocated };
  }

  async getDepartmentMetrics(departmentId: string, query: AnalyticsBaseQuery, range: ResolvedDateRange) {
    const scoped = { ...query, departmentId };
    const [rooms, assets, maintenance, openMaintenance, meterCount] = await Promise.all([
      this.db.room.count({ where: this.roomWhere(scoped) }),
      this.db.asset.count({ where: this.assetWhere(scoped) }),
      this.db.maintenanceRequest.count({ where: this.maintenanceWhere(scoped, range) }),
      this.countOpenMaintenance(scoped, range),
      this.db.electricityMeter.count({ where: { departmentId, isActive: true } }),
    ]);
    return { rooms, assets, maintenance, openMaintenance, meterCount };
  }

  async groupRoomsByBuilding(query: AnalyticsBaseQuery) {
    const rows = await this.db.room.findMany({
      where: this.roomWhere(query),
      select: {
        occupancyStatus: true,
        floor: {
          select: {
            buildingId: true,
            building: { select: { id: true, code: true, name: true } },
          },
        },
      },
    });
    const map = new Map<
      string,
      { buildingId: string; code: string; name: string; total: number; occupied: number }
    >();
    for (const row of rows) {
      const b = row.floor.building;
      const entry = map.get(b.id) ?? { buildingId: b.id, code: b.code, name: b.name, total: 0, occupied: 0 };
      entry.total += 1;
      if (row.occupancyStatus === RoomOccupancyStatus.OCCUPIED) entry.occupied += 1;
      map.set(b.id, entry);
    }
    return [...map.values()];
  }

  async groupRoomsByFloor(query: AnalyticsBaseQuery) {
    const rows = await this.db.room.findMany({
      where: this.roomWhere(query),
      select: {
        occupancyStatus: true,
        floor: {
          select: {
            id: true,
            level: true,
            building: { select: { name: true } },
          },
        },
      },
    });
    const map = new Map<
      string,
      { floorId: string; level: string; buildingName: string; total: number; occupied: number }
    >();
    for (const row of rows) {
      const f = row.floor;
      const entry = map.get(f.id) ?? {
        floorId: f.id,
        level: f.level,
        buildingName: f.building.name,
        total: 0,
        occupied: 0,
      };
      entry.total += 1;
      if (row.occupancyStatus === RoomOccupancyStatus.OCCUPIED) entry.occupied += 1;
      map.set(f.id, entry);
    }
    return [...map.values()];
  }

  async groupParkingByStatus(query: AnalyticsBaseQuery) {
    return this.db.parkingSlot.groupBy({
      by: ['status'],
      where: query.buildingId ? { area: { buildingId: query.buildingId } } : undefined,
      _count: { _all: true },
    });
  }

  async groupParkingByType(query: AnalyticsBaseQuery) {
    return this.db.parkingSlot.groupBy({
      by: ['slotType'],
      where: query.buildingId ? { area: { buildingId: query.buildingId } } : undefined,
      _count: { _all: true },
    });
  }

  async countParkingAreas(query: AnalyticsBaseQuery, activeOnly = false) {
    return this.db.parkingArea.count({
      where: {
        ...(query.buildingId ? { buildingId: query.buildingId } : {}),
        ...(activeOnly ? { isActive: true } : {}),
      },
    });
  }

  async groupParkingByBuilding() {
    const rows = await this.db.parkingSlot.findMany({
      select: {
        status: true,
        area: {
          select: {
            buildingId: true,
            building: { select: { id: true, name: true } },
          },
        },
      },
    });
    const map = new Map<
      string,
      { buildingId: string; name: string; total: number; available: number; allocated: number }
    >();
    for (const row of rows) {
      const buildingId = row.area.buildingId ?? 'unassigned';
      const name = row.area.building?.name ?? 'Unassigned';
      const entry = map.get(buildingId) ?? { buildingId, name, total: 0, available: 0, allocated: 0 };
      entry.total += 1;
      if (row.status === 'AVAILABLE') entry.available += 1;
      if (row.status === 'OCCUPIED' || row.status === 'RESERVED') entry.allocated += 1;
      map.set(buildingId, entry);
    }
    return [...map.values()];
  }

  async getCategoryNames(ids: string[]) {
    if (ids.length === 0) return [];
    return this.db.assetCategory.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true },
    });
  }

  async countUnreadNotifications(userId?: string): Promise<number> {
    if (mongoose.connection.readyState !== 1) return 0;
    try {
      const filter = userId ? { userId, isRead: false } : { isRead: false };
      return Notification.countDocuments(filter);
    } catch (err) {
      log.warn('Failed to count unread notifications', { err });
      return 0;
    }
  }

  async countUtilityAnomalies(typePrefix: 'Electricity' | 'Water', range: ResolvedDateRange): Promise<number> {
    if (mongoose.connection.readyState !== 1) return 0;
    try {
      return Notification.countDocuments({
        type: 'UTILITY_ANOMALY',
        title: { $regex: typePrefix, $options: 'i' },
        createdAt: { $gte: range.from, $lte: range.to },
      });
    } catch (err) {
      log.warn('Failed to count utility anomalies', { err, typePrefix });
      return 0;
    }
  }

  async findOccupancyAuditEvents(range: ResolvedDateRange) {
    if (mongoose.connection.readyState !== 1) return [];
    try {
      return AuditLog.find({
        entityName: 'Room',
        action: 'updateOccupancy',
        createdAt: { $gte: range.from, $lte: range.to },
      })
        .sort({ createdAt: 'asc' })
        .limit(500)
        .lean()
        .exec();
    } catch (err) {
      log.warn('Failed to load occupancy audit events', { err });
      return [];
    }
  }

  async findParkingAuditEvents(range: ResolvedDateRange) {
    if (mongoose.connection.readyState !== 1) return [];
    try {
      return AuditLog.find({
        entityName: 'ParkingSlot',
        action: { $in: ['allocateParkingSlot', 'releaseParkingSlot'] },
        createdAt: { $gte: range.from, $lte: range.to },
      })
        .sort({ createdAt: 'asc' })
        .limit(500)
        .lean()
        .exec();
    } catch (err) {
      log.warn('Failed to load parking audit events', { err });
      return [];
    }
  }

  async paginateBuildingsForAnalytics(
    query: AnalyticsBaseQuery & { page: number; limit: number; sortBy?: string; sortOrder?: 'asc' | 'desc' },
  ) {
    const skip = getPrismaSkip(query.page, query.limit);
    const where = query.buildingId ? { id: query.buildingId } : undefined;
    const [data, total] = await Promise.all([
      this.db.building.findMany({
        where,
        skip,
        take: query.limit,
        orderBy: buildOrderBy(query.sortBy ?? 'name', query.sortOrder ?? 'asc'),
        select: { id: true, code: true, name: true },
      }),
      this.db.building.count({ where }),
    ]);
    return { data, total, page: query.page, limit: query.limit };
  }
}

export { OPEN_MAINTENANCE };
