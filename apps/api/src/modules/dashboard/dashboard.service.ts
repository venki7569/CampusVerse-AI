import { RoomOccupancyStatus, OperationalStatus, MaintenanceStatus } from '@prisma/client';
import { config } from '../../config/env';
import { cacheService } from '../../services/cache.service';
import { createLogger } from '../../utils/logger';
import type { ElectricityRepository } from '../electricity/electricity.repository';
import type { WaterRepository } from '../water/water.repository';
import type { DashboardRepository } from './dashboard.repository';
import { dashboardEvents } from './dashboard.events';
import type {
  DashboardOverview,
  DashboardOverviewQuery,
  OccupancyBucket,
  UtilityEnergyBlock,
  UtilityWaterBlock,
  UtilitySeriesPoint,
  UtilityBuildingPoint,
} from './dashboard.dto';

const log = createLogger('DashboardService');

export function calculateOccupancyRate(occupied: number, total: number): number | null {
  if (total <= 0) return null;
  return Math.round((occupied / total) * 1000) / 10;
}

export function emptyOccupancy(): OccupancyBucket {
  return { total: 0, occupied: 0, available: 0, reserved: 0, underMaintenance: 0 };
}

function occupancyFromCounts(
  rows: Array<{ occupancyStatus: RoomOccupancyStatus; _count: { _all: number } }>,
): OccupancyBucket {
  const bucket = emptyOccupancy();
  for (const row of rows) {
    bucket.total += row._count._all;
    if (row.occupancyStatus === RoomOccupancyStatus.OCCUPIED) bucket.occupied += row._count._all;
    if (row.occupancyStatus === RoomOccupancyStatus.AVAILABLE) bucket.available += row._count._all;
    if (row.occupancyStatus === RoomOccupancyStatus.RESERVED) bucket.reserved += row._count._all;
    if (row.occupancyStatus === RoomOccupancyStatus.UNDER_MAINTENANCE) {
      bucket.underMaintenance += row._count._all;
    }
  }
  return bucket;
}

function sumReadings(values: number[]): number {
  return values.reduce((acc, n) => acc + n, 0);
}

function groupByDay(items: Array<{ readingTime: Date; consumption: number }>): UtilitySeriesPoint[] {
  const groups = new Map<string, number>();
  for (const item of items) {
    const key = item.readingTime.toISOString().split('T')[0] ?? item.readingTime.toISOString();
    groups.set(key, (groups.get(key) ?? 0) + item.consumption);
  }
  return Array.from(groups.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([period, consumption]) => ({ period, consumption }));
}

function inWindow(date: Date, from: Date, to: Date): boolean {
  return date >= from && date <= to;
}

function activityMessage(entityName: string, action: string, metadata: Record<string, unknown>): string {
  if (entityName === 'Room' && action === 'updateOccupancy') {
    const roomNumber = typeof metadata['roomNumber'] === 'string' ? metadata['roomNumber'] : 'Room';
    const newStatus = typeof metadata['newStatus'] === 'string' ? metadata['newStatus'] : 'updated';
    return `Room ${roomNumber} changed to ${newStatus}`;
  }
  if (entityName === 'MaintenanceRequest') {
    return `Maintenance request ${action.replace(/([A-Z])/g, ' $1').trim()}`;
  }
  if (entityName === 'ElectricityMeter') {
    const serial = typeof metadata['serialNumber'] === 'string' ? metadata['serialNumber'] : 'meter';
    return `Electricity ${action} (${serial})`;
  }
  if (entityName === 'WaterMeter') {
    const serial = typeof metadata['serialNumber'] === 'string' ? metadata['serialNumber'] : 'meter';
    return `Water ${action} (${serial})`;
  }
  if (entityName === 'Asset') {
    return `Asset ${action}`;
  }
  return `${entityName}: ${action}`;
}

function activitySeverity(entityName: string, action: string, metadata: Record<string, unknown>): 'INFO' | 'WARNING' | 'CRITICAL' {
  const severity = metadata['severity'];
  if (severity === 'CRITICAL') return 'CRITICAL';
  if (severity === 'HIGH' || action.includes('anomaly')) return 'WARNING';
  if (entityName === 'MaintenanceRequest' && action.startsWith('create')) return 'WARNING';
  return 'INFO';
}

function activityModule(entityName: string): string {
  if (entityName === 'Room') return 'Occupancy';
  if (entityName === 'MaintenanceRequest') return 'Maintenance';
  if (entityName === 'ElectricityMeter') return 'Electricity';
  if (entityName === 'WaterMeter') return 'Water';
  if (entityName === 'Asset') return 'Asset';
  if (entityName === 'ParkingArea' || entityName === 'ParkingSlot') return 'Parking';
  return entityName;
}

export class DashboardService {
  constructor(
    private readonly repo: DashboardRepository,
    private readonly electricityRepo: ElectricityRepository,
    private readonly waterRepo: WaterRepository,
  ) {}

  async getOverview(query: DashboardOverviewQuery): Promise<DashboardOverview> {
    const cacheKey = `dashboard:overview:${JSON.stringify(query)}`;
    return cacheService.getOrSet(
      cacheKey,
      () => this.buildOverview(query),
      { ttlSeconds: config.cache.dashboardTtlSeconds, prefix: 'cv' },
    );
  }

  private async buildOverview(query: DashboardOverviewQuery): Promise<DashboardOverview> {
    const now = new Date();
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const trendFrom = query.from ?? new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    const trendTo = query.to ?? now;

    const [
      buildings,
      departments,
      classrooms,
      laboratories,
      occupancyRows,
      buildingRooms,
      assetRows,
      maintenanceRows,
      criticalOpen,
      highPriorityOpen,
      completedMaintenance,
    ] = await Promise.all([
      this.repo.countBuildings(query),
      this.repo.countDepartments(query),
      this.repo.countRooms(query, { roomType: 'CLASSROOM' }),
      this.repo.countRooms(query, { roomType: 'LABORATORY' }),
      this.repo.groupRoomsByOccupancy(query),
      this.repo.findRoomsForBuildingOccupancy(query),
      this.repo.groupAssetsByStatus(query),
      this.repo.groupMaintenanceByStatus(query),
      this.repo.countCriticalOpenMaintenance(query),
      this.repo.findHighPriorityOpenMaintenance(query),
      this.repo.findCompletedMaintenanceForAverage(query),
    ]);

    const occupancy = occupancyFromCounts(occupancyRows);
    const occupancyRate = calculateOccupancyRate(occupancy.occupied, occupancy.total);

    const buildingOccupancyMap = new Map<
      string,
      { code: string; name: string; bucket: OccupancyBucket }
    >();
    for (const room of buildingRooms) {
      const building = room.floor.building;
      const current = buildingOccupancyMap.get(building.id) ?? {
        code: building.code,
        name: building.name,
        bucket: emptyOccupancy(),
      };
      current.bucket.total += 1;
      if (room.occupancyStatus === RoomOccupancyStatus.OCCUPIED) current.bucket.occupied += 1;
      if (room.occupancyStatus === RoomOccupancyStatus.AVAILABLE) current.bucket.available += 1;
      if (room.occupancyStatus === RoomOccupancyStatus.RESERVED) current.bucket.reserved += 1;
      if (room.occupancyStatus === RoomOccupancyStatus.UNDER_MAINTENANCE) {
        current.bucket.underMaintenance += 1;
      }
      buildingOccupancyMap.set(building.id, current);
    }

    const buildingOccupancy = Array.from(buildingOccupancyMap.entries()).map(([buildingId, row]) => ({
      buildingId,
      code: row.code,
      name: row.name,
      ...row.bucket,
      occupancyRate: calculateOccupancyRate(row.bucket.occupied, row.bucket.total),
    }));

    const assetCounts: Record<OperationalStatus, number> = {
      ACTIVE: 0,
      INACTIVE: 0,
      UNDER_MAINTENANCE: 0,
      DAMAGED: 0,
      RETIRED: 0,
    };
    for (const row of assetRows) {
      assetCounts[row.operationalStatus] = row._count._all;
    }
    const assetTotal = Object.values(assetCounts).reduce((a, b) => a + b, 0);
    const assetDistribution = (Object.keys(assetCounts) as OperationalStatus[]).map((status) => ({
      status,
      count: assetCounts[status],
      percent: calculateOccupancyRate(assetCounts[status], assetTotal),
    }));

    const maintenanceCounts: Record<MaintenanceStatus, number> = {
      REPORTED: 0,
      ASSIGNED: 0,
      IN_PROGRESS: 0,
      RESOLVED: 0,
      CLOSED: 0,
      REJECTED: 0,
      CANCELLED: 0,
    };
    for (const row of maintenanceRows) {
      maintenanceCounts[row.status] = row._count._all;
    }
    const maintenanceTotal = Object.values(maintenanceCounts).reduce((a, b) => a + b, 0);
    const openMaintenance =
      maintenanceCounts.REPORTED + maintenanceCounts.ASSIGNED + maintenanceCounts.IN_PROGRESS;

    let averageResolutionHours: number | null = null;
    if (completedMaintenance.length > 0) {
      const hours = completedMaintenance
        .filter((item) => item.completedAt)
        .map((item) => (item.completedAt!.getTime() - item.createdAt.getTime()) / 36e5);
      if (hours.length > 0) {
        averageResolutionHours = Math.round((sumReadings(hours) / hours.length) * 10) / 10;
      }
    }

    const highPriorityMapped = highPriorityOpen.map((item) => ({
      id: item.id,
      title: item.title,
      priority: item.priority,
      status: item.status,
      createdAt: item.createdAt.toISOString(),
      roomNumber: item.room?.roomNumber ?? null,
      buildingName: item.room?.floor?.building?.name ?? null,
    }));

    const [electricity, water, recentActivityRaw, energyAnomaliesRaw, waterAnomaliesRaw, parkingAreas, parkingActiveAreas, parkingSlotRows] =
      await Promise.all([
        this.loadElectricity(query, { now, dayAgo, weekAgo, monthAgo, trendFrom, trendTo }),
        this.loadWater(query, { now, dayAgo, weekAgo, monthAgo, trendFrom, trendTo }),
        this.repo.findRecentActivity(20),
        this.repo.findUtilityAnomalyNotifications('Electricity'),
        this.repo.findUtilityAnomalyNotifications('Water'),
        this.repo.countParkingAreas(query),
        this.repo.countActiveParkingAreas(query),
        this.repo.groupParkingSlotsByStatus(query),
      ]);

    const parking = {
      areas: parkingAreas,
      activeAreas: parkingActiveAreas,
      totalSlots: 0,
      available: 0,
      occupied: 0,
      reserved: 0,
      underMaintenance: 0,
      utilizationPercent: null as number | null,
    };
    for (const row of parkingSlotRows) {
      parking.totalSlots += row._count._all;
      if (row.status === 'AVAILABLE') parking.available += row._count._all;
      if (row.status === 'OCCUPIED') parking.occupied += row._count._all;
      if (row.status === 'RESERVED') parking.reserved += row._count._all;
      if (row.status === 'UNDER_MAINTENANCE') parking.underMaintenance += row._count._all;
    }
    parking.utilizationPercent =
      parking.totalSlots > 0
        ? Math.round(((parking.occupied + parking.reserved) / parking.totalSlots) * 1000) / 10
        : null;

    const buildingPerformance = buildingOccupancy.map((row) => ({
      buildingId: row.buildingId,
      code: row.code,
      name: row.name,
      rooms: row.total,
      occupancyRate: row.occupancyRate,
      electricity: electricity.byBuilding.find((b) => b.id === row.buildingId)?.consumption ?? null,
      water: water.byBuilding.find((b) => b.id === row.buildingId)?.consumption ?? null,
    }));

    const recentActivity = recentActivityRaw.map((item) => ({
      id: item.id,
      module: activityModule(item.entityName),
      action: item.action,
      message: activityMessage(item.entityName, item.action, item.metadata),
      timestamp: item.createdAt.toISOString(),
      severity: activitySeverity(item.entityName, item.action, item.metadata),
      entityId: item.entityId,
    }));

    const overview: DashboardOverview = {
      kpis: {
        buildings,
        departments,
        rooms: occupancy.total,
        classrooms,
        laboratories,
        assets: assetTotal,
        openMaintenance,
        occupiedRooms: occupancy.occupied,
        availableRooms: occupancy.available,
        occupancyRate,
        parkingAreas: parking.areas,
        parkingSlots: parking.totalSlots,
        parkingAvailable: parking.available,
        parkingUtilization: parking.utilizationPercent,
      },
      occupancy: {
        ...occupancy,
        occupancyRate,
        hasData: occupancy.total > 0,
      },
      parking,
      buildingOccupancy,
      energy: { electricity, water },
      maintenance: {
        total: maintenanceTotal,
        reported: maintenanceCounts.REPORTED,
        assigned: maintenanceCounts.ASSIGNED,
        inProgress: maintenanceCounts.IN_PROGRESS,
        resolved: maintenanceCounts.RESOLVED,
        closed: maintenanceCounts.CLOSED,
        cancelled: maintenanceCounts.CANCELLED,
        rejected: maintenanceCounts.REJECTED,
        open: openMaintenance,
        critical: criticalOpen,
        averageResolutionHours,
        highPriorityOpen: highPriorityMapped,
      },
      assets: {
        total: assetTotal,
        active: assetCounts.ACTIVE,
        inactive: assetCounts.INACTIVE,
        underMaintenance: assetCounts.UNDER_MAINTENANCE,
        damaged: assetCounts.DAMAGED,
        retired: assetCounts.RETIRED,
        distribution: assetDistribution,
      },
      buildingPerformance,
      recentActivity,
      alerts: {
        criticalMaintenance: highPriorityMapped.filter((item) => item.priority === 'CRITICAL'),
        energyAnomalies: energyAnomaliesRaw.map((item) => ({
          id: item.id,
          title: item.title,
          message: item.message,
          severity: this.normalizeSeverity(item.severity),
          timestamp: item.timestamp.toISOString(),
          link: item.link,
        })),
        waterAnomalies: waterAnomaliesRaw.map((item) => ({
          id: item.id,
          title: item.title,
          message: item.message,
          severity: this.normalizeSeverity(item.severity),
          timestamp: item.timestamp.toISOString(),
          link: item.link,
        })),
      },
      filtersApplied: {
        from: query.from?.toISOString(),
        to: query.to?.toISOString(),
        buildingId: query.buildingId,
        departmentId: query.departmentId,
        floorId: query.floorId,
      },
    };

    dashboardEvents.emit('dashboard.updated', { timestamp: now.toISOString() });
    return overview;
  }

  private normalizeSeverity(value: string): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    if (value === 'LOW' || value === 'MEDIUM' || value === 'HIGH' || value === 'CRITICAL') {
      return value;
    }
    return 'MEDIUM';
  }

  private async loadElectricity(
    query: DashboardOverviewQuery,
    windows: {
      now: Date;
      dayAgo: Date;
      weekAgo: Date;
      monthAgo: Date;
      trendFrom: Date;
      trendTo: Date;
    },
  ): Promise<UtilityEnergyBlock> {
    const empty: UtilityEnergyBlock = {
      available: false,
      unit: 'kWh',
      latest: null,
      daily: null,
      weekly: null,
      monthly: null,
      trend: [],
      byBuilding: [],
    };

    try {
      const readings = await this.electricityRepo.getReadingsBetweenDates({
        from: query.from ?? windows.monthAgo,
        to: query.to ?? windows.now,
        buildingId: query.buildingId,
        departmentId: query.departmentId,
      });

      if (readings.length === 0) return empty;

      const mapped = readings.map((r) => ({
        readingTime: r.readingTime,
        consumption: r.kwhConsumption,
        buildingId: r.meter.buildingId ?? 'unassigned',
        buildingLabel: r.meter.building?.name ?? 'Unassigned',
      }));

      const latest = mapped[mapped.length - 1]?.consumption ?? null;
      const daily = sumReadings(
        mapped.filter((r) => inWindow(r.readingTime, windows.dayAgo, windows.now)).map((r) => r.consumption),
      );
      const weekly = sumReadings(
        mapped.filter((r) => inWindow(r.readingTime, windows.weekAgo, windows.now)).map((r) => r.consumption),
      );
      const monthly = sumReadings(mapped.map((r) => r.consumption));

      const byBuildingMap = new Map<string, UtilityBuildingPoint>();
      for (const row of mapped) {
        const current = byBuildingMap.get(row.buildingId) ?? {
          id: row.buildingId,
          label: row.buildingLabel,
          consumption: 0,
        };
        current.consumption += row.consumption;
        byBuildingMap.set(row.buildingId, current);
      }

      return {
        available: true,
        unit: 'kWh',
        latest,
        daily,
        weekly,
        monthly,
        trend: groupByDay(
          mapped.filter((r) => inWindow(r.readingTime, windows.trendFrom, windows.trendTo)),
        ),
        byBuilding: Array.from(byBuildingMap.values()),
      };
    } catch (err) {
      log.warn('Electricity aggregation failed; dashboard will omit energy data', { err });
      return empty;
    }
  }

  private async loadWater(
    query: DashboardOverviewQuery,
    windows: {
      now: Date;
      dayAgo: Date;
      weekAgo: Date;
      monthAgo: Date;
      trendFrom: Date;
      trendTo: Date;
    },
  ): Promise<UtilityWaterBlock> {
    const empty: UtilityWaterBlock = {
      available: false,
      unit: 'L',
      daily: null,
      weekly: null,
      monthly: null,
      trend: [],
      byBuilding: [],
    };

    try {
      const readings = await this.waterRepo.getReadingsBetweenDates({
        from: query.from ?? windows.monthAgo,
        to: query.to ?? windows.now,
        buildingId: query.buildingId,
      });

      if (readings.length === 0) return empty;

      const mapped = readings.map((r) => ({
        readingTime: r.readingTime,
        consumption: r.litersConsumption,
        buildingId: r.meter.buildingId ?? 'unassigned',
        buildingLabel: r.meter.building?.name ?? 'Unassigned',
      }));

      const daily = sumReadings(
        mapped.filter((r) => inWindow(r.readingTime, windows.dayAgo, windows.now)).map((r) => r.consumption),
      );
      const weekly = sumReadings(
        mapped.filter((r) => inWindow(r.readingTime, windows.weekAgo, windows.now)).map((r) => r.consumption),
      );
      const monthly = sumReadings(mapped.map((r) => r.consumption));

      const byBuildingMap = new Map<string, UtilityBuildingPoint>();
      for (const row of mapped) {
        const current = byBuildingMap.get(row.buildingId) ?? {
          id: row.buildingId,
          label: row.buildingLabel,
          consumption: 0,
        };
        current.consumption += row.consumption;
        byBuildingMap.set(row.buildingId, current);
      }

      return {
        available: true,
        unit: 'L',
        daily,
        weekly,
        monthly,
        trend: groupByDay(
          mapped.filter((r) => inWindow(r.readingTime, windows.trendFrom, windows.trendTo)),
        ),
        byBuilding: Array.from(byBuildingMap.values()),
      };
    } catch (err) {
      log.warn('Water aggregation failed; dashboard will omit water data', { err });
      return empty;
    }
  }
}
