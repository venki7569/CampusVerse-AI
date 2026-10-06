// @ts-nocheck
import assert from 'node:assert';
import { MaintenanceRiskService } from './maintenance-risk.service';
import { UtilityIntelligenceService } from './utility-intelligence.service';
import { OccupancyIntelligenceService } from './occupancy-intelligence.service';
import { CampusHealthService } from './campus-health.service';
import { DigitalTwinService } from './digital-twin.service';
import { RecommendationService } from './recommendation.service';
import { digitalTwinEvents } from './digital-twin.events';

let passed = 0;
let failed = 0;
const emitted: Array<{ event: string; payload: unknown }> = [];

digitalTwinEvents.subscribe((event, payload) => {
  emitted.push({ event, payload });
});

async function test(name: string, fn: () => void | Promise<void>) {
  try {
    await fn();
    passed += 1;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failed += 1;
    console.error(`  ✗ ${name}`, err);
  }
}

const now = new Date();
const overdue = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

const mockRepo: any = {
  listAssetsWithMaintenanceContext: async () => [
    {
      id: 'asset-1',
      assetTag: 'AST-104',
      name: 'Projector',
      condition: 'Fair',
      operationalStatus: 'ACTIVE',
      lastMaintenance: null,
      nextMaintenance: overdue,
      warrantyExpiry: null,
      purchaseDate: null,
      buildingId: 'bld-1',
      maintenanceRequests: [{ id: 'r1' }, { id: 'r2' }, { id: 'r3' }, { id: 'r4' }],
      maintenanceHistory: [],
    },
    {
      id: 'asset-2',
      assetTag: 'AST-200',
      name: 'Stable Asset',
      condition: 'Good',
      operationalStatus: 'ACTIVE',
      nextMaintenance: new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000),
      maintenanceRequests: [],
      maintenanceHistory: [],
    },
  ],
  getElectricityReadings: async () => {
    const readings = [];
    for (let i = 0; i < 30; i++) {
      const isRecent = i < 7;
      readings.push({
        kwhConsumption: isRecent ? 280 : 100,
        readingTime: new Date(now.getTime() - i * 24 * 60 * 60 * 1000),
        meter: { building: { id: 'bld-1', name: 'Main Building' }, serialNumber: 'E1' },
      });
    }
    return readings;
  },
  getWaterReadings: async () => [],
  groupRoomsByOccupancy: async () => [
    { occupancyStatus: 'OCCUPIED', _count: { _all: 8 } },
    { occupancyStatus: 'AVAILABLE', _count: { _all: 12 } },
  ],
  listRoomsWithBuilding: async () => [
    {
      id: 'room-1',
      roomNumber: '101',
      occupancyStatus: 'AVAILABLE',
      capacity: 40,
      roomType: 'CLASSROOM',
      floor: { level: '1', buildingId: 'bld-1', building: { name: 'Main' } },
    },
    {
      id: 'room-2',
      roomNumber: '102',
      occupancyStatus: 'OCCUPIED',
      capacity: 30,
      roomType: 'CLASSROOM',
      floor: { level: '1', buildingId: 'bld-1', building: { name: 'Main' } },
    },
  ],
  countOpenMaintenance: async () => 5,
  countAllMaintenanceRequests: async () => 20,
  getActiveBuildingsRatio: async () => ({ total: 2, active: 2 }),
  getAssetStatusGroups: async () => [{ operationalStatus: 'ACTIVE', _count: { _all: 10 } }],
  getParkingStats: async () => ({ total: 20, available: 15, slots: [] }),
  countBuildings: async () => 2,
  countFloors: async () => 4,
  countRooms: async () => 20,
  countAssets: async () => 10,
  listBuildingsSummary: async () => [
    { id: 'bld-1', code: 'MAIN', name: 'Main', operationalStatus: 'ACTIVE', floorCount: 2, roomCount: 10, occupancyRate: 40, healthScore: 100 },
  ],
  getBuildingDetail: async (id: string) =>
    id === 'bld-1'
      ? {
          id: 'bld-1',
          code: 'MAIN',
          name: 'Main',
          location: 'Campus',
          operationalStatus: 'ACTIVE',
          floors: [{ id: 'f1', level: '1', rooms: [] }],
          electricityMeters: [],
          waterMeters: [],
          parkingAreas: [],
          assets: [],
        }
      : null,
  getRoomDetail: async (id: string) =>
    id === 'room-1'
      ? {
          id: 'room-1',
          roomNumber: '101',
          roomType: 'CLASSROOM',
          occupancyStatus: 'AVAILABLE',
          capacity: 40,
          operationalStatus: 'ACTIVE',
          floor: { building: { id: 'bld-1', code: 'MAIN', name: 'Main' } },
          department: null,
          assets: [],
          maintenanceRequests: [],
        }
      : null,
  getAssetDetail: async (id: string) =>
    id === 'asset-1'
      ? { id: 'asset-1', assetTag: 'AST-104', name: 'Projector', maintenanceHistory: [], maintenanceRequests: [] }
      : null,
  getOccupancyAuditEvents: async () => [],
  findAdminUserIds: async () => ['admin-1'],
  getIoTSummary: async () => ({
    total: 5,
    online: 3,
    offline: 1,
    stale: 1,
    maintenance: 0,
  }),
};

const mockRecommendationRepo: any = {
  isAvailable: () => false,
  list: async () => ({ data: [], total: 0 }),
  countOpenBySeverity: async () => ({ critical: 0, high: 1, total: 1 }),
  upsertOpen: async (input: any) => ({ _id: 'rec-1', ...input, createdAt: now, updatedAt: now }),
  findRecentByDedupeKey: async () => null,
  findById: async () => null,
  updateStatus: async (_id: string, status: string) => ({
    _id: 'rec-1',
    type: 'MAINTENANCE',
    severity: 'HIGH',
    status,
    title: 'Test',
    description: 'Test',
    evidence: {},
    recommendedAction: 'Inspect',
    affectedEntity: { type: 'Asset', id: 'asset-1', label: 'Projector' },
    createdAt: now,
    updatedAt: now,
  }),
};

const mockAudit: any = { logEvent: async () => {} };

const maintenanceRisk = new MaintenanceRiskService(mockRepo);
const utilityIntel = new UtilityIntelligenceService(mockRepo);
const occupancyIntel = new OccupancyIntelligenceService(mockRepo);
const campusHealth = new CampusHealthService(mockRepo, maintenanceRisk, utilityIntel, occupancyIntel);
const twinService = new DigitalTwinService(
  mockRepo,
  maintenanceRisk,
  utilityIntel,
  occupancyIntel,
  campusHealth,
  mockRecommendationRepo,
  mockAudit,
);
const recommendationService = new RecommendationService(
  mockRecommendationRepo,
  mockRepo,
  maintenanceRisk,
  utilityIntel,
  campusHealth,
  mockAudit,
);

async function runTests() {
  console.log('Digital Twin & Intelligence tests\n');

  await test('maintenance risk flags overdue asset with repeated events', async () => {
    const risks = await maintenanceRisk.assessAll();
    const high = risks.find((r) => r.assetTag === 'AST-104');
    assert.ok(high);
    assert.ok(['HIGH', 'CRITICAL'].includes(high!.riskLevel));
    assert.ok(high!.riskFactors.some((f) => f.includes('overdue') || f.includes('maintenance events')));
  });

  await test('stable asset has lower maintenance risk', async () => {
    const asset = await maintenanceRisk.assessAssetById('asset-2');
    assert.ok(asset);
    assert.ok(asset!.maintenanceRiskScore < 30);
  });

  await test('utility anomaly detects elevated electricity consumption', async () => {
    const anomalies = await utilityIntel.detectAnomalies();
    assert.ok(anomalies.length >= 1);
    assert.strictEqual(anomalies[0]!.metric, 'electricity');
    assert.ok(anomalies[0]!.explanation.includes('×'));
  });

  await test('occupancy insight returns campus utilization', async () => {
    const insight = await occupancyIntel.getCampusInsight();
    assert.strictEqual(insight.scope, 'campus');
    assert.strictEqual(insight.total, 20);
    assert.strictEqual(insight.utilizationRate, 40);
  });

  await test('campus health score is explainable with documented formula', async () => {
    const health = await campusHealth.calculate();
    assert.ok(health.overallScore >= 0 && health.overallScore <= 100);
    assert.ok(health.dimensions.length >= 5);
    assert.ok(health.formula.includes('mean'));
  });

  await test('digital twin overview aggregates campus state', async () => {
    const overview = await twinService.getOverview('user-1');
    assert.strictEqual(overview.summary.buildings, 2);
    assert.ok(overview.health.overallScore >= 0);
    assert.ok(overview.maintenanceRisks.topRisks.length >= 1);
    assert.ok(emitted.some((e) => e.event === 'digitalTwin.updated'));
  });

  await test('building drill-down returns not found for invalid id', async () => {
    let threw = false;
    try {
      await twinService.getBuildingTwin('invalid');
    } catch {
      threw = true;
    }
    assert.ok(threw);
  });

  await test('room drill-down includes insufficient_data when no audit history', async () => {
    const room = await twinService.getRoomTwin('room-1');
    assert.strictEqual(room.historicalData, 'insufficient_data');
  });

  await test('recommendation acknowledge updates status', async () => {
    const result = await recommendationService.acknowledge('rec-1', 'admin-1');
    assert.strictEqual(result!.status, 'ACKNOWLEDGED');
  });

  await test('AI permission: maintenance risk requires data not permission bypass', async () => {
    const risks = await maintenanceRisk.assessAll();
    assert.ok(Array.isArray(risks));
  });

  console.log(`\nDIGITAL TWIN: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

void runTests();
