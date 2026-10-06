import { RoomOccupancyStatus, MaintenanceStatus } from '@prisma/client';
import { config } from '../../config/env';
import { cacheService } from '../../services/cache.service';
import { buildPaginationMeta } from '../../utils/pagination';
import { calculateOccupancyRate } from '../dashboard/dashboard.service';
import type { ElectricityRepository } from '../electricity/electricity.repository';
import type { WaterRepository } from '../water/water.repository';
import type { AnalyticsRepository } from './analytics.repository';
import type { AnalyticsAuditService } from './analytics.audit.service';
import type { AnalyticsSnapshotService } from './analytics.snapshot.service';
import { analyticsEvents } from './analytics.events';
import type {
  AnalyticsBaseQuery,
  AnalyticsBuildingsQuery,
  AnalyticsDepartmentsQuery,
  AnalyticsOverview,
  AnalyticsReport,
  AnalyticsReportQuery,
  AnalyticsTrends,
  AnalyticsTrendsQuery,
  AssetAnalytics,
  BuildingAnalyticsRow,
  DepartmentAnalyticsRow,
  MaintenanceAnalytics,
  OccupancyAnalytics,
  ParkingAnalytics,
  ResolvedDateRange,
  TrendSeriesPoint,
  UtilityAnalytics,
} from './analytics.dto';
import { resolveAnalyticsDateRange } from './analytics.dto';

function sum(values: number[]): number {
  return values.reduce((a, b) => a + b, 0);
}

function groupByPeriod(
  items: Array<{ date: Date; value: number }>,
  granularity: 'daily' | 'weekly' | 'monthly',
): TrendSeriesPoint[] {
  const map = new Map<string, number>();
  for (const item of items) {
    let key: string;
    const d = item.date;
    if (granularity === 'daily') {
      key = d.toISOString().split('T')[0] ?? d.toISOString();
    } else if (granularity === 'weekly') {
      const weekStart = new Date(d);
      weekStart.setDate(d.getDate() - d.getDay());
      key = weekStart.toISOString().split('T')[0] ?? d.toISOString();
    } else {
      key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    }
    map.set(key, (map.get(key) ?? 0) + item.value);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([period, value]) => ({ period, value }));
}

function occupancyFromGroups(
  rows: Array<{ occupancyStatus: RoomOccupancyStatus; _count: { _all: number } }>,
) {
  const bucket = { total: 0, available: 0, occupied: 0, reserved: 0, underMaintenance: 0 };
  for (const row of rows) {
    bucket.total += row._count._all;
    if (row.occupancyStatus === RoomOccupancyStatus.AVAILABLE) bucket.available += row._count._all;
    if (row.occupancyStatus === RoomOccupancyStatus.OCCUPIED) bucket.occupied += row._count._all;
    if (row.occupancyStatus === RoomOccupancyStatus.RESERVED) bucket.reserved += row._count._all;
    if (row.occupancyStatus === RoomOccupancyStatus.UNDER_MAINTENANCE) {
      bucket.underMaintenance += row._count._all;
    }
  }
  return bucket;
}

function statusCounts(
  rows: Array<{ status: MaintenanceStatus; _count: { _all: number } }>,
): Record<MaintenanceStatus, number> {
  const counts = {
    REPORTED: 0,
    ASSIGNED: 0,
    IN_PROGRESS: 0,
    RESOLVED: 0,
    CLOSED: 0,
    CANCELLED: 0,
    REJECTED: 0,
  };
  for (const row of rows) counts[row.status] = row._count._all;
  return counts;
}

export class AnalyticsService {
  constructor(
    private readonly repo: AnalyticsRepository,
    private readonly electricityRepo: ElectricityRepository,
    private readonly waterRepo: WaterRepository,
    private readonly audit: AnalyticsAuditService,
    private readonly snapshots: AnalyticsSnapshotService,
  ) {}

  private rangeMeta(range: ResolvedDateRange) {
    return {
      from: range.from.toISOString(),
      to: range.to.toISOString(),
      preset: range.preset,
    };
  }

  async getOverview(query: AnalyticsBaseQuery, actorId?: string): Promise<AnalyticsOverview> {
    const cacheKey = `analytics:overview:${JSON.stringify(query)}`;
    return cacheService.getOrSet(
      cacheKey,
      () => this.buildOverview(query, actorId),
      { ttlSeconds: config.cache.analyticsTtlSeconds, prefix: 'cv' },
    );
  }

  private async buildOverview(query: AnalyticsBaseQuery, actorId?: string): Promise<AnalyticsOverview> {
    const range = resolveAnalyticsDateRange(query);

    const [
      buildings,
      activeBuildings,
      floors,
      occupancyRows,
      assetStatusRows,
      maintenanceStatusRows,
      parkingStatusRows,
      electricityReadings,
      waterReadings,
      unreadAlerts,
    ] = await Promise.all([
      this.repo.countBuildings(query),
      this.repo.countBuildings(query, true),
      this.repo.countFloors(query),
      this.repo.groupRoomsByOccupancy(query),
      this.repo.groupAssetsByStatus(query),
      this.repo.groupMaintenanceByStatus(query, range),
      this.repo.groupParkingByStatus(query),
      this.electricityRepo.getReadingsBetweenDates({
        from: range.from,
        to: range.to,
        buildingId: query.buildingId,
        departmentId: query.departmentId,
      }),
      this.waterRepo.getReadingsBetweenDates({
        from: range.from,
        to: range.to,
        buildingId: query.buildingId,
      }),
      this.repo.countUnreadNotifications(actorId),
    ]);

    const occupancy = occupancyFromGroups(occupancyRows);
    const assetCounts = Object.fromEntries(
      assetStatusRows.map((r) => [r.operationalStatus, r._count._all]),
    ) as Record<string, number>;
    const maint = statusCounts(maintenanceStatusRows);

    let parkingTotal = 0;
    let parkingAvailable = 0;
    let parkingAllocated = 0;
    for (const row of parkingStatusRows) {
      parkingTotal += row._count._all;
      if (row.status === 'AVAILABLE') parkingAvailable += row._count._all;
      if (row.status === 'OCCUPIED' || row.status === 'RESERVED') parkingAllocated += row._count._all;
    }

    const electricityKwh =
      electricityReadings.length > 0
        ? sum(electricityReadings.map((r) => r.kwhConsumption))
        : null;
    const waterLiters =
      waterReadings.length > 0 ? sum(waterReadings.map((r) => r.litersConsumption)) : null;

    await this.audit.logEvent({ actorId, action: 'analyticsViewed', metadata: { section: 'overview' } });
    analyticsEvents.emit('analytics.updated', {
      timestamp: new Date().toISOString(),
      section: 'overview',
      actorId,
    });

    return {
      kpis: {
        buildings,
        activeBuildings,
        floors,
        rooms: occupancy.total,
        availableRooms: occupancy.available,
        occupiedRooms: occupancy.occupied,
        reservedRooms: occupancy.reserved,
        roomsUnderMaintenance: occupancy.underMaintenance,
        occupancyRate: calculateOccupancyRate(occupancy.occupied, occupancy.total),
        assets: sum(Object.values(assetCounts)),
        activeAssets: assetCounts['ACTIVE'] ?? 0,
        assetsUnderMaintenance: assetCounts['UNDER_MAINTENANCE'] ?? 0,
        openMaintenance: maint.REPORTED + maint.ASSIGNED + maint.IN_PROGRESS,
        resolvedMaintenance: maint.RESOLVED + maint.CLOSED,
        electricityConsumptionKwh: electricityKwh,
        waterConsumptionLiters: waterLiters,
        parkingCapacity: parkingTotal,
        parkingAvailable,
        parkingAllocated,
        parkingUtilization:
          parkingTotal > 0
            ? Math.round((parkingAllocated / parkingTotal) * 1000) / 10
            : null,
        unreadAlerts,
      },
      dateRange: this.rangeMeta(range),
      filtersApplied: {
        buildingId: query.buildingId,
        departmentId: query.departmentId,
        floorId: query.floorId,
      },
    };
  }

  async getTrends(query: AnalyticsTrendsQuery, actorId?: string): Promise<AnalyticsTrends> {
    const range = resolveAnalyticsDateRange(query);
    const granularity = query.granularity ?? 'daily';

    const [electricityReadings, waterReadings, maintenanceRows, parkingEvents, occupancyEvents, parkingStatus] =
      await Promise.all([
        this.electricityRepo.getReadingsBetweenDates({
          from: range.from,
          to: range.to,
          buildingId: query.buildingId,
          departmentId: query.departmentId,
        }),
        this.waterRepo.getReadingsBetweenDates({
          from: range.from,
          to: range.to,
          buildingId: query.buildingId,
        }),
        this.repo.findMaintenanceInRange(query, range),
        this.repo.findParkingAuditEvents(range),
        this.repo.findOccupancyAuditEvents(range),
        this.repo.groupParkingByStatus(query),
      ]);

    const elecDaily = groupByPeriod(
      electricityReadings.map((r) => ({ date: r.readingTime, value: r.kwhConsumption })),
      'daily',
    );
    const elecWeekly = groupByPeriod(
      electricityReadings.map((r) => ({ date: r.readingTime, value: r.kwhConsumption })),
      'weekly',
    );
    const elecMonthly = groupByPeriod(
      electricityReadings.map((r) => ({ date: r.readingTime, value: r.kwhConsumption })),
      'monthly',
    );

    const waterDaily = groupByPeriod(
      waterReadings.map((r) => ({ date: r.readingTime, value: r.litersConsumption })),
      'daily',
    );
    const waterWeekly = groupByPeriod(
      waterReadings.map((r) => ({ date: r.readingTime, value: r.litersConsumption })),
      'weekly',
    );
    const waterMonthly = groupByPeriod(
      waterReadings.map((r) => ({ date: r.readingTime, value: r.litersConsumption })),
      'monthly',
    );

    const maintMap = new Map<
      string,
      {
        reported: number;
        assigned: number;
        inProgress: number;
        resolved: number;
        closed: number;
        cancelled: number;
        rejected: number;
      }
    >();
    for (const row of maintenanceRows) {
      const period =
        granularity === 'monthly'
          ? `${row.createdAt.getFullYear()}-${String(row.createdAt.getMonth() + 1).padStart(2, '0')}`
          : row.createdAt.toISOString().split('T')[0] ?? row.createdAt.toISOString();
      const entry = maintMap.get(period) ?? {
        reported: 0,
        assigned: 0,
        inProgress: 0,
        resolved: 0,
        closed: 0,
        cancelled: 0,
        rejected: 0,
      };
      if (row.status === 'REPORTED') entry.reported += 1;
      if (row.status === 'ASSIGNED') entry.assigned += 1;
      if (row.status === 'IN_PROGRESS') entry.inProgress += 1;
      if (row.status === 'RESOLVED') entry.resolved += 1;
      if (row.status === 'CLOSED') entry.closed += 1;
      if (row.status === 'CANCELLED') entry.cancelled += 1;
      if (row.status === 'REJECTED') entry.rejected += 1;
      maintMap.set(period, entry);
    }
    const maintenance = [...maintMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([period, counts]) => ({ period, ...counts }));

    const occupancyMap = new Map<
      string,
      { available: number; occupied: number; reserved: number; underMaintenance: number }
    >();
    for (const event of occupancyEvents) {
      const period = event.createdAt.toISOString().split('T')[0] ?? event.createdAt.toISOString();
      const meta = (event.metadata ?? {}) as Record<string, unknown>;
      const newStatus = typeof meta['newStatus'] === 'string' ? meta['newStatus'] : 'AVAILABLE';
      const entry = occupancyMap.get(period) ?? {
        available: 0,
        occupied: 0,
        reserved: 0,
        underMaintenance: 0,
      };
      if (newStatus === 'AVAILABLE') entry.available += 1;
      if (newStatus === 'OCCUPIED') entry.occupied += 1;
      if (newStatus === 'RESERVED') entry.reserved += 1;
      if (newStatus === 'UNDER_MAINTENANCE') entry.underMaintenance += 1;
      occupancyMap.set(period, entry);
    }
    const occupancy = [...occupancyMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([period, counts]) => ({ period, ...counts }));

    let parkingTotal = 0;
    let parkingAllocated = 0;
    for (const row of parkingStatus) {
      parkingTotal += row._count._all;
      if (row.status === 'OCCUPIED' || row.status === 'RESERVED') parkingAllocated += row._count._all;
    }
    const parkingMap = new Map<string, { allocated: number }>();
    for (const event of parkingEvents) {
      const period = event.createdAt.toISOString().split('T')[0] ?? event.createdAt.toISOString();
      const entry = parkingMap.get(period) ?? { allocated: 0 };
      if (event.action === 'allocateParkingSlot') entry.allocated += 1;
      if (event.action === 'releaseParkingSlot') entry.allocated = Math.max(0, entry.allocated - 1);
      parkingMap.set(period, entry);
    }
    const parking = [...parkingMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([period, { allocated }]) => ({
        period,
        totalCapacity: parkingTotal,
        available: Math.max(0, parkingTotal - parkingAllocated),
        allocated,
        utilizationPercent:
          parkingTotal > 0 ? Math.round((allocated / parkingTotal) * 1000) / 10 : null,
      }));

    await this.audit.logEvent({ actorId, action: 'analyticsViewed', metadata: { section: 'trends' } });

    return {
      electricity: { unit: 'kWh', daily: elecDaily, weekly: elecWeekly, monthly: elecMonthly },
      water: { unit: 'L', daily: waterDaily, weekly: waterWeekly, monthly: waterMonthly },
      maintenance,
      occupancy,
      parking,
      dateRange: this.rangeMeta(range),
    };
  }

  async getBuildingAnalytics(query: AnalyticsBuildingsQuery, actorId?: string) {
    const range = resolveAnalyticsDateRange(query);
    const pageResult = await this.repo.paginateBuildingsForAnalytics(query);

    const [electricityReadings, waterReadings] = await Promise.all([
      this.electricityRepo.getReadingsBetweenDates({ from: range.from, to: range.to }),
      this.waterRepo.getReadingsBetweenDates({ from: range.from, to: range.to }),
    ]);

    const elecByBuilding = new Map<string, number>();
    for (const r of electricityReadings) {
      const id = r.meter.buildingId ?? 'unassigned';
      elecByBuilding.set(id, (elecByBuilding.get(id) ?? 0) + r.kwhConsumption);
    }
    const waterByBuilding = new Map<string, number>();
    for (const r of waterReadings) {
      const id = r.meter.buildingId ?? 'unassigned';
      waterByBuilding.set(id, (waterByBuilding.get(id) ?? 0) + r.litersConsumption);
    }

    const rows: BuildingAnalyticsRow[] = [];
    for (const building of pageResult.data) {
      const metrics = await this.repo.getBuildingMetrics(building.id, query, range);
      rows.push({
        buildingId: building.id,
        code: building.code,
        name: building.name,
        rooms: metrics.rooms,
        occupiedRooms: metrics.occupied,
        occupancyRate: calculateOccupancyRate(metrics.occupied, metrics.rooms),
        assets: metrics.assetCount,
        maintenanceIssues: metrics.maintenanceCount,
        electricityKwh: elecByBuilding.get(building.id) ?? null,
        waterLiters: waterByBuilding.get(building.id) ?? null,
        parkingCapacity: metrics.parkingTotal,
        parkingUtilization:
          metrics.parkingTotal > 0
            ? Math.round((metrics.parkingAllocated / metrics.parkingTotal) * 1000) / 10
            : null,
      });
    }

    const sortBy = query.sortBy ?? 'name';
    const sortOrder = query.sortOrder ?? 'asc';
    rows.sort((a, b) => {
      const av = (a as Record<string, unknown>)[sortBy];
      const bv = (b as Record<string, unknown>)[sortBy];
      if (typeof av === 'number' && typeof bv === 'number') {
        return sortOrder === 'asc' ? av - bv : bv - av;
      }
      const as = String(av ?? '');
      const bs = String(bv ?? '');
      return sortOrder === 'asc' ? as.localeCompare(bs) : bs.localeCompare(as);
    });

    await this.audit.logEvent({ actorId, action: 'analyticsViewed', metadata: { section: 'buildings' } });

    return {
      data: rows,
      meta: { pagination: buildPaginationMeta(pageResult.total, pageResult.page, pageResult.limit) },
      dateRange: this.rangeMeta(range),
    };
  }

  async getDepartmentAnalytics(query: AnalyticsDepartmentsQuery, actorId?: string) {
    const range = resolveAnalyticsDateRange(query);
    const departments = await this.repo.listDepartments(query);

    const electricityReadings = await this.electricityRepo.getReadingsBetweenDates({
      from: range.from,
      to: range.to,
      departmentId: query.departmentId,
    });
    const elecByDept = new Map<string, number>();
    for (const r of electricityReadings) {
      const id = r.meter.departmentId ?? 'unassigned';
      elecByDept.set(id, (elecByDept.get(id) ?? 0) + r.kwhConsumption);
    }

    const rows: DepartmentAnalyticsRow[] = [];
    for (const dept of departments) {
      const metrics = await this.repo.getDepartmentMetrics(dept.id, query, range);
      rows.push({
        departmentId: dept.id,
        code: dept.code,
        name: dept.name,
        rooms: metrics.rooms,
        assets: metrics.assets,
        maintenanceIssues: metrics.maintenance,
        electricityMeters: metrics.meterCount,
        electricityKwh: elecByDept.get(dept.id) ?? null,
        openMaintenance: metrics.openMaintenance,
      });
    }

    await this.audit.logEvent({ actorId, action: 'analyticsViewed', metadata: { section: 'departments' } });

    return { data: rows, dateRange: this.rangeMeta(range) };
  }

  async getAssetAnalytics(query: AnalyticsBaseQuery, actorId?: string): Promise<AssetAnalytics> {
    const [
      statusRows,
      categoryRows,
      conditionRows,
      buildingRows,
      departmentRows,
      warrantyExpiring,
    ] = await Promise.all([
      this.repo.groupAssetsByStatus(query),
      this.repo.groupAssetsByCategory(query),
      this.repo.groupAssetsByCondition(query),
      this.repo.groupAssetsByBuilding(query),
      this.repo.groupAssetsByDepartment(query),
      this.repo.countAssetsWarrantyExpiring(query),
    ]);

    const categoryIds = categoryRows.map((r) => r.categoryId);
    const categoryNames = await this.repo.getCategoryNames(categoryIds);
    const nameById = new Map(categoryNames.map((c) => [c.id, c.name]));

    const buildingIds = buildingRows.map((r) => r.buildingId!).filter(Boolean);
    const buildings =
      buildingIds.length > 0 ? await this.repo.listBuildings(query) : [];
    const buildingName = new Map(buildings.map((b) => [b.id, b.name]));

    const departments = await this.repo.listDepartments(query);
    const deptName = new Map(departments.map((d) => [d.id, d.name]));

    let total = 0;
    let underMaintenance = 0;
    let retired = 0;
    const byOperationalStatus = statusRows.map((r) => {
      total += r._count._all;
      if (r.operationalStatus === 'UNDER_MAINTENANCE') underMaintenance += r._count._all;
      if (r.operationalStatus === 'RETIRED') retired += r._count._all;
      return { status: r.operationalStatus, count: r._count._all };
    });

    await this.audit.logEvent({ actorId, action: 'analyticsViewed', metadata: { section: 'assets' } });

    return {
      total,
      byCategory: categoryRows.map((r) => ({
        categoryId: r.categoryId,
        name: nameById.get(r.categoryId) ?? r.categoryId,
        count: r._count._all,
      })),
      byCondition: conditionRows,
      byOperationalStatus,
      byBuilding: buildingRows.map((r) => ({
        buildingId: r.buildingId!,
        name: buildingName.get(r.buildingId!) ?? r.buildingId!,
        count: r._count._all,
      })),
      byDepartment: departmentRows.map((r) => ({
        departmentId: r.departmentId!,
        name: deptName.get(r.departmentId!) ?? r.departmentId!,
        count: r._count._all,
      })),
      underMaintenance,
      retired,
      warrantyExpiringSoon: warrantyExpiring,
    };
  }

  async getMaintenanceAnalytics(
    query: AnalyticsBaseQuery,
    actorId?: string,
  ): Promise<MaintenanceAnalytics> {
    const range = resolveAnalyticsDateRange(query);
    const [
      statusRows,
      priorityRows,
      categoryRows,
      buildingRows,
      departmentRows,
      assetRelated,
      completed,
      workload,
    ] = await Promise.all([
      this.repo.groupMaintenanceByStatus(query, range),
      this.repo.groupMaintenanceByPriority(query, range),
      this.repo.groupMaintenanceByCategory(query, range),
      this.repo.groupMaintenanceByBuilding(query, range),
      this.repo.groupMaintenanceByDepartment(query, range),
      this.repo.countMaintenanceAssetRelated(query, range),
      this.repo.findCompletedMaintenanceForAverage(query, range),
      this.repo.groupTechnicianWorkload(query, range),
    ]);

    const counts = statusCounts(statusRows);
    const total = Object.values(counts).reduce((a, b) => a + b, 0);

    let averageResolutionHours: number | null = null;
    if (completed.length > 0) {
      const hours = completed
        .filter((r) => r.completedAt)
        .map((r) => (r.completedAt!.getTime() - r.createdAt.getTime()) / (1000 * 60 * 60));
      if (hours.length > 0) {
        averageResolutionHours = Math.round((sum(hours) / hours.length) * 10) / 10;
      }
    }

    await this.audit.logEvent({ actorId, action: 'analyticsViewed', metadata: { section: 'maintenance' } });

    return {
      total,
      reported: counts.REPORTED,
      assigned: counts.ASSIGNED,
      inProgress: counts.IN_PROGRESS,
      resolved: counts.RESOLVED,
      closed: counts.CLOSED,
      cancelled: counts.CANCELLED,
      rejected: counts.REJECTED,
      averageResolutionHours,
      byCategory: categoryRows.map((r) => ({
        categoryId: r.categoryId ?? 'unknown',
        count: r._count._all,
      })),
      byPriority: priorityRows.map((r) => ({ priority: r.priority, count: r._count._all })),
      byBuilding: buildingRows,
      byDepartment: departmentRows,
      assetRelated,
      technicianWorkload: workload,
    };
  }

  async getOccupancyAnalytics(
    query: AnalyticsBaseQuery,
    actorId?: string,
  ): Promise<OccupancyAnalytics> {
    const [occupancyRows, byBuilding, byFloor] = await Promise.all([
      this.repo.groupRoomsByOccupancy(query),
      this.repo.groupRoomsByBuilding(query),
      this.repo.groupRoomsByFloor(query),
    ]);

    const bucket = occupancyFromGroups(occupancyRows);

    await this.audit.logEvent({ actorId, action: 'analyticsViewed', metadata: { section: 'occupancy' } });

    return {
      ...bucket,
      occupancyRate: calculateOccupancyRate(bucket.occupied, bucket.total),
      byBuilding: byBuilding.map((b) => ({
        ...b,
        occupancyRate: calculateOccupancyRate(b.occupied, b.total),
      })),
      byFloor: byFloor.map((f) => ({
        ...f,
        occupancyRate: calculateOccupancyRate(f.occupied, f.total),
      })),
    };
  }

  async getParkingAnalytics(query: AnalyticsBaseQuery, actorId?: string): Promise<ParkingAnalytics> {
    const [areas, activeAreas, statusRows, typeRows, byBuilding] = await Promise.all([
      this.repo.countParkingAreas(query),
      this.repo.countParkingAreas(query, true),
      this.repo.groupParkingByStatus(query),
      this.repo.groupParkingByType(query),
      this.repo.groupParkingByBuilding(),
    ]);

    let totalSlots = 0;
    let available = 0;
    let allocated = 0;
    for (const row of statusRows) {
      totalSlots += row._count._all;
      if (row.status === 'AVAILABLE') available += row._count._all;
      if (row.status === 'OCCUPIED' || row.status === 'RESERVED') allocated += row._count._all;
    }

    await this.audit.logEvent({ actorId, action: 'analyticsViewed', metadata: { section: 'parking' } });

    return {
      areas,
      activeAreas,
      totalSlots,
      available,
      allocated,
      utilizationPercent:
        totalSlots > 0 ? Math.round((allocated / totalSlots) * 1000) / 10 : null,
      byType: typeRows.map((r) => ({ slotType: r.slotType, count: r._count._all })),
      byStatus: statusRows.map((r) => ({ status: r.status, count: r._count._all })),
      byBuilding: byBuilding.map((b) => ({
        buildingId: b.buildingId,
        name: b.name,
        total: b.total,
        available: b.available,
        allocated: b.allocated,
        utilizationPercent:
          b.total > 0 ? Math.round((b.allocated / b.total) * 1000) / 10 : null,
      })),
    };
  }

  async getUtilityAnalytics(query: AnalyticsBaseQuery, actorId?: string): Promise<UtilityAnalytics> {
    const range = resolveAnalyticsDateRange(query);

    const [electricityReadings, waterReadings, elecAnomalies, waterAnomalies] = await Promise.all([
      this.electricityRepo.getReadingsBetweenDates({
        from: range.from,
        to: range.to,
        buildingId: query.buildingId,
        departmentId: query.departmentId,
      }),
      this.waterRepo.getReadingsBetweenDates({
        from: range.from,
        to: range.to,
        buildingId: query.buildingId,
      }),
      this.repo.countUtilityAnomalies('Electricity', range),
      this.repo.countUtilityAnomalies('Water', range),
    ]);

    const elecByBuilding = new Map<string, { buildingId: string; name: string; consumption: number }>();
    const elecByDepartment = new Map<string, { departmentId: string; name: string; consumption: number }>();
    for (const r of electricityReadings) {
      const bId = r.meter.buildingId ?? 'unassigned';
      const bName = r.meter.building?.name ?? 'Unassigned';
      const bEntry = elecByBuilding.get(bId) ?? { buildingId: bId, name: bName, consumption: 0 };
      bEntry.consumption += r.kwhConsumption;
      elecByBuilding.set(bId, bEntry);

      const dId = r.meter.departmentId ?? 'unassigned';
      const dName = r.meter.department?.name ?? 'Unassigned';
      const dEntry = elecByDepartment.get(dId) ?? { departmentId: dId, name: dName, consumption: 0 };
      dEntry.consumption += r.kwhConsumption;
      elecByDepartment.set(dId, dEntry);
    }

    const waterByBuilding = new Map<string, { buildingId: string; name: string; consumption: number }>();
    for (const r of waterReadings) {
      const bId = r.meter.buildingId ?? 'unassigned';
      const bName = r.meter.building?.name ?? 'Unassigned';
      const entry = waterByBuilding.get(bId) ?? { buildingId: bId, name: bName, consumption: 0 };
      entry.consumption += r.litersConsumption;
      waterByBuilding.set(bId, entry);
    }

    await this.audit.logEvent({ actorId, action: 'analyticsViewed', metadata: { section: 'utilities' } });

    return {
      electricity: {
        unit: 'kWh',
        total: electricityReadings.length > 0 ? sum(electricityReadings.map((r) => r.kwhConsumption)) : null,
        byBuilding: [...elecByBuilding.values()],
        byDepartment: [...elecByDepartment.values()],
        dailyTrend: groupByPeriod(
          electricityReadings.map((r) => ({ date: r.readingTime, value: r.kwhConsumption })),
          'daily',
        ),
        monthlyTrend: groupByPeriod(
          electricityReadings.map((r) => ({ date: r.readingTime, value: r.kwhConsumption })),
          'monthly',
        ),
        anomalyCount: elecAnomalies,
      },
      water: {
        unit: 'L',
        total: waterReadings.length > 0 ? sum(waterReadings.map((r) => r.litersConsumption)) : null,
        byBuilding: [...waterByBuilding.values()],
        dailyTrend: groupByPeriod(
          waterReadings.map((r) => ({ date: r.readingTime, value: r.litersConsumption })),
          'daily',
        ),
        monthlyTrend: groupByPeriod(
          waterReadings.map((r) => ({ date: r.readingTime, value: r.litersConsumption })),
          'monthly',
        ),
        anomalyCount: waterAnomalies,
      },
      dateRange: this.rangeMeta(range),
    };
  }

  async generateReport(query: AnalyticsReportQuery, actorId?: string): Promise<AnalyticsReport> {
    const range = resolveAnalyticsDateRange(query);
    let data: Record<string, unknown>;

    switch (query.category) {
      case 'campus_overview':
        data = { overview: await this.getOverview(query, actorId) };
        break;
      case 'utilities':
        data = { utilities: await this.getUtilityAnalytics(query, actorId) };
        break;
      case 'maintenance':
        data = { maintenance: await this.getMaintenanceAnalytics(query, actorId) };
        break;
      case 'assets':
        data = { assets: await this.getAssetAnalytics(query, actorId) };
        break;
      case 'occupancy':
        data = { occupancy: await this.getOccupancyAnalytics(query, actorId) };
        break;
      case 'parking':
        data = { parking: await this.getParkingAnalytics(query, actorId) };
        break;
      case 'building_performance':
        data = {
          buildings: await this.getBuildingAnalytics(
            { ...query, page: 1, limit: 100, sortOrder: 'desc' },
            actorId,
          ),
        };
        break;
      default:
        data = {};
    }

    await this.snapshots.saveReportSnapshot(query.category, range, data);
    await this.audit.logEvent({
      actorId,
      action: 'analyticsReportGenerated',
      metadata: { category: query.category },
    });
    analyticsEvents.emit('analytics.report.generated', {
      timestamp: new Date().toISOString(),
      category: query.category,
      actorId,
    });

    return {
      category: query.category,
      generatedAt: new Date().toISOString(),
      dateRange: this.rangeMeta(range),
      data,
    };
  }
}
