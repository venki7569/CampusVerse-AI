import assert from 'node:assert';
import { ElectricityService } from './electricity.service';
import { electricityEvents, type ElectricityEventName, type ElectricityEventPayload } from './electricity.events';

// ── Mock State ────────────────────────────────────────────────────────────────
const mockBuildings = [
  { id: 'bld-1', name: 'Engineering Block', code: 'ENG', operationalStatus: 'ACTIVE' },
  { id: 'bld-retired', name: 'Old Shed', code: 'OLD', operationalStatus: 'RETIRED' },
];

const mockDepartments = [
  { id: 'dept-1', name: 'Computer Science', code: 'CS' },
];

let metersStore: any[] = [];
let readingsStore: any[] = [];
const emittedEvents: Array<{ event: ElectricityEventName; payload: ElectricityEventPayload }> = [];

electricityEvents.subscribe((event: ElectricityEventName, payload: ElectricityEventPayload) => {
  emittedEvents.push({ event, payload });
});

// Mock Prisma
const mockDb: any = {
  building: {
    findUnique: async ({ where }: any) => mockBuildings.find((b) => b.id === where.id) || null,
  },
  department: {
    findUnique: async ({ where }: any) => mockDepartments.find((d) => d.id === where.id) || null,
  },
  electricityReading: {
    findMany: async ({ where, take }: any) => {
      let results = readingsStore.filter((r) => (!where?.meterId || r.meterId === where.meterId));
      if (take) results = results.slice(0, take);
      return results;
    },
  },
  user: {
    findMany: async () => [],
  },
};

// Mock Repository
const mockRepo: any = {
  findAllMeters: async (query: any) => ({
    data: metersStore.filter((m) =>
      (query.isActive === undefined || m.isActive === query.isActive) &&
      (!query.buildingId || m.buildingId === query.buildingId)
    ),
    total: metersStore.length,
    page: 1,
    limit: 10,
  }),
  findMeterById: async (id: string) => metersStore.find((m) => m.id === id) || null,
  findMeterBySerialNumber: async (sn: string) => metersStore.find((m) => m.serialNumber === sn) || null,
  createMeter: async (dto: any) => {
    const meter = {
      id: `meter-${metersStore.length + 1}`,
      ...dto,
      createdAt: new Date(),
    };
    metersStore.push(meter);
    return meter;
  },
  updateMeter: async (id: string, dto: any) => {
    const meter = metersStore.find((m) => m.id === id);
    if (meter) Object.assign(meter, dto);
    return meter;
  },
  archiveMeter: async (id: string) => {
    const meter = metersStore.find((m) => m.id === id);
    if (meter) meter.isActive = false;
    return meter;
  },
  findReadings: async (meterId: string, _query: any) => {
    const readings = readingsStore.filter((r) => r.meterId === meterId);
    return { data: readings, total: readings.length, page: 1, limit: 10 };
  },
  findLatestReading: async (meterId: string) => {
    const readings = readingsStore.filter((r) => r.meterId === meterId);
    return readings.length > 0 ? readings[readings.length - 1] : null;
  },
  createReading: async (meterId: string, kwhConsumption: number, readingTime: Date) => {
    const reading = {
      id: `reading-${readingsStore.length + 1}`,
      meterId,
      kwhConsumption,
      readingTime,
      createdAt: new Date(),
    };
    readingsStore.push(reading);
    return reading;
  },
  getReadingsBetweenDates: async (filters: any) => {
    let results = readingsStore;
    if (filters.meterId) results = results.filter((r) => r.meterId === filters.meterId);
    if (filters.from) results = results.filter((r) => r.readingTime >= filters.from);
    if (filters.to) results = results.filter((r) => r.readingTime <= filters.to);
    return results.map((r) => ({
      ...r,
      meter: {
        ...metersStore.find((m) => m.id === r.meterId),
        building: null,
        department: null,
      },
    }));
  },
};

// Mock Audit Service
const mockAudit: any = {
  logEvent: async () => {},
  createAnomalyNotification: async () => {},
};

// ── Test Runner ──────────────────────────────────────────────────────────────
async function runTests() {
  console.log('\n============================================================');
  console.log('⚡ RUNNING PHASE 10 ELECTRICITY MANAGEMENT TEST SUITE');
  console.log('============================================================\n');

  const service = new ElectricityService(mockRepo, mockAudit, mockDb);
  let passed = 0;
  let total = 0;

  async function test(name: string, fn: () => Promise<void>) {
    total++;
    try {
      await fn();
      console.log(`  ✅ [PASS] ${total}. ${name}`);
      passed++;
    } catch (err: any) {
      console.error(`  ❌ [FAIL] ${total}. ${name}`);
      console.error(`     Error: ${err.message}`);
    }
  }

  // ── 1. Create electricity meter ───────────────────────────────────────────
  await test('Create electricity meter with valid data', async () => {
    const meter = await service.createMeter({
      serialNumber: 'ELEC-ENG-001',
      buildingId: 'bld-1',
      departmentId: 'dept-1',
      isActive: true,
    }, 'actor-1');
    assert.strictEqual(meter.serialNumber, 'ELEC-ENG-001');
    assert.strictEqual(meter.isActive, true);
  });

  // ── 2. Duplicate serial rejected ─────────────────────────────────────────
  await test('Reject duplicate electricity meter serial number', async () => {
    let caught = false;
    try {
      await service.createMeter({ serialNumber: 'ELEC-ENG-001', isActive: true }, 'actor-1');
    } catch (err: any) {
      caught = true;
      assert.strictEqual(err.statusCode, 409);
    }
    assert.ok(caught, 'Should throw 409 Conflict');
  });

  // ── 3. Event emitted on creation ─────────────────────────────────────────
  await test('Verify electricity:meter_created event emitted', async () => {
    const evt = emittedEvents.find((e) => e.event === 'electricity:meter_created');
    assert.ok(evt, 'Event should be emitted');
    assert.strictEqual(evt.payload.serialNumber, 'ELEC-ENG-001');
  });

  // ── 4. Invalid building rejected ─────────────────────────────────────────
  await test('Reject electricity meter with non-existent building', async () => {
    let caught = false;
    try {
      await service.createMeter({ serialNumber: 'ELEC-X-001', buildingId: 'bld-nonexistent', isActive: true }, 'actor-1');
    } catch (err: any) {
      caught = true;
      assert.ok(err.statusCode === 404 || err.statusCode === 400);
    }
    assert.ok(caught, 'Should throw on invalid building');
  });

  // ── 5. RETIRED building rejected ─────────────────────────────────────────
  await test('Reject electricity meter assignment to RETIRED building', async () => {
    let caught = false;
    try {
      await service.createMeter({ serialNumber: 'ELEC-OLD-001', buildingId: 'bld-retired', isActive: true }, 'actor-1');
    } catch (err: any) {
      caught = true;
      assert.strictEqual(err.statusCode, 400);
    }
    assert.ok(caught, 'Should throw 400 on RETIRED building');
  });

  // ── 6. Update electricity meter ───────────────────────────────────────────
  await test('Update electricity meter serial number', async () => {
    const meterId = metersStore[0].id;
    const updated = await service.updateMeter(meterId, { serialNumber: 'ELEC-ENG-001-UPDATED' }, 'actor-1');
    assert.strictEqual(updated?.serialNumber, 'ELEC-ENG-001-UPDATED');
  });

  // ── 7. Archive electricity meter ─────────────────────────────────────────
  await test('Archive electricity meter (sets isActive = false)', async () => {
    const meter = await service.createMeter({ serialNumber: 'ELEC-TEMP-001', isActive: true }, 'actor-1');
    const archived = await service.archiveMeter(meter.id, 'actor-1');
    assert.strictEqual(archived.isActive, false);
  });

  // ── 8. Archived meter rejects new readings ───────────────────────────────
  await test('Archived meter cannot receive new readings', async () => {
    const archivedMeter = metersStore.find((m) => !m.isActive);
    assert.ok(archivedMeter, 'Need an archived meter in store');
    let caught = false;
    try {
      await service.createReading(archivedMeter.id, { kwhConsumption: 100, readingTime: new Date() }, 'actor-1');
    } catch (err: any) {
      caught = true;
      assert.strictEqual(err.statusCode, 400);
    }
    assert.ok(caught, 'Should throw 400 on archived meter');
  });

  // ── 9. Create valid reading ───────────────────────────────────────────────
  await test('Create electricity reading for active meter', async () => {
    const meterId = metersStore[0].id;
    const reading = await service.createReading(meterId, { kwhConsumption: 250, readingTime: new Date() }, 'actor-1');
    assert.strictEqual(reading.kwhConsumption, 250);
    assert.strictEqual(reading.meterId, meterId);
  });

  // ── 10. electricity:reading_created event emitted ─────────────────────────
  await test('Verify electricity:reading_created event emitted', async () => {
    const evt = emittedEvents.find((e) => e.event === 'electricity:reading_created');
    assert.ok(evt, 'electricity:reading_created event must be emitted');
    assert.strictEqual(evt.payload.metadata?.kwhConsumption, 250);
  });

  // ── 11. Negative consumption rejected ────────────────────────────────────
  await test('Reject negative electricity consumption reading', async () => {
    const meterId = metersStore[0].id;
    let caught = false;
    try {
      await service.createReading(meterId, { kwhConsumption: -5, readingTime: new Date() }, 'actor-1');
    } catch (err: any) {
      caught = true;
      assert.strictEqual(err.statusCode, 400);
    }
    assert.ok(caught, 'Should throw 400 for negative consumption');
  });

  // ── 12. Future timestamp rejected ─────────────────────────────────────────
  await test('Reject electricity reading with future timestamp', async () => {
    const meterId = metersStore[0].id;
    const futureDate = new Date();
    futureDate.setFullYear(futureDate.getFullYear() + 1);
    let caught = false;
    try {
      await service.createReading(meterId, { kwhConsumption: 100, readingTime: futureDate }, 'actor-1');
    } catch (err: any) {
      caught = true;
      assert.strictEqual(err.statusCode, 400);
    }
    assert.ok(caught, 'Should throw 400 for future timestamps');
  });

  // ── 13. Reading history retrieval ─────────────────────────────────────────
  await test('Retrieve electricity reading history for a meter', async () => {
    const meterId = metersStore[0].id;
    const result = await service.getReadings(meterId, { page: 1, limit: 10, sortBy: 'readingTime', sortOrder: 'desc', from: undefined, to: undefined });
    assert.ok(result.data.length >= 1, 'Should return reading history');
    assert.ok(result.meta.pagination.total >= 1);
  });

  // ── 14. Latest reading retrieval ─────────────────────────────────────────
  await test('Retrieve latest electricity reading', async () => {
    const meterId = metersStore[0].id;
    const latest = await service.getLatestReading(meterId);
    assert.ok(latest !== undefined, 'Should return the latest reading');
  });

  // ── 15. Daily aggregation ─────────────────────────────────────────────────
  await test('Daily consumption analytics aggregation', async () => {
    const meterId = metersStore[0].id;
    const result = await service.getConsumptionAnalytics({
      meterId,
      groupBy: 'day',
      from: undefined,
      to: undefined,
    });
    assert.ok(Array.isArray(result), 'Daily analytics should return an array');
    if (result.length > 0) {
      assert.ok('period' in result[0], 'Each result must have a period key');
      assert.ok('consumption' in result[0], 'Each result must have a consumption key');
    }
  });

  // ── 16. Weekly aggregation ───────────────────────────────────────────────
  await test('Weekly consumption analytics aggregation', async () => {
    const meterId = metersStore[0].id;
    const result = await service.getConsumptionAnalytics({
      meterId,
      groupBy: 'week',
      from: undefined,
      to: undefined,
    });
    assert.ok(Array.isArray(result), 'Weekly analytics should return an array');
  });

  // ── 17. Monthly aggregation ──────────────────────────────────────────────
  await test('Monthly consumption analytics aggregation', async () => {
    const meterId = metersStore[0].id;
    const result = await service.getConsumptionAnalytics({
      meterId,
      groupBy: 'month',
      from: undefined,
      to: undefined,
    });
    assert.ok(Array.isArray(result), 'Monthly analytics should return an array');
  });

  // ── 18. Building aggregation ─────────────────────────────────────────────
  await test('Building-level electricity consumption aggregation', async () => {
    const result = await service.getConsumptionAnalytics({ groupBy: 'building', from: undefined, to: undefined });
    assert.ok(Array.isArray(result), 'Building analytics should return an array');
  });

  // ── 19. Meter-level aggregation ──────────────────────────────────────────
  await test('Meter-level electricity consumption aggregation', async () => {
    const result = await service.getConsumptionAnalytics({ groupBy: 'meter', from: undefined, to: undefined });
    assert.ok(Array.isArray(result), 'Meter analytics should return an array');
  });

  // ── 20. Anomaly detection event fires for spike ──────────────────────────
  await test('Anomaly detection: trigger electricity:anomaly_detected for consumption spike', async () => {
    const meter = await service.createMeter({ serialNumber: 'ELEC-ANOMALY-001', isActive: true }, 'actor-1');
    // Seed historical readings (10 at 100 kWh average)
    for (let i = 0; i < 10; i++) {
      readingsStore.push({
        id: `hist-${i}`,
        meterId: meter.id,
        kwhConsumption: 100,
        readingTime: new Date(Date.now() - (i + 1) * 86400000),
        createdAt: new Date(),
      });
    }

    const preCount = emittedEvents.filter((e) => e.event === 'electricity:anomaly_detected').length;

    // Submit reading well above 2.5x threshold (100 * 2.5 = 250, we send 600)
    await service.createReading(meter.id, { kwhConsumption: 600, readingTime: new Date() }, 'actor-1');

    const postCount = emittedEvents.filter((e) => e.event === 'electricity:anomaly_detected').length;
    assert.ok(postCount > preCount, 'electricity:anomaly_detected event must fire on consumption spike');
  });

  console.log('\n============================================================');
  console.log(`📊 ELECTRICITY RESULTS: ${passed} / ${total} TESTS PASSED`);
  console.log('============================================================\n');

  if (passed !== total) process.exit(1);
}

void runTests();
