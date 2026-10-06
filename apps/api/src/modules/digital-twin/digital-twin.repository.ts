import { MaintenanceStatus, OperationalStatus, RoomOccupancyStatus } from '@prisma/client';
import type { PrismaClient } from '@prisma/client';
import mongoose from 'mongoose';
import { AuditLog } from '../database/mongodb/schemas/auditLog.schema';
import { createLogger } from '../../utils/logger';

const log = createLogger('DigitalTwinRepository');

const OPEN_MAINTENANCE: MaintenanceStatus[] = [
  MaintenanceStatus.REPORTED,
  MaintenanceStatus.ASSIGNED,
  MaintenanceStatus.IN_PROGRESS,
];

export class DigitalTwinRepository {
  constructor(private readonly db: PrismaClient) {}

  async countBuildings() {
    return this.db.building.count();
  }

  async countFloors() {
    return this.db.floor.count();
  }

  async countRooms() {
    return this.db.room.count();
  }

  async countAssets() {
    return this.db.asset.count();
  }

  async countOpenMaintenance() {
    return this.db.maintenanceRequest.count({ where: { status: { in: OPEN_MAINTENANCE } } });
  }

  async getIoTSummary() {
    const [total, online, offline, stale, maintenance] = await Promise.all([
      this.db.ioTDevice.count({ where: { isActive: true } }),
      this.db.ioTDevice.count({ where: { isActive: true, status: 'ONLINE' } }),
      this.db.ioTDevice.count({ where: { isActive: true, status: 'OFFLINE' } }),
      this.db.ioTDevice.count({ where: { isActive: true, status: 'STALE' } }),
      this.db.ioTDevice.count({ where: { isActive: true, status: 'MAINTENANCE' } }),
    ]);
    return { total, online, offline, stale, maintenance };
  }

  async countAllMaintenanceRequests() {
    return this.db.maintenanceRequest.count();
  }

  async listBuildingsSummary() {
    const buildings = await this.db.building.findMany({
      select: {
        id: true,
        code: true,
        name: true,
        operationalStatus: true,
        floors: { select: { id: true, rooms: { select: { id: true, occupancyStatus: true } } } },
      },
      orderBy: { name: 'asc' },
    });

    return buildings.map((b) => {
      const rooms = b.floors.flatMap((f) => f.rooms);
      const occupied = rooms.filter((r) => r.occupancyStatus === RoomOccupancyStatus.OCCUPIED).length;
      const total = rooms.length;
      return {
        id: b.id,
        code: b.code,
        name: b.name,
        operationalStatus: b.operationalStatus,
        floorCount: b.floors.length,
        roomCount: total,
        occupancyRate: total > 0 ? Math.round((occupied / total) * 1000) / 10 : null,
        healthScore: b.operationalStatus === OperationalStatus.ACTIVE ? 100 : 60,
      };
    });
  }

  async getBuildingDetail(buildingId: string) {
    return this.db.building.findUnique({
      where: { id: buildingId },
      include: {
        floors: {
          include: {
            rooms: {
              include: {
                department: { select: { id: true, code: true, name: true } },
                assets: { select: { id: true, assetTag: true, name: true, operationalStatus: true, condition: true } },
              },
            },
          },
        },
        electricityMeters: { include: { readings: { orderBy: { readingTime: 'desc' }, take: 30 } } },
        waterMeters: { include: { readings: { orderBy: { readingTime: 'desc' }, take: 30 } } },
        parkingAreas: { include: { slots: true } },
        assets: { take: 50, select: { id: true, assetTag: true, name: true, operationalStatus: true, condition: true } },
      },
    });
  }

  async getRoomDetail(roomId: string) {
    return this.db.room.findUnique({
      where: { id: roomId },
      include: {
        floor: { include: { building: { select: { id: true, code: true, name: true } } } },
        department: { select: { id: true, code: true, name: true } },
        assets: true,
        maintenanceRequests: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: { id: true, title: true, status: true, priority: true, createdAt: true },
        },
      },
    });
  }

  async getAssetDetail(assetId: string) {
    return this.db.asset.findUnique({
      where: { id: assetId },
      include: {
        category: true,
        vendor: true,
        department: true,
        building: true,
        room: true,
        maintenanceRequests: { orderBy: { createdAt: 'desc' }, take: 10 },
        maintenanceHistory: { orderBy: { performedAt: 'desc' }, take: 20 },
      },
    });
  }

  async listAssetsWithMaintenanceContext(windowDays: number) {
    const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);
    return this.db.asset.findMany({
      where: { operationalStatus: { not: OperationalStatus.RETIRED } },
      select: {
        id: true,
        assetTag: true,
        name: true,
        condition: true,
        operationalStatus: true,
        lastMaintenance: true,
        nextMaintenance: true,
        warrantyExpiry: true,
        purchaseDate: true,
        buildingId: true,
        maintenanceRequests: {
          where: { createdAt: { gte: since } },
          select: { id: true, status: true, createdAt: true, priority: true },
        },
        maintenanceHistory: {
          where: { performedAt: { gte: since } },
          select: { id: true, action: true, cost: true, performedAt: true },
        },
      },
    });
  }

  async groupRoomsByOccupancy(buildingId?: string) {
    return this.db.room.groupBy({
      by: ['occupancyStatus'],
      where: buildingId ? { floor: { buildingId } } : undefined,
      _count: { _all: true },
    });
  }

  async listRoomsWithBuilding() {
    return this.db.room.findMany({
      select: {
        id: true,
        roomNumber: true,
        occupancyStatus: true,
        roomType: true,
        capacity: true,
        floor: { select: { level: true, buildingId: true, building: { select: { name: true } } } },
      },
    });
  }

  async getElectricityReadings(days: number) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    return this.db.electricityReading.findMany({
      where: { readingTime: { gte: since } },
      include: { meter: { include: { building: { select: { id: true, name: true } } } } },
      orderBy: { readingTime: 'asc' },
    });
  }

  async getWaterReadings(days: number) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    return this.db.waterReading.findMany({
      where: { readingTime: { gte: since } },
      include: { meter: { include: { building: { select: { id: true, name: true } } } } },
      orderBy: { readingTime: 'asc' },
    });
  }

  async getParkingStats() {
    const slots = await this.db.parkingSlot.groupBy({
      by: ['status'],
      _count: { _all: true },
    });
    const total = slots.reduce((acc, s) => acc + s._count._all, 0);
    const available = slots.find((s) => s.status === 'AVAILABLE')?._count._all ?? 0;
    return { total, available, slots };
  }

  async getActiveBuildingsRatio() {
    const [total, active] = await Promise.all([
      this.db.building.count(),
      this.db.building.count({ where: { operationalStatus: OperationalStatus.ACTIVE } }),
    ]);
    return { total, active };
  }

  async getAssetStatusGroups() {
    return this.db.asset.groupBy({
      by: ['operationalStatus'],
      _count: { _all: true },
    });
  }

  async getOccupancyAuditEvents(roomId: string, days: number) {
    if (mongoose.connection.readyState !== 1) return [];
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    try {
      return AuditLog.find({
        entityName: 'Room',
        entityId: roomId,
        action: 'updateOccupancy',
        createdAt: { $gte: since },
      })
        .sort({ createdAt: -1 })
        .limit(100)
        .lean();
    } catch (err) {
      log.warn('Occupancy audit query failed', { err, roomId });
      return [];
    }
  }

  async findAdminUserIds(): Promise<string[]> {
    const roles = await this.db.role.findMany({
      where: { name: { in: ['SUPER_ADMIN', 'CAMPUS_ADMIN', 'MAINTENANCE_STAFF'] } },
      select: { id: true },
    });
    if (roles.length === 0) return [];
    const userRoles = await this.db.userRole.findMany({
      where: { roleId: { in: roles.map((r) => r.id) }, user: { isActive: true } },
      select: { userId: true },
    });
    return [...new Set(userRoles.map((ur) => ur.userId))];
  }
}
