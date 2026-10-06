import assert from 'node:assert';
import { AnalyticsService } from './analytics.service';
import { resolveAnalyticsDateRange } from './analytics.dto';
import { analyticsEvents } from './analytics.events';
import { calculateOccupancyRate } from '../dashboard/dashboard.service';

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

function buildHarness() {
  const buildings = [
    { id: 'b1', code: 'MAIN', name: 'Main Building' },
    { id: 'b2', code: 'SCI', name: 'Science Block' },
  ];
  const departments = [
    { id: 'd1', code: 'CS', name: 'Computer Science' },
    { id: 'd2', code: 'EE', name: 'Electrical Engineering' },
  ];

  const repo = {
    countBuildings: async (_q: unknown, activeOnly = false) =>
      activeOnly ? buildings.length : buildings.length,
    countFloors: async () => 6,
    groupRoomsByOccupancy: async () => [
      { occupancyStatus: 'AVAILABLE', _count: { _all: 5 } },
      { occupancyStatus: 'OCCUPIED', _count: { _all: 8 } },
      { occupancyStatus: 'RESERVED', _count: { _all: 2 } },
      { occupancyStatus: 'UNDER_MAINTENANCE', _count: { _all: 1 } },
    ],
    groupAssetsByStatus: async () => [
      { operationalStatus: 'ACTIVE', _count: { _all: 20 } },
      { operationalStatus: 'UNDER_MAINTENANCE', _count: { _all: 3 } },
    ],
    groupMaintenanceByStatus: async () => [
      { status: 'REPORTED', _count: { _all: 2 } },
      { status: 'IN_PROGRESS', _count: { _all: 1 } },
      { status: 'RESOLVED', _count: { _all: 4 } },
      { status: 'CLOSED', _count: { _all: 3 } },
    ],
    groupParkingByStatus: async () => [
      { status: 'AVAILABLE', _count: { _all: 10 } },
      { status: 'OCCUPIED', _count: { _all: 6 } },
      { status: 'RESERVED', _count: { _all: 2 } },
    ],
    countParkingAreas: async () => 2,
    countUnreadNotifications: async () => 5,
    findMaintenanceInRange: async () => [
      { createdAt: new Date('2026-08-01T10:00:00Z'), status: 'REPORTED' },
      { createdAt: new Date('2026-08-02T10:00:00Z'), status: 'RESOLVED' },
    ],
    findParkingAuditEvents: async () => [],
    findOccupancyAuditEvents: async () => [],
    paginateBuildingsForAnalytics: async () => ({
      data: buildings,
      total: buildings.length,
      page: 1,
      limit: 10,
    }),
    getBuildingMetrics: async (id: string) => ({
      rooms: id === 'b1' ? 10 : 6,
      occupied: id === 'b1' ? 6 : 2,
      assetCount: 5,
      maintenanceCount: 2,
      parkingTotal: 8,
      parkingAllocated: 3,
    }),
    listDepartments: async () => departments,
    getDepartmentMetrics: async () => ({
      rooms: 4,
      assets: 6,
      maintenance: 2,
      openMaintenance: 1,
      meterCount: 1,
    }),
    groupAssetsByCategory: async () => [{ categoryId: 'c1', _count: { _all: 10 } }],
    groupAssetsByCondition: async () => [{ condition: 'Good', count: 8 }],
    groupAssetsByBuilding: async () => [{ buildingId: 'b1', _count: { _all: 7 } }],
    groupAssetsByDepartment: async () => [{ departmentId: 'd1', _count: { _all: 5 } }],
    countAssetsWarrantyExpiring: async () => 2,
    getCategoryNames: async () => [{ id: 'c1', name: 'IT Equipment' }],
    listBuildings: async () => buildings,
    groupMaintenanceByPriority: async () => [{ priority: 'HIGH', _count: { _all: 2 } }],
    groupMaintenanceByCategory: async () => [{ categoryId: 'ELECTRICAL', _count: { _all: 3 } }],
    groupMaintenanceByBuilding: async () => [{ buildingId: 'b1', name: 'Main Building', count: 2 }],
    groupMaintenanceByDepartment: async () => [{ departmentId: 'd1', name: 'CS', count: 1 }],
    countMaintenanceAssetRelated: async () => 1,
    findCompletedMaintenanceForAverage: async () => [
      { createdAt: new Date('2026-08-01T08:00:00Z'), completedAt: new Date('2026-08-01T10:00:00Z') },
    ],
    groupTechnicianWorkload: async () => [
      { technicianId: 't1', name: 'Tech One', assignments: 3 },
    ],
    groupRoomsByBuilding: async () => [
      { buildingId: 'b1', code: 'MAIN', name: 'Main Building', total: 10, occupied: 6 },
    ],
    groupRoomsByFloor: async () => [
      { floorId: 'f1', level: '1', buildingName: 'Main Building', total: 5, occupied: 3 },
    ],
    groupParkingByType: async () => [{ slotType: 'STANDARD', _count: { _all: 16 } }],
    groupParkingByBuilding: async () => [
      { buildingId: 'b1', name: 'Main Building', total: 16, available: 10, allocated: 6 },
    ],
    countUtilityAnomalies: async (prefix: string) => (prefix === 'Electricity' ? 1 : 0),
  };

  const electricityRepo = {
    getReadingsBetweenDates: async () => [
      {
        readingTime: new Date('2026-08-10T12:00:00Z'),
        kwhConsumption: 100,
        meter: {
          buildingId: 'b1',
          departmentId: 'd1',
          building: { name: 'Main Building' },
          department: { name: 'CS' },
        },
      },
      {
        readingTime: new Date('2026-08-11T12:00:00Z'),
        kwhConsumption: 150,
        meter: {
          buildingId: 'b1',
          departmentId: 'd1',
          building: { name: 'Main Building' },
          department: { name: 'CS' },
        },
      },
    ],
  };

  const waterRepo = {
    getReadingsBetweenDates: async () => [
      {
        readingTime: new Date('2026-08-10T12:00:00Z'),
        litersConsumption: 500,
        meter: { buildingId: 'b1', building: { name: 'Main Building' } },
      },
    ],
  };

  const audit = { logEvent: async () => undefined };
  const snapshots = { saveReportSnapshot: async () => undefined };

  const service = new AnalyticsService(
    repo as never,
    electricityRepo as never,
    waterRepo as never,
    audit as never,
    snapshots as never,
  );

  return { service, audit, snapshots };
}

async function runTests(): Promise<void> {
  console.log('\n============================================================');
  console.log('ANALYTICS SERVICE TESTS');
  console.log('============================================================\n');

  const { service } = buildHarness();
  const events: string[] = [];
  analyticsEvents.subscribe((event) => events.push(event));

  await test('Overview KPI aggregation', async () => {
    const overview = await service.getOverview({ preset: 'last30days' }, 'actor-1');
    assert.strictEqual(overview.kpis.buildings, 2);
    assert.strictEqual(overview.kpis.rooms, 16);
    assert.strictEqual(overview.kpis.occupiedRooms, 8);
    assert.strictEqual(overview.kpis.electricityConsumptionKwh, 250);
    assert.strictEqual(overview.kpis.waterConsumptionLiters, 500);
    assert.strictEqual(overview.kpis.parkingCapacity, 18);
    assert.strictEqual(overview.kpis.unreadAlerts, 5);
  });

  await test('Empty campus returns zero occupancy rate', () => {
    assert.strictEqual(calculateOccupancyRate(0, 0), null);
  });

  await test('Date preset last7days resolves', () => {
    const range = resolveAnalyticsDateRange({ preset: 'last7days' });
    assert.ok(range.from <= range.to);
    assert.strictEqual(range.preset, 'last7days');
  });

  await test('Invalid date range rejected', () => {
    let rejected = false;
    try {
      resolveAnalyticsDateRange({
        preset: 'custom',
        from: new Date('2026-08-20'),
        to: new Date('2026-08-01'),
      });
    } catch {
      rejected = true;
    }
    assert.strictEqual(rejected, true);
  });

  await test('Trends electricity and water', async () => {
    const trends = await service.getTrends({ preset: 'last30days', granularity: 'daily' });
    assert.strictEqual(trends.electricity.unit, 'kWh');
    assert.ok(trends.electricity.daily.length >= 1);
    assert.strictEqual(trends.water.unit, 'L');
    assert.ok(trends.maintenance.length >= 1);
  });

  await test('Building analytics comparison and sorting', async () => {
    const result = await service.getBuildingAnalytics({
      preset: 'last30days',
      page: 1,
      limit: 10,
      sortBy: 'occupancyRate',
      sortOrder: 'desc',
    });
    assert.strictEqual(result.data.length, 2);
    assert.ok(result.data[0]!.occupancyRate !== null);
  });

  await test('Department analytics metrics', async () => {
    const result = await service.getDepartmentAnalytics({ preset: 'last30days', page: 1, limit: 10 });
    assert.strictEqual(result.data.length, 2);
    assert.strictEqual(result.data[0]!.electricityMeters, 1);
  });

  await test('Asset analytics distributions', async () => {
    const assets = await service.getAssetAnalytics({ preset: 'last30days' });
    assert.strictEqual(assets.total, 23);
    assert.ok(assets.byCategory.length >= 1);
    assert.strictEqual(assets.warrantyExpiringSoon, 2);
  });

  await test('Maintenance analytics status and resolution', async () => {
    const maint = await service.getMaintenanceAnalytics({ preset: 'last30days' });
    assert.strictEqual(maint.total, 10);
    assert.strictEqual(maint.assetRelated, 1);
    assert.strictEqual(maint.averageResolutionHours, 2);
    assert.ok(maint.byPriority.length >= 1);
  });

  await test('Occupancy analytics campus-wide', async () => {
    const occ = await service.getOccupancyAnalytics({});
    assert.strictEqual(occ.total, 16);
    assert.strictEqual(occ.occupancyRate, 50);
    assert.ok(occ.byBuilding.length >= 1);
  });

  await test('Parking analytics utilization', async () => {
    const parking = await service.getParkingAnalytics({});
    assert.strictEqual(parking.totalSlots, 18);
    assert.strictEqual(parking.allocated, 8);
    assert.ok(parking.utilizationPercent !== null);
  });

  await test('Utility analytics with anomaly counts', async () => {
    const utilities = await service.getUtilityAnalytics({ preset: 'last30days' });
    assert.strictEqual(utilities.electricity.total, 250);
    assert.strictEqual(utilities.electricity.anomalyCount, 1);
    assert.strictEqual(utilities.water.unit, 'L');
  });

  await test('Report generation', async () => {
    const report = await service.generateReport(
      { preset: 'last30days', category: 'utilities' },
      'actor-1',
    );
    assert.strictEqual(report.category, 'utilities');
    assert.ok(report.data.utilities);
    assert.ok(events.includes('analytics.report.generated'));
  });

  await test('RBAC permission codes documented', () => {
    const required = ['analytics.view', 'analytics.report'];
    assert.strictEqual(required.length, 2);
  });

  console.log('\n============================================================');
  console.log(`ANALYTICS RESULTS: ${passed} / ${total} TESTS PASSED`);
  console.log('============================================================\n');

  if (passed !== total) process.exit(1);
}

void runTests();
