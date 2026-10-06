import assert from 'node:assert';
import { RoomOccupancyStatus, OperationalStatus, MaintenanceStatus } from '@prisma/client';
import {
  DashboardService,
  calculateOccupancyRate,
  emptyOccupancy,
} from './dashboard.service';
import type { DashboardOverviewQuery } from './dashboard.dto';

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

const emptyQuery: DashboardOverviewQuery = {
  from: undefined,
  to: undefined,
  buildingId: undefined,
  departmentId: undefined,
  floorId: undefined,
};

function buildRepo(overrides: Record<string, unknown> = {}) {
  return {
    countBuildings: async () => 4,
    countDepartments: async () => 3,
    countRooms: async (_q: DashboardOverviewQuery, extra?: { roomType?: string }) => {
      if (extra?.roomType === 'CLASSROOM') return 12;
      if (extra?.roomType === 'LABORATORY') return 5;
      return 20;
    },
    groupRoomsByOccupancy: async () => [
      { occupancyStatus: RoomOccupancyStatus.OCCUPIED, _count: { _all: 8 } },
      { occupancyStatus: RoomOccupancyStatus.AVAILABLE, _count: { _all: 7 } },
      { occupancyStatus: RoomOccupancyStatus.RESERVED, _count: { _all: 3 } },
      { occupancyStatus: RoomOccupancyStatus.UNDER_MAINTENANCE, _count: { _all: 2 } },
    ],
    findRoomsForBuildingOccupancy: async () => [
      {
        occupancyStatus: RoomOccupancyStatus.OCCUPIED,
        floor: { buildingId: 'bld-1', building: { id: 'bld-1', name: 'Main', code: 'MAIN' } },
      },
      {
        occupancyStatus: RoomOccupancyStatus.AVAILABLE,
        floor: { buildingId: 'bld-1', building: { id: 'bld-1', name: 'Main', code: 'MAIN' } },
      },
      {
        occupancyStatus: RoomOccupancyStatus.OCCUPIED,
        floor: { buildingId: 'bld-2', building: { id: 'bld-2', name: 'Lab Block', code: 'LAB' } },
      },
    ],
    groupAssetsByStatus: async () => [
      { operationalStatus: OperationalStatus.ACTIVE, _count: { _all: 10 } },
      { operationalStatus: OperationalStatus.UNDER_MAINTENANCE, _count: { _all: 2 } },
      { operationalStatus: OperationalStatus.DAMAGED, _count: { _all: 1 } },
    ],
    groupMaintenanceByStatus: async () => [
      { status: MaintenanceStatus.REPORTED, _count: { _all: 2 } },
      { status: MaintenanceStatus.ASSIGNED, _count: { _all: 1 } },
      { status: MaintenanceStatus.IN_PROGRESS, _count: { _all: 3 } },
      { status: MaintenanceStatus.CLOSED, _count: { _all: 4 } },
    ],
    countCriticalOpenMaintenance: async () => 1,
    findHighPriorityOpenMaintenance: async () => [
      {
        id: 'mnt-1',
        title: 'AC failure',
        priority: 'CRITICAL',
        status: 'IN_PROGRESS',
        createdAt: new Date('2026-08-20T10:00:00.000Z'),
        room: { roomNumber: '101', floor: { building: { name: 'Main' } } },
      },
    ] as never,
    findCompletedMaintenanceForAverage: async () => [
      {
        createdAt: new Date('2026-08-20T08:00:00.000Z'),
        completedAt: new Date('2026-08-20T10:00:00.000Z'),
      },
    ],
    findRecentActivity: async () => [
      {
        id: 'act-1',
        actorId: 'user-1',
        action: 'updateOccupancy',
        entityName: 'Room',
        entityId: 'room-1',
        metadata: { roomNumber: '301', newStatus: 'OCCUPIED' },
        createdAt: new Date('2026-08-23T10:00:00.000Z'),
      },
    ],
    findUtilityAnomalyNotifications: async (prefix: string) =>
      prefix === 'Electricity'
        ? [
            {
              id: 'anom-1',
              title: 'Electricity Anomaly - HIGH',
              message: 'Spike in Engineering Block',
              severity: 'HIGH',
              timestamp: new Date('2026-08-23T09:00:00.000Z'),
              link: '/electricity',
            },
          ]
        : [],
    countParkingAreas: async () => 2,
    countActiveParkingAreas: async () => 2,
    groupParkingSlotsByStatus: async () => [
      { status: 'AVAILABLE', _count: { _all: 8 } },
      { status: 'OCCUPIED', _count: { _all: 4 } },
      { status: 'RESERVED', _count: { _all: 2 } },
      { status: 'UNDER_MAINTENANCE', _count: { _all: 1 } },
    ],
    ...overrides,
  };
}

function buildElectricityRepo(readings: Array<Record<string, unknown>> = []) {
  return {
    getReadingsBetweenDates: async () => readings,
  };
}

function buildWaterRepo(readings: Array<Record<string, unknown>> = []) {
  return {
    getReadingsBetweenDates: async () => readings,
  };
}

async function runTests(): Promise<void> {
  console.log('\n============================================================');
  console.log('DASHBOARD SERVICE TESTS');
  console.log('============================================================\n');

  await test('Occupancy rate: occupied / total * 100', () => {
    assert.strictEqual(calculateOccupancyRate(142, 250), 56.8);
  });

  await test('Occupancy rate: zero rooms returns null (no division error)', () => {
    assert.strictEqual(calculateOccupancyRate(0, 0), null);
    assert.strictEqual(calculateOccupancyRate(5, 0), null);
  });

  await test('emptyOccupancy starts at zeroes', () => {
    assert.deepStrictEqual(emptyOccupancy(), {
      total: 0,
      occupied: 0,
      available: 0,
      reserved: 0,
      underMaintenance: 0,
    });
  });

  await test('KPI calculation from aggregated counts', async () => {
    const service = new DashboardService(
      buildRepo() as never,
      buildElectricityRepo() as never,
      buildWaterRepo() as never,
    );
    const overview = await service.getOverview(emptyQuery);
    assert.strictEqual(overview.kpis.buildings, 4);
    assert.strictEqual(overview.kpis.departments, 3);
    assert.strictEqual(overview.kpis.rooms, 20);
    assert.strictEqual(overview.kpis.classrooms, 12);
    assert.strictEqual(overview.kpis.laboratories, 5);
    assert.strictEqual(overview.kpis.assets, 13);
    assert.strictEqual(overview.kpis.openMaintenance, 6);
    assert.strictEqual(overview.kpis.occupiedRooms, 8);
    assert.strictEqual(overview.kpis.availableRooms, 7);
    assert.strictEqual(overview.kpis.occupancyRate, 40);
  });

  await test('Occupancy summary buckets', async () => {
    const service = new DashboardService(
      buildRepo() as never,
      buildElectricityRepo() as never,
      buildWaterRepo() as never,
    );
    const overview = await service.getOverview(emptyQuery);
    assert.strictEqual(overview.occupancy.total, 20);
    assert.strictEqual(overview.occupancy.occupied, 8);
    assert.strictEqual(overview.occupancy.available, 7);
    assert.strictEqual(overview.occupancy.reserved, 3);
    assert.strictEqual(overview.occupancy.underMaintenance, 2);
    assert.strictEqual(overview.occupancy.hasData, true);
  });

  await test('Empty occupancy dataset does not invent rooms', async () => {
    const service = new DashboardService(
      buildRepo({
        groupRoomsByOccupancy: async () => [],
        findRoomsForBuildingOccupancy: async () => [],
        countRooms: async () => 0,
      }) as never,
      buildElectricityRepo() as never,
      buildWaterRepo() as never,
    );
    const overview = await service.getOverview(emptyQuery);
    assert.strictEqual(overview.occupancy.total, 0);
    assert.strictEqual(overview.occupancy.hasData, false);
    assert.strictEqual(overview.kpis.occupancyRate, null);
  });

  await test('Building occupancy aggregation without N+1', async () => {
    const service = new DashboardService(
      buildRepo() as never,
      buildElectricityRepo() as never,
      buildWaterRepo() as never,
    );
    const overview = await service.getOverview(emptyQuery);
    const main = overview.buildingOccupancy.find((b) => b.buildingId === 'bld-1');
    assert.ok(main);
    assert.strictEqual(main?.total, 2);
    assert.strictEqual(main?.occupied, 1);
    assert.strictEqual(main?.available, 1);
    assert.strictEqual(main?.occupancyRate, 50);
  });

  await test('Maintenance summary includes open and closed states', async () => {
    const service = new DashboardService(
      buildRepo() as never,
      buildElectricityRepo() as never,
      buildWaterRepo() as never,
    );
    const overview = await service.getOverview(emptyQuery);
    assert.strictEqual(overview.maintenance.reported, 2);
    assert.strictEqual(overview.maintenance.assigned, 1);
    assert.strictEqual(overview.maintenance.inProgress, 3);
    assert.strictEqual(overview.maintenance.closed, 4);
    assert.strictEqual(overview.maintenance.open, 6);
    assert.strictEqual(overview.maintenance.critical, 1);
    assert.strictEqual(overview.maintenance.averageResolutionHours, 2);
    assert.strictEqual(overview.alerts.criticalMaintenance.length, 1);
  });

  await test('Asset health distribution uses real percentages', async () => {
    const service = new DashboardService(
      buildRepo() as never,
      buildElectricityRepo() as never,
      buildWaterRepo() as never,
    );
    const overview = await service.getOverview(emptyQuery);
    assert.strictEqual(overview.assets.total, 13);
    assert.strictEqual(overview.assets.active, 10);
    assert.strictEqual(overview.assets.underMaintenance, 2);
    assert.strictEqual(overview.assets.damaged, 1);
    const active = overview.assets.distribution.find((d) => d.status === 'ACTIVE');
    assert.strictEqual(active?.percent, 76.9);
  });

  await test('Electricity aggregation from real readings', async () => {
    const now = new Date();
    const service = new DashboardService(
      buildRepo() as never,
      buildElectricityRepo([
        {
          kwhConsumption: 100,
          readingTime: new Date(now.getTime() - 2 * 60 * 60 * 1000),
          meter: { buildingId: 'bld-1', building: { name: 'Main' } },
        },
        {
          kwhConsumption: 50,
          readingTime: now,
          meter: { buildingId: 'bld-1', building: { name: 'Main' } },
        },
      ]) as never,
      buildWaterRepo() as never,
    );
    const overview = await service.getOverview(emptyQuery);
    assert.strictEqual(overview.energy.electricity.available, true);
    assert.strictEqual(overview.energy.electricity.unit, 'kWh');
    assert.strictEqual(overview.energy.electricity.daily, 150);
    assert.strictEqual(overview.energy.electricity.latest, 50);
    assert.ok(overview.energy.electricity.byBuilding.some((b) => b.id === 'bld-1' && b.consumption === 150));
  });

  await test('Water aggregation from real readings', async () => {
    const now = new Date();
    const service = new DashboardService(
      buildRepo() as never,
      buildElectricityRepo() as never,
      buildWaterRepo([
        {
          litersConsumption: 400,
          readingTime: now,
          meter: { buildingId: 'bld-2', building: { name: 'Lab Block' } },
        },
      ]) as never,
    );
    const overview = await service.getOverview(emptyQuery);
    assert.strictEqual(overview.energy.water.available, true);
    assert.strictEqual(overview.energy.water.unit, 'L');
    assert.strictEqual(overview.energy.water.daily, 400);
  });

  await test('Missing utility readings return unavailable, not fake zeroes', async () => {
    const service = new DashboardService(
      buildRepo() as never,
      buildElectricityRepo([]) as never,
      buildWaterRepo([]) as never,
    );
    const overview = await service.getOverview(emptyQuery);
    assert.strictEqual(overview.energy.electricity.available, false);
    assert.strictEqual(overview.energy.electricity.daily, null);
    assert.strictEqual(overview.energy.water.available, false);
    assert.strictEqual(overview.energy.water.monthly, null);
  });

  await test('Partial electricity failure still returns occupancy and maintenance', async () => {
    const service = new DashboardService(
      buildRepo() as never,
      {
        getReadingsBetweenDates: async () => {
          throw new Error('electricity down');
        },
      } as never,
      buildWaterRepo() as never,
    );
    const overview = await service.getOverview(emptyQuery);
    assert.strictEqual(overview.energy.electricity.available, false);
    assert.strictEqual(overview.occupancy.total, 20);
    assert.strictEqual(overview.maintenance.open, 6);
  });

  await test('Filters are echoed in filtersApplied', async () => {
    const from = new Date('2026-08-01T00:00:00.000Z');
    const service = new DashboardService(
      buildRepo() as never,
      buildElectricityRepo() as never,
      buildWaterRepo() as never,
    );
    const overview = await service.getOverview({
      from,
      to: undefined,
      buildingId: 'bld-1',
      departmentId: undefined,
      floorId: undefined,
    });
    assert.strictEqual(overview.filtersApplied.buildingId, 'bld-1');
    assert.strictEqual(overview.filtersApplied.from, from.toISOString());
  });

  await test('Recent activity is built from audit records, not mocks', async () => {
    const service = new DashboardService(
      buildRepo() as never,
      buildElectricityRepo() as never,
      buildWaterRepo() as never,
    );
    const overview = await service.getOverview(emptyQuery);
    assert.strictEqual(overview.recentActivity.length, 1);
    assert.strictEqual(overview.recentActivity[0]?.message, 'Room 301 changed to OCCUPIED');
    assert.strictEqual(overview.recentActivity[0]?.module, 'Occupancy');
  });

  await test('Empty asset dataset does not invent percentages', async () => {
    const service = new DashboardService(
      buildRepo({ groupAssetsByStatus: async () => [] }) as never,
      buildElectricityRepo() as never,
      buildWaterRepo() as never,
    );
    const overview = await service.getOverview(emptyQuery);
    assert.strictEqual(overview.assets.total, 0);
    assert.ok(overview.assets.distribution.every((item) => item.percent === null));
  });

  console.log('\n============================================================');
  console.log(`DASHBOARD RESULTS: ${passed} / ${total} TESTS PASSED`);
  console.log('============================================================\n');

  if (passed !== total) process.exit(1);
}

void runTests();
